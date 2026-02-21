/**
 * Layout engine — converts HWPX document model to positioned render commands
 *
 * Inspired by PDF.js's PartialEvaluator: walks the document tree and
 * produces a flat list of positioned drawing operations per page.
 *
 * Key concepts:
 * - Y cursor tracks vertical position within a page
 * - When Y exceeds content area height, a new page starts
 * - Text is measured with canvas measureText for accurate line breaking
 * - Tables are laid out with fixed column widths from HWPX metadata
 */

import type {
  Section, Paragraph, Run, RunChild, GenericElement,
} from '@handoc/document-model';
import type {
  CharProperty, ParaProperty,
} from '@handoc/document-model';
import type { HanDoc, ImageInfo } from '@handoc/hwpx-parser';
import { parseTable } from '@handoc/hwpx-parser';
import {
  hwpToPoint, hwpToPx,
  type PageLayout, type PageRenderList,
  type TextSegment, type LineSegment, type RectSegment, type ImageSegment,
  type TextStyle, type ParagraphLayout,
} from './types';
import { getFontFamily, resolveFontFromHeader, canvasFont } from './font-map';

// ── Style resolution ──

function resolveTextStyle(doc: HanDoc, charPrIDRef: number | null): TextStyle {
  const defaults: TextStyle = {
    fontFamily: getFontFamily(undefined),
    fontSize: 10,
    bold: false,
    italic: false,
    underline: false,
    strikeout: false,
    color: '#000000',
    letterSpacing: 0,
  };

  if (charPrIDRef == null) return defaults;
  const cp = doc.header.refList.charProperties.find(c => c.id === charPrIDRef);
  if (!cp) return defaults;

  const style = { ...defaults };

  if (cp.height) style.fontSize = cp.height / 100;
  if (cp.bold) style.bold = true;
  if (cp.italic) style.italic = true;
  if (cp.underline && cp.underline !== 'none' && cp.underline !== 'NONE') style.underline = true;
  if (cp.strikeout && cp.strikeout !== 'none' && cp.strikeout !== 'NONE') style.strikeout = true;
  if (cp.textColor && cp.textColor !== '0' && cp.textColor !== '#000000') {
    const c = cp.textColor.replace('#', '').padStart(6, '0');
    style.color = `#${c}`;
  }

  // Resolve font
  const fontRef = (cp as any).fontRef;
  if (fontRef) {
    const hangulId = fontRef.hangul ?? fontRef.HANGUL;
    if (hangulId != null && doc.header.refList.fontFaces) {
      const fontName = resolveFontFromHeader(doc.header.refList.fontFaces, hangulId, 'HANGUL');
      if (fontName) style.fontFamily = getFontFamily(fontName);
    }
  }

  return style;
}

function resolveParaLayout(doc: HanDoc, paraPrIDRef: number | null): ParagraphLayout {
  const defaults: ParagraphLayout = {
    align: 'left',
    lineHeight: 1.6,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
    textIndent: 0,
  };

  if (paraPrIDRef == null) return defaults;
  const pp = doc.header.refList.paraProperties.find(p => p.id === paraPrIDRef);
  if (!pp) return defaults;

  const layout = { ...defaults };

  if (pp.align) {
    const alignMap: Record<string, ParagraphLayout['align']> = {
      left: 'left', center: 'center', right: 'right',
      justify: 'justify', distribute: 'justify',
      LEFT: 'left', CENTER: 'center', RIGHT: 'right',
      JUSTIFY: 'justify', DISTRIBUTE: 'justify',
    };
    layout.align = alignMap[pp.align] ?? 'left';
  }

  if (pp.lineSpacing) {
    const t = pp.lineSpacing.type.toLowerCase();
    if (t === 'percent') {
      layout.lineHeight = pp.lineSpacing.value / 100;
    } else if (t === 'fixed' && pp.lineSpacing.value > 0) {
      // Fixed line spacing in HWP units → convert to approximate multiplier
      layout.lineHeight = hwpToPoint(pp.lineSpacing.value) / 10; // relative to ~10pt
    }
  }

  if (pp.margin) {
    if (pp.margin.left) layout.marginLeft = hwpToPoint(pp.margin.left);
    if (pp.margin.right) layout.marginRight = hwpToPoint(pp.margin.right);
    if (pp.margin.indent) layout.textIndent = hwpToPoint(pp.margin.indent);
    if (pp.margin.prev) layout.marginTop = hwpToPoint(pp.margin.prev);
    if (pp.margin.next) layout.marginBottom = hwpToPoint(pp.margin.next);
  }

  return layout;
}

// ── Text measurement ──

/**
 * Measure text width using an offscreen canvas (browser) or approximation (Node.js)
 */
