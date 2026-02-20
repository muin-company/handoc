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
  bold?: boolean;
  italic?: boolean;
  underline?: string;
  strikeout?: string;
  textColor?: string;
  shadeColor?: string;
  highlightColor?: string;
  fontRef?: Record<string, number>; // lang → fontFace index (e.g. hangul, latin, hanja, ...)
  attrs: Record<string, string>;
  children: GenericElement[];
}

// ── Paragraph properties ──

export interface ParaProperty {
  id: number;
  align?: 'left' | 'center' | 'right' | 'justify' | 'distribute';
  heading?: { type: string; level: number };
  lineSpacing?: { type: string; value: number };
  margin?: { left?: number; right?: number; indent?: number; prev?: number; next?: number };
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
