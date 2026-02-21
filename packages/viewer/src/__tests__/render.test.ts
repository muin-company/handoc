import { describe, it, expect } from 'vitest';
import { paragraphToHtml, runChildToHtml, sectionToHtml, documentToHtml } from '../render';
import type { Paragraph, Section, Run, RunChild, GenericElement } from '@handoc/document-model';
import type { RenderContext } from '../render';

const emptyCtx: RenderContext = {};

function makePara(runs: Run[], opts: Partial<Paragraph> = {}): Paragraph {
  return {
    id: null,
    paraPrIDRef: null,
    styleIDRef: null,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs,
    lineSegArray: [],
    ...opts,
  };
}

function makeRun(text: string, charPrIDRef: number | null = null): Run {
  return {
    charPrIDRef,
    children: [{ type: 'text', content: text }],
  };
}

describe('runChildToHtml', () => {
  it('renders text', () => {
    const child: RunChild = { type: 'text', content: 'Hello' };
    expect(runChildToHtml(child, emptyCtx)).toBe('Hello');
  });

  it('escapes HTML entities', () => {
    const child: RunChild = { type: 'text', content: '<b>test</b>' };
    expect(runChildToHtml(child, emptyCtx)).toBe('&lt;b&gt;test&lt;/b&gt;');
  });

  it('renders secPr as empty', () => {
    const child: RunChild = { type: 'secPr', element: { tag: 'secPr', attrs: {}, children: [], text: null } };
    expect(runChildToHtml(child, emptyCtx)).toBe('');
  });

  it('renders unknown RunChild type as empty (default case)', () => {
    const child = { type: 'unknownType' } as any;
    expect(runChildToHtml(child, emptyCtx)).toBe('');
  });
});

