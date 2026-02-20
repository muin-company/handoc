import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { readHwp } from '../hwp-reader.js';
import { parseRecords, HWPTAG } from '../record-parser.js';
import { parseDocInfo } from '../docinfo-parser.js';
import { parseSectionContent } from '../body-parser.js';
import { extractRichContent } from '../text-extractor.js';

const fixturesDir = process.env.HANDOC_FIXTURES_DIR;
const realHwpDir = fixturesDir
  ? join(fixturesDir, 'real-world', 'education-hwp')
  : null;

const hwpFiles = realHwpDir
  ? readdirSync(realHwpDir).filter(f => f.endsWith('.hwp'))
  : [];

const describeIf = realHwpDir ? describe : describe.skip;

describeIf('rich HWP parsing', () => {
  it.each(hwpFiles)('%s — extracts font names from DocInfo', (filename) => {
    const buf = readFileSync(join(realHwpDir!, filename));
    const doc = readHwp(buf);
    const records = parseRecords(doc.docInfo);
    const docInfo = parseDocInfo(records);

    expect(docInfo.fontNames.length).toBeGreaterThan(0);
    // At least one font name should be a non-empty string
    expect(docInfo.fontNames[0].length).toBeGreaterThan(0);
  });

  it.each(hwpFiles)('%s — extracts char shapes (bold/italic detection)', (filename) => {
    const buf = readFileSync(join(realHwpDir!, filename));
    const doc = readHwp(buf);
    const records = parseRecords(doc.docInfo);
    const docInfo = parseDocInfo(records);

    expect(docInfo.charShapes.length).toBeGreaterThan(0);
    // Each char shape should have valid height
    for (const cs of docInfo.charShapes) {
      expect(cs.height).toBeGreaterThan(0);
      expect(typeof cs.bold).toBe('boolean');
      expect(typeof cs.italic).toBe('boolean');
    }
  });

  it.each(hwpFiles)('%s — extracts para shapes', (filename) => {
    const buf = readFileSync(join(realHwpDir!, filename));
    const doc = readHwp(buf);
    const records = parseRecords(doc.docInfo);
    const docInfo = parseDocInfo(records);

    expect(docInfo.paraShapes.length).toBeGreaterThan(0);
    for (const ps of docInfo.paraShapes) {
      expect(ps.align).toBeGreaterThanOrEqual(0);
      expect(ps.align).toBeLessThanOrEqual(5);
    }
  });

  it.each(hwpFiles)('%s — extractRichContent returns structured data', (filename) => {
    const buf = readFileSync(join(realHwpDir!, filename));
    const result = extractRichContent(buf);

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.docInfo.fontNames.length).toBeGreaterThan(0);
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.sections[0].paragraphs.length).toBeGreaterThan(0);
  });

  // Table detection: at least some of the education files should have tables
  it('detects tables in at least one file', () => {
    let totalTables = 0;
    for (const filename of hwpFiles) {
      const buf = readFileSync(join(realHwpDir!, filename));
      const result = extractRichContent(buf);
      for (const section of result.sections) {
        totalTables += section.tables.length;
      }
    }
    // Education documents typically have tables
    expect(totalTables).toBeGreaterThan(0);
  });

  // Control detection
  it('detects controls (tables/images) in at least one file', () => {
    let totalControls = 0;
    for (const filename of hwpFiles) {
      const buf = readFileSync(join(realHwpDir!, filename));
      const result = extractRichContent(buf);
      for (const section of result.sections) {
        totalControls += section.controls.length;
      }
    }
    expect(totalControls).toBeGreaterThan(0);
  });
});
