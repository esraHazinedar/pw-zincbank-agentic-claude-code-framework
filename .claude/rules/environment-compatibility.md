---
name: environment-compatibility
description: Compatibility checks for Node, dependency versions, browser binaries, and local/CI parity before running the ZincBank Cucumber + Playwright suite
paths: [package.json, package-lock.json, tsconfig.json, cucumber.js, support/browser.ts, config/environment.ts, Dockerfile, docker-compose.yaml, .github/workflows/**]
---

# Environment & Dependency Compatibility Rules

## 1. Current Toolchain Baseline

These versions are known to work together (verified: `tsc --noEmit` clean, all non-`@signup` scenarios passing):

| Tool | Version | Constraint |
|---|---|---|
| Node.js | 22.x | `@cucumber/cucumber` 13 requires Node `22 \|\| 24 \|\| >=26`. **Odd releases (23, 25) are unsupported.** Playwright requires `>=20`. |
| `@cucumber/cucumber` | 13.2.1 | Test runner. Not the Playwright Test runner. |
| `playwright` / `@playwright/test` | 1.63.0 | **Both** are in `devDependencies` and must be the exact same version (see Rule 2). |
| `typescript` | 5.9.3 | Executed at runtime through `ts-node` (see Rule 3). |
| `ts-node` | 10.9.2 | Loaded via `--require-module ts-node/register` in `cucumber.js`. |
| `@faker-js/faker` | 10.6.0 | Generates signup data (see Rule 4). |
| `dotenv` | 18.0.4 | Loads `.env` in `config/environment.ts`. |
| `@types/node` | 26.x | Newer than the Node 22 runtime (see Rule 5). |

Check what's actually installed with:

```bash
node --version
npm ls --depth=0
npm outdated
```

## 2. `playwright` and `@playwright/test` Move Together

This project depends on both packages: `playwright` provides the browser APIs and `@playwright/test` provides the types, `chromium` and `expect`. If their versions drift, two copies of `playwright-core` get installed, and `expect` matchers or `Page` types can stop lining up with the browser objects.

- Bump both in the same change, to the same exact version.
- Afterwards `npm ls playwright playwright-core` must show a **single** `playwright-core` version (the other entries say `deduped`).
- After any Playwright bump, even a patch, run `npx playwright install chromium`. Each Playwright version expects a specific Chromium build, and an old one on disk causes `Executable doesn't exist` errors at launch.
- Then re-run the full suite (`npm test`, excluding `@signup`, see Rule 7). Playwright sometimes changes auto-waiting or locator-matching behaviour between versions, and every scenario here runs against a live site.

## 3. TypeScript and `ts-node` Must Stay Compatible

Cucumber runs the `.ts` files directly through `ts-node`, so a TypeScript version that `ts-node` can't drive breaks **every** run, not just type-checking.

- `ts-node` 10 declares `typescript >=2.7` as its peer range, but that range only guarantees a lower bound. It does not promise that future majors will work.
- `npm outdated` currently reports **TypeScript 7.x** as latest. **Do not bump across a TypeScript major** until you have checked that `npx cucumber-js --profile default --dry-run` still loads the step definitions. If `ts-node` can't handle the new compiler, stay on 5.x or move the loader to one that supports it, in a separate change.
- `npx tsc --noEmit` must pass after any dependency change.

## 4. Faker Bumps Can Break Signup Silently

`test-data/signupData.ts` depends on specific Faker output shapes that ZincBank's `/apply` form validates:

| Field | Faker call | App expectation |
|---|---|---|
| `phone` | `faker.phone.number({ style: 'national' })` | Accepted phone format |
| `ssn` | `faker.string.numeric(9)` | 9 digits |
| `state` | `faker.location.state({ abbreviated: true })` | 2-letter code in the State select |
| `zip` | `faker.location.zipCode('#####')` | 5 digits |
| `password` | `faker.internet.password(...)` + `Aa1!` suffix | Meets password rules |

A major Faker bump can rename these options or change the output format. The only real check is running `@signup`, and that creates a live account, so do it only when needed and review the signatures above before bumping.

## 5. `@types/node` Should Match the Node Runtime Major

`@types/node` is currently 26.x while the runtime is Node 22. The compiler will then accept Node APIs that don't exist at runtime, and the failure only appears when the test runs. Keep `@types/node` on the same major as the Node version you run (e.g. `@types/node@22` for Node 22). If you upgrade Node, bump `@types/node` in the same change.

## 6. Pin the Node Version for Every Environment

Nothing in the repo currently pins Node, so each machine uses whatever it has installed. When setting up a new machine or CI:

- Use Node **22** or **24** (Active/Maintenance LTS lines supported by Cucumber 13).
- If you add pinning, add both `"engines": { "node": ">=22" }` in `package.json` and a `.nvmrc`, and keep them in sync with the CI Node version.
- The `ExperimentalWarning: glob is an experimental feature` printed on Node 22 comes from Cucumber using `fs.glob`. It is harmless, so don't try to fix it by changing Node versions.

## 7. Local vs. CI/Docker Parity

ZincBank (`zincbank.cydeo.io`) is an external, shared site that this repo doesn't control, so timing varies between runs and machines.

- Keep the same waiting strategy everywhere: Playwright auto-waiting and `expect(...)` polling. **Never** add `page.waitForTimeout()` to make slow environments pass, and don't lower timeouts to make fast ones quicker.
- Steps and hooks default to 15s (`setDefaultTimeout` in `support/hooks.ts`). Raise it if you see real step timeouts, never lower it, and never replace it with fixed waits.
- The `Before` hook has a 30s timeout because the first `@authenticated` scenario may do a real login. Raise it in CI only if you see real timeouts there, and never below 30s.
- CI must provide `BASE_URL`, `USERNAME`, `PASSWORD` as **secrets** (environment variables). `dotenv` doesn't override variables that are already set, so no `.env` file is needed in CI. Missing values fail fast with a clear error from `config/environment.ts`.
- CI runs headless by default. Don't set `HEADLESS=false` there.
- **Never run `@signup` in CI or scheduled runs.** It creates a real account on every run and rewrites `.env`. Every profile except `signup` already excludes it via `--tags "not @signup"` in `cucumber.js`, so `npm test` is safe for CI. Never add a CI step that runs `npm run signup`.
- CI must run `npx playwright install --with-deps chromium`, because Linux runners need the system libraries as well as the browser.
- Persist `reports/` (which includes `reports/traces/`) and `screenshots/` as build artifacts, so failure traces, screenshots and the HTML report survive after the job ends. Keep the default `TRACE=retain-on-failure` in CI.

### If Docker is added later

There's no `Dockerfile` yet. If you add one, use `mcr.microsoft.com/playwright:v<X.Y.Z>-noble` with **the same `X.Y.Z` as `playwright`/`@playwright/test` in `package.json`**, and bump the tag in the same change as any Playwright bump. Check that the tag exists before committing, because not every patch version is published. Mount `reports/` and `screenshots/` as volumes. Prefer `docker compose` (V2 syntax) over the legacy `docker-compose` binary in any npm scripts.

## 8. Before Running Anything — Checklist

1. `node --version` is 22.x or 24.x (Rule 1, Rule 6).
2. `npm ls playwright playwright-core` shows one aligned version, and `npx playwright install chromium` has been run for it (Rule 2).
3. `npx tsc --noEmit` passes (Rule 3).
4. `npx cucumber-js --profile default --dry-run` succeeds, confirming that every step matches a definition and ts-node loads cleanly. This takes about a second and catches config problems before a real browser run.
5. `.env` exists with `BASE_URL`, `USERNAME`, `PASSWORD` (see README) or CI secrets are set. If credentials are missing, run `npm run signup` locally, never in CI (Rule 7).
6. If anything under `.auth/` is from an old account or an expired session, `rm -rf .auth` before running.
7. Full-suite runs use `npm test`, which already excludes `@signup`. Create accounts only with `npm run signup`.
