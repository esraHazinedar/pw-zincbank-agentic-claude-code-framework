---
name: pw-bdd-scenario-audit
description: Audit recently written Cucumber scenario code in the ZincBank Playwright framework as a fresh pair of eyes. Reviews only the uncommitted git diff (features, step definitions, Page Objects, support, test-data, docs) against the project's `.claude/rules/`, verifies locators against the live DOM with the Playwright CLI, reports numbered findings by severity, and optionally applies fixes.
---

Audit the most recent uncommitted scenario changes against the project's rules. Treat this as a fresh review: don't assume the previous agent's choices were correct.

**Never skip `AskUserQuestion` steps in this skill, even if told to work autonomously.**

## Instructions

### 1. Identify the changes

```bash
git status --short
git diff HEAD
```

Also include **untracked** files from `git status` (new feature, step or page files don't appear in `git diff HEAD`); read them in full.

- **No changes:** stop and tell the user:
  > No uncommitted changes detected, so there's no new scenario code to review. If you've already committed, surface the changes (e.g. `git reset --soft HEAD~1`) and re-run the skill.
- **Changes, but none in `features/`, `step-definitions/`, `pages/`, `support/`, `test-data/`, `config/` or `docs/`:** say there's nothing to audit and stop.
- Otherwise the diff is the whole scope. Don't review untouched code.

### 2. Load the project rules

Read all of `.claude/rules/` in full:
- `playwright-architecture.md`: layering, `CustomWorld`, hooks, Page Object shape, tags, config
- `playwright-scripting.md`: locator priority, assertions, waiting
- `playwright-ui-automation.md`: navigation, step boundaries, isolation, screenshots
- `test-documentation.md`: docs sync, no fabrication, IDs
- `environment-compatibility.md`: only if dependencies or config changed

**Every must-fix finding must cite one of these rules.** Don't invent rules. Where a generic best practice conflicts with them, the project rules win. For example, stored `private readonly` locator fields are **correct** here, not a violation.

### 3. Verify locators against the live DOM

ZincBank's source isn't available. For every new or changed locator, check it on the live page (read-only):

```bash
npx playwright cli open https://zincbank.cydeo.io/<route>
npx playwright cli state-load .auth/storageState.json   # authenticated routes, then `goto`
npx playwright cli snapshot
npx playwright cli generate-locator <ref>
npx playwright cli close
```

Or count matches directly with a short Node script (`playwright` + `locator.count()`). Confirm each action locator matches **exactly one** element and is the highest-priority option available. Don't flag a locator as wrong without checking it. Never submit forms that change state.

### 4. Audit checklist

Walk every changed line. Record each violation with `file:line` and the rule it breaks.

**Architecture** (`playwright-architecture.md`, `playwright-ui-automation.md` §1–2)
- Dependency direction holds: features → steps → pages. Pages don't import steps; `config/` and `test-data/` import nothing from the framework.
- Step definitions use `async function (this: CustomWorld)`, never arrow functions.
- Steps contain no `this.page.goto`, `this.page.getBy…`, `this.page.locator`, `expect(...)`, hardcoded URLs or credentials.
- A Page Object is created only in the scenario's first `Given` and assigned on the World.
- A new Page Object has a typed property in `CustomWorld`.
- Per-scenario data lives on the World, not in module-level variables.
- Credentials and base URL come from `config` only; nothing reads `process.env` outside `config/environment.ts`.

**Page Objects** (`playwright-architecture.md` §5)
- `extends BasePage` and calls `super(page)`.
- Locators are `private readonly` fields assigned in the constructor, not created inside methods.
- Actions are `async`. Assertions live in `expect*`-named methods, using `expect` from `@playwright/test`.
- Navigation is the page's own `open(baseUrl)`; no hardcoded host.
- Reuse first: a near-duplicate of an existing method, or a third copy of a shared locator (e.g. `/^Welcome,/`), is a finding.

**Locators** (`playwright-scripting.md` §1)
- Priority: `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId` > CSS.
- No XPath, no `$()`/`$$()`, no bare `.nth()`/`.first()` without a comment. Repeated elements are scoped to a container.
- `{ exact: true }` or an anchored regex where one accessible name is a prefix of another.
- Verified against the live DOM in step 3.

**Assertions and waiting** (`playwright-scripting.md` §2–3, `playwright-ui-automation.md` §4)
- Every `expect` is awaited, and assertions are web-first (no `expect(await el.isVisible()).toBe(true)`).
- URLs are checked with regex, never full strings.
- No `waitForTimeout`, no `networkidle`, no redundant wait before an auto-waiting action.
- No custom timeouts unless justified by a debugged failure, and then under the 15 s step timeout.
- No visual assertions (`toHaveScreenshot` doesn't work under Cucumber).

**Gherkin and tags** (`playwright-architecture.md` §7)
- Steps are user-level: no locators, URLs or implementation detail.
- New step text doesn't duplicate or conflict with existing definitions. Run `npx cucumber-js --profile default --dry-run`; *undefined* or *ambiguous* steps are must-fix.
- Tags: `@smoke` or `@regression`; `@authenticated` if the scenario starts logged in. `login.feature` is never `@authenticated`.
- A ZTM ID is used as both the tag and the scenario-name prefix, and is never invented.

**Isolation and safety** (`playwright-ui-automation.md` §3)
- No dependency on other scenarios or on run order.
- A state-changing scenario either restores state or is kept out of `smoke`/`regression`. Nothing changes the shared account's password.
- Test data comes from Faker in `test-data/`. No account-specific values (name, balance, account number) in expectations.

**Docs sync** (`test-documentation.md` Rules 0, 3, 4, 6)
- A new or changed scenario has matching entries in `docs/test-cases/<feature>-test-cases.md` and `docs/RTM.md` **in the same diff**.
- RTM rows name real files, scenarios and methods. Confirm each with `grep`; a mismatch is must-fix.
- Recorded results and evidence come from a run in this session, never estimated. `ARCHITECTURE.md`'s route table is updated if a route gained its first scenario.

**Build**
- `npx tsc --noEmit` passes.

### 5. Report

One table per severity, with findings numbered sequentially across all tables:

```
## Audit summary
<one sentence: passes cleanly / minor issues / multiple violations>

## Findings — Must-fix
| # | Location | Issue | Fix |
|---|---|---|---|
| 1 | `LoginPage.ts:14` | <rule>: <evidence> | <fix> |

## Findings — Should-fix
| # | Location | Issue | Fix |

## Suggestions
| # | Location | Improvement | Suggested change |

## What looks good
- ...
```

- **Must-fix:** breaks a documented rule, or `tsc` / dry-run fails.
- **Should-fix:** a pattern the rules prefer, where the current code still works.
- **Suggestions:** style or readability, not codified.

Omit empty sections, keep each cell to one line, use backticks for code, and show only the filename and line in Location.

### 6. Offer next step

`AskUserQuestion`:
- Question: "Audit complete. What would you like to do?"
- Header: "Next step"
- Option 1: label "Apply must-fix", description "Resolve the must-fix findings only"
- Option 2: label "Apply all", description "Resolve must-fix and should-fix findings"
- Option 3: label "Discuss", description "Talk through findings before changing anything"

The user may pick finding numbers via "Other" (e.g. "apply 1, 3"); honor them exactly.

After applying fixes:

```bash
npx tsc --noEmit
npx cucumber-js --profile default --dry-run
TRACE=on npx cucumber-js --profile default --name "<regex for each affected scenario>"
```

If a scenario fails, debug it with the trace (`npx playwright trace open reports/traces/<slug>.zip`, then `actions` / `action <n>` / `snapshot <n> --name after` / `errors`) until it passes. If a fix changes coverage, update the docs in the same change. Leave everything uncommitted.

## Operating principles

- **Fresh eyes:** re-derive every locator from the live DOM, and question every choice.
- **Diff only:** never review or rewrite code outside the uncommitted changes.
- **Cite rules, not opinions:** opinions go under Suggestions.
- **Read-only exploration:** never submit state-changing forms while verifying.
- **Ask about intent:** if a finding depends on what the scenario was meant to do, ask.
