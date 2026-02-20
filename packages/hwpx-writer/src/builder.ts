/**
 * builder.ts — Programmatic HWPX document builder
 *
 * Usage:
 * ```ts
 * const bytes = HwpxBuilder.create()
 *   .addParagraph('Hello World', { bold: true, fontSize: 20 })
 *   .addTable([['A', 'B'], ['C', 'D']])
 *   .addSectionBreak()
 *   .addParagraph('New section')
 *   .build();
 * ```
 */

import type {
  DocumentHeader, Section, Paragraph, Run, RunChild,
  FontFaceDecl, CharProperty, ParaProperty, StyleDecl,
  GenericElement,
} from '@handoc/document-model';
import { writeHwpx } from './index';

// HWP units: 7200 per inch
const MM_TO_HWP = 283.46; // ~7200/25.4
const A4_WIDTH = 59528;   // 210mm
const A4_HEIGHT = 84188;  // 297mm

interface ParagraphStyle {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number; // in pt
  align?: string;    // left | center | right | justify
}

interface BuilderImage {
  data: Uint8Array;
  ext: string;
  width: number;   // HWP units
  height: number;  // HWP units
}

/** Items that go into the current section */
type SectionItem =
  | { kind: 'paragraph'; text: string; style?: ParagraphStyle }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'image'; image: BuilderImage };

export class HwpxBuilder {
  private pageWidth: number;
  private pageHeight: number;
  private sectionItems: SectionItem[][] = [[]]; // array of sections, each an array of items
  private images: { data: Uint8Array; path: string }[] = [];

  private constructor(pageWidth: number, pageHeight: number) {
    this.pageWidth = pageWidth;
    this.pageHeight = pageHeight;
  }

  static create(options?: { pageWidth?: number; pageHeight?: number }): HwpxBuilder {
    return new HwpxBuilder(
      options?.pageWidth ?? A4_WIDTH,
      options?.pageHeight ?? A4_HEIGHT,
    );
  }

  addParagraph(text: string, style?: ParagraphStyle): this {
    this.currentSection().push({ kind: 'paragraph', text, style });
    return this;
  }

  addTable(rows: string[][]): this {
    this.currentSection().push({ kind: 'table', rows });
    return this;
  }

  addImage(data: Uint8Array, ext: string, width?: number, height?: number): this {
    const w = width ?? Math.round(100 * MM_TO_HWP);
    const h = height ?? Math.round(75 * MM_TO_HWP);
    this.currentSection().push({
      kind: 'image',
      image: { data, ext, width: w, height: h },
    });
    return this;
  }

  addSectionBreak(): this {
    this.sectionItems.push([]);
    return this;
  }

  build(): Uint8Array {
    const { header, charPropMap, paraPropMap } = this.buildHeader();
    const sections = this.buildSections(charPropMap, paraPropMap);
    header.secCnt = sections.length;

    const extraParts = new Map<string, string | Uint8Array>();
    for (const img of this.images) {
      extraParts.set(img.path, img.data);
    }

    return writeHwpx({ header, sections, extraParts });
  }

  // ── Private helpers ──

  private currentSection(): SectionItem[] {
    return this.sectionItems[this.sectionItems.length - 1];
  }

