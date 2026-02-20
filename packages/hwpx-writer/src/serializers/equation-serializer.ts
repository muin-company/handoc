/**
 * equation-serializer.ts — Serialize equation elements back to XML
 *
 * Supports MathML-style equation notation used in HWPX.
 * Preserves script, font, baseUnit, and version attributes.
 */

import type { GenericElement } from '@handoc/document-model';
import { escapeXml } from '../xml-helpers';

function attrs(obj: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    parts.push(` ${k}="${escapeXml(String(v))}"`);
  }
  return parts.join('');
}

function open(tag: string, a: Record<string, string> = {}): string {
  return `<${tag}${attrs(a)}>`;
}

function close(tag: string): string {
  return `</${tag}>`;
}

function selfClose(tag: string, a: Record<string, string>): string {
  return `<${tag}${attrs(a)}/>`;
}

/**
 * Serialize an equation element back to XML.
 * The equation element is typically stored in RunChild with type 'equation' or 'inlineObject'.
 * 
 * Expected structure:
 * <hc:equation font="..." baseUnit="..." version="...">
 *   <hc:script>equation script text</hc:script>
 *   <hc:sz width="..." height="..."/>
 * </hc:equation>
 */
export function serializeEquation(element: GenericElement, nsPrefix: string = 'hc'): string {
  const eqAttrs = { ...element.attrs };

  let xml = open(`${nsPrefix}:equation`, eqAttrs);

  // Serialize children in order (typically: script, sz)
  for (const child of element.children) {
    xml += serializeEquationChild(child, nsPrefix);
  }

  xml += close(`${nsPrefix}:equation`);
  return xml;
}

/**
 * Serialize equation child elements (script, sz, etc.)
 */
function serializeEquationChild(child: GenericElement, nsPrefix: string): string {
  const tag = child.tag;
  const childAttrs = { ...child.attrs };

  switch (tag) {
    case 'script':
      // Script element contains the equation text
      if (child.text && child.text.length > 0) {
        return `<${nsPrefix}:${tag}${attrs(childAttrs)}>${escapeXml(child.text)}</${nsPrefix}:${tag}>`;
      }
      return `<${nsPrefix}:${tag}${attrs(childAttrs)}/>`;

    case 'sz':
      // Size element (width, height)
      return selfClose(`${nsPrefix}:${tag}`, childAttrs);

    default:
      // Generic fallback for unknown elements
      if (child.children.length === 0 && !child.text) {
        return selfClose(`${nsPrefix}:${tag}`, childAttrs);
      }
      let fallbackXml = open(`${nsPrefix}:${tag}`, childAttrs);
      for (const grandChild of child.children) {
        fallbackXml += serializeEquationChild(grandChild, nsPrefix);
      }
      if (child.text) {
        fallbackXml += escapeXml(child.text);
      }
      fallbackXml += close(`${nsPrefix}:${tag}`);
      return fallbackXml;
  }
}
