import {
  Document,
  Packer,
  Paragraph as DocxParagraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageBreak,
  SectionType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  VerticalMergeType,
  HeadingLevel,
} from 'docx';
import { HanDoc } from '@handoc/hwpx-parser';
import { parseTable, type ParsedTable, type ParsedTableCell } from '@handoc/hwpx-parser';
import type {
  Section,
  Paragraph,
  Run,
  RunChild,
  CharProperty,
  ParaProperty,
  GenericElement,
  SectionProperties,
  DocumentHeader,
} from '@handoc/document-model';

const MM_TO_TWIP = 56.692; // 1mm ≈ 56.692 twips (1 twip = 1/1440 inch)
const HWPUNIT_PER_INCH = 7200;
const TWIPS_PER_INCH = 1440;
const EMU_PER_INCH = 914400;

function hwpUnitToTwip(hu: number): number {
  return Math.round((hu / HWPUNIT_PER_INCH) * TWIPS_PER_INCH);
}

function hwpUnitToHalfPt(hu: number): number {
  return Math.round((hu / 100) * 2);
}

function hwpUnitToEmu(hu: number): number {
  return Math.round((hu / HWPUNIT_PER_INCH) * EMU_PER_INCH);
}

const ALIGN_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
  distribute: AlignmentType.DISTRIBUTE,
};

/** Map Korean font names to common DOCX-compatible names */
const FONT_MAP: Record<string, string> = {
  '한컴바탕': 'Batang',
  '한컴돋움': 'Dotum',
  '한양신명조': 'New Batang',
  '바탕': 'Batang',
  '바탕체': 'BatangChe',
  '돋움': 'Dotum',
  '돋움체': 'DotumChe',
  '굴림': 'Gulim',
  '굴림체': 'GulimChe',
  '궁서': 'Gungsuh',
  '궁서체': 'GungsuhChe',
  '맑은 고딕': 'Malgun Gothic',
  '나눔고딕': 'NanumGothic',
  '나눔명조': 'NanumMyeongjo',
  '나눔바른고딕': 'NanumBarunGothic',
  '함초롬바탕': 'HCR Batang',
  '함초롬돋움': 'HCR Dotum',
};

function mapFontName(name: string): string {
  return FONT_MAP[name] ?? name;
}

/**
 * Resolve font name for a charProperty by looking up fontRef in header's fontFaces.
 */
function resolveFontName(charProp: CharProperty, header: DocumentHeader): string | undefined {
  if (!charProp.fontRef) return undefined;
  // Try hangul first, then latin
  for (const lang of ['hangul', 'latin', 'hanja']) {
    const fontIdx = charProp.fontRef[lang];
    if (fontIdx == null) continue;
    const decl = header.refList.fontFaces.find(f => f.lang === lang);
    if (!decl) continue;
    const font = decl.fonts.find(f => f.id === fontIdx);
    if (font) return mapFontName(font.face);
  }
  return undefined;
}

/** Extract image type from mime type */
function mimeToImageType(mime: string): 'jpg' | 'png' | 'gif' | 'bmp' {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('bmp')) return 'bmp';
  return 'png'; // default
}

/**
 * Parse a borderFill GenericElement to extract border and background info.
 */
function parseBorderFill(bf: GenericElement): {
  borders: { top?: IBorder; bottom?: IBorder; left?: IBorder; right?: IBorder };
  bgColor?: string;
} {
  const result: ReturnType<typeof parseBorderFill> = { borders: {} };

  for (const child of bf.children) {
    if (child.tag === 'fillBrush' || child.tag.endsWith(':fillBrush')) {
      for (const fc of child.children) {
        if (fc.tag === 'winBrush' || fc.tag.endsWith(':winBrush')) {
          const faceColor = fc.attrs['faceColor'];
          if (faceColor && faceColor !== 'none' && faceColor !== 'ffffff') {
            result.bgColor = faceColor;
          }
        }
      }
    }
    // Parse border lines
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      // Match both "top" and "topBorder", with or without namespace prefix
      if (child.tag === side || child.tag === side + 'Border' || 
          child.tag.endsWith(':' + side) || child.tag.endsWith(':' + side + 'Border')) {
        const type = child.attrs['type'] ?? child.attrs['style'];
        const width = child.attrs['width'];
        if (type && type !== 'none') {
          result.borders[side] = { style: mapBorderStyle(type), width: width ? parseInt(width) : undefined };
        }
      }
    }
  }
  return result;
}

