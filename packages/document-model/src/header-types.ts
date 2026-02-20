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
  tabProperties: TabProperty[];
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
  spacing?: Record<string, number>; // lang → letter spacing (e.g. hangul: -5)
  ratio?: Record<string, number>;   // lang → character width ratio (장평, e.g. 100 = normal)
  offset?: Record<string, number>;  // lang → vertical offset (위첨자/아래첨자)
  relSz?: Record<string, number>;   // lang → relative size percent
  useKerning?: boolean;
  useFontSpace?: boolean;
  symMark?: string;
  borderFillIDRef?: number;
  outline?: string;                 // outline type (e.g. NONE, SOLID)
  shadow?: { type: string; color?: string; offsetX?: number; offsetY?: number };
  attrs: Record<string, string>;
  children: GenericElement[];
}

// ── Tab properties ──

export interface TabStop {
  pos: number;
  type?: string;   // LEFT, RIGHT, CENTER, DECIMAL
  leader?: string; // NONE, SOLID, DASH, DOT, etc.
  unit?: string;
}

export interface TabProperty {
  id: number;
  autoTabLeft?: boolean;
  autoTabRight?: boolean;
  tabStops: TabStop[];
}

// ── Paragraph properties ──

export interface ParaProperty {
  id: number;
  align?: 'left' | 'center' | 'right' | 'justify' | 'distribute';
  heading?: { type: string; level: number };
  lineSpacing?: { type: string; value: number };
  margin?: { left?: number; right?: number; indent?: number; prev?: number; next?: number };
  tabPrIDRef?: number;
  condense?: number;
  border?: { borderFillIDRef: number; offsetLeft?: number; offsetRight?: number; offsetTop?: number; offsetBottom?: number; connect?: boolean; ignoreMargin?: boolean };
  breakSetting?: { breakLatinWord?: string; breakNonLatinWord?: string; widowOrphan?: boolean; keepWithNext?: boolean; keepLines?: boolean; pageBreakBefore?: boolean; lineWrap?: string };
  autoSpacing?: { eAsianEng?: boolean; eAsianNum?: boolean };
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
