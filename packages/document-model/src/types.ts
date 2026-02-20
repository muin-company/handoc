import type { GenericElement } from './generic';
import type { DocumentHeader } from './header-types';

// ── Section properties (secPr) ──

export interface PageSize {
  landscape: string;
  width: number;
  height: number;
  gutterType: string;
}

export interface PageMargin {
  header: number;
  footer: number;
  gutter: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SectionProperty {
  id: string;
  textDirection: string;
  spaceColumns: number;
  tabStop: number;
  tabStopVal: number;
  tabStopUnit: string;
  outlineShapeIDRef: number;
  memoShapeIDRef: number;
  textVerticalWidthHead: number;
  masterPageCnt: number;
  pagePr: PageSize;
  margin: PageMargin;
  extra?: GenericElement[];
}

// ── Table types ──

export interface CellAddress {
  colAddr: number;
  rowAddr: number;
}

export interface CellSpan {
  colSpan: number;
  rowSpan: number;
}

export interface CellSize {
  width: number;
  height: number;
}

export interface TableCell {
  name: string;
  header: number;
  hasMargin: number;
  protect: number;
  editable: number;
  dirty: number;
  borderFillIDRef: number;
  cellAddr: CellAddress;
  cellSpan: CellSpan;
  cellSz: CellSize;
  cellMargin?: { left: number; right: number; top: number; bottom: number };
  paragraphs: Paragraph[];
}

export interface TableRow {
  cells: TableCell[];
}

export interface Table {
  kind: 'table';
  id: string;
  rowCnt: number;
  colCnt: number;
  cellSpacing: number;
  borderFillIDRef: number;
  repeatHeader: number;
  noAdjust: number;
  rows: TableRow[];
  attrs?: Record<string, string>;
  extra?: GenericElement[];
}

// ── Run children ──

export interface TextChild {
  kind: 'text';
  value: string;
}

export interface SecPrChild {
  kind: 'secPr';
  secPr: SectionProperty;
}

export interface CtrlChild {
  kind: 'ctrl';
  element: GenericElement;
}

export interface InlineObjectChild {
  kind: 'inlineObject';
  element: GenericElement;
}

export interface TrackChangeChild {
  kind: 'trackChange';
  element: GenericElement;
}

export type RunChild = TextChild | SecPrChild | CtrlChild | Table | InlineObjectChild | TrackChangeChild;

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

// ── Run & Paragraph ──

export interface Run {
  charPrIDRef: number;
  children: RunChild[];
}

export interface Paragraph {
  id: string;
  paraPrIDRef: number;
  styleIDRef: number;
  pageBreak: number;
  columnBreak: number;
  merged: number;
  runs: Run[];
  lineSegArray?: LineSeg[];
}

// ── Section ──

export interface Section {
  paragraphs: Paragraph[];
}

// ── Document root ──

export interface HwpDocument {
  header: DocumentHeader;
  sections: Section[];
}
