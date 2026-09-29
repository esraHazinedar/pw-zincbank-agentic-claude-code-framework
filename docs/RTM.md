# Requirement Traceability Matrix

Last updated: 2026-09-29. Mappings were confirmed with `grep` against `features/`, `step-definitions/` and `pages/` on that date. Results come from `npm test` at 13:53 the same day.

## Automated

| Case | ZTM ID | Requirement | Feature file | Scenario | Tags | Step definitions | Page Object methods | Last result |
|---|---|---|---|---|---|---|---|---|
| SIGNIN-01 | ZTM-5 | Registered user can sign in and land on the dashboard | `features/login.feature` | `ZTM-5: successful sign-in redirects to the dashboard` | `@smoke @ZTM-5` | `step-definitions/login.steps.ts` | `LoginPage.open()`, `enterUsername()`, `enterPassword()`, `clickLogin()`, `expectLoginSuccess()` | Passed 2026-09-29 |
| SIGNIN-02 | ZTM-6 | Wrong password is rejected with a generic error | `features/login.feature` | `ZTM-6: wrong password shows a generic error` | `@regression @ZTM-6` | `step-definitions/login.steps.ts` | `LoginPage.open()`, `enterUsername()`, `enterPassword()`, `clickLogin()`, `expectGenericLoginError()` | Passed 2026-09-29 |
| DASH-01 | Unassigned | Stored session opens the dashboard without the login UI | `features/dashboard.feature` | `Reuse a stored session instead of logging in again` | `@authenticated @regression` | `step-definitions/dashboard.steps.ts` | `DashboardPage.openDirectly()`, `expectDashboardVisible()` | Passed 2026-09-29 |
| SIGNUP-01 | Unassigned | Visitor can complete the 6-step application and open a checking account | `features/signup.feature` | `Open a new checking account` | `@signup` | `step-definitions/signup.steps.ts` | `ApplyPage.open()`, `chooseCheckingAccount()`, `continueToNextStep()`, `fillPersonalDetails()`, `fillIdentityDetails()`, `fillAddressDetails()`, `setPassword()`, `acceptTermsAndSubmit()`, `expectApplicationSubmitted()` | Not run this session (creates a real account) |
| SIGNUP-03 | Unassigned | Continue advances the wizard one step | `features/signup.feature` | Covered within `Open a new checking account` | `@signup` | `step-definitions/signup.steps.ts` (`I continue to the next step`) | `ApplyPage.continueToNextStep()` → `expectOnStep()` | Steps 1→2 verified live 2026-09-29; full run not done |

## Not yet automated / not automated

| Case | Requirement | Status | Reason |
|---|---|---|---|
| DASH-02 | Dashboard shows total deposit balance and accounts list | Not yet automated | No scenario exists |
| DASH-03 | Navigation bar links to all main sections | Not yet automated | No scenario exists. Shared component: automate once |
| DASH-04 | Recent activity empty state | Not automated | Cosmetic, low business risk |
| DASH-05 | Theme toggle | Not automated | Decorative, no business impact |
| SIGNUP-02 | Checking selected by default on step 1 | Not yet automated | Observed but not asserted; `chooseCheckingAccount()` only checks it if needed |

## Route coverage

Matches the **Known Application Surface** table in `ARCHITECTURE.md` (Rule 6).

| Route | Automated? | Cases |
|---|---|---|
| `/login` | Yes | SIGNIN-01, SIGNIN-02 |
| `/apply` | Yes | SIGNUP-01, SIGNUP-03 |
| `/dashboard` | Yes | DASH-01 |
| `/accounts`, `/move-money`, `/transactions`, `/cards`, `/profile` | No | None cataloged yet (not explored) |

## Open items

- **ZTM IDs:** only SIGNIN-01 (ZTM-5) and SIGNIN-02 (ZTM-6) have one. The others need IDs from the test-management system. Once assigned, add them as tags and scenario-name prefixes, and replace "Unassigned" here and in the catalogs.
- **Coverage report:** `docs/coverage/*.html` has not been created yet.
