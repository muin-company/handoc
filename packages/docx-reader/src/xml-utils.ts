/**
 * Minimal XML parser for OOXML documents.
 * Handles namespace prefixes (w:, r:, etc.) by stripping them for easy access.
 */

export interface XmlNode {
  tag: string;          // local name without namespace prefix
  fullTag: string;      // original tag with prefix
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

/**
 * Parse XML string into a tree of XmlNodes.
 * This is a simple recursive descent parser sufficient for OOXML.
 */
export function parseXml(xml: string): XmlNode {
  // Remove XML declaration
  const clean = xml.replace(/<\?xml[^?]*\?>/g, '').trim();
  const result = parseElement(clean, 0);
  return result.node;
}

function localName(tag: string): string {
  const idx = tag.indexOf(':');
  return idx >= 0 ? tag.slice(idx + 1) : tag;
}

function parseElement(xml: string, pos: number): { node: XmlNode; end: number } {
  // Skip whitespace
  while (pos < xml.length && xml[pos] !== '<') pos++;
  if (pos >= xml.length) return { node: { tag: '', fullTag: '', attrs: {}, children: [], text: '' }, end: pos };

  // Skip '<'
  pos++;

  // Read tag name
  let tagEnd = pos;
  while (tagEnd < xml.length && xml[tagEnd] !== ' ' && xml[tagEnd] !== '>' && xml[tagEnd] !== '/' && xml[tagEnd] !== '\n' && xml[tagEnd] !== '\r' && xml[tagEnd] !== '\t') tagEnd++;
  const fullTag = xml.slice(pos, tagEnd);
  const tag = localName(fullTag);
  pos = tagEnd;

  // Parse attributes
  const attrs: Record<string, string> = {};
  while (pos < xml.length) {
    // Skip whitespace
    while (pos < xml.length && (xml[pos] === ' ' || xml[pos] === '\n' || xml[pos] === '\r' || xml[pos] === '\t')) pos++;
    if (xml[pos] === '>' || xml[pos] === '/') break;

    // Read attr name
    let attrEnd = pos;
    while (attrEnd < xml.length && xml[attrEnd] !== '=' && xml[attrEnd] !== ' ' && xml[attrEnd] !== '>') attrEnd++;
    const attrName = localName(xml.slice(pos, attrEnd));
    pos = attrEnd;

    if (xml[pos] === '=') {
      pos++; // skip '='
      const quote = xml[pos];
      pos++; // skip opening quote
      let valEnd = pos;
      while (valEnd < xml.length && xml[valEnd] !== quote) valEnd++;
      attrs[attrName] = decodeEntities(xml.slice(pos, valEnd));
      pos = valEnd + 1; // skip closing quote
    }
  }

  // Self-closing tag
  if (xml[pos] === '/') {
    pos += 2; // skip '/>'
    return { node: { tag, fullTag, attrs, children: [], text: '' }, end: pos };
  }

  // Skip '>'
  pos++;

  // Parse children and text
  const children: XmlNode[] = [];
  let text = '';

  while (pos < xml.length) {
    // Check for closing tag
    if (xml[pos] === '<' && xml[pos + 1] === '/') {
      // Skip closing tag
      const closeEnd = xml.indexOf('>', pos);
      pos = closeEnd + 1;
      return { node: { tag, fullTag, attrs, children, text: text.trim() }, end: pos };
    }

    if (xml[pos] === '<') {
      // Child element
      const child = parseElement(xml, pos);
      children.push(child.node);
      pos = child.end;
    } else {
      // Text content
      let textEnd = pos;
      while (textEnd < xml.length && xml[textEnd] !== '<') textEnd++;
      text += decodeEntities(xml.slice(pos, textEnd));
      pos = textEnd;
    }
  }

  return { node: { tag, fullTag, attrs, children, text: text.trim() }, end: pos };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Find all descendants with matching local tag name */
export function findAll(node: XmlNode, tag: string): XmlNode[] {
  const result: XmlNode[] = [];
  if (node.tag === tag) result.push(node);
  for (const child of node.children) {
    result.push(...findAll(child, tag));
  }
  return result;
}

/** Find first descendant with matching local tag name */
export function findFirst(node: XmlNode, tag: string): XmlNode | null {
  if (node.tag === tag) return node;
  for (const child of node.children) {
    const found = findFirst(child, tag);
    if (found) return found;
  }
  return null;
}

/** Find direct children with matching local tag name */
export function childrenByTag(node: XmlNode, tag: string): XmlNode[] {
  return node.children.filter(c => c.tag === tag);
}

/** Find first direct child with matching local tag name */
export function childByTag(node: XmlNode, tag: string): XmlNode | null {
  return node.children.find(c => c.tag === tag) ?? null;
}
