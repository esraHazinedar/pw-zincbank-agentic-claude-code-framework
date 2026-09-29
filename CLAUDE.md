# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                        # install dependencies
npx playwright install chromium    # install browser binary (one-time)
npx tsc --noEmit                   # type-check (run before considering any change done)

npm test                           # run all scenarios except @signup
npm run test:smoke                 # run scenarios tagged @smoke
npm run test:regression            # run scenarios tagged @regression
npm run test:debug                 # run with PWDEBUG=1

npx cucumber-js --profile default --tags @ZTM-5     # run a single tag/scenario
HEADLESS=false npm run test:smoke                    # run with a visible browser

npm run signup                                       # create a fresh test account (the only way @signup runs;
                                                      # submits real data to the live app;
                                                      # on success, writes USERNAME/PASSWORD to .env)
rm -rf .auth                                         # force re-authentication (stale/expired session)
```

## Environment

Requires a `.env` file (gitignored) with `BASE_URL`, `USERNAME`, `PASSWORD` for a real, registered ZincBank account. If none exists yet, run the `@signup` scenario above — it creates one and populates `.env` automatically.

## Architecture

Cucumber BDD + Playwright + TypeScript + Page Object Model, targeting [zincbank.cydeo.io](https://zincbank.cydeo.io) (a simulated bank for QA education). **Read `ARCHITECTURE.md` before making structural changes** — it has the full dependency-direction diagram, layer responsibilities, and the known application route inventory (what's automated vs. not). Key points repeated here for quick orientation:

- **Dependency direction:** `features/*.feature` → `step-definitions/*.steps.ts` → `pages/*.ts` → Playwright. `config/` and `test-data/` are leaf dependencies read by any layer.
- **No `@playwright/test` fixtures** — this project uses `cucumber-js`, not the Playwright Test runner. The fixture-equivalent is Cucumber's World + hooks: `support/world.ts` defines a typed `CustomWorld` (`page`, `context`, `browser`, lazily-assigned Page Object instances); `support/hooks.ts` launches one `Browser` for the whole run (`BeforeAll`/`AfterAll`) and a fresh `BrowserContext`+`Page` per scenario (`Before`/`After`), plus failure screenshots.
- **Authenticated sessions:** `support/authSetup.ts` performs one real login (from the `Before` hook, only for `@authenticated` scenarios when no saved state exists; 30s hook timeout since it's a real network login) and saves Playwright's `storageState` to `.auth/storageState.json` (gitignored). Scenarios tagged `@authenticated` get a context pre-loaded with that session in the `Before` hook, skipping the login UI. `login.feature` is deliberately **not** tagged `@authenticated` — it exists to test the real sign-in flow.
- **Credentials** only ever come from `.env` via `config/environment.ts` — never hardcoded. `config` getters throw a clear error if a variable is missing, but only when it is read, so `@signup` still runs without credentials. `features/signup.feature` submits ZincBank's real 6-step `/apply` wizard with Faker-generated data and, on success, writes the resulting credentials into `.env` at runtime via `utils/envWriter.ts`.
- **Known locator gotcha:** on ZincBank's `/login` page, the password field's `<label>` is properly associated (`getByLabel` works), but the email field's is not — a real accessibility bug in the app, not a mistake in the code (`getByPlaceholder` is used there instead).
