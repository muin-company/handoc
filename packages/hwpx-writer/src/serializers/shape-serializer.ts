/**
 * shape-serializer.ts — Serialize shape elements back to XML
 *
 * Supports 20+ shape types: rect, ellipse, line, arc, polygon, curve, etc.
 * Preserves drawText content and shape properties.
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
 * Serialize a shape element (rect, ellipse, line, polygon, etc.) back to XML.
 * The shape element is typically stored in RunChild with type 'inlineObject' or 'shape'.
 */
export function serializeShape(element: GenericElement, nsPrefix: string = 'hp'): string {
  const shapeTag = element.tag;
  const shapeAttrs = { ...element.attrs };

  let xml = open(`${nsPrefix}:${shapeTag}`, shapeAttrs);

  // Serialize children in order
  for (const child of element.children) {
    xml += serializeShapeChild(child, nsPrefix);
  }

  xml += close(`${nsPrefix}:${shapeTag}`);
  return xml;
}

/**
 * Serialize shape child elements (sz, pos, angle, flip, drawText, etc.)
 */
function serializeShapeChild(child: GenericElement, nsPrefix: string): string {
  const tag = child.tag;
  const childAttrs = { ...child.attrs };

  // Handle known shape child elements
  switch (tag) {
    case 'sz':
    case 'pos':
    case 'angle':
    case 'flip':
    case 'lineShape':
    case 'fillBrush':
    case 'shadowEffect':
    case 'lineEffect':
    case 'strokeEffect':
    case 'rotationInfo':
    case 'renderingInfo':
    case 'effect':
      // Self-closing elements with attributes
      if (child.children.length === 0 && !child.text) {
        return selfClose(`${nsPrefix}:${tag}`, childAttrs);
      }
      // Elements with children
      let xml = open(`${nsPrefix}:${tag}`, childAttrs);
      for (const grandChild of child.children) {
        xml += serializeShapeChild(grandChild, nsPrefix);
      }
      if (child.text) {
        xml += escapeXml(child.text);
      }
      xml += close(`${nsPrefix}:${tag}`);
      return xml;

    case 'drawText':
      return serializeDrawText(child, nsPrefix);

    case 'subList':
      return serializeSubList(child, nsPrefix);

    case 'p':
      return serializeParagraph(child, nsPrefix);

    case 'run':
      return serializeRun(child, nsPrefix);

    case 't':
      // Text element
      if (child.text && child.text.length > 0) {
        return `<${nsPrefix}:${tag}${attrs(childAttrs)}>${escapeXml(child.text)}</${nsPrefix}:${tag}>`;
      }
      return `<${nsPrefix}:${tag}${attrs(childAttrs)}/>`;

    default:
      // Generic fallback for unknown elements
      if (child.children.length === 0 && !child.text) {
        return selfClose(`${nsPrefix}:${tag}`, childAttrs);
      }
      let fallbackXml = open(`${nsPrefix}:${tag}`, childAttrs);
      for (const grandChild of child.children) {
        fallbackXml += serializeShapeChild(grandChild, nsPrefix);
      }
      if (child.text) {
        fallbackXml += escapeXml(child.text);
      }
      fallbackXml += close(`${nsPrefix}:${tag}`);
      return fallbackXml;
  }
}

/**
 * Serialize drawText element (shape text content)
 */
function serializeDrawText(element: GenericElement, nsPrefix: string): string {
  const drawTextAttrs = { ...element.attrs };
  let xml = open(`${nsPrefix}:drawText`, drawTextAttrs);

  for (const child of element.children) {
    xml += serializeShapeChild(child, nsPrefix);
  }

  xml += close(`${nsPrefix}:drawText`);
  return xml;
}

/**
 * Serialize subList element (paragraph container)
 */
function serializeSubList(element: GenericElement, nsPrefix: string): string {
  const subListAttrs = { ...element.attrs };
  let xml = open(`${nsPrefix}:subList`, subListAttrs);

  for (const child of element.children) {
    xml += serializeShapeChild(child, nsPrefix);
  }

  xml += close(`${nsPrefix}:subList`);
  return xml;
}

/**
 * Serialize paragraph element
 */
function serializeParagraph(element: GenericElement, nsPrefix: string): string {
  const pAttrs = { ...element.attrs };
  let xml = open(`${nsPrefix}:p`, pAttrs);

  for (const child of element.children) {
    xml += serializeShapeChild(child, nsPrefix);
  }

  xml += close(`${nsPrefix}:p`);
  return xml;
}

/**
 * Serialize run element
 */
function serializeRun(element: GenericElement, nsPrefix: string): string {
  const runAttrs = { ...element.attrs };
  let xml = open(`${nsPrefix}:run`, runAttrs);

  for (const child of element.children) {
    xml += serializeShapeChild(child, nsPrefix);
  }

  xml += close(`${nsPrefix}:run`);
  return xml;
}
