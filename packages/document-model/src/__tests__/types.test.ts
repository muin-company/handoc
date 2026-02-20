import { describe, it, expect } from 'vitest';
import type {
  Section, Paragraph, Run, RunChild,
  DocumentHeader, RefList, FontFaceDecl, CharProperty, ParaProperty, StyleDecl,
  GenericElement, SectionProperties,
} from '../index';

describe('Type creation smoke tests', () => {
  it('creates a minimal document structure', () => {
    const header: DocumentHeader = {
      version: '1.5',
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
    };

    const section: Section = {
      paragraphs: [{
        id: '123',
        paraPrIDRef: 0,
        styleIDRef: 0,
        pageBreak: false,
        columnBreak: false,
        merged: false,
        runs: [{
          charPrIDRef: 0,
          children: [{ type: 'text', content: '안녕하세요' }],
        }],
        lineSegArray: [],
      }],
    };

    expect(section.paragraphs).toHaveLength(1);
    expect(section.paragraphs[0].runs[0].children[0]).toEqual({
      type: 'text',
      content: '안녕하세요',
    });
    expect(header.version).toBe('1.5');
  });

  it('creates a table RunChild', () => {
    const tableChild: RunChild = {
      type: 'table',
      element: {
        tag: 'tbl',
        attrs: { rowCnt: '2', colCnt: '3' },
        children: [],
        text: null,
      },
    };

    expect(tableChild.type).toBe('table');
  });

  it('creates a GenericElement for unknown elements', () => {
    const el: GenericElement = {
      tag: 'unknownElement',
      attrs: { foo: 'bar' },
      children: [],
      text: 'preserved text',
    };
    expect(el.tag).toBe('unknownElement');
  });

  it('creates a StyleDecl', () => {
    const style: StyleDecl = {
      id: 0,
      type: 'PARA',
      name: '바탕글',
      engName: 'Normal',
      paraPrIDRef: 0,
      charPrIDRef: 0,
      nextStyleIDRef: 0,
      attrs: { id: '0', type: 'PARA', name: '바탕글' },
    };
    expect(style.name).toBe('바탕글');
  });

  it('creates SectionProperties', () => {
    const props: SectionProperties = {
      pageWidth: 59528,
      pageHeight: 84186,
      margins: { left: 8504, right: 8504, top: 5668, bottom: 4252, header: 4252, footer: 4252, gutter: 0 },
      landscape: false,
    };
    expect(props.pageWidth).toBe(59528);
  });
});