function createTextMeasurer() {
  // Try to use OffscreenCanvas or DOM canvas
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(1, 1);
    ctx = canvas.getContext('2d');
  } else if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
  }

  return {
    measureText(text: string, style: TextStyle, dpi: number): number {
      if (ctx) {
        ctx.font = canvasFont(style.fontFamily, style.fontSize, style.bold, style.italic, dpi);
        return ctx.measureText(text).width;
      }
      // Fallback: approximate width (0.5em per character for CJK, 0.3em for latin)
      const sizePx = (style.fontSize / 72) * dpi;
      let width = 0;
      for (const ch of text) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x2E80) {
          width += sizePx * 1.0; // CJK full-width
        } else {
          width += sizePx * 0.5; // Latin half-width
        }
      }
      return width;
    },
  };
}

// ── Layout engine ──

export interface LayoutOptions {
  dpi?: number;
}

/**
 * Layout an entire HanDoc into positioned render commands per page.
 * This is the core function — equivalent to PDF.js's page rendering pipeline.
 */
export function layoutDocument(doc: HanDoc, options: LayoutOptions = {}): PageRenderList[] {
  const dpi = options.dpi ?? 96;
  const measurer = createTextMeasurer();
  const pages: PageRenderList[] = [];

  for (const section of doc.sections) {
    const pageLayout = getPageLayout(section);
    const contentLeft = hwpToPoint(pageLayout.margins.left);
    const contentTop = hwpToPoint(pageLayout.margins.top);
    const contentWidth = hwpToPoint(pageLayout.width - pageLayout.margins.left - pageLayout.margins.right);
    const contentHeight = hwpToPoint(pageLayout.height - pageLayout.margins.top - pageLayout.margins.bottom);

    let cursorY = contentTop;
    let currentPage: PageRenderList = newPage(pages.length, pageLayout);

    function startNewPage() {
      pages.push(currentPage);
      currentPage = newPage(pages.length, pageLayout);
      cursorY = contentTop;
    }

    function checkPageBreak(neededHeight: number) {
      if (cursorY + neededHeight > contentTop + contentHeight) {
        startNewPage();
      }
    }

    for (const para of section.paragraphs) {
      const paraLayout = resolveParaLayout(doc, para.paraPrIDRef);
      const paraLeft = contentLeft + paraLayout.marginLeft;
      const paraWidth = contentWidth - paraLayout.marginLeft - paraLayout.marginRight;

      // Add paragraph top margin
      cursorY += paraLayout.marginTop;

      let isFirstLine = true;

      for (const run of para.runs) {
        const textStyle = resolveTextStyle(doc, run.charPrIDRef);
        const lineHeightPt = textStyle.fontSize * paraLayout.lineHeight;

        for (const child of run.children) {
          switch (child.type) {
            case 'text': {
              // Word-wrap text into lines
              const indent = isFirstLine ? paraLayout.textIndent : 0;
              const lines = wrapText(
                child.content, textStyle, paraLeft + indent,
                paraWidth - indent, measurer, dpi,
              );

              for (const line of lines) {
                checkPageBreak(lineHeightPt);

                // Apply alignment
                let x = line.x;
                if (paraLayout.align === 'center') {
                  x = paraLeft + (paraWidth - line.width) / 2;
                } else if (paraLayout.align === 'right') {
                  x = paraLeft + paraWidth - line.width;
                }

                currentPage.texts.push({
                  text: line.text,
                  x: ptToPx(x, dpi),
                  y: ptToPx(cursorY + textStyle.fontSize, dpi), // baseline
                  style: textStyle,
                });

                // Underline
                if (textStyle.underline) {
                  currentPage.lines.push({
                    x1: ptToPx(x, dpi),
                    y1: ptToPx(cursorY + textStyle.fontSize + 2, dpi),
                    x2: ptToPx(x + line.width, dpi),
                    y2: ptToPx(cursorY + textStyle.fontSize + 2, dpi),
                    width: 1,
                    color: textStyle.color,
                  });
                }

                cursorY += lineHeightPt;
                isFirstLine = false;
              }
              break;
            }

            case 'table': {
              const tableResult = layoutTable(
                doc, child.element, paraLeft, cursorY,
                paraWidth, contentTop, contentHeight,
                measurer, dpi, textStyle, paraLayout,
              );
              // Add table render commands to current (and possibly new) pages
              for (const tp of tableResult.pages) {
                if (tp.pageIndex === 0) {
                  // Same page
                  currentPage.rects.push(...tp.rects);
                  currentPage.texts.push(...tp.texts);
                  currentPage.lines.push(...tp.lines);
                } else {
                  // New page needed
                  startNewPage();
                  currentPage.rects.push(...tp.rects);
                  currentPage.texts.push(...tp.texts);
                  currentPage.lines.push(...tp.lines);
                }
              }
              cursorY = tableResult.endY;
              break;
            }

            case 'inlineObject': {
              if (child.name === 'picture' || child.name === 'pic') {
                const img = layoutImage(doc, child.element, paraLeft, cursorY, paraWidth, dpi);
                if (img) {
                  checkPageBreak(img.h);
                  currentPage.images.push(img);
                  cursorY += img.h;
                }
              }
              break;
            }

            // secPr, ctrl, etc. — skip
          }
        }
      }

      // Paragraph bottom margin
      cursorY += paraLayout.marginBottom;
    }

    // Push last page of section
    pages.push(currentPage);
  }

  return pages;
}

