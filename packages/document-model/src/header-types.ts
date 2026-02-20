import type { GenericElement } from './generic';

// ── Enums (string literal unions) ──

export type LangType = 'HANGUL' | 'LATIN' | 'HANJA' | 'JAPANESE' | 'OTHER' | 'SYMBOL' | 'USER';
export type FontType = 'REP' | 'TTF' | 'HFT';
export type FontFamilyType =
  | 'FCAT_GOTHIC' | 'FCAT_MYUNGJO' | 'FCAT_DECORATIVE'
  | 'FCAT_SCRIPT' | 'FCAT_ROMAN' | 'FCAT_SWISS' | 'FCAT_MODERN'
  | 'FCAT_OTHER';

export type LineType1 =
  | 'Solid' | 'Dash' | 'Dot' | 'DashDot' | 'DashDotDot'
  | 'LongDash' | 'Circle' | 'DoubleSlim' | 'SlimThick' | 'ThickSlim'
  | 'SlimThickSlim' | 'None';

export type AlignmentType1 = 'Justify' | 'Left' | 'Right' | 'Center' | 'Distribute' | 'DistributeSpace';
export type AlignmentType2 = 'Left' | 'Center' | 'Right';
export type LineSpacingType = 'PERCENT' | 'FIXED' | 'BETWEEN_LINES' | 'AT_LEAST';
export type HeadingType = 'NONE' | 'OUTLINE' | 'NUMBER' | 'BULLET';
export type StyleType = 'PARA' | 'CHAR';
export type LineWrapType = 'BREAK' | 'SQUEEZE' | 'KEEP';

// ── Font declarations ──

export interface FontTypeInfo {
  familyType: FontFamilyType;
  weight: number;
  proportion: number;
  contrast: number;
  strokeVariation: number;
  armStyle: number;
  letterform: number;
  midline: number;
  xHeight: number;
}

export interface FontInfo {
  id: number;
  face: string;
  type: FontType;
  isEmbedded: number;
  typeInfo?: FontTypeInfo;
}

export interface FontFaceDecl {
  lang: LangType;
  fonts: FontInfo[];
}

// ── Border / Fill ──

export interface BorderSide {
  type: LineType1;
  width: string;
  color: string;
}

export interface BorderFill {
  id: number;
  threeD: number;
  shadow: number;
  centerLine: string;
  breakCellSeparateLine: number;
  borders?: {
    left: BorderSide;
    right: BorderSide;
    top: BorderSide;
    bottom: BorderSide;
    diagonal: BorderSide;
  };
  extra?: GenericElement[];
}

// ── Character properties ──

export interface LangRecord {
  hangul: number;
  latin: number;
  hanja: number;
  japanese: number;
  other: number;
  symbol: number;
  user: number;
}

export interface CharProperty {
  id: number;
  height: number;
  textColor: string;
  shadeColor: string;
  useFontSpace: number;
  useKerning: number;
  symMark: string;
  borderFillIDRef: number;
  fontRef: LangRecord;
  ratio: LangRecord;
  spacing: LangRecord;
  relSz: LangRecord;
  offset: LangRecord;
  underline?: { type: string; shape: string; color: string };
  strikeout?: { shape: string; color: string };
  outline?: { type: string };
  shadow?: { type: string; color: string; offsetX: number; offsetY: number };
  bold?: boolean;
  italic?: boolean;
  attrs?: Record<string, string>;
}

// ── Paragraph properties ──

export interface MarginValue {
  value: number;
  unit: string;
}

export interface ParaMargin {
  intent: MarginValue;
  left: MarginValue;
  right: MarginValue;
  prev: MarginValue;
  next: MarginValue;
}

export interface LineSpacing {
  type: LineSpacingType;
  value: number;
  unit: string;
}

export interface ParaProperty {
  id: number;
  tabPrIDRef: number;
  condense: number;
  fontLineHeight: number;
  snapToGrid: number;
  suppressLineNumbers: number;
  checked: number;
  textDir: string;
  align: { horizontal: string; vertical: string };
  heading: { type: HeadingType; idRef: number; level: number };
  breakSetting: {
    breakLatinWord: string;
    breakNonLatinWord: string;
    widowOrphan: number;
    keepWithNext: number;
    keepLines: number;
    pageBreakBefore: number;
    lineWrap: LineWrapType;
  };
  margin: ParaMargin;
  lineSpacing: LineSpacing;
  border?: {
    borderFillIDRef: number;
    offsetLeft: number;
    offsetRight: number;
    offsetTop: number;
    offsetBottom: number;
    connect: number;
    ignoreMargin: number;
  };
  attrs?: Record<string, string>;
}

// ── Styles ──

export interface StyleDecl {
  id: number;
  type: StyleType;
  name: string;
  engName: string;
  paraPrIDRef: number;
  charPrIDRef: number;
  nextStyleIDRef: number;
  langID?: number;
  lockForm?: number;
}

// ── RefList ──

export interface RefList {
  fontFaces: FontFaceDecl[];
  borderFills: BorderFill[];
  charProperties: CharProperty[];
  paraProperties: ParaProperty[];
  styles: StyleDecl[];
  extra?: Record<string, GenericElement[]>;
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

// ── Document Header ──

export interface DocumentHeader {
  version: string;
  secCnt: number;
  beginNum: BeginNum;
  refList: RefList;
  extra?: GenericElement[];
}
