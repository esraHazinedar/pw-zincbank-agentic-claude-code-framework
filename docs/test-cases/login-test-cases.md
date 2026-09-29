# Sign In — Test Cases

Feature file: `features/login.feature` · Route: `/login`
Last verified: 2026-09-29 (`npm test`)

| Case | ZTM ID | Type | Priority | Requirement | Automation |
|---|---|---|---|---|---|
| SIGNIN-01 | ZTM-5 | Happy | P1 | A registered user can sign in with email + password and lands on the dashboard | Automated |

## SIGNIN-01 — Successful sign-in redirects to the dashboard

- **Scenario:** `ZTM-5: successful sign-in redirects to the dashboard` (`@smoke @ZTM-5`)
- **Precondition:** Credentials for a registered account in `.env` (`USERNAME`, `PASSWORD`). The scenario is intentionally **not** `@authenticated`, so it always starts logged out.
- **Steps:** Open `/login` → enter email → enter password → click **Sign in**.
- **Expected:** URL matches `/\/dashboard$/`, and a heading matching `/^Welcome,/` is visible.
- **Evidence:**
  - Passed on 2026-09-29 13:26 in `npm test` (5 steps, ~4.5 s).
  - Real login also ran on 2026-09-29 after `rm -rf .auth`, when `ensureAuthenticatedState()` used the same `LoginPage` methods to regenerate `.auth/storageState.json`.
- **Known app defect (locator note):** The email field's `<label>` is not associated with its input, so `getByPlaceholder('you@example.com')` is used. The password field's label works with `getByLabel('Password')`.

## Identified, not yet observed

The following have **not** been observed on the live app yet, so they aren't documented as test cases (Rule 0). Explore them before cataloging:

- Wrong password for a registered email
- Unregistered email
- Empty email and/or password submitted
- Sign out from the navigation bar returns to `/login`
