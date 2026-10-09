import { defineConfig, devices } from '@playwright/test';
import { env } from './env';

type LangOptions = { lang: 'en' | 'fr' };

export default defineConfig<LangOptions>({
  testDir: '../tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
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
    },
    {
      name: 'en-locale',
      testMatch: /(ui-tests|e2e-tests)\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], lang: 'en' },
    },
    {
      name: 'fr-locale',
      testMatch: /(ui-tests|e2e-tests)\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], lang: 'fr' },
    },
  ],
});
