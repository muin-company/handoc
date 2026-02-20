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
  };
  pageStartNumber?: number;
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
  | { type: 'trackChange'; mark: string };

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
