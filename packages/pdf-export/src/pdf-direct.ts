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
import * as zlib from 'zlib';
import type { GenericElement } from '@handoc/document-model';

// ── BMP to PNG conversion (no external dependencies) ──

function bmpToPng(bmpData: Uint8Array): Uint8Array {
  // BMP header: 14 bytes file header + DIB header
  const dataOffset = bmpData[10] | (bmpData[11] << 8) | (bmpData[12] << 16) | (bmpData[13] << 24);
  const width = bmpData[18] | (bmpData[19] << 8) | (bmpData[20] << 16) | (bmpData[21] << 24);
  const height = Math.abs((bmpData[22] | (bmpData[23] << 8) | (bmpData[24] << 16) | (bmpData[25] << 24)) | 0);
  const bpp = bmpData[28] | (bmpData[29] << 8);
  const topDown = ((bmpData[22] | (bmpData[23] << 8) | (bmpData[24] << 16) | (bmpData[25] << 24)) | 0) < 0;

  // Build raw RGBA rows (PNG filter byte 0 = None per row)
  const rowBytes = Math.ceil((width * bpp / 8) / 4) * 4; // BMP rows are 4-byte aligned
  const raw = Buffer.alloc((width * 3 + 1) * height); // RGB + filter byte per row

  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : (height - 1 - y);
    const srcOff = dataOffset + srcY * rowBytes;
    const dstOff = y * (width * 3 + 1);
    raw[dstOff] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const si = srcOff + x * (bpp / 8);
      if (bpp === 24) {
        raw[dstOff + 1 + x * 3] = bmpData[si + 2]; // R
        raw[dstOff + 1 + x * 3 + 1] = bmpData[si + 1]; // G
        raw[dstOff + 1 + x * 3 + 2] = bmpData[si]; // B
      } else if (bpp === 32) {
        raw[dstOff + 1 + x * 3] = bmpData[si + 2];
        raw[dstOff + 1 + x * 3 + 1] = bmpData[si + 1];
        raw[dstOff + 1 + x * 3 + 2] = bmpData[si];
      }
    }
  }

  // Compress with zlib
  const compressed = zlib.deflateSync(raw);

  // Build minimal PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeB, data]);
    const crcVal = crc32(body);
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crcVal >>> 0);
    return Buffer.concat([len, body, crcB]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT
  const idat = Buffer.from(compressed);

  // IEND
  const iend = Buffer.alloc(0);

  return new Uint8Array(Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', iend),
  ]));
}

// CRC32 for PNG chunks
function crc32(buf: Buffer): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crc32Table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return c ^ 0xFFFFFFFF;
}
const crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crc32Table[i] = c;
}

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

  // Note: Noto CJK OTF (CFF-based) causes fontkit subsetting crash. Use TTF only.
  const serifPath = customFonts?.serif
    ?? findSystemFont('AppleMyungjo.ttf')
    ?? findSystemFont('NanumMyeongjo.ttf')
    ?? findSystemFont('batang.ttc');

  const sansPath = customFonts?.sans
    ?? findSystemFont('AppleSDGothicNeo.ttc')
    ?? findSystemFont('AppleGothic.ttf')
    ?? findSystemFont('NanumGothic.ttf')
    ?? findSystemFont('malgun.ttf');

  const serifBoldPath = serifPath; // Same file, weight handled by pdf-lib
  const sansBoldPath = sansPath;

  const serif = await tryEmbed(serifPath, StandardFonts.TimesRoman);
  const serifBold = await tryEmbed(serifBoldPath, StandardFonts.TimesRomanBold);
  const sans = await tryEmbed(sansPath, StandardFonts.Helvetica);
  const sansBold = await tryEmbed(sansBoldPath, StandardFonts.HelveticaBold);

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

