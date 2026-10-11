import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DEFAULT_BASE_URL = 'https://app.qa.nesto.ca';

// The suite creates real accounts, so it must never target production.
const NON_PROD_HOST = /(^|[.-])(qa|staging|stage|preview|uat)([.-]|$)/i;
const PROD_HOST = /prod|production/i;

export function assertNonProdTarget(url: string): void {
  const host = new URL(url).hostname;
  if (PROD_HOST.test(host) || !NON_PROD_HOST.test(host)) {
    throw new Error(`Refusing to run: ${host} is not a recognised QA, staging, preview or UAT host.`);
  }
}

const baseURL = process.env.QA_BASE_URL?.trim() || DEFAULT_BASE_URL;
assertNonProdTarget(baseURL);

export const env = { baseURL };
