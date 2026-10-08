import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DEFAULT_BASE_URL = 'https://app.qa.nesto.ca';

export const env = {
  baseURL: process.env.QA_BASE_URL?.trim() || DEFAULT_BASE_URL,
};
