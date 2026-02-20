import { parseXml, getAttr, getAttrs, parseBool, parseIntSafe } from './xml-utils.js';
import type {
  DocumentHeader, BeginNum, RefList,
  FontFaceDecl, CharProperty, ParaProperty, StyleDecl,
  TabProperty, TabStop,
} from '@handoc/document-model';
import type { GenericElement, WarningCollector } from '@handoc/document-model';

export type { DocumentHeader };

// ─── Parser ──────────────────────────────────────────────────────────

export function parseHeader(xml: string, warnings?: WarningCollector): DocumentHeader {
  const doc = parseXml(xml);
  const head = findHead(doc);

  const version = getAttr(head, 'version') ?? '';
  const secCnt = parseIntSafe(getAttr(head, 'secCnt'), 1);
  const beginNum = parseBeginNum(head);

  if (warnings && !version) {
    warnings.add('MISSING_ATTR', 'Missing required attribute "version" on <head>', 'head');
  }

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
  const tabProperties = parseTabProperties(findChild(refList, 'tabProperties') ?? {});
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

  return { fontFaces, charProperties, tabProperties, paraProperties, styles, borderFills, others };
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

      // Extract bold/italic from child elements (e.g. <hh:bold/>, <hh:italic/>)
      // Also check attrs for backward compatibility
      const boldEl = findChild(item, 'bold');
      const bold = boldEl !== undefined ? true : (attrs.bold !== undefined ? parseBool(attrs.bold) : undefined);
      const italicEl = findChild(item, 'italic');
      const italic = italicEl !== undefined ? true : (attrs.italic !== undefined ? parseBool(attrs.italic) : undefined);
      const textColor = attrs.textColor || undefined;
      const shadeColor = attrs.shadeColor && attrs.shadeColor !== 'none' ? attrs.shadeColor : undefined;
      const highlightColor = attrs.highlightColor || undefined;

      // Extract underline/strikeout from child elements
      const underlineEl = findChild(item, 'underline');
      const underline = underlineEl ? (getAttr(underlineEl, 'type') ?? undefined) : undefined;
      const strikeoutEl = findChild(item, 'strikeout');
      const strikeout = strikeoutEl ? (getAttr(strikeoutEl, 'shape') ?? undefined) : undefined;

      // Extract fontRef from child element
      const fontRefEl = findChild(item, 'fontRef');
      let fontRef: Record<string, number> | undefined;
      if (fontRefEl) {
        const fontRefAttrs = getAttrs(fontRefEl);
        fontRef = {};
        for (const [lang, val] of Object.entries(fontRefAttrs)) {
          fontRef[lang] = parseIntSafe(val);
        }
      }

      // Extract per-language numeric maps: spacing, ratio, offset, relSz
      const spacing = parseLangNumericMap(findChild(item, 'spacing'));
      const ratio = parseLangNumericMap(findChild(item, 'ratio'));
      const offset = parseLangNumericMap(findChild(item, 'offset'));
      const relSz = parseLangNumericMap(findChild(item, 'relSz'));

      // Extract outline
      const outlineEl = findChild(item, 'outline');
      const outlineType = outlineEl ? (getAttr(outlineEl, 'type') ?? undefined) : undefined;

      // Extract shadow
      const shadowEl = findChild(item, 'shadow');
      let shadow: CharProperty['shadow'] | undefined;
      if (shadowEl) {
        const sType = getAttr(shadowEl, 'type') ?? 'NONE';
        if (sType !== 'NONE') {
          shadow = {
            type: sType,
            color: getAttr(shadowEl, 'color') ?? undefined,
            offsetX: parseIntSafe(getAttr(shadowEl, 'offsetX')),
            offsetY: parseIntSafe(getAttr(shadowEl, 'offsetY')),
          };
        }
      }

      // Extract kerning/fontSpace/symMark/borderFillIDRef from attrs
      const useKerning = attrs.useKerning !== undefined ? parseBool(attrs.useKerning) : undefined;
      const useFontSpace = attrs.useFontSpace !== undefined ? parseBool(attrs.useFontSpace) : undefined;
      const symMark = attrs.symMark && attrs.symMark !== 'NONE' ? attrs.symMark : undefined;
      const borderFillIDRef = attrs.borderFillIDRef !== undefined ? parseIntSafe(attrs.borderFillIDRef) : undefined;

      const cp: CharProperty = { id, height, attrs, children: childrenToGeneric(item) };
      if (bold !== undefined) cp.bold = bold;
      if (italic !== undefined) cp.italic = italic;
      if (underline && underline !== 'NONE') cp.underline = underline;
      if (strikeout && strikeout !== 'NONE') cp.strikeout = strikeout;
      if (textColor) cp.textColor = textColor;
      if (shadeColor) cp.shadeColor = shadeColor;
      if (highlightColor) cp.highlightColor = highlightColor;
      if (fontRef) cp.fontRef = fontRef;
      if (spacing) cp.spacing = spacing;
      if (ratio) cp.ratio = ratio;
      if (offset) cp.offset = offset;
      if (relSz) cp.relSz = relSz;
      if (useKerning) cp.useKerning = useKerning;
      if (useFontSpace) cp.useFontSpace = useFontSpace;
      if (symMark) cp.symMark = symMark;
      if (borderFillIDRef !== undefined) cp.borderFillIDRef = borderFillIDRef;
      if (outlineType && outlineType !== 'NONE') cp.outline = outlineType;
      if (shadow) cp.shadow = shadow;

      result.push(cp);
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

      const pp: ParaProperty = { id, attrs, children: childrenToGeneric(item) };

      // Extract align from child element
      const alignEl = findChild(item, 'align');
      if (alignEl) {
        const h = getAttr(alignEl, 'horizontal');
        if (h) {
          const map: Record<string, ParaProperty['align']> = {
            LEFT: 'left', CENTER: 'center', RIGHT: 'right',
            JUSTIFY: 'justify', DISTRIBUTE: 'distribute',
          };
          pp.align = map[h] ?? undefined;
        }
      }

      // Extract heading from child element
      const headingEl = findChild(item, 'heading');
      if (headingEl) {
        const hType = getAttr(headingEl, 'type') ?? 'NONE';
        const hLevel = parseIntSafe(getAttr(headingEl, 'level'));
        if (hType !== 'NONE') {
          pp.heading = { type: hType, level: hLevel };
        }
      }

      // Extract lineSpacing — may be inside hp:switch/hp:case or hp:default
      const lineSpacingEl = findLineSpacing(item);
      if (lineSpacingEl) {
        const lsType = getAttr(lineSpacingEl, 'type') ?? 'PERCENT';
        const lsValue = parseIntSafe(getAttr(lineSpacingEl, 'value'));
        pp.lineSpacing = { type: lsType, value: lsValue };
      }

      // Extract margin — may be inside hp:switch/hp:case or hp:default
      const marginEl = findMargin(item);
      if (marginEl) {
        const margin: ParaProperty['margin'] = {};
        for (const child of findAllChildren(marginEl)) {
          const local = child.localTag;
          const val = parseIntSafe(getAttr(child.node, 'value'));
          if (local === 'left') margin.left = val;
          else if (local === 'right') margin.right = val;
          else if (local === 'intent') margin.indent = val;
          else if (local === 'prev') margin.prev = val;
          else if (local === 'next') margin.next = val;
        }
        if (Object.keys(margin).length > 0) pp.margin = margin;
      }

      // Extract tabPrIDRef
      if (attrs.tabPrIDRef !== undefined) pp.tabPrIDRef = parseIntSafe(attrs.tabPrIDRef);

      // Extract condense
      const condenseVal = parseIntSafe(attrs.condense);
      if (condenseVal > 0) pp.condense = condenseVal;

      // Extract border
      const borderEl = findChild(item, 'border');
      if (borderEl) {
        const bAttrs = getAttrs(borderEl);
        pp.border = {
          borderFillIDRef: parseIntSafe(bAttrs.borderFillIDRef),
          offsetLeft: parseIntSafe(bAttrs.offsetLeft),
          offsetRight: parseIntSafe(bAttrs.offsetRight),
          offsetTop: parseIntSafe(bAttrs.offsetTop),
          offsetBottom: parseIntSafe(bAttrs.offsetBottom),
          connect: parseBool(bAttrs.connect),
          ignoreMargin: parseBool(bAttrs.ignoreMargin),
        };
      }

      // Extract breakSetting
      const breakEl = findChild(item, 'breakSetting');
      if (breakEl) {
        const bsAttrs = getAttrs(breakEl);
        pp.breakSetting = {
          breakLatinWord: bsAttrs.breakLatinWord,
          breakNonLatinWord: bsAttrs.breakNonLatinWord,
          widowOrphan: parseBool(bsAttrs.widowOrphan),
          keepWithNext: parseBool(bsAttrs.keepWithNext),
          keepLines: parseBool(bsAttrs.keepLines),
          pageBreakBefore: parseBool(bsAttrs.pageBreakBefore),
          lineWrap: bsAttrs.lineWrap,
        };
      }

      // Extract autoSpacing
      const autoSpacingEl = findChild(item, 'autoSpacing');
      if (autoSpacingEl) {
        const asAttrs = getAttrs(autoSpacingEl);
        pp.autoSpacing = {
          eAsianEng: parseBool(asAttrs.eAsianEng),
          eAsianNum: parseBool(asAttrs.eAsianNum),
        };
      }

      result.push(pp);
    }
  }
  return result;
}

