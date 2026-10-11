import { test as base, APIRequestContext, Page, TestInfo } from '@playwright/test';
import * as en from '../../config/locales/en.json';
import * as fr from '../../config/locales/fr.json';

// An account created by a test, recorded so it can be cleaned up afterwards.
export interface CreatedAccount {
  id: number;
  email: string;
  accessToken: string;
}

// Locale strings (config/locales)
export type Locale = typeof en;

// Shape of the real /api/geolocation/all response, for a visitor in Quebec.
const geo = { region: 'Quebec', region_code: 'QC', country: 'Canada', country_code: 'CA', postal: 'H3H', error: false };
const GEOLOCATION_QC = { 'ipapi.co': { provider: 'ipapi.co', ...geo }, 'ipinfo.io': { provider: 'ipinfo.io', ...geo } };

// Cleanup assumption (see ASSUMPTIONS.md): DELETE /api/accounts/{id} with the account's bearer token deletes the account.
export async function cleanupAccount(request: APIRequestContext, account: CreatedAccount) {
  const path = process.env.ACCOUNT_CLEANUP_PATH || '/api/accounts/{id}';
  const method = (process.env.ACCOUNT_CLEANUP_METHOD || 'DELETE').toUpperCase();
  const res = await request.fetch(path.replace('{id}', String(account.id)), {
    method,
    headers: { Authorization: `Bearer ${account.accessToken}` },
    failOnStatusCode: false,
  });
  if (res.status() >= 300) {
    console.warn(`[cleanup] ${method} failed for account ${account.id}: ${res.status()}`);
  }
}

type Fixtures = {
  // Auto fixture: when SKIP_KNOWN_BUGS is set (CI), known-defect tests are reported as skipped and not run.
  skipKnownBugsInCi: void;
  // Accounts created during the test. Cleaned up automatically after each test.
  createdAccounts: CreatedAccount[];
  lang: 'en' | 'fr';
  strings: Locale;
  signupPath: string;
};

export const test = base.extend<Fixtures>({
  skipKnownBugsInCi: [
    async ({}, use, testInfo) => {
      if (process.env.SKIP_KNOWN_BUGS && testInfo.tags.includes("@known-bug")) {
        test.skip(true, "Known defect: not run in CI, see docs/BUG_REPORT.md");
      }
      await use();
    },
    { auto: true },
  ],

  lang: ['en', { option: true }],

  strings: async ({ lang }, use) => {
    await use((lang === 'fr' ? fr : en) as Locale);
  },

  signupPath: async ({ strings }, use) => {
    await use(strings.path);
  },

  // Browser tests only (API tests never request `page`, so no browser starts for them).
  page: async ({ page }, use) => {
    // Cookie consent
    await page.route('https://sdk.privacy-center.org/**', (route) => route.abort());
    // QC is the preselected province and phonecountry; do not depend on where the runner is. Tests can override this route.
    await page.route('**/api/geolocation/all', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GEOLOCATION_QC) }),
    );
    await use(page);
  },

  createdAccounts: async ({ request }, use) => {
    const accounts: CreatedAccount[] = [];
    await use(accounts);
    
    for (const account of accounts) {
      await cleanupAccount(request, account);
    }
  },
});


// Attaches a full-page screenshot when a test fails.
// Kept out of the shared fixtures so API tests (no browser) never launch one.
export async function attachFullPageOnFailure(page: Page, testInfo: TestInfo) {
  if (testInfo.status === testInfo.expectedStatus) return;
  try {
    const png = await page.screenshot({ fullPage: true });
    await testInfo.attach('full-page-on-failure', { body: png, contentType: 'image/png' });
  } catch {
    // page may already be closed; the default screenshot is still kept
  }
}

export { expect } from '@playwright/test';
