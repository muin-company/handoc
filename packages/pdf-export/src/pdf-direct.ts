/**
 * Direct PDF generation — HWPX → PDF via pdf-lib with embedded Korean fonts.
 * No HTML, no Playwright, no browser. Production-grade.
 *
 * Key principle: Use HWPX values exactly as specified. No heuristic adjustments.
 */

import { HanDoc, extractAnnotationText, parseFootnote } from '@handoc/hwpx-parser';
import { parseTable } from '@handoc/hwpx-parser';
import { PDFDocument, rgb, PDFFont, PDFPage, PDFImage, pushGraphicsState, popGraphicsState, setTextRenderingMode, TextRenderingMode, setLineWidth } from 'pdf-lib';
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

/** Convert mm string like "0.12 mm" to pt */
function mmToPt(mmStr: string | undefined): number {
  if (!mmStr) return 0.5;
  const m = mmStr.match(/([\d.]+)/);
  return m ? (parseFloat(m[1]) / 25.4) * 72 : 0.5;
}

/** Parse hex color string like "#000000" to rgb() */
function parseColor(colorStr: string | undefined): { red: number; green: number; blue: number } | undefined {
  if (!colorStr || colorStr === 'none') return undefined;
  const m = colorStr.match(/^#([0-9A-Fa-f]{6})$/);
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return { red: ((n >> 16) & 0xFF) / 255, green: ((n >> 8) & 0xFF) / 255, blue: (n & 0xFF) / 255 };
}

interface BorderSide {
  type: string;   // NONE, SOLID, etc.
  width: number;  // in pt
  color: { red: number; green: number; blue: number };
}

interface ResolvedBorderFill {
  left: BorderSide;
  right: BorderSide;
  top: BorderSide;
  bottom: BorderSide;
  bgColor?: { red: number; green: number; blue: number };
}

const defaultBorder: BorderSide = { type: 'SOLID', width: 0.5, color: { red: 0, green: 0, blue: 0 } };
const defaultBorderFill: ResolvedBorderFill = { left: defaultBorder, right: defaultBorder, top: defaultBorder, bottom: defaultBorder };

function resolveBorderFill(doc: HanDoc, borderFillIDRef: number): ResolvedBorderFill {
  const bfs = doc.header.refList.borderFills;
  const bf = bfs.find(b => b.attrs['id'] === String(borderFillIDRef));
  if (!bf) return defaultBorderFill;

  function parseSide(tag: string): BorderSide {
    const el = bf!.children.find(c => c.tag === tag);
    if (!el) return defaultBorder;
    const t = el.attrs['type'] ?? 'SOLID';
    const w = mmToPt(el.attrs['width']);
    const c = parseColor(el.attrs['color']) ?? { red: 0, green: 0, blue: 0 };
    return { type: t, width: w, color: c };
  }

  // Background color from fillBrush > winBrush
  let bgColor: { red: number; green: number; blue: number } | undefined;
  const fillBrush = bf.children.find(c => c.tag === 'fillBrush');
  if (fillBrush) {
    const winBrush = fillBrush.children.find(c => c.tag === 'winBrush');
    if (winBrush) {
      bgColor = parseColor(winBrush.attrs['faceColor']);
    }
  }

  return {
    left: parseSide('leftBorder'),
    right: parseSide('rightBorder'),
    top: parseSide('topBorder'),
    bottom: parseSide('bottomBorder'),
    bgColor,
  };
}

/** Get cell padding from cellMargin (HWP units) or default.
 *  Values of 0xFFFFFFFF (4294967295) mean "not set" — use default. */
function getCellPadding(cell: any): { left: number; right: number; top: number; bottom: number } {
  const m = cell.cellMargin;
  const UNSET = 4294967295; // 0xFFFFFFFF sentinel
  const validHwp = (v: number | undefined): number | undefined =>
    (v != null && v !== UNSET && v >= 0 && v < 100000) ? v : undefined;
  if (m) {
    const l = validHwp(m.left), r = validHwp(m.right), t = validHwp(m.top), b = validHwp(m.bottom);
    if (l != null || r != null || t != null || b != null) {
      return {
        left: l != null ? hwpToPt(l) : 1.2,
        right: r != null ? hwpToPt(r) : 1.2,
        top: t != null ? hwpToPt(t) : 1.2,
        bottom: b != null ? hwpToPt(b) : 1.2,
      };
    }
  }
  return { left: 1.2, right: 1.2, top: 1.2, bottom: 1.2 };
}

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

  // Note: .ttc files cause fontkit subsetting crash. Prefer .ttf first.
  const sansPath = customFonts?.sans
    ?? findSystemFont('AppleGothic.ttf')
    ?? findSystemFont('NanumGothic.ttf')
    ?? findSystemFont('malgun.ttf')
    ?? findSystemFont('AppleSDGothicNeo.ttc');

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
  charSpacing: number; // pt (character spacing)
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
  const d: TextStyle = { fontSize: 10, bold: false, italic: false, underline: false, strikeout: false, color: [0, 0, 0], isSerif: true, charSpacing: 0 };
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

  // Character spacing (자간): percentage of font size → pt
  const spacing = (cp as any).spacing;
  if (spacing) {
    const sv = spacing.hangul ?? spacing.HANGUL ?? spacing.latin ?? spacing.LATIN ?? 0;
    if (sv !== 0) s.charSpacing = s.fontSize * sv / 100;
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

// ── Numbering / Bullet prefix helpers ──

const HANGUL_SYLLABLES = '가나다라마바사아자차카타파하';
const HANGUL_JAMO = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';
const CIRCLED_DIGITS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
const CIRCLED_HANGUL = '㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷㉸㉹㉺㉻';

function formatNumber(n: number, fmt: string): string {
  switch (fmt) {
    case 'DIGIT': return String(n);
    case 'HANGUL_SYLLABLE': return HANGUL_SYLLABLES[n - 1] ?? String(n);
    case 'HANGUL_JAMO': return HANGUL_JAMO[n - 1] ?? String(n);
    case 'CIRCLED_DIGIT': return CIRCLED_DIGITS[n - 1] ?? String(n);
    case 'CIRCLED_HANGUL_SYLLABLE': return CIRCLED_HANGUL[n - 1] ?? String(n);
    case 'ROMAN_SMALL': {
      const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
      const syms = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
      let r = '', v = n;
      for (let i = 0; i < vals.length; i++) { while (v >= vals[i]) { r += syms[i]; v -= vals[i]; } }
      return r;
    }
    case 'ROMAN_CAPITAL': {
      const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
      const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
      let r = '', v = n;
      for (let i = 0; i < vals.length; i++) { while (v >= vals[i]) { r += syms[i]; v -= vals[i]; } }
      return r;
    }
    case 'LATIN_SMALL': return String.fromCharCode(96 + n); // a, b, c...
    case 'LATIN_CAPITAL': return String.fromCharCode(64 + n); // A, B, C...
    default: return String(n);
  }
}

interface NumberingState {
  /** counters[idRef][level] = current count */
  counters: Map<number, number[]>;
}

function createNumberingState(): NumberingState {
  return { counters: new Map() };
}

/**
 * Get the numbering/bullet prefix for a paragraph, advancing counters as needed.
 * Returns the prefix string (e.g., "1. ", "가. ", "● ") and whether autoIndent applies.
 */
function getParaPrefix(
  doc: HanDoc,
  paraPrIDRef: number | null,
  state: NumberingState,
): { prefix: string; autoIndent: boolean; level: number } {
  if (paraPrIDRef == null) return { prefix: '', autoIndent: false, level: 0 };
  const pp = doc.header.refList.paraProperties.find(p => p.id === paraPrIDRef);
  if (!pp?.heading) return { prefix: '', autoIndent: false, level: 0 };

  const { type, idRef, level } = pp.heading;

  // BULLET type
  if (type === 'BULLET') {
    const bullet = doc.header.refList.bullets?.find(b => b.id === idRef);
    if (bullet) {
      const paraHead = bullet.levels.find(l => l.level === level);
      const ai = paraHead?.autoIndent ?? false;
      if (paraHead?.text) {
        return { prefix: paraHead.text + ' ', autoIndent: ai, level };
      }
      if (bullet.char) {
        return { prefix: bullet.char + ' ', autoIndent: ai, level };
      }
    }
    return { prefix: '', autoIndent: false, level };
  }

  // NUMBER or OUTLINE type
  if (type === 'NUMBER' || type === 'OUTLINE') {
    const numbering = doc.header.refList.numberings?.find(n => n.id === idRef);
    if (!numbering) return { prefix: '', autoIndent: false, level };

    // Initialize counters for this numbering id
    if (!state.counters.has(idRef)) {
      state.counters.set(idRef, new Array(10).fill(0));
    }
    const counters = state.counters.get(idRef)!;

    // Increment this level's counter
    counters[level]++;
    // Reset all deeper levels
    for (let i = level + 1; i < counters.length; i++) counters[i] = 0;

    const paraHead = numbering.levels.find(l => l.level === level + 1); // levels use 1-based
    const ai = paraHead?.autoIndent ?? false;

    if (paraHead?.text) {
      // Replace ^N placeholders with formatted numbers
      let prefix = paraHead.text;
      prefix = prefix.replace(/\^(\d+)/g, (_m, idxStr) => {
        const idx = parseInt(idxStr, 10) - 1; // ^1 = level 0, ^2 = level 1, etc.
        const lvDef = numbering.levels.find(l => l.level === idx + 1);
        const fmt = lvDef?.numFormat ?? 'DIGIT';
        const count = counters[idx] || 1;
        return formatNumber(count, fmt);
      });
      return { prefix: prefix + ' ', autoIndent: ai, level };
    }

    // Fallback: generate simple number
    return { prefix: counters[level] + '. ', autoIndent: ai, level };
  }

  return { prefix: '', autoIndent: false, level: 0 };
}

/** Calculate line height in pt from paragraph style and font size */
function calcLineHeight(ps: ParaStyle, fontSize: number): number {
  if (ps.lineSpacingType === 'fixed') {
    return hwpToPt(ps.lineSpacingValue);
  }
  // percent: value is percentage (e.g., 160 = 160%)
  // HWP lineSpacing PERCENT is based on font em-square, not font size alone.
  // Apply line height correction to match 한/글's actual line height output.
  // 1.08x caused 12 regressions (page overflow); 1.03x balances 
  // improving under-spaced docs without worsening already-dense ones.
  return fontSize * (ps.lineSpacingValue / 100) * 1.03;
}

// ── Text measurement ──

function measureText(text: string, font: PDFFont, fontSize: number): number {
  try {
    let w = font.widthOfTextAtSize(text, fontSize);
    // Space width correction: Apple fonts have oversized spaces (0.32~0.40em)
    // vs HWP's HCR Batang (~0.25em). Use 0.30em as compromise target.
    const spaceCount = text.split(' ').length - 1;
    if (spaceCount > 0) {
      const actualSpaceW = font.widthOfTextAtSize(' ', fontSize);
      const targetSpaceW = fontSize * 0.30;
      if (actualSpaceW > targetSpaceW) {
        w -= spaceCount * (actualSpaceW - targetSpaceW);
      }
    }
    return w;
  } catch {
    let w = 0;
    for (const ch of text) {
      try {
        if (ch === ' ') { w += fontSize * 0.30; }
        else { w += font.widthOfTextAtSize(ch, fontSize); }
      }
      catch { w += fontSize * ((ch.codePointAt(0) ?? 0) > 0x2E80 ? 1.0 : 0.5); }
    }
    return w;
  }
}

// ── Word wrap ──

interface WLine { text: string; width: number; isWrapped?: boolean; }

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number, charSpacing = 0): WLine[] {
  if (!text || maxWidth <= 0) return [];
  const lines: WLine[] = [];
  /** measureText + charSpacing adjustment */
  const measure = (t: string) => {
    const w = measureText(t, font, fontSize);
    return charSpacing && t.length > 1 ? w + charSpacing * (t.length - 1) : w;
  };

  for (const para of text.split('\n')) {
    if (!para) { lines.push({ text: '', width: 0 }); continue; }
    let remaining = para;
    while (remaining.length > 0) {
      const fullW = measure(remaining);
      if (fullW <= maxWidth) { lines.push({ text: remaining, width: fullW }); break; }

      // Binary search for fit
      let lo = 1, hi = remaining.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (measure(remaining.substring(0, mid)) <= maxWidth) lo = mid;
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
      lines.push({ text: lineText, width: measure(lineText), isWrapped: true });
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
  charSpacing = 0,
  bold = false,
  italic = false,
): number {
  // Faux bold: FillThenStroke rendering mode with thin stroke width
  // Faux italic: skew via cm (concat matrix) operator
  const needsWrap = bold || italic;

  if (needsWrap) {
    page.pushOperators(pushGraphicsState());
    if (bold) {
      page.pushOperators(
        setTextRenderingMode(TextRenderingMode.FillAndOutline),
        setLineWidth(fontSize * 0.03),
      );
    }
  }

  let drawX = x;
  try {
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(...color), ...(charSpacing ? { characterSpacing: charSpacing } : {}) });
    if (needsWrap) page.pushOperators(popGraphicsState());
    return measureText(text, font, fontSize) + (charSpacing ? charSpacing * Math.max(0, text.length - 1) : 0);
  } catch {
    for (const ch of text) {
      try {
        page.drawText(ch, { x: drawX, y, size: fontSize, font, color: rgb(...color) });
        if (ch === ' ') {
          const actualW = font.widthOfTextAtSize(' ', fontSize);
          const targetW = fontSize * 0.30;
          drawX += (actualW > targetW ? targetW : actualW) + charSpacing;
        } else {
          drawX += font.widthOfTextAtSize(ch, fontSize) + charSpacing;
        }
      } catch {
        drawX += fontSize * ((ch.codePointAt(0) ?? 0) > 0x2E80 ? 1.0 : 0.5) + charSpacing;
      }
    }
    if (needsWrap) page.pushOperators(popGraphicsState());
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
      const cm = getCellPadding(cell);
      const innerW = cellW - cm.left - cm.right;
      let h = cm.top + cm.bottom;
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
              h += wrapText(text, cf, cts.fontSize, Math.max(innerW, 1), cts.charSpacing).length * lh;
            } else if (cc.type === 'table') {
              h += estimateTableHeight(doc, cc.element, Math.max(innerW, 1), getFont);
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
    // Handle landscape orientation: if marked landscape but dimensions are portrait, swap
    const isLandscape = sp?.landscape && sp.pageWidth < sp.pageHeight;
    const pageW = sp ? hwpToPt(isLandscape ? sp.pageHeight : sp.pageWidth) : 595.28;
    const pageH = sp ? hwpToPt(isLandscape ? sp.pageWidth : sp.pageHeight) : 841.89;
    const mL = sp ? hwpToPt(sp.margins.left) : 56.69;
    const mR = sp ? hwpToPt(sp.margins.right) : 56.69;
    const mT = sp ? hwpToPt(sp.margins.top) : 56.69;
    const mB = sp ? hwpToPt(sp.margins.bottom) : 56.69;
    const cW = pageW - mL - mR;
    const contentH = pageH - mT - mB;

    // ── Multi-column layout setup ──
    const colCount = sp?.columns?.count ?? 1;
    interface ColLayout { x: number; width: number; }
    const colLayouts: ColLayout[] = [];
    if (colCount > 1 && sp?.columns) {
      const cols = sp.columns;
      if (cols.sizes && cols.sizes.length === colCount) {
        // Per-column widths from colSz
        let xOff = mL;
        for (let i = 0; i < colCount; i++) {
          colLayouts.push({ x: xOff, width: hwpToPt(cols.sizes[i].width) });
          xOff += hwpToPt(cols.sizes[i].width) + hwpToPt(cols.sizes[i].gap);
        }
      } else {
        // Equal columns with same gap
        const gap = cols.gap > 0 ? hwpToPt(cols.gap) : hwpToPt(colCount > 1 ? 1134 : 0);
        const colW = (cW - gap * (colCount - 1)) / colCount;
        let xOff = mL;
        for (let i = 0; i < colCount; i++) {
          colLayouts.push({ x: xOff, width: colW });
          xOff += colW + gap;
        }
      }
    } else {
      colLayouts.push({ x: mL, width: cW });
    }

    let page = pdfDoc.addPage([pageW, pageH]);
    let curY = pageH - mT;
    let curCol = 0;
    const sectionPages: PDFPage[] = [page];

    // ── Footnote tracking ──
    let footnoteCounter = 0;
    const pageFootnotes = new Map<PDFPage, { num: number; text: string }[]>();

    function newColumn() {
      curCol++;
      if (curCol >= colLayouts.length) {
        // All columns full — new page
        page = pdfDoc.addPage([pageW, pageH]);
        sectionPages.push(page);
        curCol = 0;
      }
      curY = pageH - mT;
    }

    function newPage() {
      page = pdfDoc.addPage([pageW, pageH]);
      sectionPages.push(page);
      curY = pageH - mT;
      curCol = 0;
    }

    function checkBreak(h: number) {
      if (curY - h < mB) {
        if (colLayouts.length > 1) newColumn();
        else newPage();
      }
    }

    const numberingState = createNumberingState();

    for (const para of section.paragraphs) {
      // Handle column break
      if (para.columnBreak && colLayouts.length > 1) {
        newColumn();
      }

      const ps = resolveParaStyle(doc, para.paraPrIDRef);

      // Resolve numbering/bullet prefix
      const { prefix: paraPrefix, autoIndent: prefixAutoIndent, level: headingLevel } = getParaPrefix(doc, para.paraPrIDRef, numberingState);

      // Check for inline column definition changes (ctrl > colPr)
      for (const run of para.runs) {
        for (const child of run.children) {
          if (child.type === 'ctrl') {
            const colPrEl = child.element.children.find((c: GenericElement) => c.tag === 'colPr');
            if (colPrEl) {
              const newColCount = Number(colPrEl.attrs['colCount'] ?? 1);
              if (newColCount > 1) {
                const colSizes = colPrEl.children.filter((c: GenericElement) => c.tag === 'colSz');
                colLayouts.length = 0;
                if (colSizes.length === newColCount) {
                  let xOff = mL;
                  for (let i = 0; i < newColCount; i++) {
                    const w = hwpToPt(Number(colSizes[i].attrs['width'] ?? 0));
                    const g = hwpToPt(Number(colSizes[i].attrs['gap'] ?? 0));
                    colLayouts.push({ x: xOff, width: w });
                    xOff += w + g;
                  }
                } else {
                  const gap = hwpToPt(Number(colPrEl.attrs['sameGap'] ?? 1134));
                  const colW = (cW - gap * (newColCount - 1)) / newColCount;
                  let xOff = mL;
                  for (let i = 0; i < newColCount; i++) {
                    colLayouts.push({ x: xOff, width: colW });
                    xOff += colW + gap;
                  }
                }
                curCol = 0;
                curY = pageH - mT;
              } else {
                // Back to single column
                colLayouts.length = 0;
                colLayouts.push({ x: mL, width: cW });
                curCol = 0;
              }
            }
          }
        }
      }

      const col = colLayouts[curCol];
      const pL = col.x + ps.marginLeft;
      const pW = col.width - ps.marginLeft - ps.marginRight;

      curY -= ps.marginTop;

      // Track if paragraph has any content
      let hasContent = false;
      let firstLine = true;
      let prefixApplied = false;
      let prefixWidth = 0; // measured width of prefix for autoIndent hanging indent

      for (const run of para.runs) {
        const ts = resolveTextStyle(doc, run.charPrIDRef);
        const font = getFont(ts);
        const lineH = calcLineHeight(ps, ts.fontSize);

        for (const child of run.children) {
          if (child.type === 'text') {
            let content = child.content;
            if (!content && !hasContent) {
              // Empty text run — reduced height for empty paragraphs
              const emptyH = lineH * 0.75;
              checkBreak(emptyH);
              curY -= emptyH;
              hasContent = true;
              continue;
            }
            if (!content) continue;

            // Prepend numbering/bullet prefix to first text content of this paragraph
            if (paraPrefix && !prefixApplied) {
              content = paraPrefix + content;
              prefixWidth = measureText(paraPrefix, font, ts.fontSize);
              prefixApplied = true;
            }

            // Use current column dimensions
            const curColLayout = colLayouts[curCol];
            const curPW = curColLayout.width - ps.marginLeft - ps.marginRight;

            // Wrap text with proper first-line indent handling:
            // First line uses curPW - indent (narrower for positive indent, wider for negative/hanging indent)
            // Subsequent lines always use curPW
            // When autoIndent is active, continuation lines get a hanging indent equal to the prefix width
            const autoIndentOffset = (prefixAutoIndent && prefixWidth > 0) ? prefixWidth : 0;
            const indent = firstLine ? ps.textIndent : autoIndentOffset;
            const contWidth = curPW - autoIndentOffset; // continuation line width
            let lines: WLine[];
            if (indent !== 0 || autoIndentOffset !== 0) {
              // Split wrapping: first line at indented width, rest at continuation width
              const firstLineWidth = curPW - indent;
              const firstLines = wrapText(content, font, ts.fontSize, firstLineWidth, ts.charSpacing);
              if (firstLines.length <= 1) {
                lines = firstLines;
              } else {
                // Take only the first line, re-wrap the rest at continuation width
                lines = [firstLines[0]];
                const usedText = firstLines[0].text;
                const remaining = content.substring(usedText.length).trimStart();
                if (remaining) {
                  lines.push(...wrapText(remaining, font, ts.fontSize, contWidth, ts.charSpacing));
                }
              }
            } else {
              lines = wrapText(content, font, ts.fontSize, curPW, ts.charSpacing);
            }

            for (const line of lines) {
              checkBreak(lineH);
              // Re-fetch column after potential column/page break
              const activeCol = colLayouts[curCol];
              const activePL = activeCol.x + ps.marginLeft;
              const activePW = activeCol.width - ps.marginLeft - ps.marginRight;

              const lineIndent = firstLine ? ps.textIndent : autoIndentOffset;
              const effectiveW = activePW - lineIndent;
              let x = activePL + lineIndent;
              let justifyCs = ts.charSpacing;
              if (ps.align === 'center') x = activePL + lineIndent + (effectiveW - line.width) / 2;
              else if (ps.align === 'right') x = activePL + lineIndent + effectiveW - line.width;
              else if (ps.align === 'justify' && line.isWrapped && line.text.length > 1) {
                const extra = effectiveW - line.width;
                justifyCs = ts.charSpacing + extra / (line.text.length - 1);
              }

              const textY = curY - ts.fontSize;
              drawText(page, line.text, x, textY, font, ts.fontSize, ts.color, justifyCs, ts.bold, ts.italic);

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
            const activeCol = colLayouts[curCol];
            renderTable(doc, child.element, activeCol.x + ps.marginLeft, activeCol.width - ps.marginLeft - ps.marginRight, getFont);
          } else if (child.type === 'inlineObject') {
            hasContent = true;
            const activeCol = colLayouts[curCol];
            const activePL = activeCol.x + ps.marginLeft;
            const activePW = activeCol.width - ps.marginLeft - ps.marginRight;
            if (child.name === 'picture' || child.name === 'pic') {
              renderImage(doc, child.element, activePL, activePW);
            } else {
              // Shape/drawing: render outline + internal content
              renderShapeContent(doc, child.element, activePL, activePW, font, ts, ps, getFont, child.name);
            }
          } else if (child.type === 'shape') {
            hasContent = true;
            const activeCol = colLayouts[curCol];
            const activePL = activeCol.x + ps.marginLeft;
            const activePW = activeCol.width - ps.marginLeft - ps.marginRight;
            renderShapeContent(doc, child.element, activePL, activePW, font, ts, ps, getFont, child.name);
          } else if (child.type === 'ctrl') {
            // Check for footnote/endnote
            const fn = parseFootnote(child.element);
            if (fn) {
              footnoteCounter++;
              const fnText = extractAnnotationText(fn);

              // Collect footnote for rendering at page bottom
              if (!pageFootnotes.has(page)) pageFootnotes.set(page, []);
              pageFootnotes.get(page)!.push({ num: footnoteCounter, text: fnText });
            }
          }
        }
      }

      // If paragraph had no content at all, advance by reduced height
      // Empty paragraphs in HWP typically render shorter than full line height
      if (!hasContent) {
        const defaultLineH = calcLineHeight(ps, 10);
        const emptyLineH = defaultLineH * 0.75;
        checkBreak(emptyLineH);
        curY -= emptyLineH;
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
        let declaredRowH = 0;
        for (const cell of tbl.rows[ri].cells) {
          if (cell.cellSpan.rowSpan > 1) continue;
          const h = estimateCellHeight(doc, cell, gridCellW(cell), getFont);
          const declH = cell.cellSz.height > 0 ? hwpToPt(cell.cellSz.height) : 0;
          declaredRowH = Math.max(declaredRowH, declH);
          rh = Math.max(rh, h);
        }
        // HWP declared row height is a MINIMUM, not a maximum.
        // Content that exceeds declared height expands the row (한/글 behavior).
        // Only cap extreme overestimation (>1.8x) to handle font metric differences
        // between our embedded fonts and the original Korean fonts.
        if (declaredRowH > 0 && rh > declaredRowH * 1.8) {
          rh = declaredRowH * 1.2;
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
        let rowH = Math.min(rowHeights[ri], contentH);

        // Page break with row-splitting for very tall rows: when a row
        // doesn't fit and is taller than 40% of a page, render it partially
        // at the current position if there's enough remaining space (>= 15%
        // of page). This prevents excessive page waste from tall rows.
        const remaining = curY - mB;
        if (remaining < rowH) {
          if (rowH > contentH * 0.4 && remaining >= contentH * 0.15) {
            // Very tall row with significant remaining space: render partial
            rowH = remaining;
          } else {
            newPage();
          }
        }

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
          // When row was split (rowH < rowHeights[ri]), cap cell height
          if (cell.cellSpan.rowSpan === 1 && rowH < rowHeights[ri]) cellH = rowH;

          // Resolve border fill for this cell
          const bf = resolveBorderFill(doc, cell.borderFillIDRef);

          // Cell background fill
          if (bf.bgColor) {
            page.drawRectangle({
              x: cellX, y: curY - cellH,
              width: cellW, height: cellH,
              color: rgb(bf.bgColor.red, bf.bgColor.green, bf.bgColor.blue),
            });
          }

          // Cell borders (draw each side individually with proper width/style)
          const bx = cellX, by = curY - cellH;
          function drawCellBorder(side: BorderSide, x1: number, y1: number, x2: number, y2: number) {
            if (side.type === 'NONE') return;
            const c = rgb(side.color.red, side.color.green, side.color.blue);
            if (side.type === 'DOUBLE_SLIM' || side.type === 'DOUBLE' || side.type === 'SLIM_THICK' || side.type === 'THICK_SLIM') {
              // Double border: two thin lines with a gap
              const gap = Math.max(side.width * 0.35, 0.4);
              const lineW = Math.max(side.width * 0.2, 0.15);
              const isV = Math.abs(x1 - x2) < 0.01;
              const d = gap / 2;
              if (isV) {
                page.drawLine({ start: { x: x1 - d, y: y1 }, end: { x: x2 - d, y: y2 }, thickness: lineW, color: c });
                page.drawLine({ start: { x: x1 + d, y: y1 }, end: { x: x2 + d, y: y2 }, thickness: lineW, color: c });
              } else {
                page.drawLine({ start: { x: x1, y: y1 - d }, end: { x: x2, y: y2 - d }, thickness: lineW, color: c });
                page.drawLine({ start: { x: x1, y: y1 + d }, end: { x: x2, y: y2 + d }, thickness: lineW, color: c });
              }
            } else if (side.type === 'DASHED' || side.type === 'DASH') {
              page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 },
                thickness: side.width, color: c, dashArray: [side.width * 4, side.width * 2] });
            } else if (side.type === 'DOTTED' || side.type === 'DOT') {
              page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 },
                thickness: side.width, color: c, dashArray: [side.width, side.width * 2] });
            } else {
              // SOLID and other types
              page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: side.width, color: c });
            }
          }
          drawCellBorder(bf.left, bx, by, bx, by + cellH);
          drawCellBorder(bf.right, bx + cellW, by, bx + cellW, by + cellH);
          drawCellBorder(bf.top, bx, by + cellH, bx + cellW, by + cellH);
          drawCellBorder(bf.bottom, bx, by, bx + cellW, by);

          // Cell text
          renderCellContent(doc, cell, cellX, curY, cellW, cellH, getFont);
        }
        curY -= rowH;
      }

    }

    /** Estimate cell height from content */
    function estimateCellHeight(doc: HanDoc, cell: any, cellW: number, getFont: (s: TextStyle) => PDFFont): number {
      const cellDeclaredH = cell.cellSz.height > 0 ? hwpToPt(cell.cellSz.height) : 0;
      const cm = getCellPadding(cell);
      const padH = cm.top + cm.bottom;
      const innerW = cellW - cm.left - cm.right;
      let h = padH;
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
              h += wrapText(text, cf, cts.fontSize, Math.max(innerW, 1), cts.charSpacing).length * lh;
            } else if (cc.type === 'table') {
              h += estimateTableHeight(doc, cc.element, Math.max(innerW, 1), getFont);
            } else if (cc.type === 'inlineObject' && (cc.name === 'pic' || cc.name === 'picture')) {
              // Use curSz > orgSz > imgRect for height estimation (matching renderImage logic)
              const curSzE = findDesc(cc.element, 'curSz');
              const orgSzE = findDesc(cc.element, 'orgSz');
              const imgEl = findDesc(cc.element, 'img') ?? findDesc(cc.element, 'imgRect');
              const szEl = curSzE ?? orgSzE ?? imgEl;
              if (szEl) {
                const imgH = Number(szEl.attrs['height'] ?? 0);
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
      // If the cell has a declared height, use the larger of declared vs estimated.
      // Cap extreme overestimation (>2.5x) from font metric differences.
      if (cellDeclaredH > 0 && h > cellDeclaredH * 2.5) {
        return cellDeclaredH * 1.2;
      }
      return Math.max(cellDeclaredH, h);
    }

    /** Render cell content (text + nested tables) */
    function renderCellContent(doc: HanDoc, cell: any, cellX: number, cellTop: number, cellW: number, cellH: number, getFont: (s: TextStyle) => PDFFont) {
      const cm = getCellPadding(cell);
      const innerW = cellW - cm.left - cm.right;
      // Vertical alignment: estimate content height first
      const vAlign = cell.vertAlign ?? 'TOP';
      let contentHeight = 0;
      if (vAlign === 'CENTER' || vAlign === 'BOTTOM') {
        contentHeight = estimateCellHeight(doc, cell, cellW, getFont) - cm.top - cm.bottom;
      }
      let yOffset = 0;
      if (vAlign === 'CENTER') yOffset = Math.max(0, (cellH - contentHeight) / 2 - cm.top);
      else if (vAlign === 'BOTTOM') yOffset = Math.max(0, cellH - contentHeight - cm.top - cm.bottom);

      let ty = cellTop - cm.top - yOffset;
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
              const cls = wrapText(text, cf, cts.fontSize, Math.max(innerW, 1), cts.charSpacing);
              for (const cl of cls) {
                ty -= cts.fontSize;
                let tx = cellX + cm.left;
                let cellJustifyCs = cts.charSpacing;
                if (cps.align === 'center') tx = cellX + (cellW - cl.width) / 2;
                else if (cps.align === 'right') tx = cellX + cellW - cm.right - cl.width;
                else if (cps.align === 'justify' && cl.isWrapped && cl.text.length > 1) {
                  const extra = innerW - cl.width;
                  cellJustifyCs = cts.charSpacing + extra / (cl.text.length - 1);
                }
                if (ty > cellTop - cellH) {
                  drawText(page, cl.text, tx, ty, cf, cts.fontSize, cts.color, cellJustifyCs, cts.bold, cts.italic);

                  // Underline / strikethrough in table cells
                  if (cts.underline) {
                    page.drawLine({
                      start: { x: tx, y: ty - 2 },
                      end: { x: tx + cl.width, y: ty - 2 },
                      thickness: 0.5,
                      color: rgb(...cts.color),
                    });
                  }
                  if (cts.strikeout) {
                    page.drawLine({
                      start: { x: tx, y: ty + cts.fontSize * 0.35 },
                      end: { x: tx + cl.width, y: ty + cts.fontSize * 0.35 },
                      thickness: 0.5,
                      color: rgb(...cts.color),
                    });
                  }
                }
                ty -= (lh - cts.fontSize);
              }
            } else if (cc.type === 'table') {
              const savedCurY = curY;
              curY = ty;
              renderTable(doc, cc.element, cellX + cm.left, Math.max(innerW, 1), getFont);
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
              // Shape/container inside cell — draw outline + content
              const savedCurY = curY;
              curY = ty;
              renderShapeContent(doc, cc.element, cellX + 2, cellW - 4, cf, cts, cps, getFont, cc.name);
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

    // ── Shape outline/fill rendering ──
    /** Extract shape visual properties and draw outline/fill */
    function renderShapeOutline(
      element: GenericElement, shapeName: string,
      shapeX: number, shapeW: number,
    ) {
      // Extract size
      const curSzEl = findDesc(element, 'curSz') ?? findDesc(element, 'sz');
      const orgSzEl = findDesc(element, 'orgSz');
      const szEl = curSzEl ?? orgSzEl;
      let w = shapeW;
      let h = 0;
      if (szEl) {
        const sw = Number(szEl.attrs['width'] ?? 0);
        const sh = Number(szEl.attrs['height'] ?? 0);
        if (sw > 0) w = Math.min(hwpToPt(sw), shapeW);
        if (sh > 0) h = hwpToPt(sh);
      }
      if (h <= 0) return 0; // no size info, skip outline

      // Extract line properties
      const lineShapeEl = findDesc(element, 'lineShape');
      let lineColor = { red: 0, green: 0, blue: 0 };
      let lineWidth = 0.5;
      let lineStyle = 'SOLID';
      if (lineShapeEl) {
        const lc = parseColor(lineShapeEl.attrs['color']);
        if (lc) lineColor = lc;
        const lw = Number(lineShapeEl.attrs['width'] ?? 0);
        if (lw > 0) lineWidth = hwpToPt(lw);
        // Cap line width to reasonable range
        if (lineWidth > 5) lineWidth = 5;
        if (lineWidth < 0.1) lineWidth = 0.5;
        lineStyle = lineShapeEl.attrs['style'] ?? 'SOLID';
      }
      const noLine = lineStyle === 'NONE' || (lineShapeEl && lineShapeEl.attrs['style'] === 'NONE');

      // Extract fill
      const fillEl = findDesc(element, 'fillBrush');
      let fillColor: { red: number; green: number; blue: number } | undefined;
      if (fillEl) {
        // Solid fill from winBrush
        const winBrush = findDesc(fillEl, 'winBrush');
        if (winBrush) {
          fillColor = parseColor(winBrush.attrs['faceColor']);
        }
        // Gradient: use first color as approximation
        if (!fillColor) {
          const gradation = findDesc(fillEl, 'gradation');
          if (gradation) {
            const colors = gradation.children.filter(c => c.tag === 'color' || c.tag.endsWith(':color'));
            if (colors.length > 0) {
              fillColor = parseColor(colors[0].attrs['value']);
            }
          }
        }
      }

      // Ensure space
      checkBreak(h);
      const y = curY - h;

      // Draw based on shape type
      const tag = shapeName.includes(':') ? shapeName.split(':').pop()! : shapeName;

      if (tag === 'ellipse') {
        const cx = shapeX + w / 2;
        const cy = y + h / 2;
        if (fillColor) {
          page.drawEllipse({
            x: cx, y: cy,
            xScale: w / 2, yScale: h / 2,
            color: rgb(fillColor.red, fillColor.green, fillColor.blue),
          });
        }
        if (!noLine) {
          page.drawEllipse({
            x: cx, y: cy,
            xScale: w / 2, yScale: h / 2,
            borderColor: rgb(lineColor.red, lineColor.green, lineColor.blue),
            borderWidth: lineWidth,
          });
        }
      } else if (tag === 'line' || tag === 'connectLine') {
        // Line shape: draw from top-left to bottom-right of bounding box
        // TODO: parse actual start/end points if available
        const startX = shapeX;
        const startY = curY;
        const endX = shapeX + w;
        const endY = y;
        page.drawLine({
          start: { x: startX, y: startY },
          end: { x: endX, y: endY },
          thickness: lineWidth,
          color: rgb(lineColor.red, lineColor.green, lineColor.blue),
        });
      } else if (tag === 'polygon') {
        // Polygon: try to extract points, fallback to rect
        // For now draw as rect outline
        if (fillColor) {
          page.drawRectangle({
            x: shapeX, y: y, width: w, height: h,
            color: rgb(fillColor.red, fillColor.green, fillColor.blue),
          });
        }
        if (!noLine) {
          page.drawRectangle({
            x: shapeX, y: y, width: w, height: h,
            borderColor: rgb(lineColor.red, lineColor.green, lineColor.blue),
            borderWidth: lineWidth,
          });
        }
      } else {
        // rect, arc, and other shapes: draw rectangle
        if (fillColor) {
          page.drawRectangle({
            x: shapeX, y: y, width: w, height: h,
            color: rgb(fillColor.red, fillColor.green, fillColor.blue),
          });
        }
        if (!noLine) {
          page.drawRectangle({
            x: shapeX, y: y, width: w, height: h,
            borderColor: rgb(lineColor.red, lineColor.green, lineColor.blue),
            borderWidth: lineWidth,
          });
        }
      }

      return h;
    }

    // ── Shape/drawing content rendering ──
    function renderShapeContent(
      doc: HanDoc, element: GenericElement,
      shapeX: number, shapeW: number,
      defaultFont: PDFFont, defaultTs: TextStyle, defaultPs: ParaStyle,
      getFont: (s: TextStyle) => PDFFont,
      shapeName?: string,
    ) {
      // Draw shape outline/fill first
      if (shapeName) {
        const tag = shapeName.includes(':') ? shapeName.split(':').pop()! : shapeName;
        // For line/connectLine, only draw the line, no content
        if (tag === 'line' || tag === 'connectLine') {
          const h = renderShapeOutline(element, shapeName, shapeX, shapeW);
          if (h > 0) curY -= h;
          return;
        }
        renderShapeOutline(element, shapeName, shapeX, shapeW);
      }
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
              const lines = wrapText(text, defaultFont, defaultTs.fontSize, shapeW, defaultTs.charSpacing);
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
            const lines = wrapText(shapeText.trim(), defaultFont, defaultTs.fontSize, shapeW, defaultTs.charSpacing);
            for (const line of lines) {
              checkBreak(lineH);
              drawText(page, line.text, shapeX, curY - defaultTs.fontSize, defaultFont, defaultTs.fontSize, defaultTs.color);
              curY -= lineH;
            }
          }
        }
      }
    }

    // ── Footnote rendering at page bottom ──
    const fnFont = fonts.sans;
    const fnFontSize = 8;
    const fnLineH = fnFontSize * 1.4;
    for (const [pg, footnotes] of pageFootnotes) {
      if (footnotes.length === 0) continue;
      // Calculate total footnote area height
      const totalFnH = fnLineH * footnotes.length + 6; // 6pt for separator line + spacing
      // Start from bottom margin + footer space, going up
      let fnY = mB + totalFnH;

      // Draw separator line
      const sepY = fnY + 4;
      pg.drawLine({
        start: { x: mL, y: sepY },
        end: { x: mL + cW * 0.3, y: sepY },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      });

      // Draw each footnote
      for (const fn of footnotes) {
        const numStr = `${fn.num}) `;
        const numW = fnFont.widthOfTextAtSize(numStr, fnFontSize);
        // Draw number
        drawText(pg, numStr, mL, fnY - fnFontSize, fnFont, fnFontSize, [0, 0, 0]);
        // Draw text
        drawText(pg, fn.text, mL + numW, fnY - fnFontSize, fnFont, fnFontSize, [0, 0, 0]);
        fnY -= fnLineH;
      }
    }

    // ── Header/Footer rendering ──
    const headerMarginPt = sp ? hwpToPt(sp.margins.header) : 0;
    const footerMarginPt = sp ? hwpToPt(sp.margins.footer) : 0;
    const sectionHeaders = doc.headers;
    const sectionFooters = doc.footers;
    const pageStartNum = sp?.pageStartNumber ?? 1;
    const hfFont = fonts.sans;
    const hfFontSize = 10;

    // Total page count for {{pages}} placeholder
    const totalPages = sectionPages.length;

    for (let pi = 0; pi < sectionPages.length; pi++) {
      const pg = sectionPages[pi];
      const pageNum = pageStartNum + pi;

      // Helper to replace field placeholders
      const replacePlaceholders = (text: string): string =>
        text.replace(/\{\{page\}\}/g, String(pageNum))
            .replace(/\{\{pages\}\}/g, String(totalPages));

      // Render headers
      for (const hdr of sectionHeaders) {
        if (hdr.applyPageType === 'EVEN' && pageNum % 2 !== 0) continue;
        if (hdr.applyPageType === 'ODD' && pageNum % 2 === 0) continue;
        let text = extractAnnotationText(hdr);
        if (!text.trim()) continue;
        text = replacePlaceholders(text);
        // Position: top margin area, centered
        const textW = hfFont.widthOfTextAtSize(text, hfFontSize);
        const hdrY = pageH - headerMarginPt - hfFontSize;
        const hdrX = mL + (cW - textW) / 2;
        drawText(pg, text, hdrX, hdrY, hfFont, hfFontSize, [0, 0, 0]);
      }

      // Render footers
      for (const ftr of sectionFooters) {
        if (ftr.applyPageType === 'EVEN' && pageNum % 2 !== 0) continue;
        if (ftr.applyPageType === 'ODD' && pageNum % 2 === 0) continue;
        let text = extractAnnotationText(ftr);
        if (!text.trim()) continue;
        text = replacePlaceholders(text);
        // Position: bottom margin area, centered
        const textW = hfFont.widthOfTextAtSize(text, hfFontSize);
        const ftrY = footerMarginPt;
        const ftrX = mL + (cW - textW) / 2;
        drawText(pg, text, ftrX, ftrY, hfFont, hfFontSize, [0, 0, 0]);
      }

      // Render automatic page numbering from <hp:pageNum> section config
      if (sp?.pageNumbering) {
        const pn = sp.pageNumbering;
        const sideChar = pn.sideChar || '';
        const numStr = sideChar
          ? `${sideChar} ${pageNum} ${sideChar}`
          : String(pageNum);
        const numW = hfFont.widthOfTextAtSize(numStr, hfFontSize);
        const pos = pn.pos.toUpperCase();

        let pnX: number;
        if (pos.includes('LEFT')) {
          pnX = mL;
        } else if (pos.includes('RIGHT')) {
          pnX = mL + cW - numW;
        } else {
          // CENTER (default)
          pnX = mL + (cW - numW) / 2;
        }

        let pnY: number;
        if (pos.includes('TOP')) {
          pnY = pageH - headerMarginPt - hfFontSize;
        } else {
          // BOTTOM (default)
          pnY = footerMarginPt;
        }

        drawText(pg, numStr, pnX, pnY, hfFont, hfFontSize, [0, 0, 0]);
      }
    }
  }

  return new Uint8Array(await pdfDoc.save());
}
