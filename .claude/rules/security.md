---
name: security
description: Non-negotiable rules for protecting credentials, session data and account information from leaking to GitHub or anywhere else, and for never creating, changing or deleting files without the user's explicit consent
---

# Security Rules

These rules apply to every task in this repository. They **take precedence over every other rule file and every skill** (including the `pw-bdd-*` skills). Where a skill says to write, fix, commit or delete something, these consent rules still apply first.

A rule file is guidance. The hard enforcement lives in `.claude/settings.json` (permission `deny`/`ask` rules). Never try to work around a denied or prompted action by other means, for example reading `.env` with `cat` when `Read` is denied, or deleting with `find -delete` when `rm` asks.

## 1. Sensitive data in this framework

| Item | Location | Why it is sensitive |
|---|---|---|
| Account email + password | `.env` | Real login for the shared ZincBank account |
| Session cookies | `.auth/storageState.json` | Anyone holding the file is logged in, no password needed |
| Playwright traces | `reports/traces/*.zip` | Record the values typed into fields, **including the password**, plus cookies and full network traffic |
| Screenshots, CLI snapshots | `screenshots/`, `.playwright-cli/` | Show the account holder's name, balance and account number |
| Cucumber reports | `reports/cucumber-report.{json,html}` | Embed the failure screenshots |
| Generated signup data | runtime (`test-data/signupData.ts` output) | Name, email, phone, simulated SSN, address, password of a real account |
| Maintainer's personal email | git author metadata | Becomes public on push |

All paths above except git metadata are in `.gitignore`. They must **stay** there. Never remove or weaken those entries.

## 2. Never commit or push sensitive files

- Never `git add -f` / `--force`. An ignored file is ignored on purpose.
- Never stage blindly. Before every commit, run `git diff --cached --name-only` and confirm none of the §1 paths are listed.
- Before any push, scan the commits being pushed for secrets (e.g. `gitleaks detect`, if installed) and report the result.
- Treat the GitHub repository as **public** unless the user has confirmed it is private.
- Never `git push --force`, and never rewrite published history, without explicit consent (§4).

## 3. Never write secrets anywhere else

Credentials, cookies, and account-specific data (holder name, balance, account number, generated identity) must never appear in:

- source code, test data, feature files, or docs (`docs/`, `README.md`, `ARCHITECTURE.md`, `CLAUDE.md`, rules, skills)
- commit messages, PR titles or descriptions
- console output, log lines, error messages, Cucumber attachments
- chat responses to the user, including when quoting command output. Redact values as `<redacted>`.

Error messages may **name** a missing or invalid variable but never print its value. `config/environment.ts` already works this way; keep it so.

## 4. Consent before any file change

- **Before creating, editing, moving, renaming or deleting any file**, show the user what will change (file list plus a summary, or the diff for small edits) and get an explicit "yes" in the current conversation.
- A "yes" covers only the change it was given for. It does not extend to follow-up changes, other files, or later tasks.
- **Deletion always needs its own explicit "yes"**, naming what will be deleted. This includes generated or gitignored files such as `.auth/` (even though `rm -rf .auth` is a documented command), `reports/`, `screenshots/`, `.playwright-cli/` and `node_modules/`.
- When a skill or another rule says to write or fix something, first present the change and ask. Apply it only after approval.
- If a change is needed mid-task and consent hasn't been given, stop and ask. Don't make the change and report it afterwards.

## 5. Commands that need explicit approval

Ask before running any of these, even if a similar command was approved earlier:

| Category | Commands |
|---|---|
| Git history and state | `git commit`, `git push`, `git reset`, `git restore`, `git checkout -- …`, `git clean`, `git rm`, `git branch -D`, `git rebase`, `git stash drop`, `git config`, any history rewrite |
| Deletion | `rm`, `rmdir`, `find … -delete`, `git clean` |
| Dependencies | `npm install` / `npm i` / `npm update` / `npm uninstall` (they change `package.json` and `package-lock.json`) |
| Account and credentials | `npm run signup` or `--profile signup` (creates a real account and rewrites `.env`) |

A plain chat request such as "commit it" counts as consent for that one commit only.

## 6. Live-app actions that need explicit approval

Anything that changes state on `zincbank.cydeo.io` needs a separate "yes": submitting `/apply`, transfers or bill pay, scheduled payments, changing the password, or opening a savings account. See also `test-documentation.md` Rule 5 and `playwright-ui-automation.md` §3. Never change the shared account's password.

## 7. Never read secret contents

- Never read or print the contents of `.env` or `.auth/`. To check that one exists, use `ls` or `test -f` only.
- To check whether a variable is set, rely on `config/environment.ts` failing with a named error. Never echo the value.
- Never paste secrets into tools, URLs, prompts, or external services.

## 8. CI and GitHub (when added)

- Credentials come only from GitHub Actions **secrets**, never from committed files, and are never echoed in logs.
- Trace artifacts (`reports/traces/`) contain the password, so upload them with short retention (e.g. `retention-days: 3`), and only from private repositories.
- Never run `@signup` in CI.
- Commit with a GitHub **noreply** email (`<id>+<username>@users.noreply.github.com`) so no personal email is published.

## 9. If a secret leaks

1. **Stop** and tell the user immediately: what leaked, where, and since when.
2. Don't try to hide it with a follow-up commit. Deleting a file in a new commit doesn't remove it from history.
3. Recommend rotating the credentials: create a fresh account with `npm run signup` (with consent) and delete `.auth/` (with consent), so the leaked session and password stop working.
4. Cleaning git history (e.g. `git filter-repo`) and force-pushing happen **only with explicit consent**, after the user has reviewed the plan.
