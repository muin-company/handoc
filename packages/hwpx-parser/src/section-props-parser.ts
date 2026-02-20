import type { GenericElement } from './types';

export interface SectionProperties {
  pageWidth: number;   // HWP unit (1/7200 inch)
  pageHeight: number;
  margins: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    header: number;
    footer: number;
    gutter: number;
  };
  landscape: boolean;
  columns?: {
    count: number;
    gap: number;
    type: string;
  };
  pageStartNumber?: number;
}

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
  const landscape = pagePr?.attrs['landscape'] === 'WIDELY';

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

  // columns — look for colPr in sibling ctrl elements or in the secPr itself
  // colPr is typically in a ctrl element, not inside secPr directly
  // We'll check secPr children for colPr as well
  const colPr = findChild(element, 'colPr');
  if (colPr) {
    result.columns = {
      count: num(colPr.attrs['colCount'], 1),
      gap: num(colPr.attrs['sameGap']),
      type: colPr.attrs['type'] ?? 'NEWSPAPER',
    };
  }

  if (startNum) {
    const pageNum = num(startNum.attrs['page']);
    if (pageNum > 0) {
      result.pageStartNumber = pageNum;
    }
  }

  return result;
}
