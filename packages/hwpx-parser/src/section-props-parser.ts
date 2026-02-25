import type { GenericElement, SectionProperties } from './types';

export type { SectionProperties };

function findChild(el: GenericElement, tag: string): GenericElement | undefined {
  return el.children.find((c) => c.tag === tag);
}

function num(val: string | undefined, fallback = 0): number {
  if (val === undefined) return fallback;
  const n = Number(val);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Parse a secPr GenericElement into structured SectionProperties.
 */
export function parseSectionProps(element: GenericElement): SectionProperties {
  const pagePr = findChild(element, 'pagePr');
  const marginEl = pagePr ? findChild(pagePr, 'margin') : undefined;
  const startNum = findChild(element, 'startNum');

  const width = num(pagePr?.attrs['width']);
  const height = num(pagePr?.attrs['height']);
  // HWP landscape attribute: NARROWLY = landscape (rotated), WIDELY = portrait (default)
  const landscape = pagePr?.attrs['landscape'] === 'NARROWLY';

  const margins = {
    left: num(marginEl?.attrs['left']),
    right: num(marginEl?.attrs['right']),
    top: num(marginEl?.attrs['top']),
    bottom: num(marginEl?.attrs['bottom']),
    header: num(marginEl?.attrs['header']),
    footer: num(marginEl?.attrs['footer']),
    gutter: num(marginEl?.attrs['gutter']),
  };

  const result: SectionProperties = {
    pageWidth: width,
    pageHeight: height,
    margins,
    landscape,
  };

  const colPr = findChild(element, 'colPr');
  if (colPr) {
    result.columns = {
      count: num(colPr.attrs['colCount'], 1),
      gap: num(colPr.attrs['sameGap']),
      type: colPr.attrs['type'] ?? 'NEWSPAPER',
    };
    // Parse per-column sizes (colSz children)
    const colSizes = colPr.children.filter((c) => c.tag === 'colSz');
    if (colSizes.length > 0) {
      result.columns.sizes = colSizes.map((cs) => ({
        width: num(cs.attrs['width']),
        gap: num(cs.attrs['gap']),
      }));
    }
    // Parse column separator line (colLine child)
    const colLine = colPr.children.find((c) => c.tag === 'colLine');
    if (colLine) {
      result.columns.separator = {
        type: colLine.attrs['type'] ?? 'SOLID',
        width: colLine.attrs['width'] ?? '0.12 mm',
        color: colLine.attrs['color'] ?? '#000000',
      };
    }
  }

  if (startNum) {
    const pageNum = num(startNum.attrs['page']);
    if (pageNum > 0) {
      result.pageStartNumber = pageNum;
    }
  }

  return result;
}
