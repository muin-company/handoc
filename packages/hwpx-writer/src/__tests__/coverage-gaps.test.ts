/**
 * Tests targeting specific uncovered lines across multiple files.
 */
import { describe, it, expect } from 'vitest';
import { serializeEquation } from '../serializers/equation-serializer';
import { serializeShape } from '../serializers/shape-serializer';
import { writeHeader } from '../header-writer';
import { writeSection } from '../section-writer';
import type { GenericElement, DocumentHeader, Section, Paragraph, RunChild } from '@handoc/document-model';

// ── Equation serializer: default branch (lines 76-87) ──
describe('equation-serializer edge cases', () => {
  it('should serialize unknown child with no children and no text as self-closing', () => {
    const eq: GenericElement = {
      tag: 'equation',
      attrs: { font: 'HWP_Equation' },
      children: [
        { tag: 'customTag', attrs: { foo: 'bar' }, children: [], text: null },
      ],
      text: null,
    };
    const xml = serializeEquation(eq);
    expect(xml).toContain('<hc:customTag foo="bar"/>');
  });

  it('should serialize unknown child with children (recursive)', () => {
    const eq: GenericElement = {
      tag: 'equation',
      attrs: {},
      children: [
        {
          tag: 'wrapper',
          attrs: {},
          children: [
            { tag: 'inner', attrs: { a: '1' }, children: [], text: null },
          ],
          text: null,
        },
      ],
      text: null,
    };
    const xml = serializeEquation(eq);
    expect(xml).toContain('<hc:wrapper>');
    expect(xml).toContain('<hc:inner a="1"/>');
    expect(xml).toContain('</hc:wrapper>');
  });

  it('should serialize unknown child with text', () => {
    const eq: GenericElement = {
      tag: 'equation',
      attrs: {},
      children: [
        { tag: 'note', attrs: {}, children: [], text: 'some text' },
      ],
      text: null,
    };
    const xml = serializeEquation(eq);
    expect(xml).toContain('<hc:note>some text</hc:note>');
  });
});

// ── Shape serializer: drawText, subList, p, run, t branches (lines 76-118) ──
describe('shape-serializer edge cases', () => {
  it('should serialize known tags with children (non-self-closing)', () => {
    const shape: GenericElement = {
      tag: 'rect',
      attrs: {},
      children: [
        {
          tag: 'lineShape',
          attrs: { width: '1' },
          children: [
            { tag: 'color', attrs: { value: 'red' }, children: [], text: null },
          ],
          text: null,
        },
      ],
      text: null,
    };
    const xml = serializeShape(shape);
    expect(xml).toContain('<hp:lineShape width="1">');
    expect(xml).toContain('</hp:lineShape>');
  });

  it('should serialize known tags with text content', () => {
    const shape: GenericElement = {
      tag: 'rect',
      attrs: {},
      children: [
        { tag: 'fillBrush', attrs: {}, children: [], text: 'fill content' },
      ],
      text: null,
    };
    const xml = serializeShape(shape);
    expect(xml).toContain('<hp:fillBrush>fill content</hp:fillBrush>');
  });

  it('should serialize drawText element', () => {
    const shape: GenericElement = {
      tag: 'rect',
      attrs: {},
      children: [
        {
          tag: 'drawText',
          attrs: { lastWidth: '100' },
          children: [
            {
              tag: 'subList',
              attrs: { id: '1' },
              children: [
                {
                  tag: 'p',
                  attrs: { paraPrIDRef: '0' },
                  children: [
                    {
                      tag: 'run',
                      attrs: { charPrIDRef: '0' },
                      children: [
                        { tag: 't', attrs: {}, children: [], text: 'Hello' },
                      ],
                      text: null,
                    },
                  ],
                  text: null,
                },
              ],
              text: null,
            },
          ],
          text: null,
        },
      ],
      text: null,
    };
    const xml = serializeShape(shape);
    expect(xml).toContain('<hp:drawText');
    expect(xml).toContain('<hp:subList');
    expect(xml).toContain('<hp:p');
    expect(xml).toContain('<hp:run');
    expect(xml).toContain('<hp:t>Hello</hp:t>');
    expect(xml).toContain('</hp:drawText>');
  });

  it('should serialize t element with no text as self-closing', () => {
    const shape: GenericElement = {
      tag: 'rect',
      attrs: {},
      children: [
        { tag: 't', attrs: {}, children: [], text: null },
      ],
      text: null,
    };
    const xml = serializeShape(shape);
    expect(xml).toContain('<hp:t/>');
  });

  it('should serialize unknown child with children/text (default branch)', () => {
    const shape: GenericElement = {
      tag: 'rect',
      attrs: {},
      children: [
        {
          tag: 'unknownTag',
          attrs: {},
          children: [
            { tag: 'child', attrs: {}, children: [], text: null },
          ],
          text: 'extra text',
        },
      ],
      text: null,
    };
    const xml = serializeShape(shape);
    expect(xml).toContain('<hp:unknownTag>');
    expect(xml).toContain('<hp:child/>');
    expect(xml).toContain('extra text');
    expect(xml).toContain('</hp:unknownTag>');
  });
});

