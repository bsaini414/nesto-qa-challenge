import { Page } from '@playwright/test';


export type WaitLevel = 'short' | 'long' | 'veryLong';

const DEFAULTS_MS: Record<WaitLevel, number> = {
  short: 500,
  long: 3000,
  veryLong: 10000,
};

const ENV_KEYS: Record<WaitLevel, string> = {
  short: 'WAIT_SHORT_MS',
  long: 'WAIT_LONG_MS',
  veryLong: 'WAIT_VERY_LONG_MS',
};

export function waitMs(level: WaitLevel): number {
  const raw = process.env[ENV_KEYS[level]];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULTS_MS[level];
}

export async function pause(page: Page, level: WaitLevel): Promise<void> {
  await page.waitForTimeout(waitMs(level));
}
