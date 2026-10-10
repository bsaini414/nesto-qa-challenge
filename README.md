# Nesto Signup QA Suite

Playwright + TypeScript automation for the Nesto signup page (`/signup`). It covers the API, the UI, and end-to-end flows in English and French, across desktop browsers and a mobile profile.

> The suite creates real accounts. Only run it against QA or staging. `scripts/check-target.js` refuses hosts that don't look like QA/staging/preview/UAT.

## Prerequisites

- Node.js (current LTS)
- npm
- Git

## Setup

```bash
git clone git@github.com:bsaini414/nesto-qa-challenge.git
cd nesto-qa-challenge
npm install
npx playwright install --with-deps chromium firefox webkit
cp .env.example .env
```

## Configuration

Settings are read from environment variables. `.env` is loaded locally and is git-ignored.

| Variable | Default | Purpose |
| --- | --- | --- |
| `QA_BASE_URL` | `https://app.qa.nesto.ca` | Target site. Must be QA or staging. |
| `REPORT_DIR` | `playwright` | Subfolder under `reports/` for the run output. |
| `UI_RETRIES` | `0` locally, `2` in CI | Retries for UI and E2E tests. |
| `ACCOUNT_CLEANUP_METHOD` | `DELETE` | HTTP method used to clean up created accounts. |
| `ACCOUNT_CLEANUP_PATH` | `/api/accounts/{id}` | Cleanup path. Cleanup currently returns `404`, so accounts stay in QA. |
| `WAIT_SHORT_MS`, `WAIT_LONG_MS`, `WAIT_VERY_LONG_MS` | `500`, `3000`, `30000` | Override the wait presets in `src/utils/wait.ts`. |

## Running the tests

| Command | What it runs |
| --- | --- |
| `npm test` | Everything, all 9 projects |
| `npm run test:en` | Chromium, English only |
| `npm run test:fr` | Chromium, French only |
| `npm run test:smoke` | Smoke tests (`@smoke`) on API, Chromium EN and FR, excluding known bugs |
| `npm run test:smoke:known` | Smoke tests tagged as known bugs |
| `npm run test:regression` | Everything except known bugs |
| `npm run test:known` | Only known-bug tests |
| `npm run typecheck` | TypeScript check, no tests |

You can also pass any Playwright flag, for example:

```bash
npx playwright test -c config/playwright.config.ts tests/ui-tests --project=webkit-fr
npx playwright test -c config/playwright.config.ts --grep "Successful signup" --workers=1
npx playwright test -c config/playwright.config.ts --headed --workers=1 --project=chromium-en
```

## Projects

| Project | Type | Locale |
| --- | --- | --- |
| `api` | API requests | n/a |
| `chromium-en`, `chromium-fr` | Desktop Chrome | EN, FR |
| `firefox-en`, `firefox-fr` | Desktop Firefox | EN, FR |
| `webkit-en`, `webkit-fr` | Desktop Safari engine | EN, FR |
| `mobile-en`, `mobile-fr` | iPhone 14 profile (390×844) on Chromium | EN, FR |

On mobile, the header links and language switch sit in the burger menu. The mobile-specific tests are at the bottom of `tests/e2e-tests/signup-e2e.spec.ts`.

## Known bugs

Tests for known defects use `knownBug('BUG-xx')` from `src/utils/known-bug.ts`. This adds the `@known-bug` tag, so they run separately and their failures don't block the build. Each bug is described in `docs/BUG_REPORT.md`.

## Reports

Results are written under `reports/`, which is git-ignored.

```bash
npx playwright show-report reports/playwright        # HTML report from the last run
node scripts/summary.js "My run" reports/playwright/results.json   # job-style summary
```

Failure screenshots, traces, and error context are in `reports/playwright-output/`.

A full run exits with code 1 because the known-bug tests fail on purpose. To check for real failures:

```bash
npm test > /tmp/full.txt 2>&1
grep "✘" /tmp/full.txt | grep -vc "@known-bug"
```

## Project structure

```
config/                 Playwright config and environment settings
  locales/              EN and FR text and validation messages
src/
  factories/            Random test data (faker)
  fixtures/             Shared fixtures, including account cleanup
  pages/                Signup page object (locators and actions)
  utils/                Wait presets and the known-bug helper
tests/
  api-tests/            API contract and negative cases
  ui-tests/             Form behaviour, validation, mocked API responses
  e2e-tests/            Full signup flows and mobile burger-menu checks
scripts/
  check-target.js       Refuses production-looking hosts
  summary.js            Builds the run summary
docs/
  ASSUMPTIONS.md        Assumptions made while writing the tests
  BUG_REPORT.md         Defects found, BUG-01 to BUG-12
.github/workflows/
  smoke.yml             Smoke run (on deploy dispatch or manual)
  nightly.yml           Nightly API, UI, and E2E jobs per browser
```

## CI

- **Smoke** (`smoke.yml`): triggered by a `repository_dispatch` from the app repo after a staging deploy, or started by hand with a URL input.
- **Nightly** (`nightly.yml`): runs daily at 02:00 UTC (`0 2 * * *`) and can be started by hand. It has separate API, UI, and E2E jobs; UI and E2E run a browser matrix.

Both workflows run `check-target.js` before any test. Reporting back to the app pull request needs a token with status-write access to the app repository. This is not configured yet.

## Known limitations

- **Accounts are not cleaned up.** The assumed `DELETE /api/accounts/{id}` returns `404`, so every signup leaves an account in QA.
- **Intermittent login blocks under parallel load.** Auth0 can return `429 too_many_attempts` when several signups log in from one machine at once. The signup-to-Get A Quote test can fail in full parallel runs. See BUG-12 and `docs/ASSUMPTIONS.md`.

## Contributing

- Put new assumptions in `docs/ASSUMPTIONS.md` and new defects in `docs/BUG_REPORT.md`.
- Run `npm run typecheck` before committing.
- Don't commit `.env`, `reports/`, or `node_modules/`.
