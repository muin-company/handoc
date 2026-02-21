/**
 * Additional annotation-parser tests for uncovered paths.
 */
import { describe, it, expect } from 'vitest';
import {
  parseHeaderFooter,
  parseFootnote,
  extractAnnotationText,
  collectHeadersFooters,
  collectFootnotes,
} from '../annotation-parser';
import type { GenericElement, Paragraph, Run, RunChild } from '../types';

function makeCtrlParagraph(ctrlElement: GenericElement): { paragraphs: Paragraph[] } {
  const child: RunChild = { type: 'ctrl', element: ctrlElement };
  const run: Run = { charPrIDRef: null, children: [child] };
  const para: Paragraph = {
    id: null, paraPrIDRef: null, styleIDRef: null,
    pageBreak: false, columnBreak: false, merged: false,
    runs: [run], lineSegArray: [],
  };
  return { paragraphs: [para] };
}

describe('parseFootnote', () => {
  it('parses a footnote element directly', () => {
    const el: GenericElement = {
      tag: 'footnote',
      attrs: {},
      children: [{
        tag: 'subList',
        attrs: {},
        children: [{
          tag: 'p',
          attrs: {},
          children: [{
            tag: 'run',
            attrs: {},
            children: [{ tag: 't', attrs: {}, children: [], text: 'Footnote text' }],
            text: null,
          }],
          text: null,
        }],
        text: null,
      }],
      text: null,
    };
    const result = parseFootnote(el);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('footnote');
    expect(extractAnnotationText(result!)).toBe('Footnote text');
  });

  it('parses an endnote element directly', () => {
    const el: GenericElement = {
      tag: 'endnote',
      attrs: {},
      children: [{
        tag: 'subList',
        attrs: {},
        children: [{
          tag: 'p',
          attrs: {},
          children: [{
            tag: 'run',
            attrs: {},
            children: [{ tag: 't', attrs: {}, children: [], text: 'Endnote' }],
            text: null,
          }],
          text: null,
        }],
        text: null,
      }],
      text: null,
    };
    const result = parseFootnote(el);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('endnote');
  });

  it('parses footnote nested in ctrl element', () => {
    const el: GenericElement = {
      tag: 'ctrl',
      attrs: {},
      children: [{
        tag: 'footnote',
        attrs: {},
        children: [{
          tag: 'subList',
          attrs: {},
          children: [{
            tag: 'p',
            attrs: {},
            children: [{
              tag: 'run',
              attrs: {},
              children: [{ tag: 't', attrs: {}, children: [], text: 'Nested fn' }],
              text: null,
            }],
            text: null,
          }],
          text: null,
        }],
        text: null,
      }],
      text: null,
    };
    const result = parseFootnote(el);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('footnote');
  });
});

describe('parseHeaderFooter - footer', () => {
  it('parses a footer element directly', () => {
    const el: GenericElement = {
      tag: 'footer',
      attrs: { applyPageType: 'ODD' },
      children: [{
        tag: 'subList',
        attrs: {},
        children: [{
          tag: 'p',
          attrs: {},
          children: [{
            tag: 'run',
            attrs: {},
            children: [{ tag: 't', attrs: {}, children: [], text: 'Footer text' }],
            text: null,
          }],
          text: null,
        }],
        text: null,
      }],
      text: null,
    };
    const result = parseHeaderFooter(el);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('footer');
    expect(result!.applyPageType).toBe('ODD');
  });

  it('uses BOTH as default applyPageType', () => {
    const el: GenericElement = {
      tag: 'header',
      attrs: {},
      children: [],
      text: null,
    };
    const result = parseHeaderFooter(el);
    expect(result).not.toBeNull();
    expect(result!.applyPageType).toBe('BOTH');
    expect(result!.paragraphs).toHaveLength(0);
  });

  it('parses header/footer without subList (paragraphs directly in element)', () => {
    const el: GenericElement = {
      tag: 'header',
      attrs: {},
      children: [{
        tag: 'p',
        attrs: {},
        children: [{
          tag: 'run',
          attrs: {},
          children: [{ tag: 't', attrs: {}, children: [], text: 'Direct para' }],
          text: null,
        }],
        text: null,
      }],
      text: null,
    };
    const result = parseHeaderFooter(el);
    expect(result).not.toBeNull();
    expect(result!.paragraphs).toHaveLength(1);
  });
});

describe('collectHeadersFooters', () => {
  it('collects headers from sections with ctrl elements', () => {
    const headerEl: GenericElement = {
      tag: 'ctrl',
      attrs: {},
      children: [{
        tag: 'header',
        attrs: { applyPageType: 'BOTH' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const section = makeCtrlParagraph(headerEl);
    const results = collectHeadersFooters([section]);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('header');
  });

  it('returns empty for sections with no ctrl children', () => {
    const textChild: RunChild = { type: 'text', content: 'hello' };
    const run: Run = { charPrIDRef: null, children: [textChild] };
    const para: Paragraph = {
      id: null, paraPrIDRef: null, styleIDRef: null,
      pageBreak: false, columnBreak: false, merged: false,
      runs: [run], lineSegArray: [],
    };
    const results = collectHeadersFooters([{ paragraphs: [para] }]);
    expect(results).toHaveLength(0);
  });
});

describe('collectFootnotes', () => {
  it('collects footnotes from sections with ctrl elements', () => {
    const fnEl: GenericElement = {
      tag: 'ctrl',
      attrs: {},
      children: [{
        tag: 'footnote',
        attrs: {},
        children: [],
        text: null,
      }],
      text: null,
    };
    const section = makeCtrlParagraph(fnEl);
    const results = collectFootnotes([section]);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('footnote');
  });

  it('skips non-footnote ctrl elements', () => {
    const colEl: GenericElement = {
      tag: 'ctrl',
      attrs: {},
      children: [{ tag: 'colPr', attrs: {}, children: [], text: null }],
      text: null,
    };
    const section = makeCtrlParagraph(colEl);
    const results = collectFootnotes([section]);
    expect(results).toHaveLength(0);
  });
});

describe('extractAnnotationText', () => {
  it('extracts text from footnote with multiple paragraphs', () => {
    const fn = {
      type: 'footnote' as const,
      paragraphs: [
        {
          id: null, paraPrIDRef: null, styleIDRef: null,
          pageBreak: false, columnBreak: false, merged: false,
          runs: [{
            charPrIDRef: null,
            children: [{ type: 'text' as const, content: 'Part 1' }],
          }],
          lineSegArray: [],
        },
        {
          id: null, paraPrIDRef: null, styleIDRef: null,
          pageBreak: false, columnBreak: false, merged: false,
          runs: [{
            charPrIDRef: null,
            children: [{ type: 'text' as const, content: 'Part 2' }],
          }],
          lineSegArray: [],
        },
      ],
    };
    expect(extractAnnotationText(fn)).toBe('Part 1Part 2');
  });
});

describe('annotation paragraph parsing - non-p children', () => {
  it('skips non-paragraph children in subList', () => {
    const el: GenericElement = {
      tag: 'footnote',
      attrs: {},
      children: [{
        tag: 'subList',
        attrs: {},
        children: [
          { tag: 'metadata', attrs: {}, children: [], text: null },
          {
            tag: 'p',
            attrs: {},
            children: [{
              tag: 'run',
              attrs: {},
              children: [{ tag: 't', attrs: {}, children: [], text: 'Text' }],
              text: null,
            }],
            text: null,
          },
        ],
        text: null,
      }],
      text: null,
    };
    const result = parseFootnote(el);
    expect(result).not.toBeNull();
    expect(result!.paragraphs).toHaveLength(1);
  });
});
