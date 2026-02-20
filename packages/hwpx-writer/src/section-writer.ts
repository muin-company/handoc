/**
 * section-writer.ts — Serializes parsed section data back to section XML
 *
 * Works with hwpx-parser's section-parser/paragraph-parser output types.
 */

import type { Section, Paragraph, Run, RunChild, LineSeg, GenericElement } from '@handoc/document-model';
import { writeGenericElement, escapeXml } from './xml-helpers';

const SECTION_NS: Record<string, string> = {
  'xmlns:hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
  'xmlns:hs': 'http://www.hancom.co.kr/hwpml/2011/section',
  'xmlns:hc': 'http://www.hancom.co.kr/hwpml/2011/core',
  'xmlns:hh': 'http://www.hancom.co.kr/hwpml/2011/head',
};

function attrs(obj: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    parts.push(` ${k}="${escapeXml(String(v))}"`);
  }
  return parts.join('');
}

function selfClose(tag: string, a: Record<string, string>): string {
  return `<${tag}${attrs(a)}/>`;
}

function open(tag: string, a: Record<string, string> = {}): string {
  return `<${tag}${attrs(a)}>`;
}

function close(tag: string): string {
  return `</${tag}>`;
}

export function writeSection(section: Section): string {
  let xml = '<?xml version="1.0" encoding="UTF-8" ?>\n';
  xml += open('hs:sec', SECTION_NS);

  for (const p of section.paragraphs) {
    xml += writeParagraph(p);
  }

  xml += close('hs:sec');
  return xml;
}

function writeParagraph(p: Paragraph): string {
  const pAttrs: Record<string, string> = {};
  if (p.id !== null) pAttrs.id = p.id;
  if (p.paraPrIDRef !== null) pAttrs.paraPrIDRef = String(p.paraPrIDRef);
  if (p.styleIDRef !== null) pAttrs.styleIDRef = String(p.styleIDRef);
  pAttrs.pageBreak = p.pageBreak ? '1' : '0';
  pAttrs.columnBreak = p.columnBreak ? '1' : '0';
  pAttrs.merged = p.merged ? '1' : '0';

  let xml = open('hp:p', pAttrs);

  for (const run of p.runs) {
    xml += writeRun(run);
  }

  if (p.lineSegArray.length > 0) {
    xml += open('hp:linesegarray');
    for (const ls of p.lineSegArray) {
      xml += writeLineSeg(ls);
    }
    xml += close('hp:linesegarray');
  }

  xml += close('hp:p');
  return xml;
}

function writeRun(run: Run): string {
  const runAttrs: Record<string, string> = {};
  if (run.charPrIDRef !== null) runAttrs.charPrIDRef = String(run.charPrIDRef);

  let xml = open('hp:run', runAttrs);

  for (const child of run.children) {
    xml += writeRunChild(child);
  }

  xml += close('hp:run');
  return xml;
}

function writeRunChild(child: RunChild): string {
  switch (child.type) {
    case 'text':
      if (child.content === '') {
        return '<hp:t/>';
      }
      return `<hp:t>${escapeXml(child.content)}</hp:t>`;

    case 'secPr':
      return writeGenericElement(child.element, 'hp');

    case 'ctrl':
      return writeGenericElement(child.element, 'hp');

    case 'table':
      // Try dedicated table serialization, fallback to GenericElement
      return writeTable(child.element);

    case 'inlineObject':
      // Try dedicated inline object (pic) serialization, fallback to GenericElement
      return writeInlineObject(child.element);

    case 'shape':
      // Try dedicated shape serialization, fallback to GenericElement
      return writeShape(child.element);

    case 'trackChange':
      return `<hp:${child.mark}/>`;

    default:
      return '';
  }
}

function writeLineSeg(ls: LineSeg): string {
  return selfClose('hp:lineseg', {
    textpos: String(ls.textpos),
    vertpos: String(ls.vertpos),
    vertsize: String(ls.vertsize),
    textheight: String(ls.textheight),
    baseline: String(ls.baseline),
    spacing: String(ls.spacing),
    horzpos: String(ls.horzpos),
    horzsize: String(ls.horzsize),
    flags: String(ls.flags),
  });
}

