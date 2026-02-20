/**
 * Re-export types from hwpx-parser for use by the writer.
 * These match the parser's output format exactly.
 */

// GenericElement
export interface GenericElement {
  tag: string;
  attrs: Record<string, string>;
  children: GenericElement[];
  text: string | null;
}

// Section types
export interface Section {
  paragraphs: Paragraph[];
}

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

export interface Run {
  charPrIDRef: number | null;
  children: RunChild[];
}

export type RunChild =
  | { type: 'text'; content: string }
  | { type: 'secPr'; element: GenericElement }
  | { type: 'ctrl'; element: GenericElement }
  | { type: 'table'; element: GenericElement }
  | { type: 'inlineObject'; name: string; element: GenericElement }
  | { type: 'trackChange'; mark: string };

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

// Header types (from header-parser output)
export interface DocumentHeader {
  version: string;
  secCnt: number;
  beginNum: BeginNum;
  refList: RefList;
  extra?: GenericElement[];
}

export interface BeginNum {
  page: number;
  footnote: number;
  endnote: number;
  pic: number;
  tbl: number;
  equation: number;
}

export interface RefList {
  fontFaces: FontFaceDecl[];
  borderFills: GenericElement[];
  charProperties: CharProperty[];
  paraProperties: ParaProperty[];
  styles: StyleDecl[];
  others: GenericElement[];
}

export interface FontFaceDecl {
  lang: string;
  fonts: { id: number; face: string; type: string; isEmbedded: boolean }[];
}

export interface CharProperty {
  id: number;
  height: number;
  attrs: Record<string, string>;
  children: GenericElement[];
}

export interface ParaProperty {
  id: number;
  attrs: Record<string, string>;
  children: GenericElement[];
}

export interface StyleDecl {
  id: number;
  type: string;
  name: string;
  engName?: string;
  paraPrIDRef?: number;
  charPrIDRef?: number;
  nextStyleIDRef?: number;
  attrs: Record<string, string>;
}
