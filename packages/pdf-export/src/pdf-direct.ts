/**
 * Direct PDF generation — HWPX → PDF via pdf-lib with embedded Korean fonts.
 * No HTML, no Playwright, no browser. Production-grade.
 *
 * Architecture:
 * 1. Parse HWPX → document model
 * 2. Layout: walk paragraphs/tables/images, compute positions with Y cursor
 * 3. Render: emit pdf-lib drawing commands with embedded CJK fonts
 * 4. Page breaks: when Y cursor exceeds content area, start new page
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

const SERIF_NAMES = ['함초롬바탕', '바탕', '바탕체', '궁서', '궁서체', '휴먼명조', '한양신명조', '신명조'];

interface FontSet {
  serif: PDFFont;
  serifBold: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

/**
 * Locate a system font file by name. Returns path or undefined.
 */
function findSystemFont(name: string): string | undefined {
  const searchDirs = [
    '/System/Library/Fonts',
    '/System/Library/Fonts/Supplemental',
    '/Library/Fonts',
    path.join(process.env.HOME ?? '', 'Library/Fonts'),
    // Linux
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    // Windows
    'C:\\Windows\\Fonts',
  ];

  for (const dir of searchDirs) {
    try {
      const target = path.join(dir, name);
      if (fs.existsSync(target)) return target;
    } catch { /* skip */ }
  }
  return undefined;
}