/** Find all descendant elements matching a tag */
function findAllDesc(el: GenericElement, tag: string): GenericElement[] {
  const results: GenericElement[] = [];
  for (const c of el.children) {
    const t = c.tag.includes(':') ? c.tag.split(':').pop()! : c.tag;
    if (t === tag) results.push(c);
    results.push(...findAllDesc(c, tag));
  }
  return results;
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
      let data = img.data;
      let format = ext;
      // Convert BMP/GIF/TIFF to PNG
      if (ext === 'bmp' || ext === 'dib') {
        try { data = bmpToPng(data); format = 'png'; } catch { continue; }
      }
      if (format === 'png') imageCache.set(img.path, await pdfDoc.embedPng(data));
      else if (format === 'jpg' || format === 'jpeg') imageCache.set(img.path, await pdfDoc.embedJpg(data));
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
              // Shape/drawing: render internal content (tables, images, text)
              renderShapeContent(doc, child.element, pL, pW, font, ts, ps, getFont);
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

    // ── Table rendering with proper rowSpan/colSpan support ──
    function renderTable(doc: HanDoc, element: GenericElement, tableX: number, maxWidth: number, getFont: (s: TextStyle) => PDFFont) {
      const tbl = parseTable(element);
      const szEl = element.children.find(c => c.tag === 'sz');
      const tblW = szEl ? hwpToPt(Number(szEl.attrs['width'])) : maxWidth;

      // ── Build grid column widths from colSpan=1 cells ──
      const colWidths: number[] = new Array(tbl.colCnt).fill(0);
      for (const row of tbl.rows) {
        for (const cell of row.cells) {
          if (cell.cellSpan.colSpan === 1 && cell.cellSz.width > 0) {
            const ci = cell.cellAddr.colAddr;
            if (ci >= 0 && ci < tbl.colCnt && colWidths[ci] === 0) {
              colWidths[ci] = hwpToPt(cell.cellSz.width);
            }
          }
        }
      }
      // Fill any missing columns with equal distribution
      const knownW = colWidths.reduce((a, b) => a + b, 0);
      const missingCols = colWidths.filter(w => w === 0).length;
      if (missingCols > 0 && tblW > knownW) {
        const eachW = (tblW - knownW) / missingCols;
        for (let i = 0; i < colWidths.length; i++) {
          if (colWidths[i] === 0) colWidths[i] = eachW;
        }
      }
      // Column X offsets
      const colX: number[] = [0];
      for (let i = 0; i < colWidths.length; i++) {
        colX.push(colX[i] + colWidths[i]);
      }

      // Helper: get cell width from grid
      function gridCellW(cell: any): number {
        const ci = cell.cellAddr.colAddr;
        const cs = cell.cellSpan.colSpan;
        if (ci + cs <= colX.length) return colX[ci + cs] - colX[ci];
        return cell.cellSz.width > 0 ? hwpToPt(cell.cellSz.width) : (tblW / tbl.colCnt) * cs;
      }

      // ── Pass 1: Calculate row heights ──
      const rowHeights: number[] = [];
      for (let ri = 0; ri < tbl.rows.length; ri++) {
        let rh = 12;
        for (const cell of tbl.rows[ri].cells) {
          if (cell.cellSpan.rowSpan > 1) continue;
          const h = estimateCellHeight(doc, cell, gridCellW(cell), getFont);
          rh = Math.max(rh, h);
        }
        rowHeights.push(rh);
      }

      // Adjust for rowSpan>1 cells
      for (let ri = 0; ri < tbl.rows.length; ri++) {
        for (const cell of tbl.rows[ri].cells) {
          const rs = cell.cellSpan.rowSpan;
          if (rs <= 1) continue;
          const neededH = estimateCellHeight(doc, cell, gridCellW(cell), getFont);
          let spanH = 0;
          for (let j = ri; j < Math.min(ri + rs, tbl.rows.length); j++) spanH += rowHeights[j];
          if (neededH > spanH) {
            const extra = (neededH - spanH) / rs;
            for (let j = ri; j < Math.min(ri + rs, tbl.rows.length); j++) rowHeights[j] += extra;
          }
        }
      }

      // ── Pass 2: Render ──
      for (let ri = 0; ri < tbl.rows.length; ri++) {
        const rowH = Math.min(rowHeights[ri], contentH);

        // Page break
        if (curY - rowH < mB) newPage();

        for (const cell of tbl.rows[ri].cells) {
          const ci = cell.cellAddr.colAddr;
          // Use grid-based X and width for accuracy
          const cellX = tableX + (ci < colX.length ? colX[ci] : 0);
          const cellW = gridCellW(cell);

          // Calculate actual cell height (sum of spanned rows)
          let cellH = 0;
          for (let j = ri; j < Math.min(ri + cell.cellSpan.rowSpan, tbl.rows.length); j++) {
            cellH += rowHeights[j];
          }
          if (cellH > contentH) cellH = contentH;

          // Cell border
          page.drawRectangle({
            x: cellX, y: curY - cellH,
            width: cellW, height: cellH,
            borderColor: rgb(0, 0, 0), borderWidth: 0.5,
          });

          // Cell text
          renderCellContent(doc, cell, cellX, curY, cellW, cellH, getFont);
        }
        curY -= rowH;
      }
    }

    /** Estimate cell height from content */
    function estimateCellHeight(doc: HanDoc, cell: any, cellW: number, getFont: (s: TextStyle) => PDFFont): number {
      const cellDeclaredH = cell.cellSz.height > 0 ? hwpToPt(cell.cellSz.height) : 0;
      const pad = 4;
      let h = pad;
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
            } else if (cc.type === 'inlineObject' && (cc.name === 'pic' || cc.name === 'picture')) {
              const imgEl = findDesc(cc.element, 'img') ?? findDesc(cc.element, 'imgRect');
              if (imgEl) {
                const imgH = Number(imgEl.attrs['height'] ?? 0);
                h += imgH > 0 ? hwpToPt(imgH) : lh;
              } else { h += lh; }
            } else if (cc.type === 'shape') {
              const curSzEl = findDesc(cc.element, 'curSz');
              if (curSzEl) {
                const shH = Number(curSzEl.attrs['height'] ?? 0);
                h += shH > 0 ? hwpToPt(shH) : lh;
              } else { h += lh; }
            }
          }
        }
        h += cps.marginBottom;
      }
      return Math.max(cellDeclaredH, h);
    }

    /** Render cell content (text + nested tables) */
    function renderCellContent(doc: HanDoc, cell: any, cellX: number, cellTop: number, cellW: number, cellH: number, getFont: (s: TextStyle) => PDFFont) {
      const pad = 4; // cell padding
      // Vertical alignment: estimate content height first
      const vAlign = cell.vertAlign ?? 'TOP';
      let contentHeight = 0;
      if (vAlign === 'CENTER' || vAlign === 'BOTTOM') {
        contentHeight = estimateCellHeight(doc, cell, cellW, getFont) - pad;
      }
      let yOffset = 0;
      if (vAlign === 'CENTER') yOffset = Math.max(0, (cellH - contentHeight) / 2 - pad / 2);
      else if (vAlign === 'BOTTOM') yOffset = Math.max(0, cellH - contentHeight - pad);

      let ty = cellTop - pad / 2 - yOffset;
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
                if (ty > cellTop - cellH) {
                  drawText(page, cl.text, tx, ty, cf, cts.fontSize, cts.color);
                }
                ty -= (lh - cts.fontSize);
              }
            } else if (cc.type === 'table') {
              const savedCurY = curY;
              curY = ty;
              renderTable(doc, cc.element, cellX + 2, cellW - 4, getFont);
              ty = curY;
              curY = savedCurY;
            } else if (cc.type === 'inlineObject') {
              // Image (pic/picture) inside cell
              if (cc.name === 'picture' || cc.name === 'pic') {
                const savedCurY = curY;
                curY = ty;
                renderImage(doc, cc.element, cellX + 2, cellW - 4);
                ty = curY;
                curY = savedCurY;
              }
            } else if (cc.type === 'shape') {
              // Shape/container inside cell — may contain pics, tables, text
              const savedCurY = curY;
              curY = ty;
              renderShapeContent(doc, cc.element, cellX + 2, cellW - 4, cf, cts, cps, getFont);
              ty = curY;
              curY = savedCurY;
            }
          }
        }
        ty -= cps.marginBottom;
      }
    }

    // ── Image rendering ──
    function renderImage(doc: HanDoc, element: GenericElement, imgX: number, maxWidth: number) {
      // Try fileRef first, then fall back to img/imgRect binaryItemIDRef
      const fileRef = findDesc(element, 'fileRef');
      const imgTag = findDesc(element, 'img');
      const binRef = fileRef?.attrs['binItemIDRef']
        ?? imgTag?.attrs['binaryItemIDRef']
        ?? imgTag?.attrs['binItemIDRef']
        ?? '';
      if (!binRef) return;
      const img = doc.images.find(i => i.path.includes(binRef));
      if (!img) return;
      const pdfImg = imageCache.get(img.path);
      if (!pdfImg) return;

      // Use curSz (display size) > orgSz > imgRect dimensions
      const curSzEl = findDesc(element, 'curSz');
      const orgSzEl = findDesc(element, 'orgSz');
      const imgEl = findDesc(element, 'img') ?? findDesc(element, 'imgRect');
      let w = maxWidth, h = maxWidth * 0.75;
      if (curSzEl) {
        const wH = Number(curSzEl.attrs['width'] ?? 0);
        const hH = Number(curSzEl.attrs['height'] ?? 0);
        if (wH > 0) w = hwpToPt(wH);
        if (hH > 0) h = hwpToPt(hH);
      } else if (orgSzEl) {
        const wH = Number(orgSzEl.attrs['width'] ?? 0);
        const hH = Number(orgSzEl.attrs['height'] ?? 0);
        if (wH > 0) w = hwpToPt(wH);
        if (hH > 0) h = hwpToPt(hH);
      } else if (imgEl) {
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

    // ── Shape/drawing content rendering ──
    function renderShapeContent(
      doc: HanDoc, element: GenericElement,
      shapeX: number, shapeW: number,
      defaultFont: PDFFont, defaultTs: TextStyle, defaultPs: ParaStyle,
      getFont: (s: TextStyle) => PDFFont,
    ) {
      // Process shape's direct children only (not recursive) to avoid duplication.
      // Tables/images inside cells are handled by renderCellContent.
      let hasContent = false;
      for (const child of element.children) {
        const tag = child.tag.includes(':') ? child.tag.split(':').pop()! : child.tag;
        if (tag === 'tbl') {
          renderTable(doc, child, shapeX, shapeW, getFont);
          hasContent = true;
        } else if (tag === 'pic' || tag === 'picture') {
          renderImage(doc, child, shapeX, shapeW);
          hasContent = true;
        } else if (tag === 'drawText' || tag === 'subList') {
          // drawText contains paragraphs — render text from them
          const paras = findAllDesc(child, 'p');
          for (const p of paras) {
            // Extract text from runs
            const texts: string[] = [];
            const tEls = findAllDesc(p, 't');
            for (const t of tEls) {
              const txt = t.attrs['#text'] ?? '';
              if (txt) texts.push(txt);
            }
            if (texts.length > 0) {
              const text = texts.join('');
              const lineH = calcLineHeight(defaultPs, defaultTs.fontSize);
              const lines = wrapText(text, defaultFont, defaultTs.fontSize, shapeW);
              for (const line of lines) {
                checkBreak(lineH);
                drawText(page, line.text, shapeX, curY - defaultTs.fontSize, defaultFont, defaultTs.fontSize, defaultTs.color);
                curY -= lineH;
              }
              hasContent = true;
            }
          }
        }
      }

      // Fallback: if no direct children matched, try recursive search (legacy behavior)
      if (!hasContent) {
        const tables = findAllDesc(element, 'tbl');
        for (const tbl of tables) {
          renderTable(doc, tbl, shapeX, shapeW, getFont);
          hasContent = true;
        }
        if (!hasContent) {
          const pics = [...findAllDesc(element, 'picture'), ...findAllDesc(element, 'pic')];
          for (const pic of pics) {
            renderImage(doc, pic, shapeX, shapeW);
            hasContent = true;
          }
        }
        if (!hasContent) {
          const shapeText = extractShapeText(element);
          if (shapeText.trim()) {
            const lineH = calcLineHeight(defaultPs, defaultTs.fontSize);
            const lines = wrapText(shapeText.trim(), defaultFont, defaultTs.fontSize, shapeW);
            for (const line of lines) {
              checkBreak(lineH);
              drawText(page, line.text, shapeX, curY - defaultTs.fontSize, defaultFont, defaultTs.fontSize, defaultTs.color);
              curY -= lineH;
            }
          }
        }
      }
    }
  }

  return new Uint8Array(await pdfDoc.save());
}