// ── Specialized serializers for table/image/shape ──

/**
 * Write table element with dedicated serialization.
 * Fallback to GenericElement passthrough if structure is unknown.
 */
function writeTable(element: GenericElement): string {
  try {
    // Table root
    const tblAttrs: Record<string, string> = { ...element.attrs };
    let xml = open('hp:tbl', tblAttrs);

    // Serialize children (sz, pos, margins, tr, etc.)
    for (const child of element.children) {
      if (child.tag === 'tr') {
        xml += writeTableRow(child);
      } else {
        xml += writeGenericElement(child, 'hp');
      }
    }

    xml += close('hp:tbl');
    return xml;
  } catch (err) {
    // Fallback to GenericElement passthrough
    return writeGenericElement(element, 'hp');
  }
}

/**
 * Write table row <hp:tr>
 */
function writeTableRow(row: GenericElement): string {
  let xml = open('hp:tr', row.attrs);

  for (const tc of row.children) {
    if (tc.tag === 'tc') {
      xml += writeTableCell(tc);
    } else {
      xml += writeGenericElement(tc, 'hp');
    }
  }

  xml += close('hp:tr');
  return xml;
}

/**
 * Write table cell <hp:tc>
 */
function writeTableCell(cell: GenericElement): string {
  const tcAttrs: Record<string, string> = { ...cell.attrs };
  let xml = open('hp:tc', tcAttrs);

  for (const child of cell.children) {
    if (child.tag === 'subList') {
      xml += writeSubList(child);
    } else {
      xml += writeGenericElement(child, 'hp');
    }
  }

  xml += close('hp:tc');
  return xml;
}

/**
 * Write subList (cell content)
 */
function writeSubList(subList: GenericElement): string {
  let xml = open('hp:subList', subList.attrs);

  for (const child of subList.children) {
    if (child.tag === 'p') {
      // Parse and write paragraph from GenericElement
      xml += writeParagraphFromGeneric(child);
    } else {
      xml += writeGenericElement(child, 'hp');
    }
  }

  xml += close('hp:subList');
  return xml;
}

/**
 * Write paragraph from GenericElement (for cell paragraphs)
 * This reconstructs a Paragraph from GenericElement structure.
 */
function writeParagraphFromGeneric(pEl: GenericElement): string {
  const pAttrs: Record<string, string> = { ...pEl.attrs };
  let xml = open('hp:p', pAttrs);

  // Write runs and other children
  for (const child of pEl.children) {
    if (child.tag === 'run') {
      xml += writeRunFromGeneric(child);
    } else if (child.tag === 'linesegarray') {
      xml += writeGenericElement(child, 'hp');
    } else {
      xml += writeGenericElement(child, 'hp');
    }
  }

  xml += close('hp:p');
  return xml;
}

/**
 * Write run from GenericElement
 */
function writeRunFromGeneric(runEl: GenericElement): string {
  let xml = open('hp:run', runEl.attrs);

  for (const child of runEl.children) {
    if (child.tag === 't') {
      // Text element
      if (child.text && child.text.length > 0) {
        xml += `<hp:t>${escapeXml(child.text)}</hp:t>`;
      } else {
        xml += '<hp:t/>';
      }
    } else {
      xml += writeGenericElement(child, 'hp');
    }
  }

  xml += close('hp:run');
  return xml;
}

/**
 * Write inline object (picture, etc.)
 * Fallback to GenericElement passthrough if structure is unknown.
 */
function writeInlineObject(element: GenericElement): string {
  // For now, use GenericElement passthrough
  // Can be specialized later for <hp:pic>
  return writeGenericElement(element, 'hp');
}

/**
 * Write shape element (rect, ellipse, line, etc.)
 * Fallback to GenericElement passthrough if structure is unknown.
 */
function writeShape(element: GenericElement): string {
  // For now, use GenericElement passthrough
  // Can be specialized later for specific shape tags
  return writeGenericElement(element, 'hp');
}