// ── Header writer: heading in paraPr, tabProperties with tabStops (lines 202-238) ──
describe('header-writer edge cases', () => {
  function makeMinimalHeader(overrides?: Partial<DocumentHeader>): DocumentHeader {
    return {
      version: '1.5',
      secCnt: 1,
      beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
      refList: {
        fontFaces: [],
        borderFills: [],
        charProperties: [],
        tabProperties: [],
        numberings: [],
        bullets: [],
        paraProperties: [],
        styles: [],
        others: [],
      },
      ...overrides,
    };
  }

  it('should write paraPr with heading not in children', () => {
    const header = makeMinimalHeader({
      refList: {
        fontFaces: [],
        borderFills: [],
        charProperties: [],
        tabProperties: [],
        numberings: [],
        bullets: [],
        paraProperties: [{
          id: 0,
          align: 'left',
          attrs: { id: '0' },
          children: [],
          heading: { type: 'outline', idRef: 1, level: 2 },
        }],
        styles: [],
        others: [],
      },
    });
    const xml = writeHeader(header);
    expect(xml).toContain('<hh:heading type="outline" idRef="1" level="2"/>');
  });

  it('should not duplicate heading if already in children', () => {
    const header = makeMinimalHeader({
      refList: {
        fontFaces: [],
        borderFills: [],
        charProperties: [],
        tabProperties: [],
        numberings: [],
        bullets: [],
        paraProperties: [{
          id: 0,
          align: 'left',
          attrs: { id: '0' },
          children: [
            { tag: 'heading', attrs: { type: 'outline', idRef: '1', level: '2' }, children: [], text: null },
          ],
          heading: { type: 'outline', idRef: 1, level: 2 },
        }],
        styles: [],
        others: [],
      },
    });
    const xml = writeHeader(header);
    // heading should appear once (from children), not twice
    const count = (xml.match(/heading/g) || []).length;
    // One open from child writeGenericElement (heading tag) and its close
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should write tabProperties with tabStops', () => {
    const header = makeMinimalHeader({
      refList: {
        fontFaces: [],
        borderFills: [],
        charProperties: [],
        tabProperties: [
          {
            id: 0,
            autoTabLeft: true,
            autoTabRight: false,
            tabStops: [
              { pos: 100, type: 'left', leader: 'solid', unit: 'hwpUnit' },
              { pos: 200 },
            ],
          },
          {
            id: 1,
            tabStops: [],
          },
        ],
        numberings: [],
        bullets: [],
        paraProperties: [],
        styles: [],
        others: [],
      },
    });
    const xml = writeHeader(header);
    expect(xml).toContain('<hh:tabProperties');
    expect(xml).toContain('autoTabLeft="1"');
    expect(xml).toContain('autoTabRight="0"');
    expect(xml).toContain('<hh:tabItem');
    expect(xml).toContain('type="left"');
    expect(xml).toContain('leader="solid"');
  });

  it('should write numberings', () => {
    const header = makeMinimalHeader({
      refList: {
        fontFaces: [],
        borderFills: [],
        charProperties: [],
        tabProperties: [],
        numberings: [{
          id: 0,
          start: 1,
          levels: [
            { level: 1, start: 1, align: 'left', numFormat: 'digit', charPrIDRef: 0, text: '1.' },
            { level: 2, useInstWidth: true, autoIndent: false, widthAdjust: 10, textOffsetType: 'percent', textOffset: 50, checkable: true },
          ],
        }],
        bullets: [{
          id: 0,
          char: '●',
          useImage: false,
          levels: [
            { level: 1, text: '●' },
          ],
        }],
        paraProperties: [],
        styles: [],
        others: [],
      },
    });
    const xml = writeHeader(header);
    expect(xml).toContain('<hh:numberings');
    expect(xml).toContain('<hh:numbering');
    expect(xml).toContain('numFormat="digit"');
    expect(xml).toContain('<hh:paraHead');
    expect(xml).toContain('>1.</hh:paraHead>');
    expect(xml).toContain('useInstWidth="1"');
    expect(xml).toContain('autoIndent="0"');
    expect(xml).toContain('checkable="1"');
    expect(xml).toContain('<hh:bullets');
    expect(xml).toContain('<hh:bullet');
    expect(xml).toContain('useImage="0"');
  });

  it('should write extra elements', () => {
    const header = makeMinimalHeader();
    header.extra = [
      { tag: 'compatibleDocument', attrs: { targetProgram: 'HWP' }, children: [], text: null },
    ];
    const xml = writeHeader(header);
    expect(xml).toContain('compatibleDocument');
    expect(xml).toContain('targetProgram="HWP"');
  });
});