/** Parse per-language numeric map from element attributes (e.g. <hh:spacing hangul="0" latin="-5" ...>) */
function parseLangNumericMap(el: Record<string, unknown> | undefined): Record<string, number> | undefined {
  if (!el) return undefined;
  const elAttrs = getAttrs(el);
  const map: Record<string, number> = {};
  let hasNonZero = false;
  for (const [lang, val] of Object.entries(elAttrs)) {
    const n = parseIntSafe(val);
    map[lang] = n;
    if (n !== 0) hasNonZero = true;
  }
  // Only return if there's at least one non-default value, or for ratio where 100 is default
  return Object.keys(map).length > 0 ? map : undefined;
}

/** Parse tab properties */
function parseTabProperties(tabPropsNode: Record<string, unknown>): TabProperty[] {
  const items = findChildren(tabPropsNode, 'tabPr');
  return items.map((item) => {
    const tAttrs = getAttrs(item);
    const tabStops: TabStop[] = [];

    // tabItem can be direct child or inside switch/case/default
    const collectTabItems = (node: Record<string, unknown>) => {
      for (const ti of findChildren(node, 'tabItem')) {
        const tiAttrs = getAttrs(ti);
        tabStops.push({
          pos: parseIntSafe(tiAttrs.pos),
          type: tiAttrs.type,
          leader: tiAttrs.leader,
          unit: tiAttrs.unit,
        });
      }
    };

    collectTabItems(item);

    // Check inside switch > case (prefer) or default
    const sw = findChild(item, 'switch');
    if (sw) {
      const cs = findChild(sw, 'case');
      if (cs) collectTabItems(cs);
      else {
        const df = findChild(sw, 'default');
        if (df) collectTabItems(df);
      }
    }

    return {
      id: parseIntSafe(tAttrs.id),
      autoTabLeft: tAttrs.autoTabLeft !== undefined ? parseBool(tAttrs.autoTabLeft) : undefined,
      autoTabRight: tAttrs.autoTabRight !== undefined ? parseBool(tAttrs.autoTabRight) : undefined,
      tabStops,
    };
  });
}

