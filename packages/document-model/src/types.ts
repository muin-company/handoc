import type { GenericElement } from './generic';

// ── Section properties (parsed from secPr elements) ──

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
    /** Per-column widths and gaps (HWP units). Present when sameSz=0 */
    sizes?: Array<{ width: number; gap: number }>;
  };
  pageStartNumber?: number;
  /** Automatic page numbering config from <hp:pageNum> */
  pageNumbering?: {
    pos: string;        // e.g. 'BOTTOM_CENTER', 'BOTTOM_RIGHT', 'TOP_CENTER'
    formatType: string; // e.g. 'DIGIT'
    sideChar: string;   // e.g. '-' → renders as "- 1 -"
  };
  /** Footnote properties from <hp:footNotePr> */
  footNotePr?: {
    suffixChar: string;       // e.g. ')' — appended after footnote number
    supscript: boolean;       // whether footnote number is superscript
    noteLineLength: number;   // separator line length in HWP units (-1 = 30% of column width)
    noteLineWidth: number;    // separator line thickness in pt
    aboveLine: number;        // spacing above separator line in HWP units
    belowLine: number;        // spacing below separator line in HWP units
    betweenNotes: number;     // spacing between footnotes in HWP units
  };
}

// ── Section ──

export interface Section {
  paragraphs: Paragraph[];
  sectionProps?: SectionProperties;
}

// ── Paragraph ──

export interface Paragraph {
  id: string | null;
  paraPrIDRef: number | null;
  styleIDRef: number | null;
  pageBreak: boolean;
  columnBreak: boolean;
  merged: boolean;
  runs: Run[];
  lineSegArray: LineSeg[];
}

// ── Run ──

export interface Run {
  charPrIDRef: number | null;
  children: RunChild[];
}

// ── RunChild ──

export type RunChild =
  | { type: 'text'; content: string }
  | { type: 'secPr'; element: GenericElement }
  | { type: 'ctrl'; element: GenericElement }
  | { type: 'table'; element: GenericElement }
  | { type: 'inlineObject'; name: string; element: GenericElement }
  | { type: 'shape'; name: string; element: GenericElement }
  | { type: 'equation'; element: GenericElement }
  | { type: 'trackChange'; mark: string; id?: number; tcId?: number; paraEnd?: boolean }
  | { type: 'hiddenComment'; paragraphs: Paragraph[] };

// ── LineSeg ──

export interface LineSeg {
  textpos: number;
  vertpos: number;
  vertsize: number;
  textheight: number;
  baseline: number;
  spacing: number;
  horzpos: number;
  horzsize: number;
  flags: number;
}
