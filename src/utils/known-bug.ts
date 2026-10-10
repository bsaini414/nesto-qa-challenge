
 //Tags a test as covering a known defect in BUG_REPORT.md.
export const knownBug = (id: string) => ({
  tag: '@known-bug',
  annotation: { type: 'bug', description: id },
});
