---
name: pw-bdd-debug-scenario
description: Debug a failing or flaky Cucumber scenario in the ZincBank Playwright framework. Re-runs the single scenario with Playwright tracing forced on (TRACE=on), analyzes the trace with the `npx playwright trace` CLI, classifies the root cause (test bug / app bug / environment), and fixes it in the Page Object or step definition following the project rules. Use when the user says a scenario/feature/step is failing, broken, flaky, or asks why a Cucumber run failed in this project.
---

# Debug a Failing Cucumber Scenario

You are debugging a scenario in this Cucumber + Playwright framework (not the Playwright Test runner, so there is no `npx playwright test`, `--trace` flag, or `test-results/`). Tracing is built into `support/hooks.ts` and controlled by the `TRACE` env var:

| `TRACE` | Behavior |
|---|---|
| `retain-on-failure` (default) | Trace recorded for every scenario, saved only when it fails |
| `on` | Trace saved for every scenario |
| `off` | No tracing |

Traces are saved to `reports/traces/<scenario-name-slug>.zip` (a `Trace saved: …` line is printed). A failure screenshot is saved to `screenshots/failed-<scenario-name-slug>.png`. Both folders are gitignored, and each run overwrites the previous file for the same scenario.

**Never skip `AskUserQuestion` steps in this skill, even if told to work autonomously.**

## Step 0: Confirm the scenario

The user must name the scenario, either its `Scenario:` title, a unique keyword from it, or a tag such as `@ZTM-5`. If they didn't, **stop and ask**:

> Which scenario should I debug? Please paste the `Scenario:` title, a unique keyword from it, or its tag (e.g. `@ZTM-5`).

Don't guess, and don't run the whole suite to find a failure.

## Step 1: Find the scenario and read its code path

1. `grep -rn "Scenario:.*<keyword>" features/` (or grep the tag). If there are several matches, list them and ask. If there are none, say so and stop.
2. Read the feature file, then the matching step definitions in `step-definitions/`, then every Page Object method those steps call in `pages/`. You need the full path from Gherkin step to locator before running anything.
3. Read the project rules: `.claude/rules/playwright-architecture.md`, `playwright-scripting.md`, `playwright-ui-automation.md`. The fix must comply with them.
4. **Safety check.** If the scenario is tagged `@signup`, or otherwise changes state on the live site (creates accounts, moves money, changes the password), **stop and ask** before running it. `@signup` creates a real account and rewrites `.env`. It is also excluded from the `default` profile, so it only runs via `--profile signup`.

## Step 2: Run the single scenario with tracing forced on

```bash
TRACE=on npx cucumber-js --profile default --name "<regex matching the scenario title>"
```

- `--name` is a regex, so escape regex characters in the title (`(`, `)`, `.`, `?`, `+`, `*`, `[`, `]`).
- Or select by tag: `--tags @ZTM-5`. Tags are ANDed with the profile's `not @signup`.
- If Cucumber reports `0 scenarios`, the name/tag didn't match. Fix the selector; don't fall back to the full suite.
- Add `HEADLESS=false` only if the user wants to watch; it doesn't change the trace.

Read the output:

- **Passes:** say so and note it may be flaky. To quantify, re-run it up to 5 times in one loop and report the pass count, e.g. `for i in 1 2 3 4 5; do npx cucumber-js --profile default --name "<regex>" 2>&1 | grep -E "^[0-9]+ scenario"; done`. If every run passes, stop; don't open a trace for a passing run. If one fails, continue with that run's trace (default `retain-on-failure` keeps it).
- **Fails:** capture the error message, the failing step, the stack frame in `pages/` or `step-definitions/`, and the `Trace saved:` path.

## Step 3: Analyze the trace with the CLI

**Use `npx playwright trace` (CLI), never `npx playwright show-trace`,** which opens a GUI and blocks.

```bash
npx playwright trace open reports/traces/<slug>.zip
npx playwright trace actions                    # failing action marked ✗
npx playwright trace action <n>                 # error, expected vs received, timeout
npx playwright trace snapshot <n> --name after  # DOM at failure (--name before for the prior state)
npx playwright trace errors                     # errors with stack traces (points to pages/*.ts lines)
npx playwright trace requests                   # if data/API/slow response is suspected
npx playwright trace console                    # page-side JS errors
npx playwright trace close
```

Also `Read` the failure screenshot `screenshots/failed-<slug>.png`. It shows the rendered page at the moment of failure.

If the trace suggests the live DOM differs from what the locator expects, confirm it on the live page (read-only) with the Playwright CLI:

```bash
npx playwright cli open https://zincbank.cydeo.io/<route>
npx playwright cli snapshot
npx playwright cli generate-locator <ref>
npx playwright cli close
```

For authenticated routes, load the saved session first: `npx playwright cli state-load .auth/storageState.json`, then `goto`.

## Step 4: Report findings

- **Scenario:** feature file path and exact `Scenario:` title
- **Failing step:** the Gherkin step, and the code line in `path:line` form (usually in `pages/`)
- **Root cause:** locator no longer matches, assertion mismatch, step timeout, network failure, stale session, missing env var, etc.
- **Evidence:** error text, expected vs received, what the snapshot or screenshot showed
- **Classification:** exactly one of the following:
  - **Test bug:** wrong or ambiguous locator, missing wait on an async UI change, wrong expectation.
  - **App bug:** ZincBank is genuinely broken. Don't weaken the test to hide it; tell the user and suggest documenting it per `test-documentation.md`.
  - **Environment:** `.env` missing a value (the `config` error names it), expired or stale `.auth/` (`rm -rf .auth`), a site outage, or the wrong Node or browser version (see `environment-compatibility.md`).

## Step 5: Apply the fix

If the cause is clear and lives in the framework, fix it where the rules say it belongs:

- **Locators and assertions:** in the Page Object (`private readonly` field set in the constructor, `expect*` method).
- **Waiting for async UI:** a web-first assertion inside the Page Object action (see how `ApplyPage.continueToNextStep()` waits for the next step).
- **Step wiring:** in the step definition, which only calls Page Object methods.

**Forbidden fixes:** `page.waitForTimeout()`, `{ force: true }`, blanket timeout increases, or loosening an assertion to hide an app bug. Raise a single assertion's timeout only if the trace proves the default was genuinely insufficient, and keep it under the 15 s step timeout.

Then verify:

```bash
npx tsc --noEmit
npx cucumber-js --profile default --name "<regex>"   # normal run, default tracing
```

For a flaky scenario, re-run it 3–5 times before calling it fixed. If the fix isn't clear-cut, such as an app bug, an ambiguous cause, or the environment, explain the situation and propose next steps rather than guessing.

Leave changes uncommitted for the user to review. If the fix changes coverage, the docs must be updated in the same change (`test-documentation.md` Rule 4).
