#!/usr/bin/env node
// Refuses to run against a production host. Usage: node scripts/check-target.js <url>
const url = process.argv[2];
if (!url) {
  console.error('No target URL set (QA_BASE_URL is empty).');
  process.exit(1);
}

const host = new URL(url).hostname;
const looksLikeNonProd = /(^|[.-])(qa|staging|stage|preview|uat)([.-]|$)/i;
const looksLikeProd = /prod|production/i;

if (looksLikeProd.test(host) || !looksLikeNonProd.test(host)) {
  console.error(`Refusing to run: ${host} is not a recognised QA, staging or preview host.`);
  process.exit(1);
}
console.log(`Target OK: ${url}`);
