# Dashboard — Test Cases

Feature file: `features/dashboard.feature` · Route: `/dashboard`
Last verified: 2026-09-29 (`npm test`)

| Case | ZTM ID | Type | Priority | Requirement | Automation |
|---|---|---|---|---|---|
| DASH-01 | Unassigned | Happy | P1 | A stored session opens the dashboard directly, without the login UI | Automated |
| DASH-02 | Unassigned | UI state | P2 | The dashboard shows a total deposit balance and the user's accounts list | Not yet automated |
| DASH-03 | Unassigned | Navigation | P2 | The top navigation bar links to Dashboard, Accounts, Move money, Transactions, Cards and Sign out | Not yet automated |
| DASH-04 | Unassigned | UI state | P4 | "Recent activity" shows an empty state ("No activity yet.") for an account with no transactions | Not automated: cosmetic empty state, low business risk |
| DASH-05 | Unassigned | UI state | P4 | A theme toggle switches between light and dark mode | Not automated: decorative, no business impact |

## DASH-01 — Reuse a stored session instead of logging in again

- **Scenario:** `Reuse a stored session instead of logging in again` (`@authenticated @regression`)
- **Precondition:** `.auth/storageState.json` exists, or is created by `ensureAuthenticatedState()` in the `Before` hook.
- **Steps:** Open `/dashboard` directly with the stored session.
- **Expected:** URL matches `/\/dashboard$/`, and a heading matching `/^Welcome,/` is visible.
- **Evidence:**
  - Passed on 2026-09-29 13:26 in `npm test` (3 steps, ~4.0 s), and again at 13:42.
  - Also passed on 2026-09-29 after `rm -rf .auth` (session regenerated in the same run).
  - **Unconfirmed intermittent failure:** failed once on 2026-09-29 before the 15 s default step timeout was added. The failure screenshot showed a fully rendered dashboard, which suggests a timeout on a slow load. The error text was not captured, so the cause is not verified. Passed in all 13 full-suite runs since (through 13:42), 7 of them with the 15 s timeout.

## DASH-02 to DASH-05 — Observed dashboard content

- **Evidence:** Observed on 2026-09-29 in the failure screenshot `screenshots/failed-reuse-a-stored-session-instead-of-logging-in-again.png`: the navigation bar (Dashboard, Accounts, Move money, Transactions, Cards, theme toggle, Sign out), a "Move money" button, "Total deposit balance", "Your accounts" with a Checking account card, and "Recent activity" showing "No activity yet."
- **Not verified:** that each nav link reaches its route, that the theme toggle works, and how the page looks for an account with transactions. These need their own exploration before automation.
- **Shared component:** the navigation bar (DASH-03) appears on every authenticated page. Automate it once, not per page (Rule 1).
- Expected results describe structure only, never this account's name, balance, or account number (Rule 0).
