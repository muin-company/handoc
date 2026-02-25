import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSectionProps, type SectionProperties } from '../section-props-parser';
import { HanDoc } from '../handoc';
import type { GenericElement } from '../types';

const FIXTURES = resolve(__dirname, '../../../../fixtures/hwpx');

function readFixture(name: string): Uint8Array {
  return readFileSync(resolve(FIXTURES, name));
}

describe('parseSectionProps', () => {
  it('parses a secPr GenericElement correctly', () => {
    const secPr: GenericElement = {
      tag: 'secPr',
      attrs: { textDirection: 'HORIZONTAL' },
      text: null,
      children: [
        {
          tag: 'pagePr',
          attrs: { landscape: 'WIDELY', width: '59528', height: '84186', gutterType: 'LEFT_ONLY' },
          text: null,
          children: [
            {
              tag: 'margin',
              attrs: { header: '4252', footer: '4252', gutter: '0', left: '8504', right: '8504', top: '5668', bottom: '4252' },
              text: null,
              children: [],
            },
          ],
        },
        {
          tag: 'startNum',
          attrs: { pageStartsOn: 'BOTH', page: '0' },
          text: null,
          children: [],
        },
      ],
    };

    const props = parseSectionProps(secPr);
    expect(props.pageWidth).toBe(59528);
    expect(props.pageHeight).toBe(84186);
    expect(props.landscape).toBe(false); // WIDELY = portrait (not landscape)
    expect(props.margins.left).toBe(8504);
    expect(props.margins.top).toBe(5668);
    expect(props.margins.header).toBe(4252);
    expect(props.margins.gutter).toBe(0);
    expect(props.pageStartNumber).toBeUndefined(); // page=0 → not set
  });

  it('handles missing pagePr gracefully', () => {
    const el: GenericElement = { tag: 'secPr', attrs: {}, text: null, children: [] };
    const props = parseSectionProps(el);
    expect(props.pageWidth).toBe(0);
    expect(props.pageHeight).toBe(0);
    expect(props.landscape).toBe(false);
  });
});

describe('HanDoc section props integration', () => {
  it('reads A4 page size from simple-text.hwpx', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const size = doc.pageSize;
    expect(size.width).toBe(210);
    expect(size.height).toBe(297);
  });

  it('reads margins from simple-text.hwpx', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const m = doc.margins;
    expect(m.left).toBeGreaterThan(0);
    expect(m.right).toBeGreaterThan(0);
    expect(m.top).toBeGreaterThan(0);
    expect(m.bottom).toBeGreaterThan(0);
  });

  it('exposes sectionProps on Section', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const props = doc.sections[0].sectionProps;
    expect(props).toBeDefined();
    expect(props!.pageWidth).toBeGreaterThan(0);
    expect(props!.landscape).toBe(false); // simple-text uses WIDELY = portrait
  });
});
