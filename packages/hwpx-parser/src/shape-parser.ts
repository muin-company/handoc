import type { GenericElement, Paragraph } from './types';
import { parseParagraph } from './paragraph-parser';

export interface Shape {
  type: string;
  width?: number;
  height?: number;
  textContent?: string;
  paragraphs: Paragraph[];
  children: GenericElement[];
}

/**
 * Parse a shape GenericElement (rect, ellipse, line, polygon, etc.) into a structured Shape.
 * Expects an inlineObject's element (e.g. from RunChild where name is 'rect', 'ellipse', etc.).
 * If the element doesn't contain recognizable shape data, returns a minimal Shape with the tag as type.
 */
export function parseShape(element: GenericElement): Shape {
  const type = element.tag;

  // Extract size from hp:sz child
  const szChild = findChild(element, 'sz');
  const width = szChild ? parseNum(szChild.attrs['width']) : undefined;
  const height = szChild ? parseNum(szChild.attrs['height']) : undefined;

  // Extract text from hp:drawText > hp:subList > hp:p
  const paragraphs: Paragraph[] = [];
  const drawText = findChild(element, 'drawText');
  if (drawText) {
    const subList = findChild(drawText, 'subList');
    const pSource = subList ?? drawText;
    for (const child of pSource.children) {
      if (child.tag === 'p') {
        paragraphs.push(parseParagraphFromGeneric(child));
      }
    }
  }

  // Build textContent from paragraphs
  const textContent = paragraphs.length > 0
    ? paragraphs
        .map(p => p.runs.map(r => r.children.filter(c => c.type === 'text').map(c => (c as { type: 'text'; content: string }).content).join('')).join(''))
        .join('\n')
    : undefined;

  return {
    type,
    width,
    height,
    textContent: textContent || undefined,
    paragraphs,
    children: element.children,
  };
}

function findChild(el: GenericElement, tag: string): GenericElement | undefined {
  return el.children.find(c => c.tag === tag);
}

function parseNum(val: string | undefined): number | undefined {
  if (val == null) return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

/**
 * Convert a GenericElement representing a paragraph back into a Paragraph.
 * This re-parses the generic element structure.
 */
function parseParagraphFromGeneric(el: GenericElement): Paragraph {
  // Reconstruct a raw object that parseParagraph can handle
  const raw = genericToRaw(el);
  return parseParagraph(raw);
}

function genericToRaw(el: GenericElement): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  // Attrs
  for (const [k, v] of Object.entries(el.attrs)) {
    obj[`@_${k}`] = v;
  }

  // Text
  if (el.text != null) {
    obj['#text'] = el.text;
  }

  // Children - group by tag
  const grouped = new Map<string, unknown[]>();
  for (const child of el.children) {
    const arr = grouped.get(child.tag) ?? [];
    arr.push(genericToRaw(child));
    grouped.set(child.tag, arr);
  }

  for (const [tag, items] of grouped) {
    obj[tag] = items.length === 1 ? items[0] : items;
  }

  return obj;
}
