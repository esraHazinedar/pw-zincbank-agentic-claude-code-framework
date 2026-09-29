---
name: pw-bdd-coverage-planner
description: Plan Cucumber scenario coverage for a ZincBank feature or flow. Enters plan mode, reviews existing features/steps/docs, explores the live app read-only with the Playwright CLI, brainstorms happy/edge/negative cases as Gherkin-level scenarios, and saves the approved plan to `.claude/pw-plans/` for `pw-bdd-new-scenario` to implement.
model: opus
effort: medium
---

Build a coverage plan for a parent scenario in the ZincBank Cucumber + Playwright framework. The output is a markdown plan in `.claude/pw-plans/` that `pw-bdd-new-scenario` can implement one case at a time.

Parent scenario: $ARGUMENTS

**Never skip `AskUserQuestion` steps in this skill, even if told to work autonomously.**

## Instructions

### 1. Enter plan mode immediately

Call `EnterPlanMode` before anything else. Steps 2–5 are research only; nothing is written until the user approves in step 6.

If `$ARGUMENTS` is empty or too vague (fewer than ~5 words and no feature, page or flow named), use `AskUserQuestion` once to ask for the parent scenario, then enter plan mode.

### 2. Anchor on the parent scenario

Restate it in one sentence and identify:
- **Actor:** ZincBank has two:
  - **Visitor:** unauthenticated. `/login`, `/apply`.
  - **Authenticated user:** the shared `.env` account via `@authenticated`. `/dashboard`, `/accounts`, `/move-money`, `/transactions`, `/cards`, `/profile`.
- **Feature area:** the route(s) and flow. See the **Known Application Surface** table in `ARCHITECTURE.md`.
- **Primary goal:** what success looks like for the actor.

Make reasonable assumptions and flag them; don't block on them.

### 3. Review existing coverage and conventions

Read:
- `.claude/rules/*.md`, especially `test-documentation.md` (Rule 2 says what's worth automating for a bank) and `playwright-ui-automation.md` §3 (isolation and the shared account)
- `features/*.feature` and `step-definitions/*.steps.ts`: existing scenarios, and **step text that new scenarios can reuse**
- `pages/*.ts`: existing Page Object methods
- `docs/RTM.md` and `docs/test-cases/*.md`: existing case keys, and the "Identified, not yet observed" lists (good candidates)

Note which cases already exist so the plan doesn't duplicate them, and which feature file each new case belongs in.

### 4. Explore the live app (read-only)

There is no ZincBank source code to read. Observe behavior on the live site with the Playwright CLI:

```bash
npx playwright cli open https://zincbank.cydeo.io/<route>
npx playwright cli state-load .auth/storageState.json   # for authenticated routes, then:
npx playwright cli goto https://zincbank.cydeo.io/<route>
npx playwright cli snapshot
npx playwright cli close
```

**Stay read-only** (`test-documentation.md` Rule 5): look at pages, forms, labels, visible rules, and navigation. You may trigger client-side validation (e.g. submitting an empty form) as long as nothing is successfully submitted. **Don't** submit applications, transfers, payments or password changes. Mark cases whose behavior you couldn't observe with `?`.

### 5. Brainstorm cases

Keep only cases observable through the UI and realistic for E2E:

**Happy path:** the canonical flow, plus meaningful valid variants.

**Edge cases:**
- **Input boundaries:** empty, whitespace, min/max length, special characters, case sensitivity.
- **Amounts** (money flows): 0, smallest unit, exactly the available balance, just over it.
- **State:** empty lists ("No activity yet."), a single item, many items.
- **Navigation:** back or refresh mid-wizard, deep-linking into a later `/apply` step.
- **Repeated submission:** double-clicking submit.

**Negative cases:**
- **Validation:** required fields, malformed email, weak password, mismatched confirm-password.
- **Authentication:** wrong password, unknown email, an unauthenticated visitor opening an authenticated route, expired session.
- **Business rules:** transfer over balance, paying an unknown payee.
- **Not found:** bad account id in a URL.

For each case decide:
- **Priority:** P0 must-have, P1 important, P2 nice-to-have.
- **State impact:** read-only, or state-changing. A state-changing case needs a restore strategy or a separate tag (`playwright-ui-automation.md` §3). Say which.
- **Step reuse:** existing steps it can use vs new steps needed.

### 6. Present the plan with `ExitPlanMode`

```markdown
# Coverage Plan: <short title>

**Actor:** <Visitor | Authenticated user>
**Feature area:** <route(s) / flow>
**Primary goal:** <one sentence>
**Feature file:** `features/<domain>.feature` (new | existing)
**Page Objects:** <existing to extend / new to create>
**Existing related scenarios:** <titles, or "none">

## Assumptions
- ...

## Scenarios

### Happy path
1. **<User-behavior title, e.g. "Authenticated user can view transaction history">** _(P0, read-only)_
   - Tags: `@regression @authenticated`
   - Given / When / Then: <user-level Gherkin; ♻ marks reused existing steps>
   - Observed: <what the CLI exploration showed, or `?` if not observed>

### Edge cases
2. ...

### Negative cases
3. ...

## State-changing cases
- <case>: <restore strategy or separate tag>, needs user approval before running

## Out of scope
- <case>: <reason, e.g. "no UI surface", "would change the shared account's password">

## Open questions
- <each `?` item>
```

Titles describe user behavior (`<Actor> can …`, `<Actor> sees an error when …`). Gherkin is user-level, with no selectors, URLs, or account-specific values. Don't propose ZTM IDs; those come from the test-management system.

### 7. Save after approval

Write the approved plan body to `.claude/pw-plans/<kebab-slug>.md` (create the folder if needed; add `-2`, `-3`, … instead of overwriting).

A plan is **not** documentation of observed behavior. Don't add its cases to `docs/test-cases/` or `docs/RTM.md` yet. They are added when each case is implemented and observed (`test-documentation.md` Rule 0).

### 8. Offer next step

`AskUserQuestion`:
- Question: "Coverage plan saved to `.claude/pw-plans/<slug>.md`. What's next?"
- Header: "Next step"
- Option 1: label "Implement first P0", description "Run `pw-bdd-new-scenario` for the top P0 case"
- Option 2: label "Done", description "Stop here — I'll implement later"

On **Implement first P0**, hand off to `pw-bdd-new-scenario`, passing that case's title, tags, Given/When/Then and observations as the test steps.
