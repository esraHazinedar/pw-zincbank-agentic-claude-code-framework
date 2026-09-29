---
name: playwright-ui-automation
description: UI automation rules for the ZincBank Cucumber + Playwright framework — Page Object navigation, step-definition boundaries, scenario isolation, live-app stability, and screenshot limits
paths: [features/**, step-definitions/**, pages/**, support/**]
---

# Playwright UI Automation Rules

Companion rules: layering and World/hooks in `playwright-architecture.md`, and locators, assertions and waits in `playwright-scripting.md`. This file covers navigation, what step definitions may touch, scenario isolation, stability, and screenshots.

## 1. Navigation — Page Objects Only

Scenarios reach a page through the Page Object's own `open(baseUrl)` / `openDirectly(baseUrl)` method, called from a step with `config.baseUrl`. There are no fixtures, and a step never navigates directly.

```typescript
// CORRECT: the Page Object owns the route, the step supplies the base URL
When('I navigate to the sign-in page', async function (this: CustomWorld) {
  await this.loginPage.open(config.baseUrl);
});

// WRONG: raw navigation in a step, hardcoded URL
When('I navigate to the sign-in page', async function (this: CustomWorld) {
  await this.page.goto('https://zincbank.cydeo.io/login');
});
```

- Route paths (`/login`, `/apply`, `/dashboard`) live only inside their Page Object.
- **Secondary navigation** (moving between pages mid-scenario) happens by clicking through the UI the way a user would, e.g. through the navigation bar. It is not a second `open()`, unless the scenario is specifically about opening a URL directly (like DASH-01, "navigate directly to the dashboard").
- A scenario that crosses pages uses one Page Object per page, each lazily assigned on the World (see `playwright-architecture.md` §2).

## 2. What Step Definitions May Touch

Step definitions only call Page Object methods and read `config` / `test-data`. They never contain:

- `this.page.goto()`, `this.page.locator()`, or `this.page.getBy…()`
- `page.$()` / `page.$$()` or XPath
- `expect(...)` (use the Page Object's `expect*()` methods)
- `new <Name>Page(...)` outside the scenario's first `Given` step (see `playwright-architecture.md` §2)
- Hardcoded URLs, credentials, or `page.waitForTimeout()`

```typescript
// NEVER in a step definition
await this.page.goto('/dashboard');
const btn = this.page.getByRole('button', { name: 'Sign in' });
await expect(this.page).toHaveURL('https://zincbank.cydeo.io/dashboard');
await this.page.waitForTimeout(3000);
```

## 3. Scenario Isolation

- Each scenario gets a fresh `BrowserContext` and `Page` from the `Before` hook. Never reuse one across scenarios.
- No scenario may depend on another scenario having run first, or on the order scenarios run in.
- Per-scenario data lives on `CustomWorld` (e.g. `this.signupData`), never in module-level variables.
- Generated data comes from Faker via `test-data/` and is created fresh inside the scenario.
- **The one shared fixture is the registered account** in `.env`, and its saved session in `.auth/`. Treat it as read-mostly:
  - Scenarios may read from it (sign in, view dashboard, view accounts and transactions).
  - A scenario that changes its state (money movement, password change, opening a savings account) must either put that state back before it finishes, or be tagged separately and kept out of `smoke`/`regression` like `@signup`. Discuss which approach with the user before automating the first such flow.
  - **Never change the password of the shared account in a scenario.** That breaks `.env`, `.auth/`, and every later run.
- **Created accounts cannot be cleaned up by the suite.** No delete-account flow has been observed on ZincBank, so every `npm run signup` leaves a permanent account behind. That is why `@signup` runs only on request (`npm run signup`) and never in CI.

## 4. Stability Rules

- Rely on Playwright's auto-waiting for actions (`click`, `fill`, `check`, `selectOption`). They already wait until the element is visible, enabled and stable, and they scroll it into view, so `scrollIntoViewIfNeeded()` is rarely needed.
- Add an explicit web-first assertion before an action only when the UI changes asynchronously and the next action could hit stale state. Example: `ApplyPage.continueToNextStep()` waits for `Step N+1 of 6` before the next step's fields are filled.
- Use regex URL assertions: `toHaveURL(/\/dashboard$/)`.
- Hover-revealed controls must be hovered before their child is clicked. None exist in the automated flows yet.
- Never add a fixed sleep to get past slowness on the live site. If a step genuinely needs more time, raise that assertion's timeout (keeping it under the 15 s step timeout), or raise the default in `support/hooks.ts` (see `environment-compatibility.md` §7).
- If a scenario fails intermittently, capture the actual error before changing anything. Don't widen timeouts on a guess.

## 5. Third-Party Content / Ad Blocking

There is no ad-blocking layer. None has been needed on ZincBank, and no third-party ads have been observed. If one is ever needed, it is infrastructure: add it once in the `Before` hook in `support/hooks.ts` (e.g. `this.context.route(...)`). Never add it in a step definition or Page Object.

## 6. Screenshots — Diagnostic Only, No Visual Assertions

- `expect(...).toHaveScreenshot()` and snapshot baselines **do not work** here. They need the Playwright Test runner, and under Cucumber they throw `toHaveScreenshot() must be called during the test`. Don't write visual-comparison assertions, and don't commit snapshot baselines.
- Screenshots are for diagnosis only:
  - The `After` hook saves a full-page screenshot on failure to `screenshots/failed-<scenario>.png` and attaches it to the Cucumber report.
  - `BasePage.takeScreenshot(name)` is available for ad-hoc debugging. Don't leave calls to it in committed scenarios.
- `screenshots/` is gitignored.
- Verify layout by asserting on DOM state (visibility, text, attributes, counts), never by pixel comparison.
