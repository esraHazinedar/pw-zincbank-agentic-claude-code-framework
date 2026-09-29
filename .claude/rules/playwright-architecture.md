---
name: playwright-architecture
description: Defines CustomWorld, hooks, Page Object, and layering rules for the ZincBank Cucumber + Playwright framework
paths: [features/**, step-definitions/**, pages/**, support/**, config/**, test-data/**, utils/**, cucumber.js, tsconfig.json]
---

# Cucumber + Playwright Architecture Rules

Full background lives in `ARCHITECTURE.md`. This file is the enforceable contract.

## 1. Dependency Direction Is One-Way

```text
features/*.feature  →  step-definitions/*.steps.ts  →  pages/*.ts  →  Playwright
```

- `config/` and `test-data/` are leaf dependencies — any layer may read them; they import nothing from the framework.
- `support/` sits beside the chain: it hands step definitions a ready `page`/`context`/`browser` and contains no test logic.
- A layer never imports from a layer above it (pages never import step definitions; nothing imports from `features/`).

| Layer | Does | Never does |
|---|---|---|
| `features/*.feature` | Business-readable Gherkin | Mention locators, URLs, CSS, or implementation detail |
| `step-definitions/*.steps.ts` | Translate a step into Page Object calls | Touch `this.page` directly, declare locators, call `expect` on raw locators |
| `pages/*.ts` | Locators + actions + `expect*` assertions for one page/flow | Reference Gherkin, reach into another Page Object's internals |
| `support/world.ts` | Typed per-scenario state | Business/test logic |
| `support/hooks.ts` | Browser/context lifecycle, failure screenshots | Locators, assertions |
| `support/authSetup.ts` | One-time real login → `.auth/storageState.json` | Run per scenario |
| `config/environment.ts` | Read `.env`, expose typed `config` | — |
| `test-data/*.ts` | Faker-generated, non-secret data | Hold credentials |
| `utils/*.ts` | Small, genuinely generic helpers | Become a dumping ground |

## 2. CustomWorld Is the Only Entry Point

All step definitions receive state through the typed `CustomWorld` (`support/world.ts`). Always type `this`, and always use `function`, never arrow functions (arrows lose the World binding).

```typescript
// CORRECT
When('I navigate to the sign-in page', async function (this: CustomWorld) {
  await this.loginPage.open(config.baseUrl);
});

// WRONG — arrow function, untyped World, raw page access
When('I navigate to the sign-in page', async () => {
  await page.goto('https://zincbank.cydeo.io/login');
});
```

`CustomWorld` exposes:

| Property | Type | Set by |
|---|---|---|
| `this.browser` | `Browser` | `Before` hook (shared, launched once in `BeforeAll`) |
| `this.context` | `BrowserContext` | `Before` hook (fresh per scenario) |
| `this.page` | `Page` | `Before` hook (fresh per scenario) |
| `this.loginPage` | `LoginPage` | First `Given` step of `login.steps.ts` |
| `this.applyPage` | `ApplyPage` | First `Given` step of `signup.steps.ts` |
| `this.dashboardPage` | `DashboardPage` | First `Given` step of `dashboard.steps.ts` |
| `this.signupData` | `SignupData` | `signup.steps.ts` personal-details step (Faker) |

- Page Objects are **lazily assigned** on the World in the scenario's first (`Given`) step: `this.loginPage = new LoginPage(this.page)`. Later steps reuse that instance — never construct the same Page Object twice in one scenario.
- Page Objects are constructed only in step definitions (or `support/authSetup.ts`, which runs outside a scenario). Never in pages, config, or utils.
- Per-scenario data (e.g. generated signup data) belongs on the World, not in module-level `let` variables — module state leaks between scenarios.

## 3. Hooks Are the Fixture System

There is **no** `@playwright/test` runner and **no** `test.extend()` fixtures. `@playwright/test` is imported only for its types, `chromium`, and `expect`. The fixture equivalent is `support/hooks.ts`:

| Hook | Scope | Does |
|---|---|---|
| `BeforeAll` | Once per run | `launchBrowser()` |
| `Before` (30s timeout) | Per scenario | If tagged `@authenticated`: `ensureAuthenticatedState()` (logs in only if `.auth/` is missing), then new `BrowserContext` with `storageState`. Otherwise a clean context. Then new `Page` |
| `After` | Per scenario | Full-page screenshot on failure → `screenshots/failed-<scenario>.png`, attached to report; always closes context |
| `AfterAll` | Once per run | `closeBrowser()` |

- Never launch a browser or create a context inside step definitions or Page Objects — `support/browser.ts` owns the single `Browser`.
- Never share a `BrowserContext` or `Page` between scenarios.
- Steps and hooks default to a 15s timeout (`setDefaultTimeout(15_000)` in `support/hooks.ts`; Cucumber's own 5s default is too tight for the live site). Only hooks that need more, like the login in `Before`, set their own explicit timeout.

## 4. Authenticated Sessions

- Scenarios that need a logged-in user are tagged `@authenticated` — they start with the saved session and must **not** drive the login UI.
- `features/login.feature` is **never** tagged `@authenticated`; it exists to test the real sign-in flow.
- `.auth/` is gitignored (session cookies = secret). Force re-auth with `rm -rf .auth`.

## 5. Page Object Rules

- Every Page Object `extends BasePage` and takes `page: Page` in its constructor, calling `super(page)`.
- Locators are declared as `private readonly <name>: Locator` fields and assigned in the constructor. Nothing outside the class reads them.
- Locator priority: `getByRole` > `getByLabel` > `getByPlaceholder` / `getByText` > CSS. Known exception: the `/login` email field has no associated label (app accessibility bug) — `getByPlaceholder('you@example.com')` is intentional.
- All interaction methods are `async` and return `Promise<void>` (or a typed value).
- Each Page Object owns navigation to its own route via `open(baseUrl)` / `openDirectly(baseUrl)`, built on `BasePage.goto()`. The base URL is passed in from `config.baseUrl` by the step — never hardcoded in the page.
- Assertions live in Page Objects as methods prefixed `expect*` (e.g. `expectLoginSuccess()`), using `expect` from `@playwright/test`. Steps call these; they never assert on locators themselves.
- No `page.waitForTimeout()` anywhere — rely on auto-waiting and `expect(...)` polling.
- One Page Object per page or multi-step flow (`ApplyPage` covers the whole 6-step `/apply` wizard).

## 6. Adding a New Page / Feature

1. Create `pages/<Name>Page.ts` extending `BasePage`, following section 5.
2. Add a typed `<name>Page!: <Name>Page` property to `CustomWorld` in `support/world.ts`.
3. Create `step-definitions/<domain>.steps.ts`; assign `this.<name>Page` in the first `Given` step.
4. Create `features/<domain>.feature` — one feature file per domain, with matching tags.
5. Update the route inventory table in `ARCHITECTURE.md` (Automated? → Yes).
6. Run `npx tsc --noEmit` — it must pass before the change is done.

Never skip step 2 — an untyped World property defeats strict mode.

## 7. Tags

| Tag | Meaning |
|---|---|
| `@smoke` | Fast critical-path check; runs via `npm run test:smoke` |
| `@regression` | Broader coverage; runs via `npm run test:regression` |
| `@authenticated` | Starts with the stored session (see section 4) |
| `@signup` | Submits real data to the live app and rewrites `.env`. Excluded from `default`/`smoke`/`regression` profiles; runs only via `npm run signup`. Never add `@smoke`/`@regression` to it |
| `@ZTM-<n>` | Traceability to an external test-management ticket; also prefix the scenario name (`ZTM-5: ...`) |

## 8. Configuration & Secrets Contract

| Setting | Value |
|---|---|
| Runner | `cucumber-js` with `ts-node/register` |
| Profiles | `default`, `smoke`, `regression` (all with `--tags "not @signup"`), and `signup` (`--tags @signup` only) in `cucumber.js` |
| Formatters | `progress`, `json:reports/cucumber-report.json`, `html:reports/cucumber-report.html` |
| Browser | Chromium only; headless unless `HEADLESS=false` (exposed as `config.headless`) |
| Default step/hook timeout | 15 000 ms (`setDefaultTimeout` in `support/hooks.ts`) |
| `Before` timeout | 30 000 ms (covers the one-time login) |
| TypeScript | `strict: true`; every new top-level folder must be added to `tsconfig.json` `include` |

- `BASE_URL`, `USERNAME`, `PASSWORD` come only from `.env` through `config/environment.ts`. Never hardcode URLs or credentials, and never read `process.env.X` outside `config/environment.ts` — add new variables to `EnvironmentConfig` instead.
- Required values are exposed as getters that call `required(name, hint)`, which throws a clear error naming the missing variable. Validate on access, never at import, so `@signup` can run before credentials exist.
- Every new variable in `EnvironmentConfig` must also be added to the `.env` snippet in `README.md`.
- Only `utils/envWriter.ts` writes to `.env`, and only from the `@signup` success step.
- `.env`, `.auth/`, reports, and screenshots are never committed.
