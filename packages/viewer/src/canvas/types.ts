/**
 * Canvas renderer types — inspired by PDF.js architecture
 */

/** HWP unit conversion: 1 HWP unit = 1/7200 inch */
export const HWP_UNIT_PER_INCH = 7200;
export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

/** Convert HWP units to points (1/72 inch) */
export function hwpToPoint(hwp: number): number {
  return (hwp / HWP_UNIT_PER_INCH) * PT_PER_INCH;
}

/** Convert HWP units to mm */
export function hwpToMm(hwp: number): number {
  return (hwp / HWP_UNIT_PER_INCH) * MM_PER_INCH;
}

/** Convert HWP units to pixels at given DPI */
export function hwpToPx(hwp: number, dpi: number = 96): number {
  return (hwp / HWP_UNIT_PER_INCH) * dpi;
}

/** Convert mm to pixels at given DPI */
export function mmToPx(mm: number, dpi: number = 96): number {
  return (mm / MM_PER_INCH) * dpi;
}

/** Page dimensions in HWP units */
export interface PageLayout {
  width: number;   // HWP units
  height: number;  // HWP units
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    header: number;
    footer: number;
    gutter: number;
  };
  landscape: boolean;
}

/** Rendering viewport */
export interface Viewport {
  width: number;   // pixels
  height: number;  // pixels
  scale: number;   // zoom factor (1.0 = 100%)
  dpi: number;
}

/** Text style for canvas rendering */
export interface TextStyle {
  fontFamily: string;
  fontSize: number;    // pt
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeout: boolean;
  color: string;       // CSS color
  letterSpacing: number; // pt
}

/** Paragraph layout info */
export interface ParagraphLayout {
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;    // multiplier (e.g., 1.6)
  marginLeft: number;    // pt
  marginRight: number;   // pt
  marginTop: number;     // pt
  marginBottom: number;  // pt
  textIndent: number;    // pt
}

/** A positioned text segment ready for rendering */
export interface TextSegment {
  text: string;
  x: number;      // pt from page left
  y: number;      // pt from page top
  style: TextStyle;
}

/** A positioned line (for underline, strikeout, borders) */
export interface LineSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  width: number;
  color: string;
}

/** A positioned rectangle (for borders, backgrounds) */
export interface RectSegment {
  x: number; y: number;
  w: number; h: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

/** A positioned image */
export interface ImageSegment {
  data: Uint8Array;
  mimeType: string;
  x: number; y: number;
  w: number; h: number;
}

/** All render commands for a single page */
export interface PageRenderList {
  pageIndex: number;
  layout: PageLayout;
  texts: TextSegment[];
  lines: LineSegment[];
  rects: RectSegment[];
  images: ImageSegment[];
}
