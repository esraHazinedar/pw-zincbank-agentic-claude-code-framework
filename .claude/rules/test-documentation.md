---
name: test-documentation
description: Defines how test case catalogs, the RTM, and the coverage report are created and kept in sync with the ZincBank Cucumber suite
paths: [docs/**, features/**, step-definitions/**, pages/**]
---

# Test Documentation Rules

These rules govern `docs/` and how it relates to `features/`, `step-definitions/`, and `pages/`.

## 0. Zero fabrication (non-negotiable)

Nothing in `docs/test-cases/*.md`, `docs/RTM.md`, or `docs/coverage/*.html` may describe a test case, mapping, result, or piece of evidence that wasn't actually verified. Concretely:

- A test case is only documented if the behavior it describes was actually observed, either in a scenario that exists right now or directly on the live app (`zincbank.cydeo.io`).
- An RTM row marked "Automated" must name a real feature file, scenario name, tag, step definition file, and Page Object method. Confirm each with `grep`/`Read` in the same session the row is written, not from memory of an earlier session.
- Pass/fail results must come from a Cucumber run executed in that session (`npm test`, or a named profile/tag), read from its console output or `reports/cucumber-report.json`. Never estimate them, and never carry them forward from an earlier run.
- "Evidence" describes something actually done: a real inspection of the live DOM, a real run, a real failure screenshot from `screenshots/`. Never write a plausible description of what evidence would look like.
- If something can't be verified, the doc says so explicitly ("not verified this run", "unconfirmed"). An honest gap is always better than a confident fabrication.
- Don't record account-specific data (names, balances, account numbers, emails) as expected results or evidence. The test account is replaced whenever `npm run signup` runs. Describe the pattern (e.g. "heading matches `/^Welcome,/`").

## 1. Before adding a test, check the whole repo first

Search the existing suite for coverage of the same **component**, not just the same page:

- **Scenarios:** `grep -rn "<phrase>" features/`
- **Step text:** `grep -rn "<phrase>" step-definitions/`. Cucumber fails with an *ambiguous step* error if two definitions match the same text, so reuse an existing step before writing a new one.
- **Locators/methods:** `grep -rn "<accessible name>" pages/`

Shared UI must be covered **once**, not per page it appears on. Known shared components in ZincBank:

- The top navigation bar (Dashboard, Accounts, Move money, Transactions, Cards, theme toggle, Sign out) appears on every authenticated page.
- The `Welcome, <name>` heading is already located identically in both `LoginPage` and `DashboardPage` (`getByRole('heading', { name: /^Welcome,/ })`). Don't add a third copy. If another page needs it, move it to a shared place first.

Grep for the exact string before calling something a gap, and record the grep as evidence in the test case entry.

## 2. Only automate critical, business-relevant behavior

For a banking app, automate:

- **Authentication:** sign-in, sign-out, session reuse, and invalid-credential handling.
- **Account opening:** the `/apply` wizard, plus its validation where it protects data quality.
- **Money movement:** transfers between own accounts, bill pay, and scheduled payments on `/move-money`.
- **Account visibility:** balances and accounts list on `/dashboard` and `/accounts`, and transaction history and filters on `/transactions`.
- **Security settings:** changing the password on `/profile`.

Decorative or low-risk behavior (the light/dark theme toggle, empty-state styling such as "No activity yet.", layout and spacing) is still documented in the test case catalog for completeness. Mark it **Not automated** with a one-line business rationale, and never drop it silently.

## 3. `docs/` structure

| Path | Contents |
|---|---|
| `docs/test-cases/<feature>-test-cases.md` | Every identified requirement for one feature, matching the feature file name (`login`, `signup`, `dashboard`, …). Each case has an ID, type (happy / negative / edge / navigation / recovery / UI state), priority, observed evidence, and automation status. |
| `docs/RTM.md` | Requirement Traceability Matrix: one row per test case (see below). |
| `docs/coverage/<feature>-coverage-report.html` | Living HTML coverage report (see Rule 4). |

**Don't name a folder `docs/reports/`.** `.gitignore` contains `reports/`, which matches at any depth, so that folder would be silently left out of git.

### Test case IDs and tags

- Every case has a doc-local key `<FEATURE>-NN` (e.g. `SIGNIN-01`, `DASH-03`, `SIGNUP-02`), used to cross-reference the catalog and the RTM. Never renumber an existing key.
- The **ZTM ID** (`ZTM-<n>`, e.g. `ZTM-5`) comes from the external test-management system. **Never invent one.** Until it is assigned, write "Unassigned".
- Once a case has a ZTM ID, its scenario must carry that ID as a Cucumber tag **and** as a prefix of the scenario name:

  ```gherkin
  @smoke @ZTM-5
  Scenario: ZTM-5: successful sign-in redirects to the dashboard
  ```

- Before adding a new doc-local key, grep `docs/` for the highest existing number for that feature so keys are never reused.

### RTM columns

| Column | Example |
|---|---|
| Case | `SIGNIN-01` |
| ZTM ID | `ZTM-5` (or "Unassigned") |
| Requirement | Registered user can sign in and land on the dashboard |
| Feature file | `features/login.feature` |
| Scenario | `ZTM-5: successful sign-in redirects to the dashboard` |
| Tags | `@smoke @ZTM-5` |
| Step definitions | `step-definitions/login.steps.ts` |
| Page Object methods | `LoginPage.open()`, `enterUsername()`, `enterPassword()`, `clickLogin()`, `expectLoginSuccess()` |
| Status | Automated / Not automated (reason) / Not yet automated |

If a scenario doesn't exist yet, the row says **Not yet automated**. Never write an aspirational mapping.

`docs/` is committed to git. It is living documentation, unlike the generated `reports/` (Cucumber JSON/HTML) and `screenshots/`, which stay gitignored.

## 4. The HTML coverage report is living, not a snapshot

Update `docs/coverage/*.html` **in the same change** whenever the underlying automation changes: a scenario added or removed, a tag changed, or a coverage status changed. It describes the current state of coverage, not a diary of a past session.

- The run results it shows must come from a run in that same session (Rule 0), with the date and command used (e.g. `npm test`, 2026-09-29).
- `@signup` results are shown only if `npm run signup` was actually run in that session. Otherwise mark it "not run this session" (it creates a real account, so it is not part of routine runs).
- If a report can't be updated in a given change, say so explicitly rather than letting it go stale.

## 5. Evidence gathering on the live app must be safe

ZincBank is a shared live site and the test account is real, so exploring the app to document behavior follows these limits:

- **Read-only by default.** Loading pages, reading the DOM, and moving between wizard steps without submitting are fine.
- **Anything that changes state needs the user's explicit go-ahead first:** submitting `/apply` (creates an account), transfers or bill pay, scheduled payments, changing the password, or opening a savings account.
- Verify a suspicious result independently before documenting it as a defect. Re-check the live DOM, re-run the scenario, and confirm it isn't a locator or timing problem in the framework. Example of why this matters: an earlier note recorded the `/login` email label as broken, but re-checking the live DOM on 2026-09-29 showed it correctly associated.

## 6. Keep `ARCHITECTURE.md` in sync

The **Known Application Surface** table in `ARCHITECTURE.md` (route → Automated?) and `docs/RTM.md` must agree. When a route gets its first automated scenario, update both in the same change.
