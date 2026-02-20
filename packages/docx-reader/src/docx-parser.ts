/**
 * Parse DOCX (Open XML) files into a structured DocxDocument.
 *
 * DOCX = ZIP containing:
 *   word/document.xml  — main body (w:body → w:p → w:r → w:t)
 *   docProps/core.xml  — metadata (title, author)
 *   word/media/        — embedded images
 */

import { unzipSync } from 'fflate';
import { parseXml, findAll, findFirst, childByTag, childrenByTag, type XmlNode } from './xml-utils';

// ── Public types ──

export interface DocxRunStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;    // in half-points (w:sz val)
  color?: string;       // hex color e.g. "FF0000"
  fontFamily?: string;
}

export interface DocxRun {
  text: string;
  style: DocxRunStyle;
  /** If this run contains an image */
  image?: DocxImage;
}

export interface DocxImage {
  /** Path within the DOCX ZIP (e.g. "word/media/image1.png") */
  path: string;
  /** Raw image bytes */
  data: Uint8Array;
  /** MIME type */
  mimeType: string;
  /** Width in EMU */
  width?: number;
  /** Height in EMU */
  height?: number;
}

export interface DocxParagraph {
  runs: DocxRun[];
  align?: string;       // left | center | right | both (justify)
  styleId?: string;     // e.g. "Heading1"
  /** Numbering info (for lists) */
  numPr?: {
    numId: number;
    ilvl: number;
  };
}

export interface DocxTableCell {
  paragraphs: DocxParagraph[];
  gridSpan?: number;
  vMerge?: string;      // "restart" | "continue" | undefined
  /** Background color (hex) */
  bgColor?: string;
  /** Borders */
  borders?: {
    top?: { style: string; color?: string; size?: number };
    bottom?: { style: string; color?: string; size?: number };
    left?: { style: string; color?: string; size?: number };
    right?: { style: string; color?: string; size?: number };
  };
}

export interface DocxTableRow {
  cells: DocxTableCell[];
}

export interface DocxTable {
  rows: DocxTableRow[];
}

export interface DocxSection {
  pageWidth?: number;   // twentieths of a point
  pageHeight?: number;
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  orientation?: 'portrait' | 'landscape';
}

export interface DocxDocument {
  paragraphs: DocxParagraph[];
  tables: DocxTable[];
  sections: DocxSection[];
  metadata: {
    title?: string;
    author?: string;
  };
  /** Body elements in order (paragraphs and tables interleaved) */
  body: Array<{ type: 'paragraph'; item: DocxParagraph } | { type: 'table'; item: DocxTable }>;
  /** Embedded images extracted from word/media/ */
  images: DocxImage[];
}

// ── Main parse function ──

