---
name: pw-bdd-new-scenario
description: Write a new Cucumber scenario for the ZincBank Playwright framework from user-provided test steps. Explores the live app with the Playwright CLI (`npx playwright cli`) because ZincBank's source code is not available, then writes the Gherkin feature, step definitions, and Page Object methods, runs the scenario with tracing, debugs it if needed, and updates docs/test-cases and docs/RTM.md. Use when the user asks to add, write, automate, or create a new test/scenario/feature for ZincBank.
---

Write a new Cucumber scenario for the provided test steps by exploring the live ZincBank app with the Playwright CLI.

Test steps: $ARGUMENTS

**Never skip `AskUserQuestion` steps in this skill, even if told to work autonomously.**

## Why the CLI

ZincBank (`https://zincbank.cydeo.io`) is an external app, so there is no application source to read and you can't add `data-testid` attributes. Locators come from the live DOM via `npx playwright cli`, which is built into the installed Playwright. It is **not** the separate `playwright-cli` package; don't install that.

## Instructions

### 1. Read the rules and the existing suite

Read all rule files in `.claude/rules/` first. The scenario must comply with every one:
- `playwright-architecture.md`: layering, `CustomWorld`, hooks, Page Object shape, tags
- `playwright-scripting.md`: locator priority, assertions, waiting
- `playwright-ui-automation.md`: navigation, what steps may touch, isolation
- `test-documentation.md`: no fabrication, docs structure, IDs
- `environment-compatibility.md`: runtime constraints

Then review what exists so you reuse instead of duplicating:
- `features/*.feature`: is this behavior already covered? Which feature file does it belong in?
- `step-definitions/*.steps.ts`: **reuse existing step text wherever it fits.** Two definitions matching the same text cause a Cucumber *ambiguous step* error.
- `pages/*.ts`: existing Page Objects and methods. Extend or parametrize before adding new ones.
- `support/world.ts`: registered Page Objects.
- `docs/RTM.md` and `docs/test-cases/`: existing case keys, ZTM IDs, and "identified, not yet observed" items.

If the steps duplicate an existing scenario, tell the user and stop.

### 2. Safety check before touching the live app

