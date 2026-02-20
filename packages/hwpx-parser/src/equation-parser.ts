import type { GenericElement } from './types';

export interface Equation {
  script: string;
  font?: string;
  baseUnit?: number;
  version?: string;
}

/**
 * Parse an equation GenericElement into a structured Equation.
 * Expects an inlineObject's element where name is 'equation'.
 * Extracts the script text from the hp:script child.
 */
export function parseEquation(element: GenericElement): Equation {
  const scriptChild = element.children.find(c => c.tag === 'script');
  const script = scriptChild?.text ?? '';

  const font = element.attrs['font'] || undefined;
  const baseUnit = element.attrs['baseUnit'] ? Number(element.attrs['baseUnit']) : undefined;
  const version = element.attrs['version'] || undefined;

  return {
    script,
    font,
    baseUnit: baseUnit != null && !isNaN(baseUnit) ? baseUnit : undefined,
    version,
  };
}