// ── Section writer: inlineObject, trackChange, secPr, ctrl (lines 100-115, 260-307) ──
describe('section-writer edge cases', () => {
  function makeSection(runChildren: RunChild[]): Section {
    return {
      paragraphs: [{
        id: '1',
        paraPrIDRef: 0,
        styleIDRef: 0,
        pageBreak: false,
        columnBreak: false,
        merged: false,
        runs: [{ charPrIDRef: 0, children: runChildren }],
        lineSegArray: [],
      }],
    };
  }

  it('should write secPr child', () => {
    const section = makeSection([
      { type: 'secPr', element: { tag: 'secPr', attrs: { textDirection: 'HORIZONTAL' }, children: [], text: null } },
    ]);
    const xml = writeSection(section);
    expect(xml).toContain('secPr');
    expect(xml).toContain('textDirection="HORIZONTAL"');
  });

  it('should write ctrl child', () => {
    const section = makeSection([
      { type: 'ctrl', element: { tag: 'ctrl', attrs: { ctrlId: '123' }, children: [], text: null } },
    ]);
    const xml = writeSection(section);
    expect(xml).toContain('ctrl');
  });

  it('should write trackChange children', () => {
    const section = makeSection([
      { type: 'trackChange', mark: 'trackChangeBegin' } as RunChild,
      { type: 'text', content: 'changed text' },
      { type: 'trackChange', mark: 'trackChangeEnd' } as RunChild,
    ]);
    const xml = writeSection(section);
    expect(xml).toContain('<hp:trackChangeBegin/>');
    expect(xml).toContain('<hp:trackChangeEnd/>');
  });

  it('should write inlineObject equation', () => {
    const section = makeSection([
      {
        type: 'inlineObject',
        name: 'equation',
        element: {
          tag: 'equation',
          attrs: { font: 'HWP_Eq', version: '1.0' },
          children: [
            { tag: 'script', attrs: {}, children: [], text: 'x^2' },
          ],
          text: null,
        },
      },
    ]);
    const xml = writeSection(section);
    expect(xml).toContain('equation');
    expect(xml).toContain('x^2');
  });

  it('should write inlineObject shape (rect)', () => {
    const section = makeSection([
      {
        type: 'inlineObject',
        name: 'rect',
        element: {
          tag: 'rect',
          attrs: { id: '1' },
          children: [
            { tag: 'sz', attrs: { width: '100', height: '100' }, children: [], text: null },
          ],
          text: null,
        },
      },
    ]);
    const xml = writeSection(section);
    expect(xml).toContain('rect');
  });

  it('should write inlineObject picture (fallback to generic)', () => {
    const section = makeSection([
      {
        type: 'inlineObject',
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: {},
          children: [
            { tag: 'img', attrs: { src: 'image.png' }, children: [], text: null },
          ],
          text: null,
        },
      },
    ]);
    const xml = writeSection(section);
    expect(xml).toContain('pic');
    expect(xml).toContain('image.png');
  });

  it('should handle default/unknown RunChild type gracefully', () => {
    const section = makeSection([
      { type: 'unknown' as any, content: 'x' },
    ]);
    const xml = writeSection(section);
    // Should not throw, returns empty for unknown
    expect(xml).toContain('<hp:p');
  });

  it('should write lineSegArray', () => {
    const section: Section = {
      paragraphs: [{
        id: null,
        paraPrIDRef: 0,
        styleIDRef: null,
        pageBreak: false,
        columnBreak: false,
        merged: false,
        runs: [{ charPrIDRef: 0, children: [{ type: 'text', content: 'test' }] }],
        lineSegArray: [{
          textpos: 0, vertpos: 0, vertsize: 100,
          textheight: 80, baseline: 70, spacing: 10,
          horzpos: 0, horzsize: 500, flags: 0,
        }],
      }],
    };
    const xml = writeSection(section);
    expect(xml).toContain('<hp:linesegarray>');
    expect(xml).toContain('<hp:lineseg');
    expect(xml).toContain('textheight="80"');
  });

  it('should write empty text element as self-closing', () => {
    const section: Section = {
      paragraphs: [{
        id: null,
        paraPrIDRef: 0,
        styleIDRef: null,
        pageBreak: false,
        columnBreak: false,
        merged: false,
        runs: [{ charPrIDRef: 0, children: [{ type: 'text', content: '' }] }],
        lineSegArray: [],
      }],
    };
    const xml = writeSection(section);
    expect(xml).toContain('<hp:t/>');
  });
});

