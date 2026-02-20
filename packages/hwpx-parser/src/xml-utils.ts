import { XMLParser } from 'fast-xml-parser';

const ATTR_PREFIX = '@_';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  removeNSPrefix: true,
  preserveOrder: false,
  trimValues: true,
});

export function parseXml(xml: string): Record<string, unknown> {
  return parser.parse(xml) as Record<string, unknown>;
}

/** Get attribute value from a parsed node */
export function getAttr(node: Record<string, unknown>, name: string): string | undefined {
  const val = node[ATTR_PREFIX + name];
  return val !== undefined ? String(val) : undefined;
}

/** Get all attributes as a plain Record */
export function getAttrs(node: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(node)) {
    if (key.startsWith(ATTR_PREFIX)) {
      result[key.slice(ATTR_PREFIX.length)] = String(node[key]);
    }
  }
  return result;
}

/** Get child elements (non-attribute keys), always as array */
export function getChildren(node: Record<string, unknown>, tag: string): Record<string, unknown>[] {
  const val = node[tag];
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val as Record<string, unknown>[];
  return [val as Record<string, unknown>];
}

/** Get the local name of a tag (strip namespace prefix) */
export function localName(tag: string): string {
  const idx = tag.indexOf(':');
  return idx >= 0 ? tag.slice(idx + 1) : tag;
}

export function parseBool(val: string | undefined): boolean {
  if (val === undefined) return false;
  return val === '1' || val.toLowerCase() === 'true';
}

export function parseIntSafe(val: string | undefined, defaultVal = 0): number {
  if (val === undefined) return defaultVal;
  const n = Number.parseInt(val, 10);
  return Number.isNaN(n) ? defaultVal : n;
}
