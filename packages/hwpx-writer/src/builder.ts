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
  fontFamily?: string;
  color?: string;       // hex like '0000FF' (RGB) or decimal
  lineSpacing?: number; // percent (e.g. 150 = 1.5x)
  indent?: number;      // left indent in mm
}

interface BuilderImage {
  data: Uint8Array;
  ext: string;
  width: number;   // HWP units
  height: number;  // HWP units
}

interface ShapeOptions {
  shapeType: 'rect' | 'ellipse' | 'line' | 'arc' | 'polygon' | 'curve';
  width: number;   // HWP units
  height: number;  // HWP units
  x?: number;      // HWP units (position)
  y?: number;      // HWP units (position)
  text?: string;   // optional text inside shape
}

interface EquationOptions {
  script: string;  // equation script (e.g. MathML-like notation)
  font?: string;
  baseUnit?: number;
  width?: number;  // HWP units
  height?: number; // HWP units
}

/** Items that go into the current section */
type SectionItem =
  | { kind: 'paragraph'; text: string; style?: ParagraphStyle }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'image'; image: BuilderImage }
  | { kind: 'footnote'; text: string; noteText: string }
  | { kind: 'shape'; options: ShapeOptions }
  | { kind: 'equation'; options: EquationOptions };

interface SectionMeta {
  headerText?: string;
  footerText?: string;
  pageNumber?: { position: 'header' | 'footer'; align: 'left' | 'center' | 'right' };
}

export class HwpxBuilder {
  private pageWidth: number;
  private pageHeight: number;
  private sectionItems: SectionItem[][] = [[]]; // array of sections, each an array of items
  private sectionMetas: SectionMeta[] = [{}];
  private images: { data: Uint8Array; path: string }[] = [];
  private extraFontFamilies: Set<string> = new Set();

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

  addHeading(level: number, text: string): this {
    const sizes: Record<number, number> = { 1: 28, 2: 24, 3: 20, 4: 16, 5: 14, 6: 12 };
    const fontSize = sizes[level] ?? 12;
    this.currentSection().push({
      kind: 'paragraph',
      text,
      style: { bold: true, fontSize },
    });
    return this;
  }

  addFootnote(text: string, noteText: string): this {
    this.currentSection().push({ kind: 'footnote', text, noteText });
    return this;
  }

  addShape(options: ShapeOptions): this {
    this.currentSection().push({ kind: 'shape', options });
    return this;
  }

  addEquation(options: EquationOptions): this {
    this.currentSection().push({ kind: 'equation', options });
    return this;
  }

  setHeader(text: string): this {
    this.currentSectionMeta().headerText = text;
    return this;
  }

  setFooter(text: string): this {
    this.currentSectionMeta().footerText = text;
    return this;
  }

  setPageNumber(position: 'header' | 'footer', align: 'left' | 'center' | 'right'): this {
    this.currentSectionMeta().pageNumber = { position, align };
    return this;
  }