interface IBorder {
  style: string;
  width?: number;
  color?: string;
}

function mapBorderStyle(hwpStyle: string): (typeof BorderStyle)[keyof typeof BorderStyle] {
  const map: Record<string, (typeof BorderStyle)[keyof typeof BorderStyle]> = {
    'solid': BorderStyle.SINGLE,
    'double': BorderStyle.DOUBLE,
    'dashed': BorderStyle.DASHED,
    'dotted': BorderStyle.DOTTED,
    'dash_dot': BorderStyle.DOT_DASH,
    'none': BorderStyle.NONE,
  };
  return map[hwpStyle?.toLowerCase()] ?? BorderStyle.SINGLE;
}

/**
 * Convert an HWPX buffer to DOCX buffer.
 */
export async function hwpxToDocx(hwpxBuffer: Uint8Array): Promise<Uint8Array> {
  const doc = await HanDoc.open(hwpxBuffer);
  const header = doc.header;
  const sections = doc.sections;

  // Build borderFill lookup
  const borderFills = new Map<number, ReturnType<typeof parseBorderFill>>();
  for (const bf of header.refList.borderFills) {
    const id = parseInt(bf.attrs['id'] ?? '0');
    if (id > 0) borderFills.set(id, parseBorderFill(bf));
  }

  // Build headers/footers for docx
  const docxHeaders: Record<string, Header> | undefined = doc.headers.length > 0
    ? { default: convertHeaderFooterToDocxHeader(doc.headers, header) }
    : undefined;
  const docxFooters: Record<string, Footer> | undefined = doc.footers.length > 0
    ? { default: convertHeaderFooterToDocxFooter(doc.footers, header) }
    : undefined;

  const docxSections = sections.map((section, idx) => {
    const children = convertSection(section, header, doc, borderFills);
    const sectionProps = section.sectionProps;

    return {
      properties: {
        ...(sectionProps ? convertSectionProperties(sectionProps) : {}),
      },
      headers: idx === 0 ? docxHeaders : undefined,
      footers: idx === 0 ? docxFooters : undefined,
      children,
    };
  });

  const docxDoc = new Document({
    creator: doc.metadata.creator ?? 'HanDoc',
    title: doc.metadata.title,
    sections: docxSections,
  });

  const buffer = await Packer.toBuffer(docxDoc);
  return new Uint8Array(buffer);
}

function convertHeaderFooterToDocxHeader(
  headers: { type: string; paragraphs: Paragraph[] }[],
  docHeader: DocumentHeader,
): Header {
  const children: DocxParagraph[] = [];
  for (const hf of headers) {
    for (const para of hf.paragraphs) {
      const converted = convertParagraphToDocx(para, docHeader);
      children.push(...converted.filter((c): c is DocxParagraph => c instanceof DocxParagraph));
    }
  }
  return new Header({ children: children.length > 0 ? children : [new DocxParagraph({})] });
}

function convertHeaderFooterToDocxFooter(
  footers: { type: string; paragraphs: Paragraph[] }[],
  docHeader: DocumentHeader,
): Footer {
  const children: DocxParagraph[] = [];
  for (const hf of footers) {
    for (const para of hf.paragraphs) {
      const converted = convertParagraphToDocx(para, docHeader);
      children.push(...converted.filter((c): c is DocxParagraph => c instanceof DocxParagraph));
    }
  }
  return new Footer({ children: children.length > 0 ? children : [new DocxParagraph({})] });
}

