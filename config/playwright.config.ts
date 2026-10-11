import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import { env } from './env';

type LangOptions = { lang: 'en' | 'fr' };

// All generated output lives under reports/. REPORT_DIR picks the sub-folder for each CI step.
const reportDir = path.resolve(process.cwd(), 'reports', process.env.REPORT_DIR || 'playwright');
// Retries apply to UI and E2E only. API tests must pass first time.
const uiRetries = Number(process.env.UI_RETRIES ?? (process.env.CI ? 2 : 0));

// Mobile: iPhone 17 profile on WebKit (Safari engine), the closest Playwright match for iPhone Safari.
const iPhone17 = devices['iPhone 17'];

const browsers = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
  mobile: iPhone17,
  android: devices['Pixel 10 Pro'],
};

export default defineConfig<LangOptions>({
  testDir: '../tests',
  outputDir: `${reportDir}-output`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: reportDir }],
    ['json', { outputFile: `${reportDir}/results.json` }],
  ],
  use: {
    baseURL: env.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // API tests need no browser, so they run once.
      name: 'api',
      testMatch: /api-tests\/.*\.spec\.ts/,
      retries: 0,
    },
    // One locale per browser and language: e.g. chromium-en, firefox-fr, mobile-en.
    ...Object.entries(browsers).flatMap(([browser, device]) =>
      (['en', 'fr'] as const).map((lang) => ({
        name: `${browser}-${lang}`,
        testMatch: /(ui-tests|e2e-tests)\/.*\.spec\.ts/,
        retries: uiRetries,
        use: { ...device, lang },
      })),
    ),
  ],
});