  addSectionBreak(): this {
    this.sectionItems.push([]);
    this.sectionMetas.push({});
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

  private currentSectionMeta(): SectionMeta {
    return this.sectionMetas[this.sectionMetas.length - 1];
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
          if (item.style.fontFamily) {
            this.extraFontFamilies.add(item.style.fontFamily);
          }
        }
      }
    }

    // Collect unique para styles (align + lineSpacing + indent)
    const paraStyleMap = new Map<string, ParagraphStyle>();
    paraStyleMap.set('left||', {}); // default
    for (const section of this.sectionItems) {
      for (const item of section) {
        if (item.kind === 'paragraph' && item.style) {
          const key = paraStyleKey(item.style);
          if (!paraStyleMap.has(key)) {
            paraStyleMap.set(key, item.style);
          }
        }
      }
    }

    // Build fontFaces
    const extraFonts = Array.from(this.extraFontFamilies);
    const fontFaces: FontFaceDecl[] = [
      {
        lang: 'hangul',
        fonts: [
          { id: 0, face: '맑은 고딕', type: 'ttf', isEmbedded: false },
          ...extraFonts.map((f, i) => ({ id: i + 1, face: f, type: 'ttf' as const, isEmbedded: false })),
        ],
      },
      {
        lang: 'latin',
        fonts: [
          { id: 0, face: '맑은 고딕', type: 'ttf', isEmbedded: false },
          ...extraFonts.map((f, i) => ({ id: i + 1, face: f, type: 'ttf' as const, isEmbedded: false })),
        ],
      },
      {
        lang: 'hanja',
        fonts: [
          { id: 0, face: '맑은 고딕', type: 'ttf', isEmbedded: false },
          ...extraFonts.map((f, i) => ({ id: i + 1, face: f, type: 'ttf' as const, isEmbedded: false })),
        ],
      },
    ];
    // Map font family name to font id
    const fontIdMap = new Map<string, number>();
    fontIdMap.set('맑은 고딕', 0);
    extraFonts.forEach((f, i) => fontIdMap.set(f, i + 1));

    // Build charProperties
    const charProperties: CharProperty[] = [];
    const charPropMap = new Map<string, number>();

    let cpIdx = 0;
    for (const [key, style] of charStyles) {
      const height = ((style.fontSize ?? 10) * 100); // hundredths of pt (HWP convention)
      const textColor = style.color ?? '0';
      const cpAttrs: Record<string, string> = {
        id: String(cpIdx),
        height: String(height),
        textColor,
      };
      if (style.bold) cpAttrs.bold = '1';
      if (style.italic) cpAttrs.italic = '1';

      const fontId = style.fontFamily ? String(fontIdMap.get(style.fontFamily) ?? 0) : '0';
      charProperties.push({
        id: cpIdx,
        height,
        bold: style.bold,
        italic: style.italic,
        attrs: cpAttrs,
        children: [
          makeGenericEl('fontRef', {
            hangul: fontId, latin: fontId, hanja: fontId,
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
    for (const [key, style] of paraStyleMap) {
      const alignVal: ParaProperty['align'] = (style.align as ParaProperty['align']) ?? 'left';
      const ppAttrs: Record<string, string> = { id: String(ppIdx) };
      const ppChildren: GenericElement[] = [];

      // Add align as child element
      if (alignVal && alignVal !== 'left') {
        const alignMap: Record<string, string> = {
          left: 'LEFT',
          center: 'CENTER',
          right: 'RIGHT',
          justify: 'JUSTIFY',
          distribute: 'DISTRIBUTE',
        };
        ppChildren.push(makeGenericEl('align', {
          horizontal: alignMap[alignVal] ?? 'LEFT',
        }));
      }

      const ppLineSpacing = style.lineSpacing
        ? { type: 'percent', value: style.lineSpacing }
        : undefined;
      const ppMargin = style.indent
        ? { left: Math.round(style.indent * MM_TO_HWP), indent: Math.round(style.indent * MM_TO_HWP) }
        : undefined;

      if (style.lineSpacing) {
        ppChildren.push(makeGenericEl('lineSpacing', {
          type: 'percent',
          value: String(style.lineSpacing),
        }));
      }
      if (style.indent) {
        const indentHwp = String(Math.round(style.indent * MM_TO_HWP));
        ppChildren.push(makeGenericEl('margin', {
          indent: indentHwp,
          left: indentHwp,
          right: '0',
        }));
      }

      paraProperties.push({
        id: ppIdx,
        align: alignVal,
        lineSpacing: ppLineSpacing,
        margin: ppMargin,
        attrs: ppAttrs,
        children: ppChildren,
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
        tabProperties: [],
        numberings: [],
        bullets: [],
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

    return this.sectionItems.map((items, sectionIdx) => {
      const paragraphs: Paragraph[] = [];
      const meta = this.sectionMetas[sectionIdx] ?? {};

      // Insert header/footer as ctrl elements in the first paragraph
      const headerFooterCtrls: Paragraph[] = [];
      if (meta.headerText) {
        const text = meta.pageNumber?.position === 'header'
          ? meta.headerText  // page number in header handled below
          : meta.headerText;
        headerFooterCtrls.push(makeHeaderFooterParagraph('header', text));
      } else if (meta.pageNumber?.position === 'header') {
        headerFooterCtrls.push(makeHeaderFooterParagraph('header', ''));
      }
      if (meta.footerText) {
        headerFooterCtrls.push(makeHeaderFooterParagraph('footer', meta.footerText));
      } else if (meta.pageNumber?.position === 'footer') {
        headerFooterCtrls.push(makeHeaderFooterParagraph('footer', ''));
      }

      paragraphs.push(...headerFooterCtrls);

      if (items.length === 0 && headerFooterCtrls.length === 0) {
        paragraphs.push(makeParagraph('', 0, 0));
      }

      for (const item of items) {
        switch (item.kind) {
          case 'paragraph': {
            const cpKey = item.style ? charStyleKey(item.style) : 'default';
            const ppKey = item.style ? paraStyleKey(item.style) : 'left||';
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
          case 'footnote': {
            paragraphs.push(makeFootnoteParagraph(item.text, item.noteText));
            break;
          }
          case 'shape': {
            paragraphs.push(makeShapeParagraph(item.options));
            break;
          }
          case 'equation': {
            paragraphs.push(makeEquationParagraph(item.options));
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
  if (!style.bold && !style.italic && !style.fontSize && !style.fontFamily && !style.color) return 'default';
  return `b${style.bold ? 1 : 0}_i${style.italic ? 1 : 0}_fs${style.fontSize ?? 10}_ff${style.fontFamily ?? ''}_c${style.color ?? ''}`;
}

function paraStyleKey(style: ParagraphStyle): string {
  return `${style.align ?? 'left'}|${style.lineSpacing ?? ''}|${style.indent ?? ''}`;
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

function makeHeaderFooterParagraph(type: 'header' | 'footer', text: string): Paragraph {
  const innerPara: GenericElement = {
    tag: 'p',
    attrs: { paraPrIDRef: '0', styleIDRef: '0', pageBreak: '0', columnBreak: '0', merged: '0' },
    children: [{
      tag: 'run',
      attrs: { charPrIDRef: '0' },
      children: [{
        tag: 't',
        attrs: {},
        children: [],
        text: text,
      }],
      text: null,
    }],
    text: null,
  };

  const subList: GenericElement = {
    tag: 'subList',
    attrs: {},
    children: [innerPara],
    text: null,
  };

  const hfEl: GenericElement = {
    tag: type,
    attrs: { applyPageType: 'BOTH' },
    children: [subList],
    text: null,
  };

  const ctrlEl: GenericElement = {
    tag: 'ctrl',
    attrs: {},
    children: [hfEl],
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
      children: [{ type: 'ctrl', element: ctrlEl }],
    }],
    lineSegArray: [],
  };
}

function makeFootnoteParagraph(text: string, noteText: string): Paragraph {
  const innerPara: GenericElement = {
    tag: 'p',
    attrs: { paraPrIDRef: '0', styleIDRef: '0', pageBreak: '0', columnBreak: '0', merged: '0' },
    children: [{
      tag: 'run',
      attrs: { charPrIDRef: '0' },
      children: [{
        tag: 't',
        attrs: {},
        children: [],
        text: noteText,
      }],
      text: null,
    }],
    text: null,
  };

  const subList: GenericElement = {
    tag: 'subList',
    attrs: {},
    children: [innerPara],
    text: null,
  };

  const footnoteEl: GenericElement = {
    tag: 'footnote',
    attrs: {},
    children: [subList],
    text: null,
  };

  const ctrlEl: GenericElement = {
    tag: 'ctrl',
    attrs: {},
    children: [footnoteEl],
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
      children: [
        { type: 'text', content: text },
        { type: 'ctrl', element: ctrlEl },
      ],
    }],
    lineSegArray: [],
  };
}

function makeGenericEl(tag: string, attrs: Record<string, string>): GenericElement {
  return { tag, attrs, children: [], text: null };
}

function makeShapeParagraph(options: ShapeOptions): Paragraph {
  const { shapeType, width, height, x = 0, y = 0, text } = options;

  const children: GenericElement[] = [
    {
      tag: 'sz',
      attrs: { width: String(width), height: String(height) },
      children: [],
      text: null,
    },
    {
      tag: 'pos',
      attrs: { x: String(x), y: String(y), z: '0' },
      children: [],
      text: null,
    },
  ];

  // Add text content if provided
  if (text) {
    const textPara: GenericElement = {
      tag: 'p',
      attrs: { paraPrIDRef: '0', styleIDRef: '0', pageBreak: '0', columnBreak: '0', merged: '0' },
      children: [{
        tag: 'run',
        attrs: { charPrIDRef: '0' },
        children: [{
          tag: 't',
          attrs: {},
          children: [],
          text: text,
        }],
        text: null,
      }],
      text: null,
    };

    const subList: GenericElement = {
      tag: 'subList',
      attrs: {},
      children: [textPara],
      text: null,
    };

    children.push(subList);
  }

  const shapeEl: GenericElement = {
    tag: shapeType,
    attrs: {},
    children,
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
      children: [{ type: 'shape', name: shapeType, element: shapeEl }],
    }],
    lineSegArray: [],
  };
}

function makeEquationParagraph(options: EquationOptions): Paragraph {
  const { script, font = 'HWP_Equation', baseUnit = 100, width = 5000, height = 1000 } = options;

  const eqChildren: GenericElement[] = [
    {
      tag: 'script',
      attrs: {},
      children: [],
      text: script,
    },
    {
      tag: 'sz',
      attrs: { width: String(width), height: String(height) },
      children: [],
      text: null,
    },
  ];

  const eqEl: GenericElement = {
    tag: 'equation',
    attrs: {
      font,
      baseUnit: String(baseUnit),
      version: '1.0',
    },
    children: eqChildren,
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
      children: [{ type: 'equation', element: eqEl }],
    }],
    lineSegArray: [],
  };
}
