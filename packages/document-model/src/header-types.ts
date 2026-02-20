import type { GenericElement } from './generic';

// ── Document Header ──

export interface DocumentHeader {
  version: string;
  secCnt: number;
  beginNum: BeginNum;
  refList: RefList;
  extra?: GenericElement[];
}

// ── BeginNum ──

export interface BeginNum {
  page: number;
  footnote: number;
  endnote: number;
  pic: number;
  tbl: number;
  equation: number;
}

// ── RefList ──

export interface RefList {
  fontFaces: FontFaceDecl[];
  borderFills: GenericElement[];
  charProperties: CharProperty[];
  paraProperties: ParaProperty[];
  styles: StyleDecl[];
  others: GenericElement[];
}

// ── Font declarations ──

export interface FontFaceDecl {
  lang: string;
  fonts: { id: number; face: string; type: string; isEmbedded: boolean }[];
}

// ── Character properties ──

export interface CharProperty {
  id: number;
  height: number;
  attrs: Record<string, string>;
  children: GenericElement[];
}

// ── Paragraph properties ──

export interface ParaProperty {
  id: number;
  attrs: Record<string, string>;
  children: GenericElement[];
}

// ── Styles ──

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
