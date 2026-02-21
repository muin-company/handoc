/**
 * Additional section-parser tests for uncovered paths.
 */
import { describe, it, expect } from 'vitest';
import { parseSection, extractText } from '../section-parser';
import { WarningCollector } from '@handoc/document-model';

describe('parseSection edge cases', () => {
  it('returns empty section for XML without sec element', () => {
    const section = parseSection('<root><p>text</p></root>');
    expect(section.paragraphs).toHaveLength(0);
  });

  it('emits warning for unknown elements under sec', () => {
    const warnings = new WarningCollector();
    const xml = `<?xml version="1.0"?>
      <sec>
        <unknownEl foo="bar"/>
        <p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
          <run charPrIDRef="0"><t>Hello</t></run>
        </p>
      </sec>`;
    const section = parseSection(xml, warnings);
    expect(section.paragraphs).toHaveLength(1);
    const warns = warnings.toJSON();
    expect(warns.some(w => w.message.includes('unknownEl'))).toBe(true);
  });

  it('parses section without warnings collector', () => {
    const xml = `<?xml version="1.0"?>
      <sec>
        <p><run><t>text</t></run></p>
      </sec>`;
    const section = parseSection(xml);
    expect(section.paragraphs).toHaveLength(1);
  });
});

describe('extractText', () => {
  it('extracts text from nested tables', () => {
    const xml = `<?xml version="1.0"?>
      <sec>
        <p>
          <run>
            <t>Before table</t>
            <tbl rowCnt="1" colCnt="1">
              <tr>
                <tc>
                  <subList>
                    <p><run><t>Cell text</t></run></p>
                  </subList>
                </tc>
              </tr>
            </tbl>
          </run>
        </p>
      </sec>`;
    const section = parseSection(xml);
    const text = extractText(section);
    expect(text.some(t => t.includes('Before table'))).toBe(true);
    expect(text.some(t => t.includes('Cell text'))).toBe(true);
  });

  it('extracts text from ctrl elements', () => {
    const xml = `<?xml version="1.0"?>
      <sec>
        <p>
          <run>
            <ctrl>
              <header applyPageType="BOTH">
                <subList>
                  <p><run><t>Header text</t></run></p>
                </subList>
              </header>
            </ctrl>
          </run>
        </p>
      </sec>`;
    const section = parseSection(xml);
    const text = extractText(section);
    expect(text.some(t => t.includes('Header text'))).toBe(true);
  });

  it('returns empty for section with no text', () => {
    const section = parseSection('<sec></sec>');
    const text = extractText(section);
    expect(text).toHaveLength(0);
  });

  it('extracts text from inlineObject elements', () => {
    const xml = `<?xml version="1.0"?>
      <sec>
        <p>
          <run>
            <pic imgIDRef="0">
              <caption>
                <subList>
                  <p><run><t>Picture caption</t></run></p>
                </subList>
              </caption>
            </pic>
          </run>
        </p>
      </sec>`;
    const section = parseSection(xml);
    const text = extractText(section);
    expect(text.some(t => t.includes('Picture caption'))).toBe(true);
  });

  it('extracts text from secPr elements', () => {
    const xml = `<?xml version="1.0"?>
      <sec>
        <p>
          <run>
            <secPr>
              <header>
                <subList>
                  <p><run><t>SecPr content</t></run></p>
                </subList>
              </header>
            </secPr>
          </run>
        </p>
      </sec>`;
    const section = parseSection(xml);
    const text = extractText(section);
    expect(text.some(t => t.includes('SecPr content'))).toBe(true);
  });
});