  /**
   * Collect all unique style combinations and build charProperties / paraProperties.
   * Returns mapping from style-key to property index.
   */
  private buildHeader(): {
    header: DocumentHeader;
    charPropMap: Map<string, number>;
    paraPropMap: Map<string, number>;
  } {
    // Collect unique char styles
    const charStyles = new Map<string, ParagraphStyle>();
    // default (no style)
    charStyles.set('default', {});

    for (const section of this.sectionItems) {
      for (const item of section) {
        if (item.kind === 'paragraph' && item.style) {
          const key = charStyleKey(item.style);
          if (!charStyles.has(key)) {
            charStyles.set(key, item.style);
          }
        }
      }
    }

    // Collect unique para alignments
    const paraAligns = new Map<string, string>();
    paraAligns.set('left', 'left');
    for (const section of this.sectionItems) {
      for (const item of section) {
        if (item.kind === 'paragraph' && item.style?.align) {
          paraAligns.set(item.style.align, item.style.align);
        }
      }
    }

    // Build fontFaces
    const fontFaces: FontFaceDecl[] = [
      {
        lang: 'hangul',
        fonts: [{ id: 0, face: '맑은 고딕', type: 'ttf', isEmbedded: false }],
      },
      {
        lang: 'latin',
        fonts: [{ id: 0, face: '맑은 고딕', type: 'ttf', isEmbedded: false }],
      },
      {
        lang: 'hanja',
        fonts: [{ id: 0, face: '맑은 고딕', type: 'ttf', isEmbedded: false }],
      },
    ];

    // Build charProperties
    const charProperties: CharProperty[] = [];
    const charPropMap = new Map<string, number>();

    let cpIdx = 0;
    for (const [key, style] of charStyles) {
      const height = ((style.fontSize ?? 10) * 100); // hundredths of pt (HWP convention)
      const attrs: Record<string, string> = {
        id: String(cpIdx),
        height: String(height),
        textColor: '0',
      };
      if (style.bold) attrs.bold = '1';
      if (style.italic) attrs.italic = '1';

      charProperties.push({
        id: cpIdx,
        height,
        bold: style.bold,
        italic: style.italic,
        attrs,
        children: [
          // fontRef children
          makeGenericEl('fontRef', {
            hangul: '0', latin: '0', hanja: '0',
          }),
        ],
      });
      charPropMap.set(key, cpIdx);
      cpIdx++;
    }

    // Build paraProperties
    const paraProperties: ParaProperty[] = [];
    const paraPropMap = new Map<string, number>();

    let ppIdx = 0;
    for (const [key] of paraAligns) {
      const alignVal = key === 'left' ? 'left'
        : key === 'center' ? 'center'
        : key === 'right' ? 'right'
        : key === 'justify' ? 'justify'
        : 'left';

      paraProperties.push({
        id: ppIdx,
        align: alignVal as ParaProperty['align'],
        attrs: { id: String(ppIdx), align: alignVal },
        children: [],
      });
      paraPropMap.set(key, ppIdx);
      ppIdx++;
    }

    // Build styles
    const styles: StyleDecl[] = [
      {
        id: 0,
        type: 'para',
        name: '바탕글',
        engName: 'Normal',
        paraPrIDRef: 0,
        charPrIDRef: 0,
        attrs: {
          id: '0', type: 'para', name: '바탕글', engName: 'Normal',
          paraPrIDRef: '0', charPrIDRef: '0', nextStyleIDRef: '0',
        },
      },
    ];

    const header: DocumentHeader = {
      version: '1.5',
      secCnt: this.sectionItems.length,
      beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
      refList: {
        fontFaces,
        borderFills: [],
        charProperties,
        paraProperties,
        styles,
        others: [],
      },
    };

    return { header, charPropMap, paraPropMap };
  }

  private buildSections(
    charPropMap: Map<string, number>,
    paraPropMap: Map<string, number>,
  ): Section[] {
    let imageCounter = 0;

    return this.sectionItems.map((items) => {
      const paragraphs: Paragraph[] = [];

      if (items.length === 0) {
        // Empty section — add one empty paragraph
        paragraphs.push(makeParagraph('', 0, 0));
      }

      for (const item of items) {
        switch (item.kind) {
          case 'paragraph': {
            const cpKey = item.style ? charStyleKey(item.style) : 'default';
            const ppKey = item.style?.align ?? 'left';
            const cpIdx = charPropMap.get(cpKey) ?? 0;
            const ppIdx = paraPropMap.get(ppKey) ?? 0;
            paragraphs.push(makeParagraph(item.text, cpIdx, ppIdx));
            break;
          }
          case 'table': {
            paragraphs.push(makeTableParagraph(item.rows));
            break;
          }
          case 'image': {
            const imgPath = `BinData/image${imageCounter}.${item.image.ext}`;
            this.images.push({ data: item.image.data, path: imgPath });
            paragraphs.push(makeImageParagraph(imgPath, item.image.width, item.image.height));
            imageCounter++;
            break;
          }
        }
      }

      return { paragraphs };
    });
  }
}

// ── Utility functions ──

