import type { GenericElement } from './types';

export interface Field {
  type: string;
  name?: string;
  value?: string;
  id?: string;
  /** For HYPERLINK fields, the URL */
  url?: string;
  /** Raw parameters from the field */
  parameters: Record<string, string>;
}

/**
 * Parse a field from a ctrl GenericElement containing fieldBegin.
 * Expects the ctrl element (RunChild type='ctrl').
 * Returns null if no fieldBegin is found.
 */
export function parseField(element: GenericElement): Field | null {
  const fieldBegin = findFieldBegin(element);
  if (!fieldBegin) return null;

  const type = fieldBegin.attrs['type'] ?? 'UNKNOWN';
  const name = fieldBegin.attrs['name'] || undefined;
  const id = fieldBegin.attrs['id'] || undefined;

  // Extract parameters
  const parameters: Record<string, string> = {};
  const paramsEl = fieldBegin.children.find(c => c.tag === 'parameters');
  if (paramsEl) {
    for (const param of paramsEl.children) {
      const pName = param.attrs['name'];
      const pValue = param.text ?? '';
      if (pName) {
        parameters[pName] = pValue;
      }
    }
  }

  // Extract URL for hyperlink fields
  let url: string | undefined;
  if (type === 'HYPERLINK') {
    url = parameters['Path'] || undefined;
    if (!url && parameters['Command']) {
      // Command format: "url;flags..."
      const cmd = parameters['Command'];
      const parts = cmd.split(';');
      if (parts.length > 0) {
        url = parts[0].replace(/\\\//g, '/');
      }
    }
  }

  const value = parameters['Command'] || parameters['Path'] || undefined;

  return { type, name, value, id, url, parameters };
}

/**
 * Check if a ctrl GenericElement contains a fieldEnd.
 * Returns the beginIDRef if found, null otherwise.
 */
export function parseFieldEnd(element: GenericElement): string | null {
  const fieldEnd = element.children.find(c => c.tag === 'fieldEnd') ?? 
    (element.tag === 'fieldEnd' ? element : null);
  if (!fieldEnd) return null;
  return fieldEnd.attrs['beginIDRef'] ?? null;
}

function findFieldBegin(el: GenericElement): GenericElement | null {
  if (el.tag === 'fieldBegin') return el;
  return el.children.find(c => c.tag === 'fieldBegin') ?? null;
}