describe('paragraphToHtml', () => {
  it('renders empty paragraph with &nbsp;', () => {
    const para = makePara([]);
    const html = paragraphToHtml(para, emptyCtx);
    expect(html).toContain('&nbsp;');
    expect(html).toContain('class="handoc-para"');
  });

  it('renders text runs', () => {
    const para = makePara([makeRun('Hello '), makeRun('World')]);
    const html = paragraphToHtml(para, emptyCtx);
    expect(html).toContain('Hello ');
    expect(html).toContain('World');
    expect(html).toMatch(/^<p /);
  });

  it('renders paragraphs without styles (no header context)', () => {
    const para = makePara([makeRun('Plain text')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, emptyCtx);
    expect(html).toContain('Plain text');
  });

  it('renders runs without character properties', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('No style', 5)]); // ID 5 doesn't exist
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('No style');
  });

  it('skips empty runs when rendering paragraphs', () => {
    const para: Paragraph = {
      id: null,
      paraPrIDRef: null,
      styleIDRef: null,
      pageBreak: false,
      columnBreak: false,
      merged: false,
      runs: [
        { charPrIDRef: null, children: [{ type: 'secPr', element: { tag: 'secPr', attrs: {}, children: [], text: null } }] },
        makeRun('Visible text'),
      ],
      lineSegArray: [],
    };
    const html = paragraphToHtml(para, emptyCtx);
    expect(html).toContain('Visible text');
    expect(html).not.toContain('secPr');
  });

  it('applies character styles from header context', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [
            { id: 0, height: 1200, bold: true, italic: false, attrs: {}, children: [] },
          ],
          paraProperties: [],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Bold text', 0)]);
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('font-size:12pt');
  });

  it('applies paragraph alignment', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [
            { id: 0, align: 'center', attrs: {}, children: [] },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Centered')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('text-align:center');
  });

  it('applies paragraph margins', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [
            {
              id: 0,
              margin: {
                left: 1000,
                right: 2000,
                indent: 500,
                prev: 300,
                next: 300,
              },
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Indented')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('margin-left:');
    expect(html).toContain('margin-right:');
    expect(html).toContain('text-indent:');
    expect(html).toContain('margin-top:');
    expect(html).toContain('margin-bottom:');
  });

  it('applies line spacing (percent)', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [
            {
              id: 0,
              lineSpacing: { type: 'percent', value: 150 },
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Line spacing')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('line-height:150%');
  });

  it('applies line spacing (fixed)', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [
            {
              id: 0,
              lineSpacing: { type: 'fixed', value: 2000 },
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Fixed spacing')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('line-height:');
    expect(html).toContain('pt');
  });

  it('applies right alignment', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [
            { id: 0, align: 'right', attrs: {}, children: [] },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Right')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('text-align:right');
  });

  it('applies justify alignment', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [
            { id: 0, align: 'justify', attrs: {}, children: [] },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Justified')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('text-align:justify');
  });

  it('applies distribute alignment (mapped to justify)', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [
            { id: 0, align: 'distribute' as any, attrs: {}, children: [] },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Distributed')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('text-align:justify');
  });

  it('defaults to left alignment for unknown align value', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [
            { id: 0, align: 'unknown' as any, attrs: {}, children: [] },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Unknown')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('text-align:left');
  });
});

describe('sectionToHtml', () => {
  it('wraps paragraphs in handoc-page div', () => {
    const section: Section = {
      paragraphs: [makePara([makeRun('Test')])],
    };
    const html = sectionToHtml(section, emptyCtx, 0);
    expect(html).toContain('class="handoc-page"');
    expect(html).toContain('Test');
  });
});

describe('documentToHtml', () => {
  it('renders multiple sections', () => {
    const sections: Section[] = [
      { paragraphs: [makePara([makeRun('Section 1')])] },
      { paragraphs: [makePara([makeRun('Section 2')])] },
    ];
    const html = documentToHtml(sections, emptyCtx);
    expect(html).toContain('Section 1');
    expect(html).toContain('Section 2');
    expect(html.match(/handoc-page/g)?.length).toBe(2);
  });
});

describe('table rendering', () => {
  it('renders table from GenericElement', () => {
    const tableEl: GenericElement = {
      tag: 'hp:tbl',
      attrs: {},
      children: [
        {
          tag: 'hp:tr', attrs: {}, children: [
            { tag: 'hp:tc', attrs: {}, children: [], text: 'Cell A' },
            { tag: 'hp:tc', attrs: {}, children: [], text: 'Cell B' },
          ], text: null,
        },
      ],
      text: null,
    };
    const child: RunChild = { type: 'table', element: tableEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('<table');
    expect(html).toContain('Cell A');
    expect(html).toContain('Cell B');
  });

  it('uses flatFind for deeply nested table rows', () => {
    const tableEl: GenericElement = {
      tag: 'hp:tbl',
      attrs: {},
      children: [{
        tag: 'hp:tbody',
        attrs: {},
        children: [{
          tag: 'hp:tr',
          attrs: {},
          children: [{
            tag: 'hp:tc',
            attrs: {},
            children: [],
            text: 'Nested cell',
          }],
          text: null,
        }],
        text: null,
      }],
      text: null,
    };
    const child: RunChild = { type: 'table', element: tableEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('<table');
    expect(html).toContain('Nested cell');
  });

  it('renders fallback for table without rows', () => {
    const tableEl: GenericElement = {
      tag: 'hp:tbl',
      attrs: {},
      children: [{
        tag: 'hp:caption',
        attrs: {},
        children: [],
        text: 'Table caption',
      }],
      text: null,
    };
    const child: RunChild = { type: 'table', element: tableEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('handoc-table-fallback');
    expect(html).toContain('Table caption');
  });

  it('extracts text from deeply nested elements', () => {
    const tableEl: GenericElement = {
      tag: 'hp:tbl',
      attrs: {},
      children: [{
        tag: 'hp:div',
        attrs: {},
        children: [{
          tag: 'hp:p',
          attrs: {},
          children: [],
          text: 'Deep text',
        }],
        text: 'Level 1',
      }],
      text: 'Root text',
    };
    const child: RunChild = { type: 'table', element: tableEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('Root text');
    expect(html).toContain('Level 1');
    expect(html).toContain('Deep text');
  });

  it('handles table cells with colspan and rowspan', () => {
    const tableEl: GenericElement = {
      tag: 'hp:tbl',
      attrs: {},
      children: [{
        tag: 'hp:tr',
        attrs: {},
        children: [
          {
            tag: 'hp:tc',
            attrs: { colSpan: '2', rowSpan: '3' },
            children: [],
            text: 'Merged',
          },
          {
            tag: 'hp:tc',
            attrs: {},
            children: [],
            text: 'Normal',
          },
        ],
        text: null,
      }],
      text: null,
    };
    const child: RunChild = { type: 'table', element: tableEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('colspan="2"');
    expect(html).toContain('rowspan="3"');
  });

  it('skips cells with colspan="1"', () => {
    const tableEl: GenericElement = {
      tag: 'hp:tbl',
      attrs: {},
      children: [{
        tag: 'hp:tr',
        attrs: {},
        children: [{
          tag: 'hp:tc',
          attrs: { colSpan: '1', rowSpan: '1' },
          children: [],
          text: 'Single',
        }],
        text: null,
      }],
      text: null,
    };
    const child: RunChild = { type: 'table', element: tableEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).not.toContain('colspan');
    expect(html).not.toContain('rowspan');
  });
});

describe('text color rendering', () => {
  it('applies text color', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [
            { id: 0, height: 1000, textColor: 'ff0000', attrs: {}, children: [] },
          ],
          paraProperties: [],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Red', 0)]);
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('color:#ff0000');
  });
});

describe('text decoration rendering', () => {
  it('applies underline', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [
            { id: 0, height: 1000, underline: 'single', attrs: {}, children: [] },
          ],
          paraProperties: [],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Underlined', 0)]);
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('text-decoration:underline');
  });

  it('applies strikeout', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [
            { id: 0, height: 1000, strikeout: 'single', attrs: {}, children: [] },
          ],
          paraProperties: [],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Strikethrough', 0)]);
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('text-decoration:line-through');
  });

  it('applies highlight color', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [
            { id: 0, height: 1000, highlightColor: 'yellow', attrs: {}, children: [] },
          ],
          paraProperties: [],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Highlighted', 0)]);
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('background-color:yellow');
  });
});

describe('shape rendering', () => {
  it('renders line shape as SVG', () => {
    const shapeEl: GenericElement = {
      tag: 'hp:line',
      attrs: { x: '0', y: '0', x2: '100', y2: '50', stroke: '#000000' },
      children: [],
      text: null,
    };
    const child: RunChild = { type: 'shape', name: 'line', element: shapeEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('<svg');
    expect(html).toContain('<line');
    expect(html).toContain('class="handoc-shape"');
  });

  it('renders rect shape as SVG', () => {
    const shapeEl: GenericElement = {
      tag: 'hp:rect',
      attrs: { x: '10', y: '10', width: '100', height: '50', fill: 'red' },
      children: [],
      text: null,
    };
    const child: RunChild = { type: 'shape', name: 'rect', element: shapeEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('<svg');
    expect(html).toContain('<rect');
    expect(html).toContain('fill="red"');
  });

  it('renders ellipse shape as SVG', () => {
    const shapeEl: GenericElement = {
      tag: 'hp:ellipse',
      attrs: { x: '0', y: '0', width: '100', height: '80' },
      children: [],
      text: null,
    };
    const child: RunChild = { type: 'shape', name: 'ellipse', element: shapeEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('<svg');
    expect(html).toContain('<ellipse');
  });

  it('renders unknown shape as placeholder', () => {
    const shapeEl: GenericElement = {
      tag: 'hp:polygon',
      attrs: {},
      children: [],
      text: null,
    };
    const child: RunChild = { type: 'shape', name: 'polygon', element: shapeEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('[polygon]');
    expect(html).toContain('handoc-shape-unknown');
  });

  it('renders line shape with default x2/y2', () => {
    const shapeEl: GenericElement = {
      tag: 'hp:line',
      attrs: { x: '10', y: '20', width: '50', height: '30' },
      children: [],
      text: null,
    };
    const child: RunChild = { type: 'shape', name: 'line', element: shapeEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('<line');
    expect(html).toContain('x1="10"');
    expect(html).toContain('y1="20"');
  });
});

describe('equation rendering', () => {
  it('renders equation with text content', () => {
    const eqEl: GenericElement = {
      tag: 'hp:equation',
      attrs: {},
      children: [],
      text: 'x = y + z',
    };
    const child: RunChild = { type: 'equation', element: eqEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('handoc-equation');
    expect(html).toContain('x = y + z');
  });

  it('renders empty equation as placeholder', () => {
    const eqEl: GenericElement = {
      tag: 'hp:equation',
      attrs: {},
      children: [],
      text: null,
    };
    const child: RunChild = { type: 'equation', element: eqEl };
    const html = runChildToHtml(child, emptyCtx);
    expect(html).toContain('[equation]');
  });
});

describe('header/footer rendering', () => {
  it('renders header', () => {
    const ctx: RenderContext = {
      headers: [{
        type: 'header',
        applyPageType: 'BOTH',
        paragraphs: [makePara([makeRun('Header text')])],
      }],
    };
    const section: Section = {
      paragraphs: [makePara([makeRun('Body text')])],
    };
    const html = sectionToHtml(section, ctx, 0);
    expect(html).toContain('handoc-header');
    expect(html).toContain('Header text');
    expect(html).toContain('Body text');
  });

  it('renders footer', () => {
    const ctx: RenderContext = {
      footers: [{
        type: 'footer',
        applyPageType: 'BOTH',
        paragraphs: [makePara([makeRun('Footer text')])],
      }],
    };
    const section: Section = {
      paragraphs: [makePara([makeRun('Body text')])],
    };
    const html = sectionToHtml(section, ctx, 0);
    expect(html).toContain('handoc-footer');
    expect(html).toContain('Footer text');
    expect(html).toContain('Body text');
  });

  it('renders section without footnotes', () => {
    const section: Section = {
      paragraphs: [makePara([makeRun('No footnotes here')])],
    };
    const ctx: RenderContext = {};
    const html = sectionToHtml(section, ctx, 0);
    expect(html).toContain('No footnotes here');
    expect(html).not.toContain('handoc-footnotes');
  });
});

describe('footnote rendering', () => {
  it('renders footnote reference and content', () => {
    const footnoteEl: GenericElement = {
      tag: 'footnote',
      attrs: {},
      children: [{
        tag: 'subList',
        attrs: {},
        children: [{
          tag: 'p',
          attrs: { id: '0', paraPrIDRef: '0', styleIDRef: '0', pageBreak: '0', columnBreak: '0', merged: '0' },
          children: [{
            tag: 'run',
            attrs: { charPrIDRef: '0' },
            children: [{ tag: 't', attrs: {}, children: [], text: 'Footnote content' }],
            text: null,
          }],
          text: null,
        }],
        text: null,
      }],
      text: null,
    };
    
    const ctx: RenderContext = {};
    const ctrlChild: RunChild = { type: 'ctrl', element: footnoteEl };
    
    const section: Section = {
      paragraphs: [
        makePara([
          { charPrIDRef: null, children: [
            { type: 'text', content: 'Text with footnote' },
            ctrlChild,
          ]},
        ]),
      ],
    };
    
    const html = sectionToHtml(section, ctx, 0);
    expect(html).toContain('handoc-footnote-ref');
    expect(html).toContain('handoc-footnotes');
    expect(html).toContain('Footnote content');
    expect(html).toContain('data-footnote="1"');
  });
});

describe('ctrl element with table', () => {
  it('renders ctrl with tbl tag as table', () => {
    const tblEl: GenericElement = {
      tag: 'hp:tbl',
      attrs: {},
      children: [{
        tag: 'hp:tr',
        attrs: {},
        children: [{
          tag: 'hp:tc',
          attrs: {},
          children: [],
          text: 'Cell',
        }],
        text: null,
      }],
      text: null,
    };
    const ctrlChild: RunChild = { type: 'ctrl', element: tblEl };
    const html = runChildToHtml(ctrlChild, emptyCtx);
    expect(html).toContain('<table');
    expect(html).toContain('Cell');
  });

  it('ignores unknown ctrl elements', () => {
    const unknownCtrl: GenericElement = {
      tag: 'hp:unknown',
      attrs: {},
      children: [],
      text: null,
    };
    const ctrlChild: RunChild = { type: 'ctrl', element: unknownCtrl };
    const html = runChildToHtml(ctrlChild, emptyCtx);
    expect(html).toBe('');
  });
});

describe('trackChange rendering', () => {
  it('renders trackChange as empty', () => {
    const trackChangeChild: RunChild = { type: 'trackChange', element: { tag: 'trackChange', attrs: {}, children: [], text: null } };
    expect(runChildToHtml(trackChangeChild, emptyCtx)).toBe('');
  });
});

describe('image rendering', () => {
  it('renders image from inlineObject with matching image in context', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: {},
      children: [{
        tag: 'hp:binItem',
        attrs: { binaryItemIDRef: 'BIN0001' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const ctx: RenderContext = {
      images: [{
        path: 'BinData/BIN0001.png',
        data: new Uint8Array([137, 80, 78, 71]), // PNG header
      }],
    };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('<img');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('class="handoc-image"');
  });

  it('renders missing image placeholder when image not found', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: { binaryItemIDRef: 'missing' },
      children: [],
      text: null,
    };
    const ctx: RenderContext = { images: [] };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('handoc-image-missing');
    expect(html).toContain('[image]');
  });

  it('detects JPEG images correctly', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: {},
      children: [{
        tag: 'hp:binItem',
        attrs: { binaryItemIDRef: 'IMG001' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const ctx: RenderContext = {
      images: [{
        path: 'BinData/IMG001.jpg',
        data: new Uint8Array([255, 216, 255]), // JPEG header
      }],
    };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('data:image/jpeg;base64,');
  });

  it('detects GIF images correctly', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: {},
      children: [{
        tag: 'hp:binItem',
        attrs: { binaryItemIDRef: 'GIF001' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const ctx: RenderContext = {
      images: [{
        path: 'BinData/GIF001.gif',
        data: new Uint8Array([71, 73, 70]), // GIF header
      }],
    };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('data:image/gif;base64,');
  });
});

describe('image edge cases', () => {
  it('handles unknown image extensions', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: {},
      children: [{
        tag: 'hp:binItem',
        attrs: { binaryItemIDRef: 'WEBP001' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const ctx: RenderContext = {
      images: [{
        path: 'BinData/WEBP001.webp',
        data: new Uint8Array([82, 73, 70, 70]),
      }],
    };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('data:image/webp;base64,');
  });

  it('finds images using imgRect instead of binItem', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: {},
      children: [{
        tag: 'hp:imgRect',
        attrs: { binaryItemIDRef: 'IMG_RECT' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const ctx: RenderContext = {
      images: [{
        path: 'BinData/IMG_RECT.png',
        data: new Uint8Array([137, 80, 78, 71]),
      }],
    };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('data:image/png;base64,');
  });

  it('finds images using href attribute', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: {},
      children: [{
        tag: 'hp:binItem',
        attrs: { href: 'HREF_IMG' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const ctx: RenderContext = {
      images: [{
        path: 'BinData/HREF_IMG.png',
        data: new Uint8Array([137, 80, 78, 71]),
      }],
    };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('data:image/png;base64,');
  });

  it('finds images by path.endsWith', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: {},
      children: [{
        tag: 'hp:binItem',
        attrs: { binaryItemIDRef: 'IMG002.jpg' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const ctx: RenderContext = {
      images: [{
        path: 'BinData/embedded/IMG002.jpg',
        data: new Uint8Array([255, 216, 255]),
      }],
    };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('data:image/jpeg;base64,');
  });

  it('finds images by filename match (name === href)', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: {},
      children: [{
        tag: 'hp:binItem',
        attrs: { binaryItemIDRef: 'photo' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const ctx: RenderContext = {
      images: [{
        path: 'BinData/sub/photo.png',
        data: new Uint8Array([137, 80, 78, 71]),
      }],
    };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('data:image/png;base64,');
  });

  it('handles unusual extension formats', () => {
    const imgEl: GenericElement = {
      tag: 'hp:img',
      attrs: {},
      children: [{
        tag: 'hp:binItem',
        attrs: { binaryItemIDRef: 'noext' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const ctx: RenderContext = {
      images: [{
        path: 'BinData/noext',
        data: new Uint8Array([1, 2, 3]),
      }],
    };
    const child: RunChild = { type: 'inlineObject', element: imgEl };
    const html = runChildToHtml(child, ctx);
    expect(html).toContain('<img class="handoc-image"');
    expect(html).toContain('base64,');
  });
});

describe('section with sectionProps', () => {
  it('applies pageWidth and margins from sectionProps', () => {
    const section: Section = {
      paragraphs: [makePara([makeRun('Test')])],
      sectionProps: {
        pageWidth: 210000, // 210mm in hwp units (1/7200 inch)
        pageHeight: 297000,
        margins: {
          left: 20000,
          right: 20000,
          top: 15000,
          bottom: 15000,
          header: 10000,
          footer: 10000,
          gutter: 0,
        },
        landscape: false,
      },
    };
    const html = sectionToHtml(section, emptyCtx, 0);
    expect(html).toContain('width:');
    expect(html).toContain('mm');
    expect(html).toContain('padding:');
  });
});

describe('numbering rendering', () => {
  it('renders numbering prefix for OUTLINE heading', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          tabProperties: [],
          numberings: [
            {
              id: 0,
              start: 1,
              levels: [
                { level: 0, text: '^1.', numFormat: 'DIGIT' },
                { level: 1, text: '^2)', numFormat: 'DIGIT' },
              ],
            },
          ],
          bullets: [],
          paraProperties: [
            {
              id: 0,
              heading: { type: 'OUTLINE', idRef: 0, level: 0 },
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('First item')], { paraPrIDRef: 0 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('handoc-numbering');
    expect(html).toContain('1.');
    expect(html).toContain('First item');
  });

  it('renders bullet prefix for bullet heading', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          tabProperties: [],
          numberings: [],
          bullets: [
            {
              id: 1,
              char: '●',
              levels: [
                { level: 0, text: '●' },
                { level: 1, text: '○' },
              ],
            },
          ],
          paraProperties: [
            {
              id: 1,
              heading: { type: 'OUTLINE', idRef: 1, level: 0 },
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Bullet item')], { paraPrIDRef: 1 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('handoc-numbering');
    expect(html).toContain('●');
    expect(html).toContain('Bullet item');
  });

  it('renders bullet char when levels are missing', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          tabProperties: [],
          numberings: [],
          bullets: [
            {
              id: 2,
              char: '▪',
              levels: [],
            },
          ],
          paraProperties: [
            {
              id: 2,
              heading: { type: 'OUTLINE', idRef: 2, level: 0 },
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Char bullet')], { paraPrIDRef: 2 });
    const html = paragraphToHtml(para, ctx);
    expect(html).toContain('▪');
  });

  it('does not render prefix for non-OUTLINE paragraphs', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          tabProperties: [],
          numberings: [],
          bullets: [],
          paraProperties: [
            {
              id: 3,
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Normal text')], { paraPrIDRef: 3 });
    const html = paragraphToHtml(para, ctx);
    expect(html).not.toContain('handoc-numbering');
    expect(html).toContain('Normal text');
  });

  it('returns empty prefix for heading type other than OUTLINE/NUMBER', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          numberings: [],
          bullets: [],
          paraProperties: [
            {
              id: 4,
              heading: { type: 'NONE' as any, idRef: 0, level: 0 },
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Not numbered')], { paraPrIDRef: 4 });
    const html = paragraphToHtml(para, ctx);
    expect(html).not.toContain('handoc-numbering');
  });

  it('returns empty prefix when numbering/bullet not found', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          numberings: [],
          bullets: [],
          paraProperties: [
            {
              id: 5,
              heading: { type: 'OUTLINE', idRef: 999, level: 0 }, // Invalid idRef
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Missing ref')], { paraPrIDRef: 5 });
    const html = paragraphToHtml(para, ctx);
    expect(html).not.toContain('handoc-numbering');
  });

  it('returns empty prefix when numbering level not found', () => {
    const ctx: RenderContext = {
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          numberings: [
            {
              id: 10,
              start: 1,
              levels: [
                { level: 0, text: '1.', numFormat: 'DIGIT' },
              ],
            },
          ],
          bullets: [],
          paraProperties: [
            {
              id: 6,
              heading: { type: 'OUTLINE', idRef: 10, level: 5 }, // Level 5 doesn't exist
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Level missing')], { paraPrIDRef: 6 });
    const html = paragraphToHtml(para, ctx);
    expect(html).not.toContain('handoc-numbering');
  });
});
