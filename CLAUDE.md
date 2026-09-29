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
npm run report:rtm                 # regenerate docs/coverage/rtm-coverage-report.html from docs/RTM.md + the last run
                                   # (runs automatically after test, test:smoke, test:regression and signup)

npx cucumber-js --profile default --tags @ZTM-5     # run a single tag/scenario
HEADLESS=false npm run test:smoke                    # run with a visible browser
TRACE=on npx cucumber-js --profile default --name "ZTM-5"   # save a Playwright trace for every scenario
                                                      # (default TRACE=retain-on-failure keeps traces only for failures)
npx playwright trace open reports/traces/<scenario>.zip     # inspect a trace from the CLI (never show-trace)

npm run signup                                       # create a fresh test account (the only way @signup runs;
                                                      # submits real data to the live app;
                                                      # on success, writes USERNAME/PASSWORD to .env)
rm -rf .auth                                         # force re-authentication (stale/expired session)
```

## Model & effort

Follows Anthropic's guidance in [Choosing a model and effort level](https://code.claude.com/docs/en/model-config): Opus for complex reasoning, Sonnet for daily coding, Haiku for simple tasks; `medium` effort for clear-scope work, `high` where verification matters (bug fixing, reviews), `xhigh`/`max` only for hard problems (costly, prone to overthinking). Each skill pins its own `model`/`effort` in its `SKILL.md` frontmatter; the override lasts for the current turn and your session model resumes on your next prompt.

| Work | Model | Effort | Where it is set |
|---|---|---|---|
| New scenario (`pw-bdd-new-scenario`) | `sonnet` | `medium` | Skill frontmatter |
| Debug a failing scenario (`pw-bdd-debug-scenario`) | `opus` | `high` | Skill frontmatter |
| Audit scenario changes (`pw-bdd-scenario-audit`) | `sonnet` | `high` | Skill frontmatter |
| Coverage planning (`pw-bdd-coverage-planner`) | `opus` | `medium` | Skill frontmatter |
| Everyday edits, running tests, small refactors | `sonnet` | `medium` | `/model sonnet`, `/effort medium` |
| Doc wording fixes, regenerating the RTM report | `haiku` | `low` | `/model haiku` |
| Architecture changes (`ARCHITECTURE.md`, hooks, World) | `opus` | `medium`–`high` | `/model opus` |
| Security review of changes | `opus` | `high` or above | `/model opus` |

## Environment

Requires a `.env` file (gitignored) with `BASE_URL`, `USERNAME`, `PASSWORD` for a real, registered ZincBank account. If none exists yet, run the `@signup` scenario above — it creates one and populates `.env` automatically.

## Architecture

Cucumber BDD + Playwright + TypeScript + Page Object Model, targeting [zincbank.cydeo.io](https://zincbank.cydeo.io) (a simulated bank for QA education). **Read `ARCHITECTURE.md` before making structural changes** — it has the full dependency-direction diagram, layer responsibilities, and the known application route inventory (what's automated vs. not). Key points repeated here for quick orientation:

- **Dependency direction:** `features/*.feature` → `step-definitions/*.steps.ts` → `pages/*.ts` → Playwright. `config/` and `test-data/` are leaf dependencies read by any layer.
- **No `@playwright/test` fixtures** — this project uses `cucumber-js`, not the Playwright Test runner. The fixture-equivalent is Cucumber's World + hooks: `support/world.ts` defines a typed `CustomWorld` (`page`, `context`, `browser`, lazily-assigned Page Object instances); `support/hooks.ts` launches one `Browser` for the whole run (`BeforeAll`/`AfterAll`) and a fresh `BrowserContext`+`Page` per scenario (`Before`/`After`), plus failure screenshots and Playwright traces (`TRACE` env var → `reports/traces/`).
- **Authenticated sessions:** `support/authSetup.ts` performs one real login (from the `Before` hook, only for `@authenticated` scenarios when no saved state exists; 30s hook timeout since it's a real network login) and saves Playwright's `storageState` to `.auth/storageState.json` (gitignored). Scenarios tagged `@authenticated` get a context pre-loaded with that session in the `Before` hook, skipping the login UI. `login.feature` is deliberately **not** tagged `@authenticated` — it exists to test the real sign-in flow.
- **Credentials** only ever come from `.env` via `config/environment.ts` — never hardcoded. `config` getters throw a clear error if a variable is missing, but only when it is read, so `@signup` still runs without credentials. `features/signup.feature` submits ZincBank's real 6-step `/apply` wizard with Faker-generated data and, on success, writes the resulting credentials into `.env` at runtime via `utils/envWriter.ts`.
- **Locators:** both `/login` fields have properly associated labels (`getByLabel('Email')` / `getByLabel('Password')`, verified 2026-09-29; an older note saying the email label was broken is obsolete). ZincBank also has `data-testid` attributes (e.g. `login-email-input`), but semantic locators rank higher — see `.claude/rules/playwright-scripting.md`.
