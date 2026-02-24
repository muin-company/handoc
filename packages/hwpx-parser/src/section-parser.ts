import type { Section, GenericElement, RunChild, Paragraph } from './types';
import type { SectionProperties } from './section-props-parser';
import type { WarningCollector } from '@handoc/document-model';
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

export function parseSection(xml: string, warnings?: WarningCollector): Section {
  const root = parseXml(xml);
  const paragraphs: Section['paragraphs'] = [];

  // Root could be { sec: { p: [...] } } after namespace removal
  const sec = root['sec'] as Record<string, unknown> | undefined;
  if (!sec) return { paragraphs };

  // Warn about unknown child elements under <sec>
  if (warnings) {
    const knownSecChildren = new Set(['p', '@_']);
    for (const key of Object.keys(sec)) {
      if (key.startsWith('@_') || key === '#text') continue;
      const local = key.includes(':') ? key.split(':').pop()! : key;
      if (!knownSecChildren.has(local) && local !== 'p') {
        warnings.add('UNKNOWN_ELEMENT', `Unknown element <${local}> under <sec>`, `sec/${local}`);
      }
    }
  }

  const pNodes = getChildren(sec, 'p');
  for (const pNode of pNodes) {
    paragraphs.push(parseParagraph(pNode));
  }

  const secPrEl = findSecPr(paragraphs);
  const sectionProps = secPrEl ? parseSectionProps(secPrEl) : undefined;

  // Extract pageNum config from ctrl elements in paragraphs
  if (sectionProps) {
    for (const p of paragraphs) {
      for (const r of p.runs) {
        for (const c of r.children) {
          if (c.type === 'ctrl') {
            const pageNumEl = c.element.children.find(ch => ch.tag === 'pageNum');
            if (pageNumEl && pageNumEl.attrs['pos']) {
              sectionProps.pageNumbering = {
                pos: pageNumEl.attrs['pos'],
                formatType: pageNumEl.attrs['formatType'] ?? 'DIGIT',
                sideChar: pageNumEl.attrs['sideChar'] ?? '',
              };
            }
          }
        }
      }
    }
  }

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
