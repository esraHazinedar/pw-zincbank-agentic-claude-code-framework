# ZincBank UI Automation Framework

A Playwright + Cucumber BDD UI automation framework using TypeScript and the Page Object Model, targeting [ZincBank](https://zincbank.cydeo.io) — a simulated bank for QA education.

## Tech Stack

- **Playwright** — browser automation
- **TypeScript** — language
- **Cucumber** (`@cucumber/cucumber`) — BDD feature files and step definitions
- **Page Object Model** — UI abstraction (`pages/`)
- **Faker** (`@faker-js/faker`) — test data generation for the signup flow

## Project Structure

```text
features/            Gherkin scenarios (login.feature, signup.feature, dashboard.feature)
step-definitions/     Glue code connecting Gherkin steps to Page Objects
pages/                Page Object Model (BasePage, LoginPage, ApplyPage, DashboardPage)
support/              Cucumber World, browser lifecycle, hooks, authenticated session setup
config/               Centralized environment configuration
test-data/            Test data generation (Faker-based signup data)
utils/                Small shared helpers (envWriter)
reports/              Generated JSON/HTML test reports (gitignored)
screenshots/          Failure screenshots (gitignored)
.auth/                Saved Playwright storageState (session cookies, gitignored)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Install the Playwright browser binary (one-time)

```bash
npx playwright install chromium
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```text
BASE_URL=https://zincbank.cydeo.io
USERNAME=
PASSWORD=
```

`USERNAME`/`PASSWORD` must be a real, registered ZincBank account. If you don't have one yet, leave them blank and use the signup flow to create one (see below) — it will populate `.env` for you automatically.

## Creating a Test Account (Signup)

ZincBank is a simulated bank; running the signup scenario creates a real (simulated) account and writes its generated credentials into `.env` automatically.

```bash
npm run signup
```

`@signup` is excluded from every other profile (`npm test`, `test:smoke`, `test:regression`), so it only runs when you ask for it.

This runs through all 6 steps of the `/apply` wizard with Faker-generated data (name, email, phone, simulated SSN, address, password) and submits the application. On success, `USERNAME`, `PASSWORD`, and `BASE_URL` are written to `.env` via `utils/envWriter.ts`.

Run this only when you need a fresh account — it creates a new one every time.

## Authenticated Sessions (storageState)

Scenarios that need to start already logged in don't have to drive the login UI every time. The first time an `@authenticated` scenario runs, `support/hooks.ts` (`Before`) performs a one-time real login and saves the session to `.auth/storageState.json` via `support/authSetup.ts`. Subsequent runs reuse that file and skip logging in again — it's only regenerated if `.auth/storageState.json` is missing (e.g. after deleting it, or on a clean checkout).

Tag a scenario `@authenticated` to give it a browser context pre-loaded with that saved session:

```gherkin
@authenticated
Scenario: Reuse a stored session instead of logging in again
  Given I have a stored authenticated session
  When I navigate directly to the dashboard
  Then I should see my account dashboard
```

`features/dashboard.feature` is a working example of this. `features/login.feature` intentionally does **not** use `@authenticated` — it exists specifically to test the real sign-in flow.

To force a fresh login (e.g. after the stored session expires, or the account changes), delete the saved session and rerun:

```bash
rm -rf .auth
```

## Running Tests

```bash
npm test               # run all scenarios except @signup
npm run test:smoke     # run scenarios tagged @smoke
npm run test:regression # run scenarios tagged @regression
npm run test:debug     # run with PWDEBUG=1 for step-by-step debugging
```

Run a specific tag directly:

```bash
npx cucumber-js --profile default --tags @ZTM-5
```

### Running with a visible browser

By default the browser runs headless. To watch it run:

```bash
HEADLESS=false npm run test:smoke
```

### Playwright traces

Every scenario is traced. By default (`TRACE=retain-on-failure`) the trace is kept only when the scenario fails, at `reports/traces/<scenario-name>.zip`, next to the failure screenshot. Set `TRACE=on` to keep traces for passing scenarios too, or `TRACE=off` to disable tracing.

```bash
TRACE=on npx cucumber-js --profile default --name "ZTM-5"
npx playwright trace open reports/traces/ztm-5-successful-sign-in-redirects-to-the-dashboard.zip
npx playwright trace actions   # then: action <n>, snapshot <n> --name after, errors, close
```

## Reports

Each run generates:

- Console output (progress format)
- `reports/cucumber-report.json`
- `reports/cucumber-report.html`

Open `reports/cucumber-report.html` in a browser after a run to see a readable pass/fail breakdown per feature and scenario.

## Screenshots on Failure

When a scenario fails, a full-page screenshot is automatically captured to `screenshots/failed-<scenario-name>.png` and attached to the Cucumber report.

## Adding New Tests

1. Add a scenario to a `.feature` file (or create a new one) under `features/`.
2. If the scenario needs to start already logged in, tag it `@authenticated` instead of adding login steps.
3. Implement any new steps in `step-definitions/`, delegating UI interaction to a Page Object.
4. Add or extend a Page Object in `pages/` — locators and actions live there, never in step definitions.
5. Run `npx tsc --noEmit` to type-check, then run the scenario to verify.