/** Convert paragraph to docx paragraphs (no tables, for headers/footers) */
function convertParagraphToDocx(
  para: Paragraph,
  header: DocumentHeader,
): DocxParagraph[] {
  const textRuns: TextRun[] = [];
  const paraProp = para.paraPrIDRef != null
    ? header.refList.paraProperties.find(p => p.id === para.paraPrIDRef)
    : undefined;

  for (const run of para.runs) {
    const charProp = run.charPrIDRef != null
      ? header.refList.charProperties.find(c => c.id === run.charPrIDRef)
      : undefined;
    for (const child of run.children) {
      if (child.type === 'text') {
        textRuns.push(createTextRun(child.content, charProp, header));
      }
    }
  }

  return [createDocxParagraph(textRuns, paraProp)];
}

function convertSectionProperties(props: SectionProperties) {
  return {
    page: {
      size: {
        width: hwpUnitToTwip(props.pageWidth),
        height: hwpUnitToTwip(props.pageHeight),
        orientation: props.landscape ? 'landscape' as const : undefined,
      },
      margin: {
        top: hwpUnitToTwip(props.margins.top),
        bottom: hwpUnitToTwip(props.margins.bottom),
        left: hwpUnitToTwip(props.margins.left),
        right: hwpUnitToTwip(props.margins.right),
        header: hwpUnitToTwip(props.margins.header),
        footer: hwpUnitToTwip(props.margins.footer),
        gutter: hwpUnitToTwip(props.margins.gutter),
      },
    },
  };
}

function convertSection(
  section: Section,
  header: DocumentHeader,
  doc: HanDoc,
  borderFills: Map<number, ReturnType<typeof parseBorderFill>>,
): (DocxParagraph | Table)[] {
  const result: (DocxParagraph | Table)[] = [];

  for (const para of section.paragraphs) {
    const converted = convertParagraph(para, header, doc, borderFills);
    result.push(...converted);
  }

  return result;
}

function convertParagraph(
  para: Paragraph,
  header: DocumentHeader,
  doc: HanDoc,
  borderFills: Map<number, ReturnType<typeof parseBorderFill>>,
): (DocxParagraph | Table)[] {
  const result: (DocxParagraph | Table)[] = [];
  const textRuns: (TextRun | ImageRun)[] = [];
  const paraProp = para.paraPrIDRef != null
    ? header.refList.paraProperties.find(p => p.id === para.paraPrIDRef)
    : undefined;

  // Check for page break
  if (para.pageBreak) {
    textRuns.push(new TextRun({ children: [new PageBreak()] }));
  }

  for (const run of para.runs) {
    const charProp = run.charPrIDRef != null
      ? header.refList.charProperties.find(c => c.id === run.charPrIDRef)
      : undefined;

    for (const child of run.children) {
      if (child.type === 'text') {
        textRuns.push(createTextRun(child.content, charProp, header));
      } else if (child.type === 'table') {
        // Flush accumulated text runs as a paragraph first
        if (textRuns.length > 0) {
          result.push(createDocxParagraph(textRuns.splice(0), paraProp));
        }
        const table = convertTable(child.element, header, doc, borderFills);
        if (table) result.push(table);
      } else if (child.type === 'inlineObject') {
        // Try to extract image
        const imageRun = convertInlineObject(child, doc);
        if (imageRun) textRuns.push(imageRun);
      }
    }
  }

  // Flush remaining text runs
  if (textRuns.length > 0 || result.length === 0) {
    result.push(createDocxParagraph(textRuns, paraProp));
  }

  return result;
}

/**
 * Convert an inline object (image) to an ImageRun.
 */
