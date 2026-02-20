/**
 * section-writer.ts — Serializes parsed section data back to section XML
 *
 * Works with hwpx-parser's section-parser/paragraph-parser output types.
 */

import type { Section, Paragraph, Run, RunChild, LineSeg, GenericElement } from './parser-types';
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
      return writeGenericElement(child.element, 'hp');

    case 'inlineObject':
      return writeGenericElement(child.element, 'hp');

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
