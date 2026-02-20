import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHeader } from '../header-parser.js';

const __dirname2 = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname2, '../../../../fixtures/xml-dumps');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

const FIXTURE_FILES = [
  'simple-text-header.xml',
  'styled-text-header.xml',
  'table-basic-header.xml',
  'empty-header.xml',
  'multi-section-header.xml',
];

describe('parseHeader', () => {
  it('parses simple-text-header.xml with HANGUL fontFace', () => {
    const xml = loadFixture('simple-text-header.xml');
    const header = parseHeader(xml);

    expect(header.version).toBe('1.5');
    expect(header.secCnt).toBe(1);
    expect(header.beginNum.page).toBe(1);
    expect(header.beginNum.footnote).toBe(1);

    const hangul = header.refList.fontFaces.find((f) => f.lang === 'HANGUL');
    expect(hangul).toBeDefined();
    expect(hangul!.fonts.length).toBeGreaterThanOrEqual(1);
    expect(hangul!.fonts[0].face).toBe('함초롬돋움');
  });

  it('parses styled-text-header.xml with multiple charProperties', () => {
    const xml = loadFixture('styled-text-header.xml');
    const header = parseHeader(xml);

    expect(header.refList.charProperties.length).toBeGreaterThanOrEqual(2);
    expect(header.refList.styles.length).toBeGreaterThan(0);
    expect(header.refList.styles[0].name).toBe('바탕글');
  });

  it('parses table-basic-header.xml with borderFills', () => {
    const xml = loadFixture('table-basic-header.xml');
    const header = parseHeader(xml);

    expect(header.refList.borderFills.length).toBeGreaterThanOrEqual(1);
  });

  for (const file of FIXTURE_FILES) {
    it(`parses ${file} without error`, () => {
      const xml = loadFixture(file);
      const header = parseHeader(xml);

      expect(header.version).toBeTruthy();
      expect(header.refList.fontFaces.length).toBeGreaterThan(0);
      expect(header.refList.charProperties.length).toBeGreaterThan(0);
      expect(header.refList.paraProperties.length).toBeGreaterThan(0);
      expect(header.refList.styles.length).toBeGreaterThan(0);
    });
  }
});
