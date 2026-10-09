/**
 * Tags a test as covering a known defect in BUG_REPORT.md.
 * The test still runs and fails until the defect is fixed.
 * Usage: test('name', knownBug('BUG-11'), async ({ page }) => { ... });
 */
export const knownBug = (id: string) => ({
  annotation: { type: 'bug', description: id },
});
