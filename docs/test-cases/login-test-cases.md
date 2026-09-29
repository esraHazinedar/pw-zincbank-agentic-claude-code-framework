# Sign In — Test Cases

Feature file: `features/login.feature` · Route: `/login`
Last verified: 2026-09-29 13:53 (`npm test`)

| Case | ZTM ID | Type | Priority | Requirement | Automation |
|---|---|---|---|---|---|
| SIGNIN-01 | ZTM-5 | Happy | P1 | A registered user can sign in with email + password and lands on the dashboard | Automated |
| SIGNIN-02 | ZTM-6 | Negative | P1 | A wrong password for a registered email is rejected with a generic error that does not reveal which field was wrong | Automated |

## SIGNIN-01 — Successful sign-in redirects to the dashboard

- **Scenario:** `ZTM-5: successful sign-in redirects to the dashboard` (`@smoke @ZTM-5`)
- **Precondition:** Credentials for a registered account in `.env` (`USERNAME`, `PASSWORD`). The scenario is intentionally **not** `@authenticated`, so it always starts logged out.
- **Steps:** Open `/login` → enter email → enter password → click **Sign in**.
- **Expected:** URL matches `/\/dashboard$/`, and a heading matching `/^Welcome,/` is visible.
- **Evidence:**
  - Passed on 2026-09-29 13:26 in `npm test` (5 steps, ~4.5 s).
  - Passed again on 2026-09-29 13:42 in `npm test`, after `LoginPage` switched the email locator to `getByLabel('Email')`.
  - Real login also ran on 2026-09-29 (most recently 13:42) after `rm -rf .auth`, when `ensureAuthenticatedState()` used the same `LoginPage` methods to regenerate `.auth/storageState.json`.
- **Locator note (verified 2026-09-29):** Both fields have associated labels. `getByLabel('Email')` and `getByLabel('Password')` each match exactly one element. An earlier note recorded the email label as broken; re-checking the live DOM disproved it, so `LoginPage` now uses `getByLabel('Email')` instead of the placeholder. The page also exposes `data-testid` attributes (`login-email-input`, `login-password-input`, `login-submit`).

## SIGNIN-02 — Wrong password shows a generic error

- **Scenario:** `ZTM-6: wrong password shows a generic error` (`@regression @ZTM-6`)
- **Precondition:** Registered account email in `.env` (`USERNAME`). Not `@authenticated`.
- **Steps:** Open `/login` → enter the registered email → enter an incorrect password (`incorrectPassword` in `test-data/loginData.ts`) → click **Sign in**.
- **Expected:** Stays on `/login` (URL matches `/\/login$/`); the error note has exactly the text `Invalid email or password.`
- **Evidence:**
  - Live DOM inspected 2026-09-29 with `npx playwright cli`, using an unregistered email + wrong password: URL stayed on `/login`, a single `note` element appeared with `Invalid email or password.` (`data-testid="login-error"`).
  - Scenario passed with the registered email on 2026-09-29 (`TRACE=on`, 7 steps, ~4.5 s), and again in `npm test` at 13:53, so the message is identical for registered and unregistered emails.
- **Locator note:** `getByRole('note')` chosen over the suggested `getByTestId('login-error')` per locator priority; it was the only `note` in the snapshot.
- **Note:** Each run submits one failed sign-in against the shared account. No lockout observed; lockout threshold unknown.

## Identified, not yet observed

The following have **not** been observed on the live app yet, so they aren't documented as test cases (Rule 0). Explore them before cataloging:

- Unregistered email
- Empty email and/or password submitted
- Sign out from the navigation bar returns to `/login`
