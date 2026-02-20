import type { GenericElement } from './generic';

// ── Track Changes & Memo (stub types) ──

export interface TrackChangeEntry {
  [key: string]: unknown;
}

export interface TrackChangeAuthor {
  [key: string]: unknown;
}

export interface MemoShape {
  [key: string]: unknown;
}

// ── Document Header ──

export interface DocumentHeader {
  version: string;
  secCnt: number;
  beginNum: BeginNum;
  refList: RefList;
  trackChanges?: TrackChangeEntry[];
  trackChangeAuthors?: TrackChangeAuthor[];
  memoShapes?: MemoShape[];
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
  numberings: NumberingProperty[];
  bullets: BulletProperty[];
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
  heading?: { type: string; idRef: number; level: number };
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

// ── Numbering properties ──

export interface ParaHead {
  level: number;
  start?: number;
  align?: string;
  useInstWidth?: boolean;
  autoIndent?: boolean;
  widthAdjust?: number;
  textOffsetType?: string;
  textOffset?: number;
  numFormat?: string;
  charPrIDRef?: number;
  checkable?: boolean;
  text?: string; // element text content (e.g. "^1.", "^2)")
}

export interface NumberingProperty {
  id: number;
  start: number;
  levels: ParaHead[];
}

// ── Bullet properties ──

export interface BulletProperty {
  id: number;
  char: string;
  useImage?: boolean;
  levels: ParaHead[];
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
