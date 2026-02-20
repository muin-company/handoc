import { parseXml, getAttr, getAttrs, parseBool, parseIntSafe } from './xml-utils.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface DocumentHeader {
  version: string;
  secCnt: number;
  beginNum: BeginNum;
  refList: RefList;
}

export interface BeginNum {
  page: number;
  footnote: number;
  endnote: number;
  pic: number;
  tbl: number;
  equation: number;
}

export interface RefList {
  fontFaces: FontFaceDecl[];
  charProperties: CharProperty[];
  paraProperties: ParaProperty[];
  styles: StyleDecl[];
  borderFills: GenericElement[];
  others: GenericElement[];
}

export interface FontFaceDecl {
  lang: string;
  fonts: { id: number; face: string; type: string; isEmbedded: boolean }[];
}

export interface CharProperty {
  id: number;
  height: number;
  attrs: Record<string, string>;
  children: GenericElement[];
}

export interface ParaProperty {
  id: number;
  attrs: Record<string, string>;
  children: GenericElement[];
}

export interface StyleDecl {
  id: number;
  type: string;
  name: string;
  engName?: string;
  paraPrIDRef?: number;
  charPrIDRef?: number;
  nextStyleIDRef?: number;
  attrs: Record<string, string>;
}

export interface GenericElement {
  tag: string;
  attrs: Record<string, string>;
  children: GenericElement[];
  text: string | null;
}

// ─── Parser ──────────────────────────────────────────────────────────

export function parseHeader(xml: string): DocumentHeader {
  const doc = parseXml(xml);
  const head = findHead(doc);

  const version = getAttr(head, 'version') ?? '';
  const secCnt = parseIntSafe(getAttr(head, 'secCnt'), 1);
  const beginNum = parseBeginNum(head);

  const refListNode = findChild(head, 'refList') ?? {};
  const refList = parseRefList(refListNode);

  return { version, secCnt, beginNum, refList };
}

// ─── Internal helpers ────────────────────────────────────────────────

function findHead(doc: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(doc)) {
    if (key === '?xml') continue;
    if (key === 'head' || key.endsWith(':head')) {
      return doc[key] as Record<string, unknown>;
    }
  }
  for (const key of Object.keys(doc)) {
    if (key !== '?xml') return doc[key] as Record<string, unknown>;
  }
  throw new Error('No head element found');
}

function findChild(node: Record<string, unknown>, localTag: string): Record<string, unknown> | undefined {
  for (const key of Object.keys(node)) {
    if (key.startsWith('@_')) continue;
    const local = key.includes(':') ? key.split(':').pop()! : key;
    if (local === localTag) {
      const val = node[key];
      return (Array.isArray(val) ? val[0] : val) as Record<string, unknown>;
    }
  }
  return undefined;
}

function findChildren(node: Record<string, unknown>, localTag: string): Record<string, unknown>[] {
  for (const key of Object.keys(node)) {
    if (key.startsWith('@_')) continue;
    const local = key.includes(':') ? key.split(':').pop()! : key;
    if (local === localTag) {
      const val = node[key];
      if (Array.isArray(val)) return val as Record<string, unknown>[];
      if (val !== undefined && val !== null) return [val as Record<string, unknown>];
    }
  }
  return [];
}

function parseBeginNum(head: Record<string, unknown>): BeginNum {
  const bn = findChild(head, 'beginNum') ?? {};
  return {
    page: parseIntSafe(getAttr(bn, 'page'), 1),
    footnote: parseIntSafe(getAttr(bn, 'footnote'), 1),
    endnote: parseIntSafe(getAttr(bn, 'endnote'), 1),
    pic: parseIntSafe(getAttr(bn, 'pic'), 1),
    tbl: parseIntSafe(getAttr(bn, 'tbl'), 1),
    equation: parseIntSafe(getAttr(bn, 'equation'), 1),
  };
}

