#!/usr/bin/env node
// Writes a markdown summary of Playwright JSON results.
// Usage: node scripts/summary.js "<label>" <results.json> [more.json ...]
// Appends to $GITHUB_STEP_SUMMARY when it is set, and always prints to stdout.
const fs = require('fs');

const [, , label = 'Run', ...files] = process.argv;

const rows = [];
function walk(suite, depth, group) {
  const nextGroup = depth >= 1 && suite.title ? suite.title : group;
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      rows.push({
        project: test.projectName,
        group: nextGroup,
        title: spec.title,
        test,
        status: test.status,
        bugs: (test.annotations || []).filter((a) => a.type === 'bug').map((a) => a.description),
      });
    }
  }
  for (const child of suite.suites || []) walk(child, depth + 1, nextGroup);
}

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const suite of report.suites || []) walk(suite, 0, '');
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
const name = (r) => (r.group ? `${r.group} › ${r.title}` : r.title);

function classify(r) {
  if (r.status === 'flaky') return 'flaky';
  if (r.status === 'skipped') return 'skipped';
  if (r.bugs.length) return r.status === 'unexpected' ? 'known-failing' : 'known-passing';
  return r.status === 'expected' ? 'passed' : 'failed';
}

const projects = [...new Set(rows.map((r) => r.project))].sort();
const count = (project, kind) => rows.filter((r) => r.project === project && classify(r) === kind).length;

let md = `## ${esc(label)}\n\n`;
if (rows.length === 0) {
  md += 'No results found. Check that the test step ran.\n';
} else {
  md += '### Results by project\n\n';
  md += '| Project | Passed | Failed | Flaky (passed on retry) | Skipped | Known bugs (expected failures) |\n';
  md += '|---|---:|---:|---:|---:|---:|\n';
  for (const p of projects) {
    md += `| ${p} | ${count(p, 'passed')} | ${count(p, 'failed')} | ${count(p, 'flaky')} | ${count(p, 'skipped')} | ${count(p, 'known-failing')} |\n`;
  }

  const blocking = rows.filter((r) => classify(r) === 'failed');
  md += `\n### Blocking failures (${blocking.length})\n\n`;
  md += blocking.length
    ? blocking.slice(0, 50).map((r) => `- **${esc(r.project)}**: ${esc(name(r))}`).join('\n') + '\n'
    : 'None.\n';

  const known = rows.filter((r) => r.bugs.length);
  md += `\n### Known defects (${known.length} test runs)\n\n`;
  if (known.length) {
    md += '| Bug | Test | Project | Result |\n|---|---|---|---|\n';
    for (const r of known) {
      const result = classify(r) === 'known-failing' ? 'fails (expected)' : 'passes: remove the knownBug tag';
      md += `| ${esc(r.bugs.join(', '))} | ${esc(name(r))} | ${esc(r.project)} | ${result} |\n`;
    }
  } else {
    md += 'None.\n';
  }

  const flaky = rows.filter((r) => classify(r) === 'flaky');
  md += `\n### Flaky tests: passed on retry (${flaky.length})\n\n`;
  if (flaky.length) {
    md += '| Test | Project | Attempts | Passed on attempt |\n|---|---|---:|---:|\n';
    for (const r of flaky) {
      const results = r.test.results || [];
      const passedOn = results.findIndex((x) => x.status === 'passed') + 1;
      md += `| ${esc(name(r))} | ${esc(r.project)} | ${results.length} | ${passedOn} |\n`;
    }
  } else {
    md += 'None.\n';
  }
}

console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
