import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { readHwp } from '../hwp-reader.js';
import { extractTextFromHwp } from '../text-extractor.js';

const fixturesDir = process.env.HANDOC_FIXTURES_DIR;
const realHwpDir = fixturesDir
  ? join(fixturesDir, 'real-world', 'education-hwp')
  : null;

const hwpFiles = realHwpDir
  ? readdirSync(realHwpDir).filter(f => f.endsWith('.hwp'))
  : [];

const describeIf = realHwpDir ? describe : describe.skip;

describeIf('real HWP files', () => {

  it.each(hwpFiles)('%s — readHwp succeeds with valid header', (filename) => {
    const buf = readFileSync(join(realHwpDir!, filename));
    const doc = readHwp(buf);

    // FileHeader version should be 5.x
    expect(doc.fileHeader.version.major).toBe(5);
    expect(doc.fileHeader.version.minor).toBeGreaterThanOrEqual(0);
  });

  it.each(hwpFiles)('%s — extractTextFromHwp returns non-empty Korean text', (filename) => {
    const buf = readFileSync(join(realHwpDir!, filename));
    const text = extractTextFromHwp(buf);

    expect(text.length).toBeGreaterThan(0);
    // Should contain at least some Korean characters
    expect(text).toMatch(/[\uAC00-\uD7AF]/);
  });
});