function parseRefList(refList: Record<string, unknown>): RefList {
  const fontFaces = parseFontFaces(findChild(refList, 'fontfaces') ?? {});
  const charProperties = parseCharProperties(findChildren(refList, 'charProperties'));
  const paraProperties = parseParaProperties(findChildren(refList, 'paraProperties'));
  const styles = parseStyles(findChild(refList, 'styles') ?? {});
  const borderFills = parseBorderFills(findChild(refList, 'borderFills') ?? {});

  const knownTags = new Set(['fontfaces', 'charProperties', 'paraProperties', 'styles', 'borderFills',
    'tabProperties', 'numberings', 'bullets']);
  const others: GenericElement[] = [];
  for (const key of Object.keys(refList)) {
    if (key.startsWith('@_')) continue;
    const local = key.includes(':') ? key.split(':').pop()! : key;
    if (!knownTags.has(local)) {
      for (const child of (Array.isArray(refList[key]) ? refList[key] as unknown[] : [refList[key]])) {
        others.push(toGenericElement(local, child));
      }
    }
  }

  return { fontFaces, charProperties, paraProperties, styles, borderFills, others };
}

function parseFontFaces(fontfaces: Record<string, unknown>): FontFaceDecl[] {
  const result: FontFaceDecl[] = [];
  const faces = findChildren(fontfaces, 'fontface');
  for (const face of faces) {
    const lang = getAttr(face, 'lang') ?? '';
    const fonts = findChildren(face, 'font').map((f) => ({
      id: parseIntSafe(getAttr(f, 'id')),
      face: getAttr(f, 'face') ?? '',
      type: getAttr(f, 'type') ?? '',
      isEmbedded: parseBool(getAttr(f, 'isEmbedded')),
    }));
    result.push({ lang, fonts });
  }
  return result;
}

function parseCharProperties(containers: Record<string, unknown>[]): CharProperty[] {
  const result: CharProperty[] = [];
  for (const container of containers) {
    const items = findChildren(container, 'charPr');
    for (const item of items) {
      const attrs = getAttrs(item);
      const id = parseIntSafe(attrs.id);
      const height = parseIntSafe(attrs.height);
      result.push({ id, height, attrs, children: childrenToGeneric(item) });
    }
  }
  return result;
}

function parseParaProperties(containers: Record<string, unknown>[]): ParaProperty[] {
  const result: ParaProperty[] = [];
  for (const container of containers) {
    const items = findChildren(container, 'paraPr');
    for (const item of items) {
      const attrs = getAttrs(item);
      const id = parseIntSafe(attrs.id);
      result.push({ id, attrs, children: childrenToGeneric(item) });
    }
  }
  return result;
}

function parseStyles(stylesNode: Record<string, unknown>): StyleDecl[] {
  const items = findChildren(stylesNode, 'style');
  return items.map((s) => {
    const attrs = getAttrs(s);
    return {
      id: parseIntSafe(attrs.id),
      type: attrs.type ?? '',
      name: attrs.name ?? '',
      engName: attrs.engName,
      paraPrIDRef: attrs.paraPrIDRef !== undefined ? parseIntSafe(attrs.paraPrIDRef) : undefined,
      charPrIDRef: attrs.charPrIDRef !== undefined ? parseIntSafe(attrs.charPrIDRef) : undefined,
      nextStyleIDRef: attrs.nextStyleIDRef !== undefined ? parseIntSafe(attrs.nextStyleIDRef) : undefined,
      attrs,
    };
  });
}

function parseBorderFills(node: Record<string, unknown>): GenericElement[] {
  return findChildren(node, 'borderFill').map((bf) => toGenericElement('borderFill', bf));
}

function childrenToGeneric(node: Record<string, unknown>): GenericElement[] {
  const result: GenericElement[] = [];
  for (const key of Object.keys(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    const local = key.includes(':') ? key.split(':').pop()! : key;
    const val = node[key];
    const items = Array.isArray(val) ? val : [val];
    for (const item of items) {
      result.push(toGenericElement(local, item));
    }
  }
  return result;
}

function toGenericElement(tag: string, value: unknown): GenericElement {
  if (value === null || value === undefined) {
    return { tag, attrs: {}, children: [], text: null };
  }
  if (typeof value !== 'object') {
    return { tag, attrs: {}, children: [], text: String(value) };
  }
  const node = value as Record<string, unknown>;
  const attrs = getAttrs(node);
  const text = node['#text'] !== undefined ? String(node['#text']) : null;
  const children = childrenToGeneric(node);
  return { tag, attrs, children, text };
}
