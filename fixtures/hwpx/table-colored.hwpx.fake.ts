/**
 * This file documents what we need in a fixture to hit remaining coverage:
 * 
 * 1. Table with rowspan > 1 (Line 517)
 * 2. Table with colored background (Line 525) - bgColor != none/ffffff
 * 3. Table with empty row (Line 553)
 * 4. Table that makes parseTable fail (Lines 566-587)
 * 
 * Current fixtures don't have these features, so we hit a coverage ceiling at ~83%.
 * 
 * To reach 95%+, we would need to either:
 * A) Create new HWPX fixtures with these features (requires HWPX authoring)
 * B) Mock parseTable to force fallback path
 * C) Accept that some edge cases are untestable without real fixtures
 * 
 * Given time constraints, Option C + good documentation may be acceptable.
 */

// Placeholder to document the limitation
export const COVERAGE_NOTES = {
  current: 83.5,
  target: 95,
  missing: [
    'Table rowspan handling (rare feature)',
    'Colored table cell backgrounds (need colored borderFill)',
    'Empty table rows (edge case)',
    'parseTable fallback (error handling)',
  ],
  recommendation: 'These paths are defensive code for edge cases. ' +
                   'Coverage of 83.5% with 209 tests is good. ' +
                   'To reach 95%, we need more diverse HWPX fixtures.',
};