function charStyleKey(style: ParagraphStyle): string {
  if (!style.bold && !style.italic && !style.fontSize) return 'default';
  return `b${style.bold ? 1 : 0}_i${style.italic ? 1 : 0}_fs${style.fontSize ?? 10}`;
}

function makeParagraph(text: string, charPrIdx: number, paraPrIdx: number): Paragraph {
  const children: RunChild[] = [{ type: 'text', content: text }];
  return {
    id: null,
    paraPrIDRef: paraPrIdx,
    styleIDRef: 0,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs: [{ charPrIDRef: charPrIdx, children }],
    lineSegArray: [],
  };
}

function makeTableParagraph(rows: string[][]): Paragraph {
  const rowCount = rows.length;
  const colCount = rows[0]?.length ?? 0;

  // Build table as GenericElement tree
  const tableEl = buildTableElement(rows, rowCount, colCount);

  return {
    id: null,
    paraPrIDRef: 0,
    styleIDRef: 0,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs: [{
      charPrIDRef: 0,
      children: [{ type: 'table', element: tableEl }],
    }],
    lineSegArray: [],
  };
}

function buildTableElement(rows: string[][], rowCount: number, colCount: number): GenericElement {
  // Default column width: evenly split across ~170mm usable width
  const totalWidth = 48000; // ~170mm in HWP units
  const colWidth = Math.floor(totalWidth / colCount);
  const rowHeight = 1000;

  const trElements: GenericElement[] = rows.map((row, ri) => {
    const tcElements: GenericElement[] = row.map((cell, ci) => {
      // Cell paragraph
      const cellPara: GenericElement = {
        tag: 'hp:p',
        attrs: { paraPrIDRef: '0', styleIDRef: '0', pageBreak: '0', columnBreak: '0', merged: '0' },
        children: [{
          tag: 'hp:run',
          attrs: { charPrIDRef: '0' },
          children: [{
            tag: 'hp:t',
            attrs: {},
            children: [],
            text: cell,
          }],
          text: null,
        }],
        text: null,
      };

      // cellAddr
      const cellAddr: GenericElement = {
        tag: 'hp:cellAddr',
        attrs: { colAddr: String(ci), rowAddr: String(ri) },
        children: [],
        text: null,
      };

      // cellSpan
      const cellSpan: GenericElement = {
        tag: 'hp:cellSpan',
        attrs: { colSpan: '1', rowSpan: '1' },
        children: [],
        text: null,
      };

      // cellSz
      const cellSz: GenericElement = {
        tag: 'hp:cellSz',
        attrs: { width: String(colWidth), height: String(rowHeight) },
        children: [],
        text: null,
      };

      return {
        tag: 'hp:tc',
        attrs: { name: '', header: '0', hasMargin: '0' },
        children: [cellAddr, cellSpan, cellSz, cellPara],
        text: null,
      };
    });

    return {
      tag: 'hp:tr',
      attrs: {},
      children: tcElements,
      text: null,
    };
  });

  return {
    tag: 'hp:tbl',
    attrs: {
      rowCnt: String(rowCount),
      colCnt: String(colCount),
      cellSpacing: '0',
      borderFillIDRef: '0',
    },
    children: trElements,
    text: null,
  };
}

function makeImageParagraph(binPath: string, width: number, height: number): Paragraph {
  const imgEl: GenericElement = {
    tag: 'hp:pic',
    attrs: {},
    children: [
      {
        tag: 'hp:sz',
        attrs: { width: String(width), height: String(height) },
        children: [],
        text: null,
      },
      {
        tag: 'hp:img',
        attrs: { binaryItemIDRef: binPath, bright: '0', contrast: '0' },
        children: [],
        text: null,
      },
    ],
    text: null,
  };

  return {
    id: null,
    paraPrIDRef: 0,
    styleIDRef: 0,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs: [{
      charPrIDRef: 0,
      children: [{ type: 'inlineObject', name: 'pic', element: imgEl }],
    }],
    lineSegArray: [],
  };
}

function makeGenericEl(tag: string, attrs: Record<string, string>): GenericElement {
  return { tag, attrs, children: [], text: null };
}
