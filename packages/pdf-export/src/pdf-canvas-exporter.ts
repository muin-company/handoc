/**
 * Canvas-based PDF exporter — uses layout engine directly with pdf-lib
 *
 * No HTML, no Playwright, no browser dependency.
 * Inspired by PDF.js's CanvasGraphics but in reverse:
 * instead of reading PDF → canvas, we go HWPX → layout → PDF.
 */

import { HanDoc } from '@handoc/hwpx-parser';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';

import type {
  Section, Paragraph, Run, GenericElement,
} from '@handoc/document-model';
import type { CharProperty, ParaProperty } from '@handoc/document-model';
import { parseTable } from '@handoc/hwpx-parser';

// ── Constants ──

const HWP_PER_INCH = 7200;
const PT_PER_INCH = 72;

function hwpToPt(hwp: number): number {
  return (hwp / HWP_PER_INCH) * PT_PER_INCH;
}

// ── Font mapping ──

const FONT_MAP_SERIF = ['함초롬바탕', '바탕', '바탕체', '궁서', '궁서체', '휴먼명조', '한양신명조', '신명조'];
const FONT_MAP_SANS = ['함초롬돋움', '돋움', '돋움체', '맑은 고딕', '굴림', '굴림체', '휴먼고딕', '한양중고딕'];

function resolveFontName(doc: HanDoc, charPrIDRef: number | null): string | undefined {
  if (charPrIDRef == null) return undefined;
  const cp = doc.header.refList.charProperties.find(c => c.id === charPrIDRef);
  if (!cp) return undefined;
  const fontRef = (cp as any).fontRef;
  if (!fontRef) return undefined;
  const hangulId = fontRef.hangul ?? fontRef.HANGUL;
  if (hangulId == null || !doc.header.refList.fontFaces) return undefined;
  const langFaces = doc.header.refList.fontFaces.find(f => f.lang === 'HANGUL');
  if (!langFaces) return undefined;
  return langFaces.fonts.find(f => f.id === hangulId)?.face;
}

function isSerifFont(fontName: string | undefined): boolean {
  if (!fontName) return true;
  return FONT_MAP_SERIF.includes(fontName) || !FONT_MAP_SANS.includes(fontName);
}

// ── Style resolution ──

interface TextStyle {
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: [number, number, number];
  isSerif: boolean;
}

function resolveTextStyle(doc: HanDoc, charPrIDRef: number | null): TextStyle {
  const defaults: TextStyle = { fontSize: 10, bold: false, italic: false, underline: false, color: [0, 0, 0], isSerif: true };
  if (charPrIDRef == null) return defaults;
  const cp = doc.header.refList.charProperties.find(c => c.id === charPrIDRef);
  if (!cp) return defaults;

  const style = { ...defaults };
  if (cp.height) style.fontSize = cp.height / 100;
  if (cp.bold) style.bold = true;
  if (cp.italic) style.italic = true;
  if (cp.underline && cp.underline !== 'none' && cp.underline !== 'NONE') style.underline = true;
  if (cp.textColor && cp.textColor !== '0' && cp.textColor !== '#000000' && cp.textColor !== '000000') {
    const c = cp.textColor.replace('#', '').padStart(6, '0');
    style.color = [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255];
  }
  style.isSerif = isSerifFont(resolveFontName(doc, charPrIDRef));
  return style;
}

interface ParaStyle {
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  textIndent: number;
}

function resolveParaStyle(doc: HanDoc, paraPrIDRef: number | null): ParaStyle {
  const defaults: ParaStyle = { align: 'left', lineHeight: 1.6, marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0, textIndent: 0 };
  if (paraPrIDRef == null) return defaults;
  const pp = doc.header.refList.paraProperties.find(p => p.id === paraPrIDRef);
  if (!pp) return defaults;

  const s = { ...defaults };
  if (pp.align) {
    const m: Record<string, ParaStyle['align']> = { left: 'left', center: 'center', right: 'right', justify: 'justify', distribute: 'justify', LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFY: 'justify', DISTRIBUTE: 'justify' };
    s.align = m[pp.align] ?? 'left';
  }
  if (pp.lineSpacing) {
    const t = pp.lineSpacing.type.toLowerCase();
    if (t === 'percent') s.lineHeight = pp.lineSpacing.value / 100;
    else if (t === 'fixed' && pp.lineSpacing.value > 0) s.lineHeight = hwpToPt(pp.lineSpacing.value) / s.lineHeight;
  }
  if (pp.margin) {
    if (pp.margin.left) s.marginLeft = hwpToPt(pp.margin.left);
    if (pp.margin.right) s.marginRight = hwpToPt(pp.margin.right);
    if (pp.margin.indent) s.textIndent = hwpToPt(pp.margin.indent);
    if (pp.margin.prev) s.marginTop = hwpToPt(pp.margin.prev);
    if (pp.margin.next) s.marginBottom = hwpToPt(pp.margin.next);
  }
  return s;
}

