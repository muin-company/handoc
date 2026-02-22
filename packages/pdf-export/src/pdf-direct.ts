/**
 * Direct PDF generation — HWPX → PDF via pdf-lib with embedded Korean fonts.
 * No HTML, no Playwright, no browser. Production-grade.
 *
 * Key principle: Use HWPX values exactly as specified. No heuristic adjustments.
 */

import { HanDoc } from '@handoc/hwpx-parser';
import { parseTable } from '@handoc/hwpx-parser';
import { PDFDocument, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
import type { GenericElement } from '@handoc/document-model';

// ── Constants ──

const HWP_PER_INCH = 7200;
const PT_PER_INCH = 72;
const hwpToPt = (v: number) => (v / HWP_PER_INCH) * PT_PER_INCH;

// ── Font resolution ──

const SERIF_NAMES = new Set(['함초롬바탕', '바탕', '바탕체', '궁서', '궁서체', '휴먼명조', '한양신명조', '신명조', 'Times New Roman']);

interface FontSet {
  serif: PDFFont;
  serifBold: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

function findSystemFont(name: string): string | undefined {
  const dirs = [
    '/System/Library/Fonts/Supplemental',
    '/System/Library/Fonts',
    '/Library/Fonts',
    path.join(process.env.HOME ?? '', 'Library/Fonts'),
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    'C:\\Windows\\Fonts',
  ];
  for (const dir of dirs) {
    try {
      const target = path.join(dir, name);
      if (fs.existsSync(target)) return target;
    } catch { /* skip */ }
  }
  return undefined;
}

async function embedFonts(pdfDoc: PDFDocument, customFonts?: { serif?: string; sans?: string }): Promise<FontSet> {
  pdfDoc.registerFontkit(fontkit);
  const { StandardFonts } = await import('pdf-lib');

  async function tryEmbed(fontPath: string | undefined, fallback: string): Promise<PDFFont> {
    if (fontPath) {
      try {
        return await pdfDoc.embedFont(fs.readFileSync(fontPath), { subset: true });
      } catch { /* fall through */ }
    }
    return await pdfDoc.embedFont(fallback as any);
  }

  const serifPath = customFonts?.serif
    ?? findSystemFont('AppleMyungjo.ttf')
    ?? findSystemFont('NanumMyeongjo.ttf')
    ?? findSystemFont('batang.ttc');

  const sansPath = customFonts?.sans
    ?? findSystemFont('AppleSDGothicNeo.ttc')
    ?? findSystemFont('AppleGothic.ttf')
    ?? findSystemFont('NanumGothic.ttf')
    ?? findSystemFont('malgun.ttf');

  const serif = await tryEmbed(serifPath, StandardFonts.TimesRoman);
  const serifBold = await tryEmbed(serifPath, StandardFonts.TimesRomanBold); // Same font, pdf-lib handles weight
  const sans = await tryEmbed(sansPath, StandardFonts.Helvetica);
  const sansBold = await tryEmbed(sansPath, StandardFonts.HelveticaBold);

  return { serif, serifBold, sans, sansBold };
}

// ── Style types ──

interface TextStyle {
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeout: boolean;
  color: [number, number, number];
  isSerif: boolean;
}

interface ParaStyle {
  align: 'left' | 'center' | 'right' | 'justify';
  lineSpacingValue: number;   // raw value from HWPX
  lineSpacingType: string;    // 'percent' | 'fixed'
  marginLeft: number;   // pt
  marginRight: number;  // pt
  marginTop: number;    // pt
  marginBottom: number; // pt
  textIndent: number;   // pt
}

// ── Style resolution ──

function resolveTextStyle(doc: HanDoc, charPrIDRef: number | null): TextStyle {
  const d: TextStyle = { fontSize: 10, bold: false, italic: false, underline: false, strikeout: false, color: [0, 0, 0], isSerif: true };
  if (charPrIDRef == null) return d;
  const cp = doc.header.refList.charProperties.find(c => c.id === charPrIDRef);
  if (!cp) return d;

  const s = { ...d };
  if (cp.height) s.fontSize = cp.height / 100;
  if (cp.bold) s.bold = true;
  if (cp.italic) s.italic = true;
  if (cp.underline && cp.underline !== 'none' && cp.underline !== 'NONE') s.underline = true;
  if (cp.strikeout && cp.strikeout !== 'none' && cp.strikeout !== 'NONE') s.strikeout = true;
  if (cp.textColor && cp.textColor !== '0' && cp.textColor !== '#000000' && cp.textColor !== '000000') {
    const c = cp.textColor.replace('#', '').padStart(6, '0');
    s.color = [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255];
  }

  const fontRef = (cp as any).fontRef;
  if (fontRef && doc.header.refList.fontFaces) {
    const hangulId = fontRef.hangul ?? fontRef.HANGUL;
    if (hangulId != null) {
      const langFaces = doc.header.refList.fontFaces.find(f => f.lang === 'HANGUL');
      const fontName = langFaces?.fonts.find(f => f.id === hangulId)?.face;
      if (fontName) s.isSerif = SERIF_NAMES.has(fontName);
    }
  }

  return s;
}

function resolveParaStyle(doc: HanDoc, paraPrIDRef: number | null): ParaStyle {
  const d: ParaStyle = {
    align: 'left',
    lineSpacingValue: 160, lineSpacingType: 'percent',
    marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0, textIndent: 0,
  };
  if (paraPrIDRef == null) return d;
  const pp = doc.header.refList.paraProperties.find(p => p.id === paraPrIDRef);
  if (!pp) return d;

  const s = { ...d };
  if (pp.align) {
    const m: Record<string, ParaStyle['align']> = {
      left: 'left', center: 'center', right: 'right', justify: 'justify', distribute: 'justify',
      LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFY: 'justify', DISTRIBUTE: 'justify',
    };
    s.align = m[pp.align] ?? 'left';
  }
  if (pp.lineSpacing) {
    s.lineSpacingType = pp.lineSpacing.type.toLowerCase();
    s.lineSpacingValue = pp.lineSpacing.value;
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

/** Calculate line height in pt from paragraph style and font size */
function calcLineHeight(ps: ParaStyle, fontSize: number): number {
  if (ps.lineSpacingType === 'fixed') {
    return hwpToPt(ps.lineSpacingValue);
  }
  // percent: value is percentage (e.g., 160 = 160%)
  return fontSize * (ps.lineSpacingValue / 100);
}

// ── Text measurement ──

function measureText(text: string, font: PDFFont, fontSize: number): number {
  try {
    return font.widthOfTextAtSize(text, fontSize);
  } catch {
    let w = 0;
    for (const ch of text) {
      try { w += font.widthOfTextAtSize(ch, fontSize); }
      catch { w += fontSize * ((ch.codePointAt(0) ?? 0) > 0x2E80 ? 1.0 : 0.5); }
    }
    return w;
  }
}

// ── Word wrap ──

interface WLine { text: string; width: number; }

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): WLine[] {
  if (!text || maxWidth <= 0) return [];
  const lines: WLine[] = [];

  for (const para of text.split('\n')) {
    if (!para) { lines.push({ text: '', width: 0 }); continue; }
    let remaining = para;
    while (remaining.length > 0) {
      const fullW = measureText(remaining, font, fontSize);
      if (fullW <= maxWidth) { lines.push({ text: remaining, width: fullW }); break; }

      // Binary search for fit
      let lo = 1, hi = remaining.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (measureText(remaining.substring(0, mid), font, fontSize) <= maxWidth) lo = mid;
        else hi = mid - 1;
      }
      // CJK can break at any character; for spaces, break after space
      let brk = lo;
      for (let i = lo; i > Math.max(0, lo - 15); i--) {
        const code = remaining.codePointAt(i) ?? 0;
        if (code === 32) { brk = i + 1; break; }
      }
      if (brk <= 0) brk = lo;
      const lineText = remaining.substring(0, brk);
      lines.push({ text: lineText, width: measureText(lineText, font, fontSize) });
      remaining = remaining.substring(brk).trimStart();
    }
  }
  return lines;
}

// ── Draw text ──

function drawText(
  page: PDFPage, text: string,
  x: number, y: number,
  font: PDFFont, fontSize: number,
  color: [number, number, number],
): number {
  let drawX = x;
  try {
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(...color) });
    return measureText(text, font, fontSize);
  } catch {
    for (const ch of text) {
      try {
        page.drawText(ch, { x: drawX, y, size: fontSize, font, color: rgb(...color) });
        drawX += font.widthOfTextAtSize(ch, fontSize);
      } catch {
        drawX += fontSize * ((ch.codePointAt(0) ?? 0) > 0x2E80 ? 1.0 : 0.5);
      }
    }
    return drawX - x;
  }
}

