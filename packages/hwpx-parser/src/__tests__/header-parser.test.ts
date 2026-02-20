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

  it('parses numbering properties from simple-text-header.xml', () => {
    const xml = loadFixture('simple-text-header.xml');
    const header = parseHeader(xml);

    expect(header.refList.numberings.length).toBe(1);
    const num = header.refList.numberings[0];
    expect(num.id).toBe(1);
    expect(num.start).toBe(0);
    expect(num.levels.length).toBe(10);

    // Level 1: DIGIT format, text "^1."
    expect(num.levels[0].level).toBe(1);
    expect(num.levels[0].numFormat).toBe('DIGIT');
    expect(num.levels[0].text).toBe('^1.');

    // Level 2: HANGUL_SYLLABLE
    expect(num.levels[1].level).toBe(2);
    expect(num.levels[1].numFormat).toBe('HANGUL_SYLLABLE');
    expect(num.levels[1].text).toBe('^2.');

    // Level 7: CIRCLED_DIGIT
    expect(num.levels[6].level).toBe(7);
    expect(num.levels[6].numFormat).toBe('CIRCLED_DIGIT');
    expect(num.levels[6].checkable).toBe(true);
  });

  it('parses bullet properties from simple-text-header.xml', () => {
    const xml = loadFixture('simple-text-header.xml');
    const header = parseHeader(xml);

    expect(header.refList.bullets.length).toBe(1);
    const bullet = header.refList.bullets[0];
    expect(bullet.id).toBe(1);
    expect(bullet.char).toBe('●');
    expect(bullet.useImage).toBe(false);
    expect(bullet.levels.length).toBe(1);
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

  it('parses offset as superscript/subscript convenience flags', () => {
    // Create a minimal header XML with offset attributes
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.5" secCnt="1">
        <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
        <hh:refList>
          <hh:fontfaces>
            <hh:fontface lang="HANGUL">
              <hh:font id="0" face="맑은 고딕" type="ttf" isEmbedded="0"/>
            </hh:fontface>
          </hh:fontfaces>
          <hh:charProperties>
            <hh:charPr id="0" height="1000">
              <hh:offset hangul="500" latin="500"/>
            </hh:charPr>
            <hh:charPr id="1" height="1000">
              <hh:offset hangul="-300" latin="-300"/>
            </hh:charPr>
            <hh:charPr id="2" height="1000">
            </hh:charPr>
          </hh:charProperties>
          <hh:paraProperties>
            <hh:paraPr id="0"/>
          </hh:paraProperties>
          <hh:styles>
            <hh:style id="0" type="para" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0"/>
          </hh:styles>
        </hh:refList>
      </hh:head>`;

    const header = parseHeader(xml);

    // CharPr id=0 should have superscript (positive offset)
    const cp0 = header.refList.charProperties.find((cp) => cp.id === 0);
    expect(cp0).toBeDefined();
    expect(cp0!.offset).toBeDefined();
    expect(cp0!.superscript).toBe(true);
    expect(cp0!.subscript).toBeUndefined();

    // CharPr id=1 should have subscript (negative offset)
    const cp1 = header.refList.charProperties.find((cp) => cp.id === 1);
    expect(cp1).toBeDefined();
    expect(cp1!.offset).toBeDefined();
    expect(cp1!.subscript).toBe(true);
    expect(cp1!.superscript).toBeUndefined();

    // CharPr id=2 should have neither (no offset)
    const cp2 = header.refList.charProperties.find((cp) => cp.id === 2);
    expect(cp2).toBeDefined();
    expect(cp2!.offset).toBeUndefined();
    expect(cp2!.superscript).toBeUndefined();
    expect(cp2!.subscript).toBeUndefined();
  });
});
