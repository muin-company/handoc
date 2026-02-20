/**
 * Parse DOCX (Open XML) files into a structured DocxDocument.
 *
 * DOCX = ZIP containing:
 *   word/document.xml  — main body (w:body → w:p → w:r → w:t)
 *   docProps/core.xml  — metadata (title, author)
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
}

export interface DocxParagraph {
  runs: DocxRun[];
  align?: string;       // left | center | right | both (justify)
  styleId?: string;     // e.g. "Heading1"
}

export interface DocxTableCell {
  paragraphs: DocxParagraph[];
  gridSpan?: number;
  vMerge?: string;      // "restart" | "continue" | undefined
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

  for (const child of bodyNode.children) {
    if (child.tag === 'p') {
      const p = parseParagraph(child);
      paragraphs.push(p);
      body.push({ type: 'paragraph', item: p });
    } else if (child.tag === 'tbl') {
      const t = parseTable(child);
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

  return { paragraphs, tables, sections, metadata, body };
}

// ── Internal parsers ──

function parseParagraph(node: XmlNode): DocxParagraph {
  const runs: DocxRun[] = [];
  const pPr = childByTag(node, 'pPr');
  let align: string | undefined;
  let styleId: string | undefined;

  if (pPr) {
    const jc = childByTag(pPr, 'jc');
    if (jc?.attrs.val) align = jc.attrs.val;
    const pStyle = childByTag(pPr, 'pStyle');
    if (pStyle?.attrs.val) styleId = pStyle.attrs.val;
  }

  for (const child of node.children) {
    if (child.tag === 'r') {
      runs.push(parseRun(child));
    }
  }

  return { runs, align, styleId };
}

function parseRun(node: XmlNode): DocxRun {
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

  return { text: textParts.join(''), style };
}

function parseTable(node: XmlNode): DocxTable {
  const rows: DocxTableRow[] = [];
  for (const tr of childrenByTag(node, 'tr')) {
    const cells: DocxTableCell[] = [];
    for (const tc of childrenByTag(tr, 'tc')) {
      const paras: DocxParagraph[] = [];
      for (const p of childrenByTag(tc, 'p')) {
        paras.push(parseParagraph(p));
      }

      const tcPr = childByTag(tc, 'tcPr');
      let gridSpan: number | undefined;
      let vMerge: string | undefined;

      if (tcPr) {
        const gs = childByTag(tcPr, 'gridSpan');
        if (gs?.attrs.val) gridSpan = parseInt(gs.attrs.val, 10);
        const vm = childByTag(tcPr, 'vMerge');
        if (vm) vMerge = vm.attrs.val || 'continue';
      }

      cells.push({ paragraphs: paras, gridSpan, vMerge });
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