function convertInlineObject(
  child: { type: 'inlineObject'; name: string; element: GenericElement },
  doc: HanDoc,
): ImageRun | null {
  const el = child.element;

  // Find image path from the element tree
  // HWPX structure: <pic> or <img> with binItem child referencing BinData path
  const imgPath = findImagePath(el);
  if (!imgPath) return null;

  // Get image data from HanDoc
  const imgData = doc.getImage(imgPath);
  if (!imgData) return null;

  // Get dimensions from element
  const { width, height } = findImageDimensions(el);

  // Determine image type from path
  const ext = imgPath.split('.').pop()?.toLowerCase() ?? 'png';
  const typeMap: Record<string, 'jpg' | 'png' | 'gif' | 'bmp'> = {
    'jpg': 'jpg', 'jpeg': 'jpg', 'png': 'png', 'gif': 'gif', 'bmp': 'bmp',
  };
  const imgType = typeMap[ext] ?? 'png';

  return new ImageRun({
    type: imgType,
    data: imgData,
    transformation: {
      width: width > 0 ? hwpUnitToEmu(width) / 914400 * 72 : 200, // convert to approx pixels
      height: height > 0 ? hwpUnitToEmu(height) / 914400 * 72 : 150,
    },
  });
}

function findImagePath(el: GenericElement): string | null {
  // Look for binItem with src attribute
  for (const child of el.children) {
    if (child.tag === 'binItem' || child.tag.endsWith(':binItem')) {
      const src = child.attrs['src'] ?? child.attrs['href'];
      if (src) return src;
    }
    // Look for img tag
    if (child.tag === 'img' || child.tag.endsWith(':img')) {
      const src = child.attrs['binaryItemIDRef'] ?? child.attrs['src'];
      if (src) return src;
    }
    // Recurse
    const found = findImagePath(child);
    if (found) return found;
  }
  return null;
}

function findImageDimensions(el: GenericElement): { width: number; height: number } {
  // Look for sz or size attributes
  const w = parseInt(el.attrs['width'] ?? '0');
  const h = parseInt(el.attrs['height'] ?? '0');
  if (w > 0 && h > 0) return { width: w, height: h };

  for (const child of el.children) {
    if (child.tag === 'sz' || child.tag.endsWith(':sz') || child.tag === 'imgRect' || child.tag.endsWith(':imgRect')) {
      const cw = parseInt(child.attrs['width'] ?? child.attrs['cx'] ?? '0');
      const ch = parseInt(child.attrs['height'] ?? child.attrs['cy'] ?? '0');
      if (cw > 0 && ch > 0) return { width: cw, height: ch };
    }
    const found = findImageDimensions(child);
    if (found.width > 0) return found;
  }
  return { width: 0, height: 0 };
}

function createDocxParagraph(
  children: (TextRun | ImageRun)[],
  paraProp?: ParaProperty,
): DocxParagraph {
  // Map heading styles
  let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined;
  if (paraProp?.heading) {
    const level = paraProp.heading.level;
    const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    };
    heading = headingMap[level];
  }

  return new DocxParagraph({
    children,
    alignment: paraProp?.align ? ALIGN_MAP[paraProp.align] : undefined,
    heading,
  });
}

function createTextRun(text: string, charProp?: CharProperty, header?: DocumentHeader): TextRun {
  const font = charProp && header ? resolveFontName(charProp, header) : undefined;

  return new TextRun({
    text,
    bold: charProp?.bold || undefined,
    italics: charProp?.italic || undefined,
    underline: charProp?.underline && charProp.underline !== 'none' ? {} : undefined,
    strike: charProp?.strikeout && charProp.strikeout !== 'none' ? true : undefined,
    size: charProp?.height ? hwpUnitToHalfPt(charProp.height) : undefined,
    color: charProp?.textColor && charProp.textColor !== '000000' ? charProp.textColor : undefined,
    font: font ? { name: font } : undefined,
  });
}

/**
 * Extract text from a GenericElement tree (used for tables).
 */
function extractTextFromGeneric(el: GenericElement): string {
  let text = el.text ?? '';
  for (const child of el.children) {
    text += extractTextFromGeneric(child);
  }
  return text;
}