// ── Helpers ──

function findDesc(el: GenericElement, tag: string): GenericElement | undefined {
  for (const c of el.children) {
    const t = c.tag.includes(':') ? c.tag.split(':').pop()! : c.tag;
    if (t === tag) return c;
    const found = findDesc(c, tag);
    if (found) return found;
  }
  return undefined;
}

/** Extract text from shape/drawing elements */
function extractShapeText(el: GenericElement): string {
  let text = '';
  if (el.tag === 'hp:t' || el.tag === 't') {
    text += el.text ?? '';
  }
  for (const child of el.children) {
    text += extractShapeText(child);
  }
  return text;
}

// ── Table height estimation (for nested tables) ──

function estimateTableHeight(
  doc: HanDoc, element: GenericElement, maxWidth: number,
  getFont: (s: TextStyle) => PDFFont,
): number {
  const tbl = parseTable(element);
  const szEl = element.children.find(c => c.tag === 'sz');
  const tblW = szEl ? hwpToPt(Number(szEl.attrs['width'])) : maxWidth;
  let totalH = 0;

  for (const row of tbl.rows) {
    let rowH = 12; // minimum
    for (const cell of row.cells) {
      const cellW = cell.cellSz.width > 0 ? hwpToPt(cell.cellSz.width) : tblW / tbl.colCnt;
      let h = 4;
      for (const cp of cell.paragraphs) {
        const cps = resolveParaStyle(doc, cp.paraPrIDRef);
        h += cps.marginTop;
        for (const cr of cp.runs) {
          const cts = resolveTextStyle(doc, cr.charPrIDRef);
          const cf = getFont(cts);
          const lh = calcLineHeight(cps, cts.fontSize);
          for (const cc of cr.children) {
            if (cc.type === 'text') {
              const text = cc.content;
              if (!text) { h += lh; continue; }
              h += wrapText(text, cf, cts.fontSize, cellW - 4).length * lh;
            } else if (cc.type === 'table') {
              h += estimateTableHeight(doc, cc.element, cellW - 4, getFont);
            }
          }
        }
        h += cps.marginBottom;
      }
      rowH = Math.max(rowH, h);
    }
    totalH += rowH;
  }
  return totalH;
}