export async function parseDocx(buffer: Uint8Array): Promise<DocxDocument> {
  const files = unzipSync(buffer);
  const decoder = new TextDecoder();

  const getText = (path: string): string | null => {
    const data = files[path];
    if (!data) return null;
    return decoder.decode(data);
  };

  // Extract images from word/media/
  const images: DocxImage[] = [];
  const imagesByPath = new Map<string, DocxImage>();
  for (const [path, data] of Object.entries(files)) {
    if (path.startsWith('word/media/')) {
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      const mimeMap: Record<string, string> = {
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'gif': 'image/gif', 'bmp': 'image/bmp', 'svg': 'image/svg+xml',
        'emf': 'image/x-emf', 'wmf': 'image/x-wmf', 'tiff': 'image/tiff',
      };
      const img: DocxImage = {
        path,
        data: data as Uint8Array,
        mimeType: mimeMap[ext] ?? 'application/octet-stream',
      };
      images.push(img);
      imagesByPath.set(path, img);
    }
  }

  // Parse relationships to map rId → target
  const relsMap = new Map<string, string>();
  const relsXml = getText('word/_rels/document.xml.rels');
  if (relsXml) {
    const relsTree = parseXml(relsXml);
    const rels = findAll(relsTree, 'Relationship');
    for (const rel of rels) {
      const id = rel.attrs.Id;
      const target = rel.attrs.Target;
      if (id && target) {
        // Resolve relative path
        const fullPath = target.startsWith('/') ? target.slice(1) : 'word/' + target;
        relsMap.set(id, fullPath);
      }
    }
  }

  // Parse document.xml
  const docXml = getText('word/document.xml');
  if (!docXml) throw new Error('Missing word/document.xml in DOCX');

  const docTree = parseXml(docXml);
  const bodyNode = findFirst(docTree, 'body');
  if (!bodyNode) throw new Error('No w:body found in document.xml');

  const paragraphs: DocxParagraph[] = [];
  const tables: DocxTable[] = [];
  const body: DocxDocument['body'] = [];
  const sections: DocxSection[] = [];

  const parseCtx = { relsMap, imagesByPath };

  for (const child of bodyNode.children) {
    if (child.tag === 'p') {
      const p = parseParagraph(child, parseCtx);
      paragraphs.push(p);
      body.push({ type: 'paragraph', item: p });
    } else if (child.tag === 'tbl') {
      const t = parseTable(child, parseCtx);
      tables.push(t);
      body.push({ type: 'table', item: t });
    } else if (child.tag === 'sectPr') {
      sections.push(parseSectPr(child));
    }
  }

  // Also check last paragraph for sectPr (common pattern)
  if (sections.length === 0) {
    const lastSectPr = findFirst(bodyNode, 'sectPr');
    if (lastSectPr) sections.push(parseSectPr(lastSectPr));
  }

  // Parse metadata from docProps/core.xml
  const metadata: DocxDocument['metadata'] = {};
  const coreXml = getText('docProps/core.xml');
  if (coreXml) {
    const coreTree = parseXml(coreXml);
    const titleNode = findFirst(coreTree, 'title');
    if (titleNode?.text) metadata.title = titleNode.text;
    const creatorNode = findFirst(coreTree, 'creator');
    if (creatorNode?.text) metadata.author = creatorNode.text;
  }

  return { paragraphs, tables, sections, metadata, body, images };
}

// ── Context for parsing ──

interface ParseContext {
  relsMap: Map<string, string>;
  imagesByPath: Map<string, DocxImage>;
}

// ── Internal parsers ──

function parseParagraph(node: XmlNode, ctx: ParseContext): DocxParagraph {
  const runs: DocxRun[] = [];
  const pPr = childByTag(node, 'pPr');
  let align: string | undefined;
  let styleId: string | undefined;
  let numPr: DocxParagraph['numPr'];

  if (pPr) {
    const jc = childByTag(pPr, 'jc');
    if (jc?.attrs.val) align = jc.attrs.val;
    const pStyle = childByTag(pPr, 'pStyle');
    if (pStyle?.attrs.val) styleId = pStyle.attrs.val;

    // Parse numbering (lists)
    const numPrNode = childByTag(pPr, 'numPr');
    if (numPrNode) {
      const ilvl = childByTag(numPrNode, 'ilvl');
      const numId = childByTag(numPrNode, 'numId');
      if (numId?.attrs.val) {
        numPr = {
          numId: parseInt(numId.attrs.val, 10),
          ilvl: ilvl?.attrs.val ? parseInt(ilvl.attrs.val, 10) : 0,
        };
      }
    }
  }

  for (const child of node.children) {
    if (child.tag === 'r') {
      runs.push(parseRun(child, ctx));
    }
  }

  return { runs, align, styleId, numPr };
}

function parseRun(node: XmlNode, ctx: ParseContext): DocxRun {
  const style: DocxRunStyle = {};
  const rPr = childByTag(node, 'rPr');

  if (rPr) {
    if (childByTag(rPr, 'b')) style.bold = true;
    if (childByTag(rPr, 'i')) style.italic = true;
    if (childByTag(rPr, 'u')) style.underline = true;
    if (childByTag(rPr, 'strike')) style.strike = true;

    const sz = childByTag(rPr, 'sz');
    if (sz?.attrs.val) style.fontSize = parseInt(sz.attrs.val, 10);

    const color = childByTag(rPr, 'color');
    if (color?.attrs.val && color.attrs.val !== 'auto') style.color = color.attrs.val;

    const rFonts = childByTag(rPr, 'rFonts');
    if (rFonts) {
      style.fontFamily = rFonts.attrs.ascii || rFonts.attrs.hAnsi || rFonts.attrs.eastAsia;
    }
  }

  // Check for image (w:drawing or w:pict)
  let image: DocxImage | undefined;
  const drawing = childByTag(node, 'drawing');
  if (drawing) {
    image = parseDrawingImage(drawing, ctx);
  }

  // Collect text from w:t elements
  const textParts: string[] = [];
  for (const child of node.children) {
    if (child.tag === 't') {
      textParts.push(child.text);
    } else if (child.tag === 'br') {
      textParts.push('\n');
    } else if (child.tag === 'tab') {
      textParts.push('\t');
    }
  }

  return { text: textParts.join(''), style, image };
}

