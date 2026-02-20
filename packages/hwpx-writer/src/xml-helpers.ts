/**
 * xml-helpers.ts — Shared XML serialization utilities
 */

import type { GenericElement } from './parser-types';

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function attrs(obj: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    parts.push(` ${k}="${escapeXml(String(v))}"`);
  }
  return parts.join('');
}

/**
 * Serialize a GenericElement tree back to XML.
 * prefix is the default namespace prefix for unqualified tags.
 */
export function writeGenericElement(el: GenericElement, prefix = 'hh'): string {
  const tag = el.tag.includes(':') ? el.tag : `${prefix}:${el.tag}`;
  const hasChildren = el.children.length > 0;
  const hasText = el.text !== null && el.text !== undefined;

  if (!hasChildren && !hasText) {
    return `<${tag}${attrs(el.attrs)}/>`;
  }

  let xml = `<${tag}${attrs(el.attrs)}>`;
  if (hasText) {
    xml += escapeXml(el.text!);
  }
  for (const child of el.children) {
    xml += writeGenericElement(child, prefix);
  }
  xml += `</${tag}>`;
  return xml;
}