// ── Main export ──

export interface PdfDirectOptions {
  fonts?: { serif?: string; sans?: string };
  fontMap?: Record<string, string>;
}

export async function generatePdf(
  hwpxBuffer: Uint8Array,
  options: PdfDirectOptions = {},
): Promise<Uint8Array> {
  const doc = await HanDoc.open(hwpxBuffer);
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc, options.fonts);

  function getFont(style: TextStyle): PDFFont {
    if (style.isSerif) return style.bold ? fonts.serifBold : fonts.serif;
    return style.bold ? fonts.sansBold : fonts.sans;
  }

  // Pre-embed images
  const imageCache = new Map<string, PDFImage>();
  for (const img of doc.images) {
    try {
      const ext = img.path.split('.').pop()?.toLowerCase() ?? '';
      if (ext === 'png') imageCache.set(img.path, await pdfDoc.embedPng(img.data));
      else if (ext === 'jpg' || ext === 'jpeg') imageCache.set(img.path, await pdfDoc.embedJpg(img.data));
    } catch { /* skip */ }
  }

  for (const section of doc.sections) {
    const sp = section.sectionProps;
    const pageW = sp ? hwpToPt(sp.pageWidth) : 595.28;
    const pageH = sp ? hwpToPt(sp.pageHeight) : 841.89;
    const mL = sp ? hwpToPt(sp.margins.left) : 56.69;
    const mR = sp ? hwpToPt(sp.margins.right) : 56.69;
    const mT = sp ? hwpToPt(sp.margins.top) : 56.69;
    const mB = sp ? hwpToPt(sp.margins.bottom) : 56.69;
    const cW = pageW - mL - mR;
    const contentH = pageH - mT - mB;

    let page = pdfDoc.addPage([pageW, pageH]);
    let curY = pageH - mT;

    function newPage() {
      page = pdfDoc.addPage([pageW, pageH]);
      curY = pageH - mT;
    }

    function checkBreak(h: number) {
      if (curY - h < mB) newPage();
    }

    for (const para of section.paragraphs) {
      const ps = resolveParaStyle(doc, para.paraPrIDRef);
      const pL = mL + ps.marginLeft;
      const pW = cW - ps.marginLeft - ps.marginRight;

      curY -= ps.marginTop;

      // Track if paragraph has any content
      let hasContent = false;
      let firstLine = true;

      for (const run of para.runs) {
        const ts = resolveTextStyle(doc, run.charPrIDRef);
        const font = getFont(ts);
        const lineH = calcLineHeight(ps, ts.fontSize);

        for (const child of run.children) {
          if (child.type === 'text') {
            const content = child.content;
            if (!content && !hasContent) {
              // Empty text run — still takes up one line height
              checkBreak(lineH);
              curY -= lineH;
              hasContent = true;
              continue;
            }
            if (!content) continue;

            const indent = firstLine ? ps.textIndent : 0;
            const lines = wrapText(content, font, ts.fontSize, pW - indent);

            for (const line of lines) {
              checkBreak(lineH);

              let x = pL + (firstLine ? ps.textIndent : 0);
              if (ps.align === 'center') x = pL + (pW - line.width) / 2;
              else if (ps.align === 'right') x = pL + pW - line.width;

              const textY = curY - ts.fontSize;
              drawText(page, line.text, x, textY, font, ts.fontSize, ts.color);

              if (ts.underline) {
                page.drawLine({
                  start: { x, y: textY - 2 },
                  end: { x: x + line.width, y: textY - 2 },
                  thickness: 0.5,
                  color: rgb(...ts.color),
                });
              }

              if (ts.strikeout) {
                page.drawLine({
                  start: { x, y: textY + ts.fontSize * 0.35 },
                  end: { x: x + line.width, y: textY + ts.fontSize * 0.35 },
                  thickness: 0.5,
                  color: rgb(...ts.color),
                });
              }

              curY -= lineH;
              firstLine = false;
              hasContent = true;
            }
          } else if (child.type === 'table') {
            hasContent = true;
            renderTable(doc, child.element, pL, pW, getFont);
          } else if (child.type === 'inlineObject') {
            hasContent = true;
            if (child.name === 'picture' || child.name === 'pic') {
              renderImage(doc, child.element, pL, pW);
            } else {
              // Try to extract text from shapes/drawings
              const shapeText = extractShapeText(child.element);
              if (shapeText.trim()) {
                const lines = wrapText(shapeText.trim(), font, ts.fontSize, pW);
                for (const line of lines) {
                  checkBreak(lineH);
                  drawText(page, line.text, pL, curY - ts.fontSize, font, ts.fontSize, ts.color);
                  curY -= lineH;
                }
              }
            }
          }
        }
      }

      // If paragraph had no content at all, still advance by one default line
      if (!hasContent) {
        const defaultLineH = calcLineHeight(ps, 10);
        checkBreak(defaultLineH);
        curY -= defaultLineH;
      }

      curY -= ps.marginBottom;
    }

    // ── Table rendering (nested function for page access) ──
    function renderTable(doc: HanDoc, element: GenericElement, tableX: number, maxWidth: number, getFont: (s: TextStyle) => PDFFont) {
      const tbl = parseTable(element);
      const szEl = element.children.find(c => c.tag === 'sz');
      const tblW = szEl ? hwpToPt(Number(szEl.attrs['width'])) : maxWidth;

      for (const row of tbl.rows) {
        // Calculate row height from content
        let rowH = 0;
        for (const cell of row.cells) {
          const cellW = cell.cellSz.width > 0 ? hwpToPt(cell.cellSz.width) : tblW / tbl.colCnt;
          // Use cellSz.height if available
          const cellDeclaredH = cell.cellSz.height > 0 ? hwpToPt(cell.cellSz.height) : 0;
          const cellPad = 4; // 2pt top + 2pt bottom
          let cellContentH = cellPad;

          for (const cp of cell.paragraphs) {
            const cps = resolveParaStyle(doc, cp.paraPrIDRef);
            cellContentH += cps.marginTop;
            for (const cr of cp.runs) {
              const cts = resolveTextStyle(doc, cr.charPrIDRef);
              const cf = getFont(cts);
              const lh = calcLineHeight(cps, cts.fontSize);
              for (const cc of cr.children) {
                if (cc.type === 'text') {
                  const text = cc.content;
                  if (!text) { cellContentH += lh; continue; }
                  const cl = wrapText(text, cf, cts.fontSize, cellW - 4);
                  cellContentH += cl.length * lh;
                } else if (cc.type === 'table') {
                  // Nested table: estimate height recursively
                  cellContentH += estimateTableHeight(doc, cc.element, cellW - 4, getFont);
                }
              }
            }
            cellContentH += cps.marginBottom;
          }

          // Use max of declared height and content height
          const cellH = Math.max(cellDeclaredH, cellContentH);
          rowH = Math.max(rowH, cellH);
        }

        // Ensure minimum row height
        if (rowH < 12) rowH = 12;
        // Cap to page content area
        if (rowH > contentH) rowH = contentH;

        // Page break
        if (curY - rowH < mB) newPage();

        // Draw cells
        let cellX = tableX;
        for (const cell of row.cells) {
          const cellW = cell.cellSz.width > 0
            ? hwpToPt(cell.cellSz.width)
            : (tblW / tbl.colCnt) * cell.cellSpan.colSpan;
          const cellH = rowH; // TODO: handle rowSpan properly

          // Cell border
          page.drawRectangle({
            x: cellX, y: curY - cellH,
            width: cellW, height: cellH,
            borderColor: rgb(0, 0, 0), borderWidth: 0.5,
          });

          // Cell text
          let ty = curY - 2; // 2pt top padding
          for (const cp of cell.paragraphs) {
            const cps = resolveParaStyle(doc, cp.paraPrIDRef);
            ty -= cps.marginTop;
            for (const cr of cp.runs) {
              const cts = resolveTextStyle(doc, cr.charPrIDRef);
              const cf = getFont(cts);
              const lh = calcLineHeight(cps, cts.fontSize);
              for (const cc of cr.children) {
                if (cc.type === 'text') {
                  const text = cc.content;
                  if (!text) { ty -= lh; continue; }
                  const cls = wrapText(text, cf, cts.fontSize, cellW - 4);
                  for (const cl of cls) {
                    ty -= cts.fontSize;
                    let tx = cellX + 2;
                    if (cps.align === 'center') tx = cellX + (cellW - cl.width) / 2;
                    else if (cps.align === 'right') tx = cellX + cellW - 2 - cl.width;
                    if (ty > curY - cellH) {
                      drawText(page, cl.text, tx, ty, cf, cts.fontSize, cts.color);
                    }
                    ty -= (lh - cts.fontSize);
                  }
                } else if (cc.type === 'table') {
                  // Render nested table — save/restore curY
                  const savedCurY = curY;
                  curY = ty;
                  renderTable(doc, cc.element, cellX + 2, cellW - 4, getFont);
                  ty = curY;
                  curY = savedCurY;
                }
              }
            }
            ty -= cps.marginBottom;
          }

          cellX += cellW;
        }
        curY -= rowH;
      }
    }

    // ── Image rendering ──
    function renderImage(doc: HanDoc, element: GenericElement, imgX: number, maxWidth: number) {
      const fileRef = findDesc(element, 'fileRef');
      if (!fileRef) return;
      const binRef = fileRef.attrs['binItemIDRef'] ?? '';
      const img = doc.images.find(i => i.path.includes(binRef));
      if (!img) return;
      const pdfImg = imageCache.get(img.path);
      if (!pdfImg) return;

      const imgEl = findDesc(element, 'img') ?? findDesc(element, 'imgRect');
      let w = maxWidth, h = maxWidth * 0.75;
      if (imgEl) {
        const wH = Number(imgEl.attrs['width'] ?? 0);
        const hH = Number(imgEl.attrs['height'] ?? 0);
        if (wH > 0) w = hwpToPt(wH);
        if (hH > 0) h = hwpToPt(hH);
      }
      // Clamp to page
      if (w > maxWidth) { const sc = maxWidth / w; w = maxWidth; h *= sc; }
      if (h > contentH) { const sc = contentH / h; h = contentH; w *= sc; }

      checkBreak(h);
      page.drawImage(pdfImg, { x: imgX, y: curY - h, width: w, height: h });
      curY -= h;
    }
  }

  return new Uint8Array(await pdfDoc.save());
}
