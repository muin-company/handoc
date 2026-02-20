/** HWPML XML namespace URIs */
export const NS = {
  HP: 'http://www.hancom.co.kr/hwpml/2011/paragraph',
  HH: 'http://www.hancom.co.kr/hwpml/2011/head',
  HS: 'http://www.hancom.co.kr/hwpml/2011/section',
  HC: 'http://www.hancom.co.kr/hwpml/2011/core',
  HA: 'http://www.hancom.co.kr/hwpml/2011/app',
  OPF: 'http://www.idpf.org/2007/opf/',
} as const;

/** Inline drawing object element names */
export const INLINE_OBJECT_NAMES = new Set([
  'line', 'rect', 'ellipse', 'arc', 'polyline', 'polygon', 'curve',
  'connectLine', 'picture', 'pic', 'shape', 'drawingObject', 'container',
  'equation', 'ole', 'chart', 'video', 'audio', 'textart',
]);

/** Track-change mark element names */
export const TRACK_CHANGE_MARKS = new Set([
  'insertBegin', 'insertEnd', 'deleteBegin', 'deleteEnd',
  'trackChange', 'trackChangeAuthor',
]);

/** 1 HwpUnit = 1/7200 inch */
export const HWPUNIT_PER_INCH = 7200;

/** A4 dimensions in HwpUnit */
export const A4_WIDTH_HU = 59528;
export const A4_HEIGHT_HU = 84186;

/** Font size unit: 1/100 pt (height 1000 = 10pt) */
export const FONT_SIZE_UNIT = 100;