// ── Helpers ──

function newPage(index: number, layout: PageLayout): PageRenderList {
  return { pageIndex: index, layout, texts: [], lines: [], rects: [], images: [] };
}

function ptToPx(pt: number, dpi: number): number {
  return (pt / 72) * dpi;
}

function getPageLayout(section: Section): PageLayout {
  const sp = section.sectionProps;
  if (sp) {
    return {
      width: sp.pageWidth,
      height: sp.pageHeight,
      margins: sp.margins,
      landscape: (sp as any).landscape ?? false,
    };
  }
  // A4 defaults in HWP units
  return {
    width: 59528,
    height: 84186,
    margins: { top: 2834, bottom: 2834, left: 4252, right: 4252, header: 4252, footer: 2834, gutter: 0 },
    landscape: false,
  };
}

interface WrappedLine {
  text: string;
  x: number;
  width: number;
}

function wrapText(
  text: string,
  style: TextStyle,
  x: number,
  maxWidth: number,
  measurer: ReturnType<typeof createTextMeasurer>,
  dpi: number,
): WrappedLine[] {
  if (!text || maxWidth <= 0) return [];

  const lines: WrappedLine[] = [];
  const maxWidthPx = ptToPx(maxWidth, dpi);

  // Split by newlines first
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    if (para.length === 0) {
      lines.push({ text: '', x, width: 0 });
      continue;
    }

    let remaining = para;
    while (remaining.length > 0) {
      // Binary search for the longest substring that fits
      const fullWidth = measurer.measureText(remaining, style, dpi);
      if (fullWidth <= maxWidthPx) {
        lines.push({ text: remaining, x, width: fullWidth * (72 / dpi) });
        break;
      }

      // Find break point
      let breakIdx = remaining.length;
      let lo = 1, hi = remaining.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        const w = measurer.measureText(remaining.substring(0, mid), style, dpi);
        if (w <= maxWidthPx) lo = mid;
        else hi = mid - 1;
      }
      breakIdx = lo;

      // Try to break at word boundary (space or CJK boundary)
      let actualBreak = breakIdx;
      for (let i = breakIdx; i > Math.max(0, breakIdx - 20); i--) {
        const ch = remaining.charCodeAt(i);
        if (ch === 32 || ch === 0x3000) { // space or ideographic space
          actualBreak = i + 1;
          break;
        }
      }
      if (actualBreak === 0) actualBreak = breakIdx;

      const lineText = remaining.substring(0, actualBreak);
      const lineWidth = measurer.measureText(lineText, style, dpi);
      lines.push({ text: lineText, x, width: lineWidth * (72 / dpi) });
      remaining = remaining.substring(actualBreak).trimStart();
    }
  }

  return lines;
}

// ── Table layout ──

interface TableLayoutResult {
  pages: Array<{ pageIndex: number; rects: RectSegment[]; texts: TextSegment[]; lines: LineSegment[] }>;
  endY: number;
}

