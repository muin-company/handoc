import type { Section, GenericElement, RunChild, Paragraph } from './types';
import type { SectionProperties } from './section-props-parser';
import { parseSectionProps } from './section-props-parser';
import { parseXml, getChildren } from './xml-utils';
import { parseParagraph } from './paragraph-parser';

/**
 * Find the first secPr GenericElement in parsed paragraphs.
 */
function findSecPr(paragraphs: Paragraph[]): GenericElement | undefined {
  for (const p of paragraphs) {
    for (const r of p.runs) {
      for (const c of r.children) {
        if (c.type === 'secPr') return c.element;
      }
    }
  }
  return undefined;
}

export function parseSection(xml: string): Section {
  const root = parseXml(xml);
  const paragraphs: Section['paragraphs'] = [];

  // Root could be { sec: { p: [...] } } after namespace removal
  const sec = root['sec'] as Record<string, unknown> | undefined;
  if (!sec) return { paragraphs };

  const pNodes = getChildren(sec, 'p');
  for (const pNode of pNodes) {
    paragraphs.push(parseParagraph(pNode));
  }

  const secPrEl = findSecPr(paragraphs);
  const sectionProps = secPrEl ? parseSectionProps(secPrEl) : undefined;

  return { paragraphs, sectionProps };
}

/**
 * Recursively collect all text from a GenericElement tree.
 * This handles tables (tbl → tr → tc → subList → p → run → t),
 * shapes, text boxes, and any nested structure.
 */
function collectTextFromElement(el: GenericElement): string[] {
  const lines: string[] = [];

  // If this element has direct text
  if (el.text) {
    lines.push(el.text);
  }

  // Look for paragraph-like structures inside: subList > p > run > t
  // Also recurse into all children to handle arbitrary nesting
  for (const child of el.children) {
    lines.push(...collectTextFromElement(child));
  }

  return lines;
}

/**
 * Extract text lines from a single RunChild (recursively for tables/shapes).
 */
function collectTextFromRunChild(rc: RunChild): string[] {
  if (rc.type === 'text') {
    return [rc.content];
  }
  if (rc.type === 'table' || rc.type === 'inlineObject' || rc.type === 'ctrl' || rc.type === 'secPr') {
    return collectTextFromElement(rc.element);
  }
  return [];
}

/**
 * Extract all text lines from a paragraph, including nested tables/shapes.
 */
function extractParagraphText(p: Paragraph): string[] {
  const directText = p.runs
    .flatMap(r =>
      r.children
        .filter((c): c is { type: 'text'; content: string } => c.type === 'text')
        .map(c => c.content),
    )
    .join('');

  const nestedLines: string[] = [];
  for (const r of p.runs) {
    for (const c of r.children) {
      if (c.type !== 'text') {
        nestedLines.push(...collectTextFromRunChild(c));
      }
    }
  }

  const result: string[] = [];
  if (directText) result.push(directText);
  result.push(...nestedLines.filter(l => l.length > 0));
  return result;
}

export function extractText(section: Section): string[] {
  return section.paragraphs.flatMap(p => extractParagraphText(p));
}
