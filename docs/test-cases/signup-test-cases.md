# Account Signup — Test Cases

Feature file: `features/signup.feature` · Route: `/apply`
Last verified: 2026-09-29 (partial: wizard steps 1→2 only, see below)

| Case | ZTM ID | Type | Priority | Requirement | Automation |
|---|---|---|---|---|---|
| SIGNUP-01 | Unassigned | Happy | P1 | A visitor can complete the 6-step application and open a checking account | Automated (runs only via `npm run signup`) |
| SIGNUP-02 | Unassigned | UI state | P3 | The checking account option is selected by default on step 1 | Not yet automated (currently handled inside SIGNUP-01, not asserted) |
| SIGNUP-03 | Unassigned | Navigation | P2 | **Continue** advances the wizard one step, shown by "Step N of 6 · &lt;title&gt;" | Automated (asserted inside `ApplyPage.continueToNextStep()` as part of SIGNUP-01) |

## SIGNUP-01 — Open a new checking account

- **Scenario:** `Open a new checking account` (`@signup`)
- **Steps:** Open `/apply` → choose checking → personal details → identity (simulated SSN, employment status) → address → password + confirm → accept terms and submit. Data comes from `generateSignupData()` (Faker).
- **Expected:** Text matching `/You're approved/i` is visible. The generated credentials are then written to `.env` by `saveCredentialsToEnv()`.
- **Side effects:** Creates a real account on the live site and overwrites `USERNAME`/`PASSWORD` in `.env`. Excluded from `default`, `smoke` and `regression` profiles.
- **Evidence:** **Not run on 2026-09-29.** Running it creates a real account and needs an explicit go-ahead (Rule 5). The end-to-end result is therefore unverified this session, including the new step-advance wait in `continueToNextStep()`.

## SIGNUP-02 / SIGNUP-03 — Wizard start and step navigation

- **Evidence (2026-09-29, read-only, nothing submitted):**
  - `/apply` loaded showing `Step 1 of 6 · Choose your accounts`, with the Checking account checkbox already checked.
  - Calling `ApplyPage.chooseCheckingAccount()` then `ApplyPage.continueToNextStep()` advanced to `Step 2 of 6 · About you`, and the First name field was present.
- **Not verified:** steps 3–6 titles and transitions (reaching them means entering data into the live form).

## Identified, not yet observed

Not documented as test cases until observed (Rule 0):

- Validation on required fields, invalid email, weak password, mismatched password confirmation
- Choosing a savings account (alone or with checking)
- Going back to a previous step
- Submitting with an email that already has an account