/**
 * Convert a table GenericElement to a docx Table with formatting.
 */
function convertTable(
  tableEl: GenericElement,
  header: DocumentHeader,
  doc: HanDoc,
  borderFills: Map<number, ReturnType<typeof parseBorderFill>>,
): Table | null {
  // Use the structured table parser
  let parsed: ParsedTable;
  try {
    parsed = parseTable(tableEl);
  } catch {
    // Fallback to simple extraction
    return convertTableSimple(tableEl);
  }

  if (parsed.rows.length === 0) return null;

  const tableRows = parsed.rows.map(row => {
    const tableCells = row.cells.map(cell => {
      const cellText = cell.paragraphs
        .flatMap(p => p.runs.flatMap(r =>
          r.children
            .filter((c): c is { type: 'text'; content: string } => c.type === 'text')
            .map(c => c.content)
        ))
        .join('');

      // Cell options
      const cellOpts: Record<string, unknown> = {
        children: [new DocxParagraph({ children: [new TextRun(cellText)] })],
      };

      // Column span
      if (cell.cellSpan.colSpan > 1) {
        cellOpts.columnSpan = cell.cellSpan.colSpan;
      }

      // Row span
      if (cell.cellSpan.rowSpan > 1) {
        cellOpts.rowSpan = cell.cellSpan.rowSpan;
      }

      // Border fill (background color & borders)
      if (cell.borderFillIDRef > 0) {
        const bf = borderFills.get(cell.borderFillIDRef);
        if (bf) {
          if (bf.bgColor) {
            cellOpts.shading = {
              fill: bf.bgColor,
              type: ShadingType.CLEAR,
              color: 'auto',
            };
          }
          if (Object.keys(bf.borders).length > 0) {
            const borders: Record<string, unknown> = {};
            for (const [side, border] of Object.entries(bf.borders)) {
              if (border) {
                borders[side] = {
                  style: border.style,
                  size: border.width ?? 1,
                  color: border.color ?? '000000',
                };
              }
            }
            if (Object.keys(borders).length > 0) {
              cellOpts.borders = borders;
            }
          }
        }
      }

      return new TableCell(cellOpts as any);
    });

    if (tableCells.length === 0) {
      return new TableRow({
        children: [new TableCell({ children: [new DocxParagraph({})] })],
      });
    }

    return new TableRow({ children: tableCells });
  });

  return new Table({ rows: tableRows });
}

/** Simple fallback table conversion (original logic) */
function convertTableSimple(tableEl: GenericElement): Table | null {
  const rows = tableEl.children.filter(c => c.tag === 'tr' || c.tag.endsWith(':tr'));
  if (rows.length === 0) return null;

  const tableRows = rows.map(row => {
    const cells = row.children.filter(c => c.tag === 'tc' || c.tag.endsWith(':tc'));
    const tableCells = cells.map(cell => {
      const cellText = extractTextFromGeneric(cell);
      return new TableCell({
        children: [new DocxParagraph({ children: [new TextRun(cellText)] })],
      });
    });

    if (tableCells.length === 0) {
      return new TableRow({
        children: [new TableCell({ children: [new DocxParagraph({})] })],
      });
    }

    return new TableRow({ children: tableCells });
  });

  return new Table({ rows: tableRows });
}

// Export internal functions for testing
export const __testing = {
  hwpUnitToTwip,
  hwpUnitToHalfPt,
  hwpUnitToEmu,
  mapFontName,
  resolveFontName,
  mimeToImageType,
  parseBorderFill,
  mapBorderStyle,
  extractTextFromGeneric,
  findImagePath,
  findImageDimensions,
  convertInlineObject,
  createTextRun,
  createDocxParagraph,
  convertParagraphToDocx,
  convertSectionProperties,
  convertTableSimple,
  convertTable,
  convertHeaderFooterToDocxHeader,
  convertHeaderFooterToDocxFooter,
  convertSection,
  convertParagraph,
};