function parseDrawingImage(drawing: XmlNode, ctx: ParseContext): DocxImage | undefined {
  // Look for blip element which references the image via r:embed
  const blip = findFirst(drawing, 'blip');
  if (!blip) return undefined;

  const rId = blip.attrs.embed || blip.attrs['r:embed'];
  if (!rId) return undefined;

  const targetPath = ctx.relsMap.get(rId);
  if (!targetPath) return undefined;

  const img = ctx.imagesByPath.get(targetPath);
  if (!img) return undefined;

  // Try to get dimensions from extent (cx/cy in EMU)
  const ext = findFirst(drawing, 'ext');
  if (ext) {
    const cx = ext.attrs.cx ? parseInt(ext.attrs.cx, 10) : undefined;
    const cy = ext.attrs.cy ? parseInt(ext.attrs.cy, 10) : undefined;
    if (cx) img.width = cx;
    if (cy) img.height = cy;
  }

  return img;
}

function parseTable(node: XmlNode, ctx: ParseContext): DocxTable {
  const rows: DocxTableRow[] = [];
  for (const tr of childrenByTag(node, 'tr')) {
    const cells: DocxTableCell[] = [];
    for (const tc of childrenByTag(tr, 'tc')) {
      const paras: DocxParagraph[] = [];
      for (const p of childrenByTag(tc, 'p')) {
        paras.push(parseParagraph(p, ctx));
      }

      const tcPr = childByTag(tc, 'tcPr');
      let gridSpan: number | undefined;
      let vMerge: string | undefined;
      let bgColor: string | undefined;
      let borders: DocxTableCell['borders'];

      if (tcPr) {
        const gs = childByTag(tcPr, 'gridSpan');
        if (gs?.attrs.val) gridSpan = parseInt(gs.attrs.val, 10);
        const vm = childByTag(tcPr, 'vMerge');
        if (vm) vMerge = vm.attrs.val || 'continue';

        // Background color from shading
        const shd = childByTag(tcPr, 'shd');
        if (shd?.attrs.fill && shd.attrs.fill !== 'auto') {
          bgColor = shd.attrs.fill;
        }

        // Cell borders
        const tcBorders = childByTag(tcPr, 'tcBorders');
        if (tcBorders) {
          borders = {};
          for (const side of ['top', 'bottom', 'left', 'right'] as const) {
            const b = childByTag(tcBorders, side);
            if (b?.attrs.val && b.attrs.val !== 'none') {
              borders[side] = {
                style: b.attrs.val,
                color: b.attrs.color,
                size: b.attrs.sz ? parseInt(b.attrs.sz, 10) : undefined,
              };
            }
          }
        }
      }

      cells.push({ paragraphs: paras, gridSpan, vMerge, bgColor, borders });
    }
    rows.push({ cells });
  }
  return { rows };
}

function parseSectPr(node: XmlNode): DocxSection {
  const section: DocxSection = {};

  const pgSz = childByTag(node, 'pgSz');
  if (pgSz) {
    if (pgSz.attrs.w) section.pageWidth = parseInt(pgSz.attrs.w, 10);
    if (pgSz.attrs.h) section.pageHeight = parseInt(pgSz.attrs.h, 10);
    if (pgSz.attrs.orient === 'landscape') section.orientation = 'landscape';
    else section.orientation = 'portrait';
  }

  const pgMar = childByTag(node, 'pgMar');
  if (pgMar) {
    section.margins = {
      top: pgMar.attrs.top ? parseInt(pgMar.attrs.top, 10) : undefined,
      right: pgMar.attrs.right ? parseInt(pgMar.attrs.right, 10) : undefined,
      bottom: pgMar.attrs.bottom ? parseInt(pgMar.attrs.bottom, 10) : undefined,
      left: pgMar.attrs.left ? parseInt(pgMar.attrs.left, 10) : undefined,
    };
  }

  return section;
}