// ── PDF text width estimation ──
// pdf-lib StandardFonts don't support CJK, so we estimate widths
// For accurate CJK rendering, embedded fonts would be needed

function estimateTextWidth(text: string, fontSize: number, bold: boolean): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x2E80) {
      width += fontSize; // CJK full-width
    } else if (code >= 0x20 && code <= 0x7E) {
      width += fontSize * (bold ? 0.62 : 0.55); // Latin approximate
    } else {
      width += fontSize * 0.5;
    }
  }
  return width;
}

// ── Word wrap ──

interface WLine { text: string; width: number; }

function wrapTextForPdf(text: string, fontSize: number, bold: boolean, maxWidth: number): WLine[] {
  if (!text || maxWidth <= 0) return [];
  const lines: WLine[] = [];
  const paras = text.split('\n');

  for (const para of paras) {
    if (!para) { lines.push({ text: '', width: 0 }); continue; }
    let remaining = para;
    while (remaining.length > 0) {
      const fullW = estimateTextWidth(remaining, fontSize, bold);
      if (fullW <= maxWidth) { lines.push({ text: remaining, width: fullW }); break; }
      // Binary search for fit
      let lo = 1, hi = remaining.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (estimateTextWidth(remaining.substring(0, mid), fontSize, bold) <= maxWidth) lo = mid;
        else hi = mid - 1;
      }
      // Word boundary
      let brk = lo;
      for (let i = lo; i > Math.max(0, lo - 15); i--) {
        if (remaining.charCodeAt(i) === 32) { brk = i + 1; break; }
      }
      if (brk === 0) brk = lo;
      const lineText = remaining.substring(0, brk);
      lines.push({ text: lineText, width: estimateTextWidth(lineText, fontSize, bold) });
      remaining = remaining.substring(brk).trimStart();
    }
  }
  return lines;
}

// ── Main export function ──

/**
 * Convert HWPX to PDF using direct pdf-lib rendering (no HTML, no browser).
 */