/** Walk into hp:switch > hp:case (first) or hp:default to find lineSpacing */
function findLineSpacing(item: Record<string, unknown>): Record<string, unknown> | undefined {
  // Direct child first
  const direct = findChild(item, 'lineSpacing');
  if (direct) return direct;
  // Inside switch
  const sw = findChild(item, 'switch');
  if (sw) {
    const cs = findChild(sw, 'case');
    if (cs) { const r = findChild(cs, 'lineSpacing'); if (r) return r; }
    const df = findChild(sw, 'default');
    if (df) { const r = findChild(df, 'lineSpacing'); if (r) return r; }
  }
  return undefined;
}

/** Walk into hp:switch > hp:case (first) or hp:default to find margin */
function findMargin(item: Record<string, unknown>): Record<string, unknown> | undefined {
  const direct = findChild(item, 'margin');
  if (direct) return direct;
  const sw = findChild(item, 'switch');
  if (sw) {
    const cs = findChild(sw, 'case');
    if (cs) { const r = findChild(cs, 'margin'); if (r) return r; }
    const df = findChild(sw, 'default');
    if (df) { const r = findChild(df, 'margin'); if (r) return r; }
  }
  return undefined;
}

/** Get all child elements with their local tag names */
function findAllChildren(node: Record<string, unknown>): { localTag: string; node: Record<string, unknown> }[] {
  const result: { localTag: string; node: Record<string, unknown> }[] = [];
  for (const key of Object.keys(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    const local = key.includes(':') ? key.split(':').pop()! : key;
    const val = node[key];
    const items = Array.isArray(val) ? val : [val];
    for (const item of items) {
      if (item && typeof item === 'object') {
        result.push({ localTag: local, node: item as Record<string, unknown> });
      }
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
