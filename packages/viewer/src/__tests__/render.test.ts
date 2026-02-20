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
              id: 2,
              attrs: {},
              children: [],
            },
          ],
          styles: [],
          others: [],
        },
      },
    };
    const para = makePara([makeRun('Normal text')], { paraPrIDRef: 2 });
    const html = paragraphToHtml(para, ctx);
    expect(html).not.toContain('handoc-numbering');
    expect(html).toContain('Normal text');
  });
});
