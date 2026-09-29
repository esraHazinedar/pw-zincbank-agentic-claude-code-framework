---
name: playwright-scripting
description: Playwright locator, assertion, waiting, and best-practice rules for stable UI automation in the ZincBank Cucumber + Playwright framework
paths: [pages/**, step-definitions/**, features/**, test-data/**]
---

# Playwright Scripting Rules

Where locators, assertions, and waits live (Page Objects, not steps) is defined in `playwright-architecture.md`. This file covers **how** to write them.

## 1. Locator Strategy (Priority Order)

Always pick the highest-priority locator that uniquely identifies the element. All locators are declared as `private readonly` fields in the Page Object constructor.

### Priority 1 — `getByRole()`
For interactive elements and headings. Match on the accessible name.

```typescript
page.getByRole('button', { name: 'Sign in' })
page.getByRole('button', { name: 'Submit application' })
page.getByRole('checkbox', { name: /Checking account/i })
page.getByRole('heading', { name: /^Welcome,/ })
```

### Priority 2 — `getByLabel()`
For form inputs with a properly associated `<label>`.

```typescript
page.getByLabel('First name')
page.getByLabel('Password', { exact: true })   // exact: avoids matching "Confirm password"
page.getByLabel(/Social Security/i)
```

### Priority 3 — `getByPlaceholder()`
Only when the input has no usable label.

```typescript
// /login email field: its <label> is not associated (app accessibility bug), so placeholder is intentional
page.getByPlaceholder('you@example.com')
```

### Priority 4 — `getByText()`
For non-interactive elements identified by visible text (status messages, indicators).

```typescript
page.getByText(/Step \d of \d/)
page.getByText(/You're approved/i)
```

### Priority 5 — `getByTestId()`
Only if ZincBank adds `data-testid` attributes (none found so far).

### Priority 6 — `locator()` with CSS
Only when no semantic locator can target the element. Keep it specific and add a comment explaining why.

```typescript
// Acceptable: specific, scoped, and explained
page.locator('[data-account-type="checking"] .balance')

// Avoid: overly broad
page.locator('div > span')
```

### Never Use
- `page.$()` / `page.$$()` (legacy element handles)
- XPath: `page.locator('//div[@class="foo"]')`
- A bare positional index such as `.nth(2)` / `.first()` without a comment. Scope to a container first (Section 4).

### Matching rules
- Use `{ exact: true }` or an anchored regex (`/^Welcome,/`) when one name is a prefix of another.
- Use case-insensitive regex (`/…/i`) for text the app may re-case, but don't use it to paper over an ambiguous locator.
- Verify new locators against the live DOM before committing. Don't guess from screenshots.

## 2. Assertion Rules

### Import `expect` from `@playwright/test`, only in Page Objects

This project runs on `cucumber-js`, so there is no `test-options` file. Page Objects import `expect` from `@playwright/test` and expose it through `expect*` methods. Step definitions call those methods and never import `expect`.

```typescript
// pages/LoginPage.ts
import { expect, Locator, Page } from '@playwright/test';

async expectLoginSuccess(): Promise<void> {
  await expect(this.page).toHaveURL(/\/dashboard$/);
  await expect(this.welcomeHeading).toBeVisible();
}
```

### Always `await` assertions

```typescript
// CORRECT
await expect(this.welcomeHeading).toBeVisible();

// WRONG: no await, so the step finishes before the assertion runs and it never fails the scenario
expect(this.welcomeHeading).toBeVisible();
```

### Preferred assertion methods

| Scenario | Assertion |
|---|---|
| Element visible | `toBeVisible()` |
| Element not visible | `toBeHidden()` |
| URL match | `toHaveURL(/regex/)`: always a regex |
| Text content | `toHaveText()` or `toContainText()` |
| Input value | `toHaveValue()` |
| Checkbox state | `toBeChecked()` |
| Count | `toHaveCount()` |

### Web-first assertions only

```typescript
// CORRECT: retries until true or timeout
await expect(this.checkingCheckbox).toBeChecked();

// WRONG: reads the state once, no retry
expect(await this.checkingCheckbox.isChecked()).toBe(true);
```

Reading state once with `isChecked()` / `isVisible()` is fine for **branching** (e.g. only checking a box if it isn't already checked), never for asserting.

### Extended timeout for legitimately slow assertions

The default `expect` timeout is 5s, and each step gets 15s (`setDefaultTimeout` in `support/hooks.ts`). Extend a single assertion only when the wait is genuine, such as a server-side submit on the live site, and keep it under the step timeout:

```typescript
await expect(this.page.getByText(/You're approved/i)).toBeVisible({ timeout: 10_000 });
```

### Never assert full URLs with strings

```typescript
// WRONG: hardcodes the environment
await expect(this.page).toHaveURL('https://zincbank.cydeo.io/dashboard');

// CORRECT
await expect(this.page).toHaveURL(/\/dashboard$/);
```

## 3. Waiting Rules

**Never use `page.waitForTimeout()`.** Fixed sleeps make tests flaky and slow, especially against a live shared site.

Use assertion-based waiting instead:

```typescript
// CORRECT: auto-waits for the button to be actionable
await this.continueButton.click();

// CORRECT: wait for the wizard to advance before filling the next step
await expect(this.stepIndicator).toContainText('Step 3 of 6');

// CORRECT: explicit state wait when there's nothing to assert yet
await this.submitButton.waitFor({ state: 'visible' });

// WRONG: hardcoded sleep
await this.page.waitForTimeout(3000);
```

- Playwright actions (`click`, `fill`, `check`, `selectOption`) already wait for the element to be visible, enabled, and stable. Don't add a `toBeVisible()` before every action.
- Add an explicit wait only where the UI changes asynchronously and the next action could hit the old state, such as moving between `/apply` wizard steps.
- Don't use `waitForLoadState('networkidle')`. It's unreliable on apps with polling or analytics.

## 4. Best Practices

### Generate test data with Faker, in `test-data/`

```typescript
// test-data/signupData.ts
const firstName = faker.person.firstName();
email: faker.internet.email({ firstName, lastName }),
```

- Test data comes from `test-data/*.ts` generators, never inline in Page Objects or steps.
- Generated data must satisfy the app's validation. Pin formats explicitly (`zipCode('#####')`, `state({ abbreviated: true })`), and when a generated value might not meet the rules, add a fixed suffix like the `Aa1!` on passwords.
- Credentials never come from Faker or hardcoded strings. They come from `config` (see `playwright-architecture.md`).

### Scope locators to containers

When a page repeats the same element (e.g. one card per account), scope to the container instead of indexing:

```typescript
// CORRECT: resilient to reordering
this.page.getByRole('region', { name: 'Checking' }).getByRole('button', { name: 'Details' })

// AVOID
this.page.getByRole('button', { name: 'Details' }).nth(0)
```

### Dynamic values over hardcoded ones

```typescript
// CORRECT: dates relative to now (transaction filters, scheduled payments)
const from = new Date();
from.setDate(from.getDate() - 30);

// WRONG: fixed dates go stale
'2026-01-01'
```

### Don't assert on account-specific data

The test account is created by `@signup` and may be replaced at any time. Assert on **structure** (`/^Welcome,/`, a `Checking` account card exists), not on a specific name, balance, or account number.

### Keep Gherkin free of scripting detail

Steps say what the user does ("I submit the sign-in form"), not how ("I click the button with role …"). Locator and wait details stay in Page Objects.

## 5. Anti-Patterns

| Anti-Pattern | Why Forbidden | Correct Alternative |
|---|---|---|
| `page.waitForTimeout(ms)` | Flaky, slow | `await expect(el).toBeVisible()` / web-first assertion |
| `this.page.goto()` / `this.page.getBy…()` in a step definition | Bypasses the Page Object layer | Call a Page Object method (`open(config.baseUrl)`, etc.) |
| `expect` imported in a step definition | Assertions belong to Page Objects | Add an `expect*()` method to the Page Object |
| Hardcoded base URL or credentials | Breaks cross-environment runs, leaks secrets | `config.baseUrl` / `config.username`, and `toHaveURL(/path/)` |
| Missing `await` on `expect()` | The scenario never fails on it | Always prefix with `await` |
| `expect(await el.isVisible()).toBe(true)` | Single read, no retry | `await expect(el).toBeVisible()` |
| XPath locators | Fragile, tightly coupled to the DOM | Semantic locators (`getByRole`, `getByLabel`) |
| `.nth()` / `.first()` without context | Picks the wrong element when the DOM shifts | Scope to a container first |
| Asserting on a specific user's name/balance | Breaks when `@signup` creates a new account | Assert on structure/patterns |
| `waitForLoadState('networkidle')` | Unreliable on live apps | Assert the element you need |

## Rule Scope

This file ONLY governs:
- Locator strategy
- Assertion rules
- Waiting rules
- Scripting best practices

It does NOT define:
- Layering, CustomWorld, hooks, or Page Object structure (see `playwright-architecture.md`)
- Node/dependency/CI compatibility (see `environment-compatibility.md`)
