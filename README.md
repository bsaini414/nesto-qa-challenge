# Nesto Signup QA Challenge 

Playwright + TypeScript automation for the Nesto signup page (`/signup`). It covers the API, the UI, and end-to-end flows in English and French, across desktop browsers and a mobile profile.

> The suite creates real accounts. Only run it against QA or staging. `config/env.ts` refuses hosts that don't look like QA/staging/preview/UAT, for local and CI runs alike.

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
| `QA_BASE_URL` | `https://app.qa.nesto.ca` | Target site. Must be QA or staging; anything else stops the run. |
| `REPORT_DIR` | `playwright` | Subfolder under `reports/` for the run output. |
| `UI_RETRIES` | `0` locally, `2` in CI | Retries for UI and E2E tests. |
| `ACCOUNT_CLEANUP_METHOD` | `DELETE` | HTTP method used to clean up created accounts. |
| `ACCOUNT_CLEANUP_PATH` | `/api/accounts/{id}` | Cleanup path. Cleanup currently returns `404`, so accounts stay in QA. |
| `WAIT_SHORT_MS`, `WAIT_LONG_MS`, `WAIT_VERY_LONG_MS` | `500`, `3000`, `10000` | Override the wait presets in `src/utils/wait.ts`. |

## Running the tests

| Command | What it runs |
| --- | --- |
| `npm test` | Everything, all 9 projects |
| `npm run test:en` | Chromium, English only |
| `npm run test:fr` | Chromium, French only |
| `npm run test:smoke` | Smoke tests (`@smoke`) on API, Chromium EN and FR, excluding known bugs |
| `npm run test:smoke:pr` | Smoke as run on push and pull requests: skips tests that create accounts, except the E2E signup |
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
| `mobile-en`, `mobile-fr` | iPhone 17 profile on WebKit (Safari engine) | EN, FR |
| `android-en`, `android-fr` | Pixel 10 Pro profile on Chromium | EN, FR |

On mobile, the header links and language switch sit in the burger menu. The mobile-specific tests are at the bottom of `tests/e2e-tests/signup-e2e.spec.ts`.

### Mobile profiles

Profiles come from Playwright's device list in `config/playwright.config.ts`. Playwright's viewport is the browser area, not the full screen.

| Profile | Used for | Engine | Viewport |
| --- | --- | --- | --- |
| iPhone 17 | iOS Safari layout | WebKit | 402×681 |
| Pixel 10 Pro | Android Chrome layout | Chromium | 427×876 |

Playwright has no Pixel 11 Pro profile, so Android uses Pixel 10 Pro. The mobile limits and the manual iPhone checks are under "Known limitations".

## Accessibility

- Each locale gets an axe scan (WCAG 2.0/2.1 A and AA) on page load and with field errors shown. The tests expect zero violations.
- Every field is checked for a visible label and a matching accessible name (what a screen reader announces), not only its placeholder.
- Automated scans catch only part of accessibility issues. Screen-reader and keyboard-only checks are manual.

## Known bugs

Tests for known defects use `knownBug('BUG-xx')` from `src/utils/known-bug.ts`. This adds the `@known-bug` tag, so they run separately and their failures don't block the build. Each bug is described in `docs/BUG_REPORT.md` and tracked by a Jira ticket; the tag is removed when the ticket is closed.

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
  fixtures/             Shared fixtures: account cleanup, consent banner blocked, geolocation mocked
  pages/                Signup page object (role/label locators and actions)
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
  BUG_REPORT.md         Defects found, BUG-01 to BUG-13
.github/workflows/
  smoke.yml             Smoke run (push, pull request, deploy dispatch, manual)
  nightly.yml           Nightly API, UI, and E2E jobs per browser
```

## CI

- **Smoke** (`smoke.yml`): runs on every push and pull request to `main`, on a `repository_dispatch` from the app repo after a staging deploy, or by hand with a URL input. On push and pull requests it skips tests tagged `@creates-account`, except the E2E signup (`@pr-smoke`), so each run creates only one account per language. Deploy and manual runs include everything.
- **Nightly** (`nightly.yml`): runs daily at 02:00 UTC (`0 2 * * *`) and can be started by hand. It has separate API, UI, and E2E jobs; UI and E2E run a browser matrix.

Both workflows also run `check-target.js` before any test, as a second check. Reporting back to the app pull request needs a token with status-write access to the app repository. This is not configured yet.

## Last run

Both runs used commit `524a351` against `https://app.qa.nesto.ca` on 2026-10-12. Skipped tests are known bugs (`@known-bug`), which CI skips with `SKIP_KNOWN_BUGS`.

| Workflow | Trigger | Result | Total | Passed | Needed a retry | Skipped (known bugs) |
| --- | --- | --- | --- | --- | --- | --- |
| [Smoke](https://github.com/bsaini414/nesto-qa-challenge/actions/runs/38316209260) | push | Passed, 1m30s | 81 | 39 | 0 | 42 |
| [Nightly regression](https://github.com/bsaini414/nesto-qa-challenge/actions/runs/38316402273) | manual | Passed, 11 jobs | 675 | 521 | 7 | 154 |

"Passed" includes tests that needed a retry. "Needed a retry" shows how many of them failed the first attempt.

Nightly per job:

| Job | Total | Passed | Needed a retry | Skipped (known bugs) |
| --- | --- | --- | --- | --- |
| API | 75 | 34 | 0 | 41 |
| UI (chromium, firefox, webkit, android, mobile) | 72 each | 66 each | 1 (mobile) | 6 each |
| E2E chromium / firefox | 48 each | 28 each | 0 | 20 each |
| E2E webkit | 48 | 29 | 2 | 19 |
| E2E mobile / android | 48 each | 36 each | 4 (mobile) | 12 each |

The 7 tests that needed a retry all ran on the WebKit (Safari) engine (`webkit-fr`, `mobile-en`), mostly burger-menu and new-tab navigation. They are being watched.

## Known limitations

- **Mobile projects are emulations.** They cover screen size, touch support, user agent, and browser engine.
- **They cannot test real taps and clicks on an iPhone**, the on-screen keyboard, the Safari toolbar, or iOS-specific behaviour.
- **A passing mobile run means the layout and logic work in the iPhone profile.** It does not mean the site works on an iPhone.
- **Validate on a real iPhone manually before a release:**
  - Check that the burger menu opens, and Login and the language switch work
  - Verify phone-country and province dropdowns open and select values natively
  - Ensure the on-screen virtual keyboard does not obscure active input fields
  - Verify password and confirm password fields accept input and render inline validation
  - Confirm the submit button touch target can be tapped cleanly
- **Accounts are not cleaned up yet.** Every `201` is recorded and a cleanup is attempted, but the assumed `DELETE /api/accounts/{id}` returns `404`, so accounts stay in QA until a supported cleanup endpoint exists.
- **Intermittent login blocks under parallel load.** Auth0 can return `429 too_many_attempts` when several signups log in from one machine at once. The signup-to-Get A Quote test can fail in full parallel runs. See BUG-11 and `docs/ASSUMPTIONS.md`.
- **Later:** add a cloud device service such as BrowserStack or Sauce Labs to run these checks on real iPhone and Android devices automatically.


## Contributing

- Put new assumptions in `docs/ASSUMPTIONS.md` and new defects in `docs/BUG_REPORT.md`.
- Run `npm run typecheck` before committing.
- Don't commit `.env`, `reports/`, or `node_modules/`.