function layoutTable(
  doc: HanDoc,
  element: GenericElement,
  tableX: number,
  tableY: number,
  maxWidth: number,
  contentTop: number,
  contentHeight: number,
  measurer: ReturnType<typeof createTextMeasurer>,
  dpi: number,
  defaultStyle: TextStyle,
  defaultLayout: ParagraphLayout,
): TableLayoutResult {
  const table = parseTable(element);
  const result: TableLayoutResult = {
    pages: [{ pageIndex: 0, rects: [], texts: [], lines: [] }],
    endY: tableY,
  };

  // Get table width from sz element
  const szEl = element.children.find(c => c.tag === 'sz');
  const tableWidthHwp = szEl ? Number(szEl.attrs['width']) : 0;
  const tableWidthPt = tableWidthHwp > 0 ? hwpToPoint(tableWidthHwp) : maxWidth;

  let curY = tableY;

  for (const row of table.rows) {
    // Calculate row height based on content
    let rowHeight = 0;

    for (const cell of row.cells) {
      // Estimate cell content height
      const cellWidthPt = cell.cellSz.width > 0
        ? hwpToPoint(cell.cellSz.width)
        : tableWidthPt / table.colCnt;

      let cellHeight = 4; // padding
      for (const para of cell.paragraphs) {
        const paraLayout = resolveParaLayout(doc, para.paraPrIDRef);
        cellHeight += paraLayout.marginTop;
        for (const run of para.runs) {
          const style = resolveTextStyle(doc, run.charPrIDRef);
          const lineH = style.fontSize * paraLayout.lineHeight;
          for (const child of run.children) {
            if (child.type === 'text') {
              const lines = wrapText(child.content, style, 0, cellWidthPt - 8, measurer, dpi);
              cellHeight += lines.length * lineH;
            }
          }
        }
        cellHeight += paraLayout.marginBottom;
      }
      rowHeight = Math.max(rowHeight, cellHeight);
    }

    if (rowHeight < 14) rowHeight = 14; // minimum row height

    // Draw cells
    let cellX = tableX;
    for (const cell of row.cells) {
      const cellWidthPt = cell.cellSz.width > 0
        ? hwpToPoint(cell.cellSz.width)
        : (tableWidthPt / table.colCnt) * cell.cellSpan.colSpan;

      const cellHeightPt = rowHeight * cell.cellSpan.rowSpan;

      // Cell border
      result.pages[0].rects.push({
        x: ptToPx(cellX, dpi),
        y: ptToPx(curY, dpi),
        w: ptToPx(cellWidthPt, dpi),
        h: ptToPx(cellHeightPt, dpi),
        strokeColor: '#000000',
        strokeWidth: 1,
      });

      // Cell text
      let textY = curY + 2; // padding
      for (const para of cell.paragraphs) {
        const paraLayout = resolveParaLayout(doc, para.paraPrIDRef);
        textY += paraLayout.marginTop;
        for (const run of para.runs) {
          const style = resolveTextStyle(doc, run.charPrIDRef);
          const lineH = style.fontSize * paraLayout.lineHeight;
          for (const child of run.children) {
            if (child.type === 'text') {
              const lines = wrapText(child.content, style, 0, cellWidthPt - 8, measurer, dpi);
              for (const line of lines) {
                let tx = cellX + 4; // padding
                if (paraLayout.align === 'center') {
                  tx = cellX + (cellWidthPt - (line.width * dpi / 72)) / 2;
                } else if (paraLayout.align === 'right') {
                  tx = cellX + cellWidthPt - 4 - (line.width * dpi / 72);
                }
                result.pages[0].texts.push({
                  text: line.text,
                  x: ptToPx(tx, dpi),
                  y: ptToPx(textY + style.fontSize, dpi),
                  style,
                });
                textY += lineH;
              }
            }
          }
        }
        textY += paraLayout.marginBottom;
      }

      cellX += cellWidthPt;
    }

    curY += rowHeight;
  }

  result.endY = curY;
  return result;
}

// ── Image layout ──

function layoutImage(
  doc: HanDoc,
  element: GenericElement,
  x: number,
  y: number,
  maxWidth: number,
  dpi: number,
): ImageSegment | null {
  // Find image data
  const fileRef = findDescendant(element, 'fileRef');
  if (!fileRef) return null;

  const binItemRef = fileRef.attrs['binItemIDRef'] ?? '';
  if (!binItemRef) return null;

  const image = doc.images.find(img =>
    img.path.includes(binItemRef) || img.path.endsWith(binItemRef),
  );
  if (!image) return null;

  // Get dimensions
  const imgChild = findDescendant(element, 'img') ?? findDescendant(element, 'imgRect');
  let w = maxWidth;
  let h = maxWidth * 0.75; // default aspect ratio

  if (imgChild) {
    const wHwp = Number(imgChild.attrs['width'] ?? 0);
    const hHwp = Number(imgChild.attrs['height'] ?? 0);
    if (wHwp > 0) w = hwpToPoint(wHwp);
    if (hHwp > 0) h = hwpToPoint(hHwp);
  }

  // Clamp to max width
  if (w > maxWidth) {
    const scale = maxWidth / w;
    w = maxWidth;
    h *= scale;
  }

  const ext = image.path.split('.').pop()?.toLowerCase() ?? 'png';
  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff',
  };

  return {
    data: image.data,
    mimeType: mimeMap[ext] ?? 'image/png',
    x: ptToPx(x, dpi),
    y: ptToPx(y, dpi),
    w: ptToPx(w, dpi),
    h: ptToPx(h, dpi),
  };
}

function findDescendant(el: GenericElement, tag: string): GenericElement | undefined {
  for (const child of el.children) {
    const localTag = child.tag.includes(':') ? child.tag.split(':').pop()! : child.tag;
    if (localTag === tag) return child;
    const found = findDescendant(child, tag);
    if (found) return found;
  }
  return undefined;
}
