import { describe, it, expect } from 'vitest';
import type {
  HwpDocument, Section, Paragraph, Run, RunChild, Table, TextChild,
  DocumentHeader, RefList, FontFaceDecl, CharProperty, ParaProperty, StyleDecl,
  GenericElement,
} from '../index';

describe('Type creation smoke tests', () => {
  it('creates a minimal HwpDocument', () => {
    const doc: HwpDocument = {
      header: {
        version: '1.5',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [],
          styles: [],
        },
      },
      sections: [{
        paragraphs: [{
          id: '123',
          paraPrIDRef: 0,
          styleIDRef: 0,
          pageBreak: 0,
          columnBreak: 0,
          merged: 0,
          runs: [{
            charPrIDRef: 0,
            children: [{ kind: 'text', value: '안녕하세요' }],
          }],
        }],
      }],
    };

    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].paragraphs[0].runs[0].children[0]).toEqual({
      kind: 'text',
      value: '안녕하세요',
    });
  });

  it('creates a Table RunChild', () => {
    const table: Table = {
      kind: 'table',
      id: '1',
      rowCnt: 1,
      colCnt: 1,
      cellSpacing: 0,
      borderFillIDRef: 1,
      repeatHeader: 0,
      noAdjust: 0,
      rows: [{
        cells: [{
          name: '',
          header: 0,
          hasMargin: 0,
          protect: 0,
          editable: 0,
          dirty: 1,
          borderFillIDRef: 1,
          cellAddr: { colAddr: 0, rowAddr: 0 },
          cellSpan: { colSpan: 1, rowSpan: 1 },
          cellSz: { width: 7200, height: 3600 },
          paragraphs: [{
            id: '456',
            paraPrIDRef: 0,
            styleIDRef: 0,
            pageBreak: 0,
            columnBreak: 0,
            merged: 0,
            runs: [{ charPrIDRef: 0, children: [{ kind: 'text', value: '셀' }] }],
          }],
        }],
      }],
    };

    const child: RunChild = table;
    expect(child.kind).toBe('table');
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
      langID: 1042,
    };
    expect(style.name).toBe('바탕글');
  });
});