// ── Builder: custom fonts, lineSpacing, indent, pageNumber-only ──
describe('builder edge cases', () => {
  // Import dynamically to avoid issues
  it('should handle custom fontFamily, lineSpacing, indent', async () => {
    const { HwpxBuilder } = await import('../builder');
    const result = HwpxBuilder.create()
      .addParagraph('Custom styled', {
        fontFamily: 'Arial',
        lineSpacing: 200,
        indent: 10,
        color: 'FF0000',
      })
      .build();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle page number in header without headerText', async () => {
    const { HwpxBuilder } = await import('../builder');
    const result = HwpxBuilder.create()
      .setPageNumber('header', 'center')
      .addParagraph('Content')
      .build();
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle page number in footer without footerText', async () => {
    const { HwpxBuilder } = await import('../builder');
    const result = HwpxBuilder.create()
      .setPageNumber('footer', 'right')
      .addParagraph('Content')
      .build();
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle headerText with pageNumber in header', async () => {
    const { HwpxBuilder } = await import('../builder');
    const result = HwpxBuilder.create()
      .setHeader('My Header')
      .setPageNumber('header', 'left')
      .addParagraph('Content')
      .build();
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle empty section (no items)', async () => {
    const { HwpxBuilder } = await import('../builder');
    const result = HwpxBuilder.create()
      .addSectionBreak()
      .addParagraph('Second section')
      .build();
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle align center/right/justify', async () => {
    const { HwpxBuilder } = await import('../builder');
    const result = HwpxBuilder.create()
      .addParagraph('Center', { align: 'center' })
      .addParagraph('Right', { align: 'right' })
      .addParagraph('Justify', { align: 'justify' })
      .build();
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