export async function hwpxToPdfDirect(hwpxBuffer: Uint8Array): Promise<Uint8Array> {
  const doc = await HanDoc.open(hwpxBuffer);
  const pdfDoc = await PDFDocument.create();

  // Embed standard fonts (CJK will use estimation)
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  function getFont(style: TextStyle): PDFFont {
    if (style.isSerif) return style.bold ? timesRomanBold : timesRoman;
    return style.bold ? helveticaBold : helvetica;
  }

  for (const section of doc.sections) {
    const sp = section.sectionProps;
    const pageW = sp ? hwpToPt(sp.pageWidth) : 595.28;  // A4
    const pageH = sp ? hwpToPt(sp.pageHeight) : 841.89;
    const mLeft = sp ? hwpToPt(sp.margins.left) : 56.69;
    const mRight = sp ? hwpToPt(sp.margins.right) : 56.69;
    const mTop = sp ? hwpToPt(sp.margins.top) : 56.69;
    const mBottom = sp ? hwpToPt(sp.margins.bottom) : 56.69;

    const contentW = pageW - mLeft - mRight;
    const contentH = pageH - mTop - mBottom;

    let page = pdfDoc.addPage([pageW, pageH]);
    // PDF coordinate system: origin at bottom-left, Y goes up
    let cursorY = pageH - mTop; // start from top

    function newPdfPage(): PDFPage {
      page = pdfDoc.addPage([pageW, pageH]);
      cursorY = pageH - mTop;
      return page;
    }

    function checkBreak(needed: number) {
      if (cursorY - needed < mBottom) {
        newPdfPage();
      }
    }

    for (const para of section.paragraphs) {
      const ps = resolveParaStyle(doc, para.paraPrIDRef);
      const paraLeft = mLeft + ps.marginLeft;
      const paraWidth = contentW - ps.marginLeft - ps.marginRight;

      cursorY -= ps.marginTop;
      let isFirstLine = true;

      for (const run of para.runs) {
        const ts = resolveTextStyle(doc, run.charPrIDRef);
        const lineH = ts.fontSize * ps.lineHeight;
        const font = getFont(ts);

        for (const child of run.children) {
          if (child.type === 'text') {
            const indent = isFirstLine ? ps.textIndent : 0;
            const lines = wrapTextForPdf(child.content, ts.fontSize, ts.bold, paraWidth - indent);

            for (const line of lines) {
              checkBreak(lineH);

              let x = paraLeft + indent;
              if (ps.align === 'center') x = paraLeft + (paraWidth - line.width) / 2;
              else if (ps.align === 'right') x = paraLeft + paraWidth - line.width;

              // Draw text — for CJK, we draw char by char with spacing
              const textY = cursorY - ts.fontSize;
              let drawX = x;

              for (const ch of line.text) {
                const code = ch.codePointAt(0) ?? 0;
                try {
                  if (code >= 0x20 && code <= 0x7E) {
                    // ASCII — use embedded font
                    page.drawText(ch, {
                      x: drawX, y: textY,
                      size: ts.fontSize,
                      font,
                      color: rgb(ts.color[0], ts.color[1], ts.color[2]),
                    });
                    drawX += font.widthOfTextAtSize(ch, ts.fontSize);
                  } else {
                    // CJK or special — skip in pdf-lib standard fonts
                    // TODO: embed CJK font for proper rendering
                    drawX += ts.fontSize; // full-width advance
                  }
                } catch {
                  drawX += ts.fontSize * 0.5;
                }
              }

              // Underline
              if (ts.underline) {
                page.drawLine({
                  start: { x, y: textY - 2 },
                  end: { x: x + line.width, y: textY - 2 },
                  thickness: 0.5,
                  color: rgb(ts.color[0], ts.color[1], ts.color[2]),
                });
              }

              cursorY -= lineH;
              isFirstLine = false;
            }
          } else if (child.type === 'table') {
            // Table rendering
            const tableResult = renderTableToPdf(doc, child.element, page, pdfDoc, mLeft + ps.marginLeft, cursorY, paraWidth, mBottom, pageW, pageH, mTop, getFont);
            page = tableResult.page;
            cursorY = tableResult.cursorY;
          } else if (child.type === 'inlineObject' && (child.name === 'picture' || child.name === 'pic')) {
            // Image rendering
            const imgResult = await renderImageToPdf(doc, child.element, page, pdfDoc, mLeft, cursorY, paraWidth, mBottom, pageW, pageH, mTop);
            if (imgResult) {
              page = imgResult.page;
              cursorY = imgResult.cursorY;
            }
          }
        }
      }

      cursorY -= ps.marginBottom;
    }
  }

  return new Uint8Array(await pdfDoc.save());
}

// ── Table PDF rendering ──

