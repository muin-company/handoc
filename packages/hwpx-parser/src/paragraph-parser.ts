import type { Paragraph, Run, RunChild, LineSeg, GenericElement } from './types';
import { getAttrs, getChildren, parseBool, parseIntSafe } from './xml-utils';

const SHAPE_OBJECTS = new Set([
  'line', 'rect', 'ellipse', 'arc', 'polyline', 'polygon', 'curve',
  'connectLine', 'shape', 'drawingObject', 'container', 'textart',
]);

const INLINE_OBJECTS = new Set([
  'picture', 'pic', 'ole', 'chart', 'video', 'audio',
]);

const TRACK_CHANGE_MARKS = new Set([
  'insertBegin', 'insertEnd', 'deleteBegin', 'deleteEnd',
]);

export function parseGenericElement(node: Record<string, unknown>, tag: string, depth = 0): GenericElement {
  if (depth > 50) return { tag, attrs: {}, children: [], text: null };
  const attrs = getAttrs(node);
  const children: GenericElement[] = [];
  let text: string | null = null;

  if (typeof node['#text'] === 'string' || typeof node['#text'] === 'number') {
    text = String(node['#text']);
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    const val = node[key];
    if (val === null || val === undefined) continue;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      // Primitive child — treat as text-like leaf
      children.push({ tag: key, attrs: {}, children: [], text: String(val) });
      continue;
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'object' && item !== null) {
          children.push(parseGenericElement(item as Record<string, unknown>, key, depth + 1));
        } else {
          children.push({ tag: key, attrs: {}, children: [], text: item != null ? String(item) : null });
        }
      }
    } else if (typeof val === 'object') {
      children.push(parseGenericElement(val as Record<string, unknown>, key, depth + 1));
    }
  }

  return { tag, attrs, children, text };
}

export function parseRunChild(key: string, value: unknown): RunChild[] {
  const results: RunChild[] = [];

  if (key === 't') {
    // Text content - can be string, number, object with #text, or empty
    // May also contain inline elements (track change marks, tabs, etc.)
    let content = '';
    if (typeof value === 'string' || typeof value === 'number') {
      content = String(value);
    } else if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if ('#text' in obj) {
        content = String(obj['#text']);
      }
      // Process inline elements within <hp:t> (e.g. insertBegin, deleteBegin, tab)
      for (const innerKey of Object.keys(obj)) {
        if (innerKey.startsWith('@_') || innerKey === '#text') continue;
        const localKey = innerKey.includes(':') ? innerKey.split(':').pop()! : innerKey;
        const innerVal = obj[innerKey];
        const items = Array.isArray(innerVal) ? innerVal : [innerVal];
        for (const item of items) {
          results.push(...parseRunChild(localKey, item));
        }
      }
    }
    // Array case handled by caller
    results.push({ type: 'text', content });
    return results;
  }

  if (key === 'secPr') {
    const node = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    results.push({ type: 'secPr', element: parseGenericElement(node, 'secPr') });
    return results;
  }

  if (key === 'ctrl') {
    const node = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    results.push({ type: 'ctrl', element: parseGenericElement(node, 'ctrl') });
    return results;
  }

  if (key === 'tbl') {
    const node = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    results.push({ type: 'table', element: parseGenericElement(node, 'tbl') });
    return results;
  }

  if (key === 'equation') {
    const node = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    results.push({ type: 'equation', element: parseGenericElement(node, 'equation') });
    return results;
  }

  if (SHAPE_OBJECTS.has(key)) {
    const node = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    results.push({ type: 'shape', name: key, element: parseGenericElement(node, key) });
    return results;
  }

  if (INLINE_OBJECTS.has(key)) {
    const node = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    results.push({ type: 'inlineObject', name: key, element: parseGenericElement(node, key) });
    return results;
  }

  if (TRACK_CHANGE_MARKS.has(key)) {
    const node = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    const attrs = getAttrs(node);
    const tc: RunChild = { type: 'trackChange', mark: key };
    if (attrs['Id']) tc.id = Number(attrs['Id']);
    if (attrs['TcId']) tc.tcId = Number(attrs['TcId']);
    if (attrs['paraend'] !== undefined) tc.paraEnd = attrs['paraend'] === '1';
    results.push(tc);
    return results;
  }

  if (key === 'hiddenComment' || key === 'HIDDENCOMMENT') {
    const node = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    const paragraphs = parseHiddenCommentParagraphs(node);
    results.push({ type: 'hiddenComment', paragraphs });
    return results;
  }

  // Unknown element - preserve as inlineObject
  const node = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  results.push({ type: 'inlineObject', name: key, element: parseGenericElement(node, key) });
  return results;
}

export function parseRun(node: Record<string, unknown>): Run {
  const attrs = getAttrs(node);
  const charPrIDRef = attrs['charPrIDRef'] != null ? Number(attrs['charPrIDRef']) : null;
  const children: RunChild[] = [];

  for (const key of Object.keys(node)) {
    if (key.startsWith('@_')) continue;

    const val = node[key];

    // Handle arrays (multiple elements with same tag)
    if (Array.isArray(val)) {
      for (const item of val) {
        children.push(...parseRunChild(key, item));
      }
    } else {
      children.push(...parseRunChild(key, val));
    }
  }

  return { charPrIDRef, children };
}

function parseLineSeg(node: Record<string, unknown>): LineSeg {
  const attrs = getAttrs(node);
  return {
    textpos: parseIntSafe(attrs['textpos']),
    vertpos: parseIntSafe(attrs['vertpos']),
    vertsize: parseIntSafe(attrs['vertsize']),
    textheight: parseIntSafe(attrs['textheight']),
    baseline: parseIntSafe(attrs['baseline']),
    spacing: parseIntSafe(attrs['spacing']),
    horzpos: parseIntSafe(attrs['horzpos']),
    horzsize: parseIntSafe(attrs['horzsize']),
    flags: parseIntSafe(attrs['flags']),
  };
}

export function parseParagraph(node: Record<string, unknown>): Paragraph {
  const attrs = getAttrs(node);
  const runs: Run[] = [];
  const lineSegArray: LineSeg[] = [];

  // Parse runs
  const runNodes = getChildren(node, 'run');
  for (const runNode of runNodes) {
    runs.push(parseRun(runNode));
  }

  // Parse linesegarray
  const lsaNodes = getChildren(node, 'linesegarray');
  for (const lsa of lsaNodes) {
    const segNodes = getChildren(lsa, 'lineseg');
    for (const seg of segNodes) {
      lineSegArray.push(parseLineSeg(seg));
    }
  }

  return {
    id: attrs['id'] ?? null,
    paraPrIDRef: attrs['paraPrIDRef'] != null ? Number(attrs['paraPrIDRef']) : null,
    styleIDRef: attrs['styleIDRef'] != null ? Number(attrs['styleIDRef']) : null,
    pageBreak: parseBool(attrs['pageBreak']),
    columnBreak: parseBool(attrs['columnBreak']),
    merged: parseBool(attrs['merged']),
    runs,
    lineSegArray,
  };
}

// ── Hidden comment paragraphs ──

function parseHiddenCommentParagraphs(node: Record<string, unknown>): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  // Hidden comments contain <hp:p> children
  for (const key of Object.keys(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    const local = key.includes(':') ? key.split(':').pop()! : key;
    if (local === 'p') {
      const items = Array.isArray(node[key]) ? node[key] as Record<string, unknown>[] : [node[key] as Record<string, unknown>];
      for (const item of items) {
        paragraphs.push(parseParagraph(item));
      }
    }
  }
  return paragraphs;
}