async function embedFonts(pdfDoc: PDFDocument): Promise<FontSet> {
  pdfDoc.registerFontkit(fontkit);

  // Try to find Korean fonts
  const serifPath = findSystemFont('AppleMyungjo.ttf')
    ?? findSystemFont('batang.ttc')
    ?? findSystemFont('NanumMyeongjo.ttf');

  const sansPath = findSystemFont('AppleSDGothicNeo.ttc')
    ?? findSystemFont('malgun.ttf')
    ?? findSystemFont('NanumGothic.ttf')
    ?? findSystemFont('AppleGothic.ttf');

  let serif: PDFFont;
  let serifBold: PDFFont;
  let sans: PDFFont;
  let sansBold: PDFFont;

  if (serifPath) {
    try {
      const fontBytes = fs.readFileSync(serifPath);
      serif = await pdfDoc.embedFont(fontBytes, { subset: true });
      serifBold = serif; // AppleMyungjo doesn't have bold variant
    } catch {
      const { StandardFonts } = await import('pdf-lib');
      serif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    }
  } else {
    const { StandardFonts } = await import('pdf-lib');
    serif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  }

  if (sansPath) {
    try {
      const fontBytes = fs.readFileSync(sansPath);
      // For .ttc files, pdf-lib/fontkit picks the first font
      sans = await pdfDoc.embedFont(fontBytes, { subset: true });
      sansBold = sans;
    } catch {
      const { StandardFonts } = await import('pdf-lib');
      sans = await pdfDoc.embedFont(StandardFonts.Helvetica);
      sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
  } else {
    const { StandardFonts } = await import('pdf-lib');
    sans = await pdfDoc.embedFont(StandardFonts.Helvetica);
    sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

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
  lineHeight: number;       // multiplier for percent, or absolute pt for fixed
  lineHeightFixed: boolean;  // true = lineHeight is absolute pt
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  textIndent: number;
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

  // Font resolution
  const fontRef = (cp as any).fontRef;
  if (fontRef && doc.header.refList.fontFaces) {
    const hangulId = fontRef.hangul ?? fontRef.HANGUL;
    if (hangulId != null) {
      const langFaces = doc.header.refList.fontFaces.find(f => f.lang === 'HANGUL');
      const fontName = langFaces?.fonts.find(f => f.id === hangulId)?.face;
      if (fontName) s.isSerif = SERIF_NAMES.includes(fontName);
    }
  }

  return s;
}

function resolveParaStyle(doc: HanDoc, paraPrIDRef: number | null): ParaStyle {
  const d: ParaStyle = { align: 'left', lineHeight: 1.6, lineHeightFixed: false, marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0, textIndent: 0 };
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
    const t = pp.lineSpacing.type.toLowerCase();
    if (t === 'percent') {
      s.lineHeight = pp.lineSpacing.value / 100;
      s.lineHeightFixed = false;
    } else if (t === 'fixed' && pp.lineSpacing.value > 0) {
      s.lineHeight = hwpToPt(pp.lineSpacing.value);
      s.lineHeightFixed = true;
    }
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

// ── Text measurement with embedded font ──

function measureText(text: string, font: PDFFont, fontSize: number): number {
  try {
    return font.widthOfTextAtSize(text, fontSize);
  } catch {
    // Fallback for chars not in font
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

      let lo = 1, hi = remaining.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (measureText(remaining.substring(0, mid), font, fontSize) <= maxWidth) lo = mid;
        else hi = mid - 1;
      }
      // Word boundary
      let brk = lo;
      for (let i = lo; i > Math.max(0, lo - 15); i--) {
        const code = remaining.codePointAt(i) ?? 0;
        if (code === 32 || code > 0x2E80) { brk = i + (code === 32 ? 1 : 0); break; }
      }
      if (brk <= 0) brk = lo;
      const lineText = remaining.substring(0, brk);
      lines.push({ text: lineText, width: measureText(lineText, font, fontSize) });
      remaining = remaining.substring(brk).trimStart();
    }
  }
  return lines;
}

// ── Draw text with fallback for unsupported glyphs ──

function drawText(
  page: PDFPage,
  text: string,
  x: number, y: number,
  font: PDFFont, fontSize: number,
  color: [number, number, number],
): number {
  let drawX = x;
  // Try drawing the whole string first
  try {
    page.drawText(text, { x: drawX, y, size: fontSize, font, color: rgb(...color) });
    return measureText(text, font, fontSize);
  } catch {
    // Char-by-char fallback
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

// ── Main export ──

export interface PdfDirectOptions {
  /** Custom font paths by category */
  fonts?: {
    serif?: string;
    sans?: string;
  };
  /** Custom font paths by exact 한/글 font name */
  fontMap?: Record<string, string>;
}

/**
 * Generate PDF directly from HWPX buffer.
 * Production-grade: embedded Korean fonts, accurate layout.
 */
export async function generatePdf(
  hwpxBuffer: Uint8Array,
  options: PdfDirectOptions = {},
): Promise<Uint8Array> {
  const doc = await HanDoc.open(hwpxBuffer);
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);

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
    } catch { /* skip unsupported images */ }
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

    let page = pdfDoc.addPage([pageW, pageH]);
    let curY = pageH - mT; // PDF Y: bottom-up

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
      let firstLine = true;

      for (const run of para.runs) {
        const ts = resolveTextStyle(doc, run.charPrIDRef);
        const font = getFont(ts);
        const lineH = ps.lineHeightFixed ? ps.lineHeight : ts.fontSize * ps.lineHeight;

        for (const child of run.children) {
          if (child.type === 'text') {
            const indent = firstLine ? ps.textIndent : 0;
            const lines = wrapText(child.content, font, ts.fontSize, pW - indent);

            for (const line of lines) {
              checkBreak(lineH);

              let x = pL + indent;
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
                const sy = textY + ts.fontSize * 0.35;
                page.drawLine({
                  start: { x, y: sy },
                  end: { x: x + line.width, y: sy },
                  thickness: 0.5,
                  color: rgb(...ts.color),
                });
              }

              curY -= lineH;
              firstLine = false;
            }
          } else if (child.type === 'table') {
            // Table — with proper page break handling per row
            const tbl = parseTable(child.element);
            const szEl = child.element.children.find(c => c.tag === 'sz');
            const tblW = szEl ? hwpToPt(Number(szEl.attrs['width'])) : pW;
            const contentH = pageH - mT - mB;

            for (const row of tbl.rows) {
              // Calculate row height
              let rowH = 10;
              for (const cell of row.cells) {
                const cellW = cell.cellSz.width > 0 ? hwpToPt(cell.cellSz.width) : tblW / tbl.colCnt;
                let h = 4;
                for (const cp of cell.paragraphs) {
                  const cps = resolveParaStyle(doc, cp.paraPrIDRef);
                  h += cps.marginTop + cps.marginBottom;
                  for (const cr of cp.runs) {
                    const cts = resolveTextStyle(doc, cr.charPrIDRef);
                    const cf = getFont(cts);
                    for (const cc of cr.children) {
                      if (cc.type === 'text') {
                        const cl = wrapText(cc.content, cf, cts.fontSize, cellW - 8);
                        const cellLineH = cps.lineHeightFixed ? cps.lineHeight : cts.fontSize * cps.lineHeight;
                        h += cl.length * cellLineH;
                      }
                    }
                  }
                }
                rowH = Math.max(rowH, h);
              }

              // Cap row height to content area (prevent infinite single-page rows)
              if (rowH > contentH) rowH = contentH;

              // Page break: if row doesn't fit, start new page
              // BUT: don't break if we're already near the top (just started fresh page)
              // This prevents "every row on new page" syndrome when rowH calc is inflated
              const nearTop = (pageH - curY) < 30; // within ~30pt (~2-3 lines) of page top
              if (curY - rowH < mB && !nearTop) {
                newPage();
              }

              // Draw cells
              let cellX = pL;
              for (const cell of row.cells) {
                const cellW = cell.cellSz.width > 0 ? hwpToPt(cell.cellSz.width) : (tblW / tbl.colCnt) * cell.cellSpan.colSpan;
                const cellH = rowH * cell.cellSpan.rowSpan;

                page.drawRectangle({
                  x: cellX, y: curY - cellH,
                  width: cellW, height: cellH,
                  borderColor: rgb(0, 0, 0), borderWidth: 0.5,
                });

                let ty = curY - 4;
                for (const cp of cell.paragraphs) {
                  const cps = resolveParaStyle(doc, cp.paraPrIDRef);
                  ty -= cps.marginTop;
                  for (const cr of cp.runs) {
                    const cts = resolveTextStyle(doc, cr.charPrIDRef);
                    const cf = getFont(cts);
                    const lh = cps.lineHeightFixed ? cps.lineHeight : cts.fontSize * cps.lineHeight;
                    for (const cc of cr.children) {
                      if (cc.type === 'text') {
                        const cls = wrapText(cc.content, cf, cts.fontSize, cellW - 8);
                        for (const cl of cls) {
                          ty -= cts.fontSize;
                          let tx = cellX + 4;
                          if (cps.align === 'center') tx = cellX + (cellW - cl.width) / 2;
                          else if (cps.align === 'right') tx = cellX + cellW - 4 - cl.width;
                          drawText(page, cl.text, tx, ty, cf, cts.fontSize, cts.color);
                          ty -= (lh - cts.fontSize);
                        }
                      }
                    }
                  }
                  ty -= cps.marginBottom;
                }
                cellX += cellW;
              }
              curY -= rowH;
            }
          } else if (child.type === 'inlineObject' && (child.name === 'picture' || child.name === 'pic')) {
            // Image
            const fileRef = findDesc(child.element, 'fileRef');
            if (fileRef) {
              const binRef = fileRef.attrs['binItemIDRef'] ?? '';
              const img = doc.images.find(i => i.path.includes(binRef));
              if (img) {
                const pdfImg = imageCache.get(img.path);
                if (pdfImg) {
                  const imgEl = findDesc(child.element, 'img') ?? findDesc(child.element, 'imgRect');
                  let w = pW, h = pW * 0.75;
                  if (imgEl) {
                    const wH = Number(imgEl.attrs['width'] ?? 0);
                    const hH = Number(imgEl.attrs['height'] ?? 0);
                    if (wH > 0) w = hwpToPt(wH);
                    if (hH > 0) h = hwpToPt(hH);
                  }
                  if (w > pW) { const sc = pW / w; w = pW; h *= sc; }
                  // Cap image height to content area
                  const maxImgH = pageH - mT - mB;
                  if (h > maxImgH) { const sc = maxImgH / h; h = maxImgH; w *= sc; }

                  checkBreak(h);
                  page.drawImage(pdfImg, { x: pL, y: curY - h, width: w, height: h });
                  curY -= h;
                }
              }
            }
          }
        }
      }
      curY -= ps.marginBottom;
    }
  }

  return new Uint8Array(await pdfDoc.save());
}