Classify the flow using `test-documentation.md` Rule 5 and `playwright-ui-automation.md` §3:
- **Read-only** (viewing pages, navigating, invalid-input validation that doesn't submit successfully): OK to explore.
- **State-changing** (creating an account, transfers or bill pay, scheduled payments, changing the password, opening a savings account): **stop and ask** before exploring or running. Agree with the user how the scenario restores state, or which separate tag keeps it out of `smoke`/`regression`. **Never** change the shared account's password.

### 3. Explore the live app with the Playwright CLI

```bash
npx playwright cli open https://zincbank.cydeo.io/<route>
# authenticated routes: load the saved session, then navigate
npx playwright cli state-load .auth/storageState.json   # run `npm test` first if .auth/ is missing
npx playwright cli goto https://zincbank.cydeo.io/<route>

npx playwright cli snapshot                  # element refs (e12, e15, …); saved under .playwright-cli/
npx playwright cli click <ref>
npx playwright cli fill <ref> "<text>"
npx playwright cli select <ref> "<value>"
npx playwright cli check <ref>
npx playwright cli generate-locator <ref>    # Playwright locator for an element
npx playwright cli close                     # always close; `npx playwright cli list` should show "(no browsers)"
```

Walk the flow step by step, keeping a list of which ref is which logical element. Run `generate-locator` for every element you will interact with or assert on.

**`generate-locator` is a starting point.** It often returns `getByTestId(...)`, because ZincBank has `data-testid` attributes (e.g. `login-email-input`). Re-pick each locator using the priority in `playwright-scripting.md` (`getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId` > CSS), using the role and accessible name from the snapshot. Check that each locator matches exactly one element.

Record what you observed (texts, URLs, validation messages). That is your evidence for the docs.

### 4. Write the code

Follow the architecture exactly:

1. **Page Object** (`pages/<Name>Page.ts`, extends `BasePage`):
   - Locators are `private readonly` fields assigned in the constructor.
   - Actions are `async` methods.
   - Assertions are `expect*` methods using `expect` from `@playwright/test`.
   - Navigation is `open(baseUrl)` for its own route.
   - Add a web-first wait inside an action only where the UI updates asynchronously.
2. **World** (new Page Object only): add a typed `<name>Page!: <Name>Page` to `CustomWorld`.
3. **Step definitions** (`step-definitions/<domain>.steps.ts`):
   - Use `async function (this: CustomWorld)`, never arrow functions.
   - Call only Page Object methods and `config` / `test-data`.
   - Assign the Page Object in the first `Given`.
4. **Feature** (`features/<domain>.feature`):
   - User-level Gherkin with no locators or URLs.
   - Tags: `@smoke` or `@regression`, plus `@authenticated` if it starts logged in.
   - If the user gave a ZTM ID, use it as the tag and the scenario-name prefix (`@ZTM-12` / `Scenario: ZTM-12: …`). **Never invent a ZTM ID.**
5. **Test data:** Faker generators in `test-data/`, never inline.

First-draft constraints:
- No custom timeouts. The defaults apply (5 s expect, 15 s step); raise one only as a debugging fix backed by a trace.
- No `waitForTimeout`, no hardcoded URLs or credentials, and no account-specific values (name, balance, account number) in expectations.

Then validate:

```bash
npx tsc --noEmit
npx cucumber-js --profile default --dry-run    # catches undefined and ambiguous steps
```

Both must pass before continuing.

### 5. Ask to run or adjust

`AskUserQuestion`:
- Question: "Scenario is ready. What would you like to do next?"
- Header: "Next step"
- Option 1: label "Run the scenario", description "Execute it with tracing and debug if it fails"
- Option 2: label "Something else", description "Tell me what you'd like to change"

### 6. Run it

```bash
TRACE=on npx cucumber-js --profile default --name "<regex matching the scenario title>"
```

(`--name` is a regex; escape special characters. `0 scenarios` means the selector didn't match.)

- **Passes:** go to step 8.
- **Fails:** go to step 7.

### 7. Debug with the trace

The run prints `Trace saved: reports/traces/<slug>.zip`, and a screenshot is at `screenshots/failed-<slug>.png`.

```bash
npx playwright trace open reports/traces/<slug>.zip
npx playwright trace actions                    # ✗ marks the failure
npx playwright trace action <n>
npx playwright trace snapshot <n> --name after
npx playwright trace errors
npx playwright trace close
```

Use `npx playwright trace` (CLI), **never** `show-trace` (GUI, which blocks). If the trace isn't enough, re-open a CLI session on the failing route and re-check the live DOM.

Report the root cause, the evidence and the failing `path:line`. Fix per the rules (Page Object first), then re-run step 6. If ZincBank itself is broken, tell the user rather than bending the scenario around it. Repeat until it passes or needs user input.

### 8. Confirm

`AskUserQuestion`:
- Question: "Scenario passed. Does it meet your expectations?"
- Header: "Finalize"
- Option 1: label "Looks good", description "Finalize and update the docs"
- Option 2: label "Needs changes", description "Tell me what should be adjusted"

On **Needs changes**, apply the changes and repeat from step 6.

On **Looks good**:
1. Remove any temporary debugging comments or code you added. Keep comments that explain a non-obvious *why*.
2. Run the normal suite once, `npm test`, so the recorded result reflects the real run, not only the traced one.
3. **Update the docs in the same change** (`test-documentation.md`):
   - `docs/test-cases/<feature>-test-cases.md`: new case key (next free `<FEATURE>-NN`), type, priority, expected result, and evidence from what you observed in step 3 and the run in this session.
   - `docs/RTM.md`: row with the feature file, scenario, tags, step file and Page Object methods, plus today's result.
   - If this is a route's first automated scenario, update `ARCHITECTURE.md`'s route table too.
   - Remove the item from "Identified, not yet observed" if it was listed there.

### 9. Offer to commit

`AskUserQuestion`:
- Question: "Should I commit the new scenario?"
- Header: "Commit"
- Option 1: label "Yes, commit", description "Stage the changes and create a commit"
- Option 2: label "No", description "Skip the commit"

On **Yes**, review `git status` / `git diff`, stage only the relevant files (never `.env`, `.auth/`, `reports/`, `screenshots/`, `.playwright-cli/`), and commit in the style of `git log`.
