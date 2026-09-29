# Architecture

## Purpose

A Playwright + Cucumber BDD UI automation framework, TypeScript, Page Object Model, targeting [ZincBank](https://zincbank.cydeo.io) — a simulated bank built for QA education (no real money/accounts).

## Dependency Direction

```text
Feature (.feature)
   ↓
Step Definition (step-definitions/*.steps.ts)
   ↓
Page Object (pages/*.ts)
   ↓
Playwright
```

`config/` and `test-data/` are leaf dependencies — read by any layer, depend on nothing in the framework. `support/` (World, hooks, browser lifecycle, auth setup) sits beside this chain: it feeds step definitions a ready `page`/`context`/`browser`, but contains no test logic itself.

## Layers

| Layer | Responsibility | Never does |
|---|---|---|
| `features/*.feature` | Business-readable Gherkin scenarios | Reference locators, implementation detail |
| `step-definitions/*.steps.ts` | Translate Gherkin steps into Page Object calls | Touch `this.page` directly, hold locators |
| `pages/*.ts` | Locators + UI actions/assertions for one page/flow | Reference Gherkin, other Page Objects' internals |
| `support/world.ts` | Typed Cucumber World: `page`, `context`, `browser`, Page Object instances | Business/test logic |
| `support/hooks.ts` | Browser/context lifecycle, failure screenshots, Playwright tracing | Locators, assertions |
| `support/authSetup.ts` | One-time real login → saved `storageState` | Run on every scenario (only when state is stale/missing) |
| `config/environment.ts` | Reads `.env`, exposes typed config | Scatter `process.env.X` elsewhere in the codebase |
| `test-data/*.ts` | Non-secret data generation (Faker) | Hold credentials/secrets |
| `utils/*.ts` | Small, genuinely generic helpers | Become a dumping ground |

## Cucumber World & Hooks (the "fixtures" equivalent)

This project uses Cucumber, not `@playwright/test`, so there's no `test.extend()` fixture system. The equivalent role is filled by:

- **`CustomWorld`** (`support/world.ts`) — one instance per scenario, extends Cucumber's `World`, exposes strongly-typed `browser`, `context`, `page`, and lazily-assigned Page Objects (`loginPage`, `applyPage`, `dashboardPage`).
- **`BeforeAll`/`AfterAll`** (`support/hooks.ts`) — one `Browser` launched for the entire run.
- **`Before`/`After`** — fresh `BrowserContext` + `Page` per scenario (test isolation). For `@authenticated` scenarios, `Before` first calls `ensureAuthenticatedState()` (30s timeout — real network login, not the 5s Cucumber default). `After` captures a full-page screenshot on failure and always closes the context.

## Authenticated Sessions (storageState)

Problem: repeating the full login UI flow for every scenario that needs to be logged in is slow and redundant.

Solution: `support/authSetup.ts` performs one real login (only when an `@authenticated` scenario runs and no saved state exists yet) and persists Playwright's `storageState` to `.auth/storageState.json` (gitignored — same sensitivity class as `.env`, since it holds session cookies). Any scenario tagged `@authenticated` gets a `BrowserContext` pre-loaded with that state in the `Before` hook, skipping the login screen entirely.

`login.feature` is deliberately **not** tagged `@authenticated` — it exists to test the real sign-in flow, so it must always start unauthenticated.

To force re-authentication (stale session, changed account): `rm -rf .auth`.

## Test Data & Secrets

- **Credentials** (`BASE_URL`, `USERNAME`, `PASSWORD`) live only in `.env` (gitignored), read through `config/environment.ts`. Never hardcoded.
- **Fail fast, lazily:** `config` validates each value when it is first read and throws a clear error naming the missing variable. Validation happens on access, not at import, so the `@signup` run works on a fresh checkout before credentials exist.
- **Signup flow** (`features/signup.feature`) generates a fresh Faker-based identity, submits ZincBank's real `/apply` wizard, and — on success — writes the resulting credentials into `.env` at runtime via `utils/envWriter.ts`. This happens inside the Node process during a test run, not via direct file edits.
- **Non-secret test data** (e.g. `test-data/signupData.ts`) is separate from `config/` — config is environment-sourced, test-data is generated/fixture data.

## Reporting & Diagnostics

- `cucumber.js` defines profiles (`default`, `smoke`, `regression`, all excluding `@signup`; plus `signup`, the only one that runs it) and wires three formatters: console progress, `reports/cucumber-report.json`, `reports/cucumber-report.html`.
- Tags: `@smoke`, `@regression`, `@signup`, `@authenticated`, plus traceability tags like `@ZTM-5` linking a scenario back to an external test-management ticket (e.g. TestRail/Jira).
- Failure screenshots: `screenshots/failed-<scenario-name>.png`, attached to the Cucumber report automatically.
- Playwright traces: controlled by `TRACE` (`retain-on-failure` default, `on`, `off`; read via `config.trace`), saved to `reports/traces/<scenario-name>.zip`. Inspect with `npx playwright trace open …` (CLI; `show-trace` is a blocking GUI).

## Known Application Surface (ZincBank)

Discovered by read-only inspection (no data submitted beyond what's noted); informs future test coverage, not yet all automated.

| Route | Purpose | Automated? |
|---|---|---|
| `/login` | Email + password sign-in | Yes (`login.feature`) |
| `/apply` | 6-step account-opening wizard (accounts → personal → identity(simulated) → address → password → review/submit) | Yes (`signup.feature`) |
| `/dashboard` | Landing page post-login: balance summary, accounts list | Yes (`dashboard.feature`, via `@authenticated`) |
| `/accounts` | Account list, "Open savings account" action | No |
| `/move-money` | Transfer between own accounts, pay a bill (add payee by email), scheduled payments | No |
| `/transactions` | Per-account transaction history, date-range filter, statement download | No |
| `/cards` | Card management (only a "Zinc Credit Card" surface seen) | No |
| `/profile` | Change password | No |

Not yet explored: validation/error states on any form (invalid login, failed transfer, weak password on signup), the savings account flow, bill-pay recipient flow, and card details.

## Conventions

- Locators prefer `getByRole` > `getByLabel` > `getByPlaceholder`/`getByText` > CSS. ZincBank's `/login` fields have properly associated `<label>`s (`getByLabel('Email')`, `getByLabel('Password')`, verified against the live DOM on 2026-09-29). An earlier note claimed the email label was broken; that is no longer true. The app also exposes `data-testid` attributes (e.g. `login-email-input`), which rank below semantic locators.
- No `page.waitForTimeout()` in framework code — rely on Playwright's auto-waiting and `expect(...)` polling.
- One Page Object per page/flow; step definitions never hold locators.
- `npx tsc --noEmit` must pass before any scenario is considered done.
