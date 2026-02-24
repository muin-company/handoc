import type { Paragraph, GenericElement } from './types';
import { parseParagraph } from './paragraph-parser';
import { getChildren, getAttrs } from './xml-utils';

// ─── Types ───────────────────────────────────────────────────────────

export interface HeaderFooter {
  type: 'header' | 'footer';
  applyPageType: string;
  paragraphs: Paragraph[];
}

export interface Footnote {
  type: 'footnote' | 'endnote';
  paragraphs: Paragraph[];
}

// ─── Parsers ─────────────────────────────────────────────────────────

/**
 * Parse a GenericElement representing a ctrl that contains a header or footer.
 * In HWPX, these appear as:
 *   <hp:ctrl><hp:header applyPageType="BOTH"><hp:subList>...<hp:p>...</hp:p>...</hp:subList></hp:header></hp:ctrl>
 *   <hp:ctrl><hp:footer applyPageType="BOTH"><hp:subList>...<hp:p>...</hp:p>...</hp:subList></hp:footer></hp:ctrl>
 *
 * Returns null if the element doesn't contain a header or footer.
 */
export function parseHeaderFooter(element: GenericElement): HeaderFooter | null {
  // element is either the ctrl wrapper or the header/footer itself
  const hf = findChildByTag(element, 'header') ?? findChildByTag(element, 'footer');
  if (!hf) {
    // Maybe element IS the header/footer directly
    if (element.tag === 'header' || element.tag === 'footer') {
      return buildHeaderFooter(element);
    }
    return null;
  }
  return buildHeaderFooter(hf);
}

function buildHeaderFooter(hf: GenericElement): HeaderFooter {
  const type = hf.tag === 'header' ? 'header' : 'footer';
  const applyPageType = hf.attrs['applyPageType'] ?? 'BOTH';
  const paragraphs = extractParagraphsFromSubList(hf);
  return { type, applyPageType, paragraphs };
}

/**
 * Parse a GenericElement representing a ctrl that contains a footnote or endnote.
 * In HWPX, these appear as:
 *   <hp:ctrl><hp:footnote ...><hp:subList>...<hp:p>...</hp:p>...</hp:subList></hp:footnote></hp:ctrl>
 *
 * Returns null if the element doesn't contain a footnote or endnote.
 */
export function parseFootnote(element: GenericElement): Footnote | null {
  const fn = findChildByTag(element, 'footnote') ?? findChildByTag(element, 'endnote');
  if (!fn) {
    if (element.tag === 'footnote' || element.tag === 'endnote') {
      return buildFootnote(element);
    }
    return null;
  }
  return buildFootnote(fn);
}

function buildFootnote(fn: GenericElement): Footnote {
  const type = fn.tag === 'footnote' ? 'footnote' : 'endnote';
  const paragraphs = extractParagraphsFromSubList(fn);
  return { type, paragraphs };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function findChildByTag(el: GenericElement, tag: string): GenericElement | undefined {
  return el.children.find(c => c.tag === tag);
}

/**
 * Extract Paragraph[] from a GenericElement that contains subList > p elements.
 * We need to re-parse the paragraph nodes from GenericElement back to Paragraph.
 * Since GenericElement already has the tree, we convert it back to the raw format
 * that parseParagraph expects.
 */
function extractParagraphsFromSubList(el: GenericElement): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const subList = findChildByTag(el, 'subList');
  const container = subList ?? el;

  for (const child of container.children) {
    if (child.tag === 'p') {
      paragraphs.push(parseParagraphFromGeneric(child));
    }
  }
  return paragraphs;
}

/**
 * Convert a GenericElement (already parsed as generic tree) back into a Paragraph.
 * This rebuilds the raw node format that parseParagraph() expects.
 */
function parseParagraphFromGeneric(el: GenericElement): Paragraph {
  const rawNode = genericToRawNode(el);
  return parseParagraph(rawNode);
}

/**
 * Reconstruct the raw parsed-XML node format from a GenericElement tree,
 * so we can feed it into existing parsers (parseParagraph, parseRun, etc).
 */
function genericToRawNode(el: GenericElement): Record<string, unknown> {
  const node: Record<string, unknown> = {};

  // Attributes become @_ prefixed
  for (const [k, v] of Object.entries(el.attrs)) {
    node[`@_${k}`] = v;
  }

  // Text content
  if (el.text !== null) {
    node['#text'] = el.text;
  }

  // Group children by tag name (multiple same-tag children become arrays)
  const groups = new Map<string, unknown[]>();
  for (const child of el.children) {
    const raw = genericToRawNode(child);
    if (!groups.has(child.tag)) {
      groups.set(child.tag, []);
    }
    groups.get(child.tag)!.push(raw);
  }

  for (const [tag, items] of groups) {
    node[tag] = items.length === 1 ? items[0] : items;
  }

  return node;
}

// ─── Collection helpers ──────────────────────────────────────────────

/**
 * Walk all sections' paragraphs and collect headers/footers from ctrl elements.
 */
export function collectHeadersFooters(sections: { paragraphs: Paragraph[] }[]): HeaderFooter[] {
  const results: HeaderFooter[] = [];
  for (const section of sections) {
    for (const para of section.paragraphs) {
      for (const run of para.runs) {
        for (const child of run.children) {
          if (child.type === 'ctrl') {
            const hf = parseHeaderFooter(child.element);
            if (hf) results.push(hf);
          }
        }
      }
    }
  }
  return results;
}

/**
 * Walk all sections' paragraphs and collect footnotes/endnotes from ctrl elements.
 */
export function collectFootnotes(sections: { paragraphs: Paragraph[] }[]): Footnote[] {
  const results: Footnote[] = [];
  for (const section of sections) {
    for (const para of section.paragraphs) {
      for (const run of para.runs) {
        for (const child of run.children) {
          if (child.type === 'ctrl') {
            const fn = parseFootnote(child.element);
            if (fn) results.push(fn);
          }
        }
      }
    }
  }
  return results;
}

/**
 * Extract plain text from a HeaderFooter or Footnote.
 * Handles FORMULA field codes:
 *   Prop=8 → {{page}} (current page number)
 *   Prop=9 → {{pages}} (total page count)
 */
export function extractAnnotationText(item: HeaderFooter | Footnote): string {
  return item.paragraphs
    .flatMap(p =>
      p.runs.flatMap(r =>
        r.children.flatMap(c => {
          if (c.type === 'text') return [c.content];
          if (c.type === 'ctrl') {
            // Check for FORMULA field with page number props
            const fieldBegin = c.element.children.find(ch => ch.tag === 'fieldBegin');
            if (fieldBegin?.attrs['type'] === 'FORMULA') {
              const params = fieldBegin.children.find(ch => ch.tag === 'parameters');
              const propParam = params?.children.find(
                ch => ch.attrs['name'] === 'Prop'
              );
              const prop = propParam?.text ?? propParam?.attrs['value'];
              if (prop === '8') return ['{{page}}'];
              if (prop === '9') return ['{{pages}}'];
            }
            // Check for direct pageNum ctrl
            const pageNumEl = c.element.children.find(ch => ch.tag === 'pageNum');
            if (pageNumEl) return ['{{page}}'];
          }
          return [];
        }),
      ),
    )
    .join('');
}