function renderTableToPdf(
  doc: HanDoc,
  element: GenericElement,
  page: PDFPage,
  pdfDoc: PDFDocument,
  tableX: number,
  startY: number,
  maxWidth: number,
  marginBottom: number,
  pageW: number,
  pageH: number,
  marginTop: number,
  getFont: (style: TextStyle) => PDFFont,
): { page: PDFPage; cursorY: number } {
  const table = parseTable(element);
  let cursorY = startY;
  let currentPage = page;

  // Get table width
  const szEl = element.children.find(c => c.tag === 'sz');
  const tableWidthHwp = szEl ? Number(szEl.attrs['width']) : 0;
  const tableWidthPt = tableWidthHwp > 0 ? hwpToPt(tableWidthHwp) : maxWidth;

  for (const row of table.rows) {
    // Calculate row height
    let rowHeight = 10;
    for (const cell of row.cells) {
      const cellW = cell.cellSz.width > 0 ? hwpToPt(cell.cellSz.width) : tableWidthPt / table.colCnt;
      let h = 4;
      for (const para of cell.paragraphs) {
        const ps = resolveParaStyle(doc, para.paraPrIDRef);
        h += ps.marginTop;
        for (const run of para.runs) {
          const ts = resolveTextStyle(doc, run.charPrIDRef);
          const lineH = ts.fontSize * ps.lineHeight;
          for (const child of run.children) {
            if (child.type === 'text') {
              const lines = wrapTextForPdf(child.content, ts.fontSize, ts.bold, cellW - 8);
              h += lines.length * lineH;
            }
          }
        }
        h += ps.marginBottom;
      }
      rowHeight = Math.max(rowHeight, h);
    }

    // Page break check
    if (cursorY - rowHeight < marginBottom) {
      currentPage = pdfDoc.addPage([pageW, pageH]);
      cursorY = pageH - marginTop;
    }

    // Draw cells
    let cellX = tableX;
    for (const cell of row.cells) {
      const cellW = cell.cellSz.width > 0 ? hwpToPt(cell.cellSz.width) : (tableWidthPt / table.colCnt) * cell.cellSpan.colSpan;
      const cellH = rowHeight * cell.cellSpan.rowSpan;

      // Cell border
      currentPage.drawRectangle({
        x: cellX,
        y: cursorY - cellH,
        width: cellW,
        height: cellH,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });

      // Cell text
      let textY = cursorY - 4;
      for (const para of cell.paragraphs) {
        const ps = resolveParaStyle(doc, para.paraPrIDRef);
        textY -= ps.marginTop;
        for (const run of para.runs) {
          const ts = resolveTextStyle(doc, run.charPrIDRef);
          const lineH = ts.fontSize * ps.lineHeight;
          const font = getFont(ts);
          for (const child of run.children) {
            if (child.type === 'text') {
              const lines = wrapTextForPdf(child.content, ts.fontSize, ts.bold, cellW - 8);
              for (const line of lines) {
                let tx = cellX + 4;
                if (ps.align === 'center') tx = cellX + (cellW - line.width) / 2;
                else if (ps.align === 'right') tx = cellX + cellW - 4 - line.width;
                
                textY -= ts.fontSize;
                // Draw char by char (ASCII only for now)
                let drawX = tx;
                for (const ch of line.text) {
                  const code = ch.codePointAt(0) ?? 0;
                  try {
                    if (code >= 0x20 && code <= 0x7E) {
                      currentPage.drawText(ch, {
                        x: drawX, y: textY,
                        size: ts.fontSize, font,
                        color: rgb(ts.color[0], ts.color[1], ts.color[2]),
                      });
                      drawX += font.widthOfTextAtSize(ch, ts.fontSize);
                    } else {
                      drawX += ts.fontSize;
                    }
                  } catch { drawX += ts.fontSize * 0.5; }
                }
                textY -= (lineH - ts.fontSize);
              }
            }
          }
        }
        textY -= ps.marginBottom;
      }

      cellX += cellW;
    }

    cursorY -= rowHeight;
  }

  return { page: currentPage, cursorY };
}

// ── Image PDF rendering ──

function findDescendant(el: GenericElement, tag: string): GenericElement | undefined {
  for (const child of el.children) {
    const localTag = child.tag.includes(':') ? child.tag.split(':').pop()! : child.tag;
    if (localTag === tag) return child;
    const found = findDescendant(child, tag);
    if (found) return found;
  }
  return undefined;
}

async function renderImageToPdf(
  doc: HanDoc,
  element: GenericElement,
  page: PDFPage,
  pdfDoc: PDFDocument,
  x: number,
  cursorY: number,
  maxWidth: number,
  marginBottom: number,
  pageW: number,
  pageH: number,
  marginTop: number,
): Promise<{ page: PDFPage; cursorY: number } | null> {
  const fileRef = findDescendant(element, 'fileRef');
  if (!fileRef) return null;
  const binItemRef = fileRef.attrs['binItemIDRef'] ?? '';
  if (!binItemRef) return null;
  const image = doc.images.find(img => img.path.includes(binItemRef) || img.path.endsWith(binItemRef));
  if (!image) return null;

  const imgChild = findDescendant(element, 'img') ?? findDescendant(element, 'imgRect');
  let w = maxWidth, h = maxWidth * 0.75;
  if (imgChild) {
    const wH = Number(imgChild.attrs['width'] ?? 0);
    const hH = Number(imgChild.attrs['height'] ?? 0);
    if (wH > 0) w = hwpToPt(wH);
    if (hH > 0) h = hwpToPt(hH);
  }
  if (w > maxWidth) { const s = maxWidth / w; w = maxWidth; h *= s; }

  try {
    const ext = image.path.split('.').pop()?.toLowerCase() ?? '';
    let pdfImage;
    if (ext === 'png') pdfImage = await pdfDoc.embedPng(image.data);
    else if (ext === 'jpg' || ext === 'jpeg') pdfImage = await pdfDoc.embedJpg(image.data);
    else return null;

    let currentPage = page;
    if (cursorY - h < marginBottom) {
      currentPage = pdfDoc.addPage([pageW, pageH]);
      cursorY = pageH - marginTop;
    }

    currentPage.drawImage(pdfImage, { x, y: cursorY - h, width: w, height: h });
    return { page: currentPage, cursorY: cursorY - h };
  } catch {
    return null;
  }
}
