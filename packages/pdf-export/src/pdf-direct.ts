/**
 * Direct PDF generation — HWPX → PDF via pdf-lib with embedded Korean fonts.
 * No HTML, no Playwright, no browser. Production-grade.
 *
 * Key principle: Use HWPX values exactly as specified. No heuristic adjustments.
 */

import { HanDoc, extractAnnotationText, parseFootnote, parseHeaderFooter } from '@handoc/hwpx-parser';
import { parseTable } from '@handoc/hwpx-parser';
import { PDFDocument, rgb, PDFFont, PDFPage, PDFImage, pushGraphicsState, popGraphicsState, setTextRenderingMode, TextRenderingMode, setLineWidth, concatTransformationMatrix } from 'pdf-lib';
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

  // Read palette for palettized BMPs (1, 4, 8 bpp)
  const dibHeaderSize = bmpData[14] | (bmpData[15] << 8) | (bmpData[16] << 16) | (bmpData[17] << 24);
  const paletteOffset = 14 + dibHeaderSize;
  const paletteColors = bpp <= 8 ? (1 << bpp) : 0;
  const palette: [number, number, number][] = [];
  for (let i = 0; i < paletteColors; i++) {
    const po = paletteOffset + i * 4;
    palette.push([bmpData[po + 2], bmpData[po + 1], bmpData[po]]); // BGR → RGB
  }

  // Build raw RGBA rows (PNG filter byte 0 = None per row)
  const rowBytes = Math.ceil((width * bpp / 8) / 4) * 4; // BMP rows are 4-byte aligned
  const raw = Buffer.alloc((width * 3 + 1) * height); // RGB + filter byte per row

  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : (height - 1 - y);
    const srcOff = dataOffset + srcY * rowBytes;
    const dstOff = y * (width * 3 + 1);
    raw[dstOff] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      if (bpp === 24) {
        const si = srcOff + x * 3;
        raw[dstOff + 1 + x * 3] = bmpData[si + 2]; // R
        raw[dstOff + 1 + x * 3 + 1] = bmpData[si + 1]; // G
        raw[dstOff + 1 + x * 3 + 2] = bmpData[si]; // B
      } else if (bpp === 32) {
        const si = srcOff + x * 4;
        raw[dstOff + 1 + x * 3] = bmpData[si + 2];
        raw[dstOff + 1 + x * 3 + 1] = bmpData[si + 1];
        raw[dstOff + 1 + x * 3 + 2] = bmpData[si];
      } else if (bpp === 8) {
        const ci = bmpData[srcOff + x];
        const [r, g, b] = palette[ci] ?? [0, 0, 0];
        raw[dstOff + 1 + x * 3] = r;
        raw[dstOff + 1 + x * 3 + 1] = g;
        raw[dstOff + 1 + x * 3 + 2] = b;
      } else if (bpp === 4) {
        const byteVal = bmpData[srcOff + (x >> 1)];
        const ci = (x & 1) === 0 ? (byteVal >> 4) : (byteVal & 0x0F);
        const [r, g, b] = palette[ci] ?? [0, 0, 0];
        raw[dstOff + 1 + x * 3] = r;
        raw[dstOff + 1 + x * 3 + 1] = g;
        raw[dstOff + 1 + x * 3 + 2] = b;
      } else if (bpp === 1) {
        const byteVal = bmpData[srcOff + (x >> 3)];
        const ci = (byteVal >> (7 - (x & 7))) & 1;
        const [r, g, b] = palette[ci] ?? [0, 0, 0];
        raw[dstOff + 1 + x * 3] = r;
        raw[dstOff + 1 + x * 3 + 1] = g;
        raw[dstOff + 1 + x * 3 + 2] = b;
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

// ── GIF to PNG conversion (single-frame, no external dependencies) ──

function gifToPng(gifData: Uint8Array): Uint8Array {
  // Minimal GIF87a/GIF89a decoder — first frame only
  if (gifData[0] !== 0x47 || gifData[1] !== 0x49 || gifData[2] !== 0x46) {
    throw new Error('Not a GIF');
  }

  const width = gifData[6] | (gifData[7] << 8);
  const height = gifData[8] | (gifData[9] << 8);
  const packed = gifData[10];
  const hasGCT = (packed & 0x80) !== 0;
  const gctSize = hasGCT ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
  const bgIndex = gifData[11];

  // Read Global Color Table
  let offset = 13;
  const gct: number[] = [];
  if (hasGCT) {
    for (let i = 0; i < gctSize; i++) gct.push(gifData[offset + i]);
    offset += gctSize;
  }

  // Skip extensions, find first image descriptor
  let transparentIndex = -1;
  while (offset < gifData.length) {
    const block = gifData[offset];
    if (block === 0x21) { // Extension
      offset++;
      const label = gifData[offset++];
      if (label === 0xF9) { // Graphics Control Extension
        const sz = gifData[offset++];
        const flags = gifData[offset];
        if (flags & 0x01) transparentIndex = gifData[offset + 3];
        offset += sz;
        offset++; // block terminator
      } else {
        // Skip other extensions
        while (true) {
          const sz = gifData[offset++];
          if (sz === 0) break;
          offset += sz;
        }
      }
    } else if (block === 0x2C) { // Image descriptor
      break;
    } else if (block === 0x3B) { // Trailer
      break;
    } else {
      offset++;
    }
  }

  if (gifData[offset] !== 0x2C) throw new Error('No image descriptor found');
  offset++;
  const imgLeft = gifData[offset] | (gifData[offset + 1] << 8); offset += 2;
  const imgTop = gifData[offset] | (gifData[offset + 1] << 8); offset += 2;
  const imgW = gifData[offset] | (gifData[offset + 1] << 8); offset += 2;
  const imgH = gifData[offset] | (gifData[offset + 1] << 8); offset += 2;
  const imgPacked = gifData[offset++];
  const hasLCT = (imgPacked & 0x80) !== 0;
  const interlaced = (imgPacked & 0x40) !== 0;
  const lctSize = hasLCT ? 3 * (1 << ((imgPacked & 0x07) + 1)) : 0;

  const ct = hasLCT ? [] : gct;
  if (hasLCT) {
    for (let i = 0; i < lctSize; i++) ct.push(gifData[offset + i]);
    offset += lctSize;
  }

  // LZW decode
  const minCodeSize = gifData[offset++];
  const lzwData: number[] = [];
  while (true) {
    const sz = gifData[offset++];
    if (sz === 0) break;
    for (let i = 0; i < sz; i++) lzwData.push(gifData[offset + i]);
    offset += sz;
  }

  // LZW decompression
  const pixels = lzwDecode(lzwData, minCodeSize, imgW * imgH);

  // Build RGBA image
  const hasAlpha = transparentIndex >= 0;
  const channels = hasAlpha ? 4 : 3;
  const colorType = hasAlpha ? 6 : 2; // RGBA or RGB
  const raw = Buffer.alloc((width * channels + 1) * height);

  // Fill with background
  for (let y = 0; y < height; y++) {
    raw[y * (width * channels + 1)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const off = y * (width * channels + 1) + 1 + x * channels;
      if (hasAlpha) { raw[off] = 0; raw[off + 1] = 0; raw[off + 2] = 0; raw[off + 3] = 0; }
    }
  }

  // De-interlace pass order
  const passes = interlaced
    ? [[0, 8], [4, 8], [2, 4], [1, 2]]
    : [[0, 1]];

  let pixIdx = 0;
  for (const [startRow, step] of passes) {
    for (let row = startRow; row < imgH; row += step) {
      for (let col = 0; col < imgW; col++) {
        const ci = pixels[pixIdx++] ?? bgIndex;
        const dy = imgTop + row;
        const dx = imgLeft + col;
        if (dy >= height || dx >= width) continue;
        const off = dy * (width * channels + 1) + 1 + dx * channels;
        if (ci === transparentIndex && hasAlpha) {
          raw[off + 3] = 0;
        } else {
          raw[off] = ct[ci * 3] ?? 0;
          raw[off + 1] = ct[ci * 3 + 1] ?? 0;
          raw[off + 2] = ct[ci * 3 + 2] ?? 0;
          if (hasAlpha) raw[off + 3] = 255;
        }
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
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

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;

  return new Uint8Array(Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', Buffer.from(compressed)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function lzwDecode(data: number[], minCodeSize: number, pixelCount: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const maxTableSize = 4096;

  // Initialize table
  let table: number[][] = [];
  for (let i = 0; i < clearCode; i++) table[i] = [i];
  table[clearCode] = [];
  table[eoiCode] = [];

  const output: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;
  let byteIdx = 0;

  function readCode(): number {
    while (bitCount < codeSize) {
      if (byteIdx >= data.length) return eoiCode;
      bitBuf |= data[byteIdx++] << bitCount;
      bitCount += 8;
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>= codeSize;
    bitCount -= codeSize;
    return code;
  }

  let prevEntry: number[] | null = null;

  while (output.length < pixelCount) {
    const code = readCode();
    if (code === eoiCode) break;
    if (code === clearCode) {
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
      table = [];
      for (let i = 0; i < clearCode; i++) table[i] = [i];
      table[clearCode] = [];
      table[eoiCode] = [];
      prevEntry = null;
      continue;
    }

    let entry: number[];
    if (table[code]) {
      entry = table[code];
    } else if (code === nextCode && prevEntry) {
      entry = [...prevEntry, prevEntry[0]];
    } else {
      break; // Invalid
    }

    output.push(...entry);

    if (prevEntry && nextCode < maxTableSize) {
      table[nextCode++] = [...prevEntry, entry[0]];
      if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
    }

    prevEntry = entry;
  }

  return output;
}

// ── BMP 8-bit (palettized) support in bmpToPng ──
// Already handled above via bmpToPng — but let's also handle 8-bit BMPs

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
  // Accept both '#RRGGBB' and 'RRGGBB' formats
  const m = colorStr.match(/^#?([0-9A-Fa-f]{6})$/);
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
  diagonal: BorderSide;
  bgColor?: { red: number; green: number; blue: number };
}

const defaultBorder: BorderSide = { type: 'SOLID', width: 0.5, color: { red: 0, green: 0, blue: 0 } };
const noneBorder: BorderSide = { type: 'NONE', width: 0, color: { red: 0, green: 0, blue: 0 } };
const defaultBorderFill: ResolvedBorderFill = { left: defaultBorder, right: defaultBorder, top: defaultBorder, bottom: defaultBorder, diagonal: noneBorder };

/** Convert border type to dash pattern for pdf-lib drawLine */
function borderDashPattern(type: string, width: number): { dashArray?: number[]; dashPhase?: number } {
  const w = Math.max(width, 0.5);
  switch (type.toUpperCase()) {
    case 'DASH':
    case 'DASHED':
      return { dashArray: [w * 4, w * 2] };
    case 'DOT':
    case 'DOTTED':
      return { dashArray: [w, w * 2] };
    case 'DASH_DOT':
    case 'DOT_DASH':
      return { dashArray: [w * 4, w * 2, w, w * 2] };
    case 'DASH_DOT_DOT':
      return { dashArray: [w * 4, w * 2, w, w * 2, w, w * 2] };
    case 'LONG_DASH':
      return { dashArray: [w * 8, w * 3] };
    case 'LONG_DASH_DOT':
      return { dashArray: [w * 8, w * 3, w, w * 3] };
    default:
      return {};
  }
}

/** Draw a border line with proper type (solid, dash, double, etc.) */
function drawBorderLine(
  page: PDFPage,
  start: { x: number; y: number },
  end: { x: number; y: number },
  border: BorderSide,
): void {
  if (border.type === 'NONE' || border.width <= 0) return;
  const color = rgb(border.color.red, border.color.green, border.color.blue);
  const t = border.type.toUpperCase();

  if (t === 'DOUBLE') {
    // Double line: two thin lines with gap between
    const gap = Math.max(border.width * 0.6, 0.3);
    const thin = Math.max(border.width * 0.4, 0.2);
    // Calculate perpendicular offset
    const dx = end.x - start.x, dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = -dy / len * gap, ny = dx / len * gap;
    page.drawLine({ start: { x: start.x + nx, y: start.y + ny }, end: { x: end.x + nx, y: end.y + ny }, thickness: thin, color });
    page.drawLine({ start: { x: start.x - nx, y: start.y - ny }, end: { x: end.x - nx, y: end.y - ny }, thickness: thin, color });
  } else {
    const dash = borderDashPattern(t, border.width);
    page.drawLine({ start, end, thickness: border.width, color, ...dash });
  }
}

function resolveBorderFill(doc: HanDoc, borderFillIDRef: number): ResolvedBorderFill {
  const bfs = doc.header.refList.borderFills;
  const bf = bfs.find(b => b.attrs['id'] === String(borderFillIDRef));
  if (!bf) return defaultBorderFill;

  function parseSide(tag: string): BorderSide {
    const el = bf!.children.find(c => c.tag === tag);
    if (!el) return tag === 'diagonal' ? noneBorder : defaultBorder;
    const t = el.attrs['type'] ?? 'SOLID';
    if (t === 'NONE' || t === 'none') return noneBorder;
    const w = mmToPt(el.attrs['width']);
    const c = parseColor(el.attrs['color']) ?? { red: 0, green: 0, blue: 0 };
    return { type: t, width: w, color: c };
  }

  // Background color from fillBrush > winBrush or gradation (single-color approximation)
  let bgColor: { red: number; green: number; blue: number } | undefined;
  const fillBrush = bf.children.find(c => c.tag === 'fillBrush');
  if (fillBrush) {
    const winBrush = fillBrush.children.find(c => c.tag === 'winBrush');
    if (winBrush) {
      bgColor = parseColor(winBrush.attrs['faceColor']);
    }
    // Gradation fallback: use first color stop as single-color approximation
    if (!bgColor) {
      const gradation = fillBrush.children.find(c => c.tag === 'gradation');
      if (gradation) {
        const firstColor = gradation.children.find(c => c.tag === 'color');
        if (firstColor?.attrs['value']) {
          bgColor = parseColor(firstColor.attrs['value']);
        }
      }
    }
  }

  return {
    left: parseSide('leftBorder'),
    right: parseSide('rightBorder'),
    top: parseSide('topBorder'),
    bottom: parseSide('bottomBorder'),
    diagonal: parseSide('diagonal'),
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
    // Hancom Office bundled fonts (HCR Batang/Dotum = 함초롬바탕/돋움)
    '/Applications/Hancom Office HWP.app/Contents/Resources/Hnc/Shared/TTF/Install',
    '/Applications/Hancom Office HWP.app/Contents/Resources/Hnc/Shared/TTF/Hwp',
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

  // Priority: HCR (함초롬) > Apple > Nanum > Windows
  // HCR fonts match 한/글's default rendering — critical for SSIM accuracy
  const serifPath = customFonts?.serif
    ?? findSystemFont('HANBatang.ttf')      // HCR Batang (함초롬바탕) — 한/글 default serif
    ?? findSystemFont('AppleMyungjo.ttf')
    ?? findSystemFont('NanumMyeongjo.ttf')
    ?? findSystemFont('batang.ttc');

  // Note: .ttc files cause fontkit subsetting crash. Prefer .ttf first.
  const sansPath = customFonts?.sans
    ?? findSystemFont('HANDotum.ttf')       // HCR Dotum (함초롬돋움) — 한/글 default sans
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
  highlightColor?: [number, number, number]; // text background highlight/shade color
}

interface ParaStyle {
  align: 'left' | 'center' | 'right' | 'justify';
  lineSpacingValue: number;   // raw value from HWPX
  lineSpacingType: string;    // 'percent' | 'fixed' | 'betweenlines' | 'atleast'
  condense: number;           // paragraph-level condensation (0 = none, N = condense by N%)
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

  // Highlight / shade color (text background)
  const hlc = cp.highlightColor || cp.shadeColor;
  if (hlc && hlc !== 'none' && hlc !== 'NONE' && hlc !== '#ffffff' && hlc !== 'ffffff') {
    const h = hlc.replace('#', '').padStart(6, '0');
    s.highlightColor = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
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
    lineSpacingValue: 160, lineSpacingType: 'percent', condense: 0,
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
  if (pp.condense && pp.condense > 0) s.condense = pp.condense;
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

/** Get font design-height ratio (ascent+|descent|)/unitsPerEm from fontkit metrics */
const emRatioCache = new Map<PDFFont, number>();
function getEmRatio(font?: PDFFont): number {
  if (!font) return 1.0;
  const cached = emRatioCache.get(font);
  if (cached !== undefined) return cached;
  try {
    const fk = (font as any).embedder?.font;
    if (fk && fk.unitsPerEm) {
      // fontkit: ascent positive, descent negative
      const ratio = (fk.ascent - fk.descent) / fk.unitsPerEm;
      if (ratio > 0.5 && ratio < 3.0) {
        emRatioCache.set(font, ratio);
        return ratio;
      }
    }
  } catch {}
  return 1.0; // fallback for standard (non-fontkit) fonts
}

/** Calculate line height in pt from paragraph style and font size */
function calcLineHeight(ps: ParaStyle, fontSize: number, font?: PDFFont): number {
  if (ps.lineSpacingType === 'fixed') {
    return hwpToPt(ps.lineSpacingValue);
  }
  if (ps.lineSpacingType === 'betweenlines') {
    // betweenLines: gap between lines (lineHeight = fontSize + gap)
    return fontSize + hwpToPt(ps.lineSpacingValue);
  }
  const emRatio = getEmRatio(font);
  if (ps.lineSpacingType === 'atleast') {
    // atLeast: minimum line height — use max(calculated, minimum)
    const pctHeight = fontSize * emRatio * (ps.lineSpacingValue / 100);
    return Math.max(pctHeight, fontSize * 1.2);
  }
  // percent: value is percentage (e.g., 160 = 160%)
  // HWP computes lineHeight = fontSize × emRatio × (lineSpacing / 100)
  // where emRatio = (ascent - descent) / unitsPerEm from the font's metrics.
  // e.g., HCR Batang emRatio ≈ 1.30, so 10pt × 1.30 × 1.60 = 20.8pt
  return fontSize * emRatio * (ps.lineSpacingValue / 100);
}

// ── Text measurement ──

function measureText(text: string, font: PDFFont, fontSize: number): number {
  try {
    let w = font.widthOfTextAtSize(text, fontSize);
    // Space width correction: Apple fonts have oversized spaces (0.32~0.40em)
    // vs HWP's HCR Batang (~0.25em). Use 0.22em to match HCR Batang measured width.
    const spaceCount = text.split(' ').length - 1;
    if (spaceCount > 0) {
      const actualSpaceW = font.widthOfTextAtSize(' ', fontSize);
      const targetSpaceW = fontSize * 0.22;
      if (actualSpaceW > targetSpaceW) {
        w -= spaceCount * (actualSpaceW - targetSpaceW);
      }
    }
    return w;
  } catch {
    let w = 0;
    for (const ch of text) {
      try {
        if (ch === ' ') { w += fontSize * 0.22; }
        else { w += font.widthOfTextAtSize(ch, fontSize); }
      }
      catch { w += fontSize * ((ch.codePointAt(0) ?? 0) > 0x2E80 ? 1.0 : 0.5); }
    }
    return w;
  }
}

// ── Word wrap ──

interface WLine { text: string; width: number; isWrapped?: boolean; }

// CJK kinsoku (禁則処理) rules
// Characters that must NOT start a line (closing brackets, punctuation)
const NO_START = new Set(
  '）」』】〕〉》）］｝、。，．？！；：・ー々〻ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ' +
  '),.!?;:'.split('')
);
// Characters that must NOT end a line (opening brackets)
const NO_END = new Set(
  '（「『【〔〈《（［｛'.split('')
);

function isCJK(code: number): boolean {
  return (code >= 0x3000 && code <= 0x9FFF) ||
    (code >= 0xAC00 && code <= 0xD7AF) ||
    (code >= 0xF900 && code <= 0xFAFF) ||
    (code >= 0x20000 && code <= 0x2FA1F) ||
    (code >= 0xFF01 && code <= 0xFF60);
}

/** Check if we can break between remaining[pos-1] and remaining[pos] */
function canBreakAt(remaining: string, pos: number): boolean {
  if (pos <= 0 || pos >= remaining.length) return false;
  const after = remaining[pos];
  const before = remaining[pos - 1];
  // Don't break if next char can't start a line
  if (NO_START.has(after)) return false;
  // Don't break if previous char can't end a line
  if (NO_END.has(before)) return false;
  return true;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number, charSpacing = 0, condense = 0): WLine[] {
  if (!text || maxWidth <= 0) return [];
  const lines: WLine[] = [];
  /** measureText + charSpacing adjustment, with condense scaling */
  const condenseFactor = condense > 0 ? (100 - condense) / 100 : 1;
  const measure = (t: string) => {
    let w = measureText(t, font, fontSize);
    if (condenseFactor !== 1) w *= condenseFactor;
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

      // Find best break point — space-based word boundary, then force at max fit
      // NOTE: CJK kinsoku (canBreakAt) disabled — caused +401 page regression in v38
      let brk = -1;
      // Try to find a space break (word boundary) looking back from lo
      for (let i = lo; i > Math.max(0, lo - 15); i--) {
        if (remaining.charCodeAt(i) === 32) {
          brk = i + 1; // break after space
          break;
        }
      }
      // No space found — force break at max fit position
      if (brk < 0) brk = lo;

      if (brk <= 0) brk = lo;
      const lineText = remaining.substring(0, brk);
      lines.push({ text: lineText, width: measure(lineText), isWrapped: true });
      remaining = remaining.substring(brk);
      // Trim leading spaces on continuation lines (but not CJK)
      if (remaining.charCodeAt(0) === 32) remaining = remaining.trimStart();
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
  highlightColor?: [number, number, number],
  condense = 0,
): number {
  // Draw highlight background if present
  if (highlightColor && text.trim().length > 0) {
    const tw = measureText(text, font, fontSize) + (charSpacing ? charSpacing * Math.max(0, text.length - 1) : 0);
    page.drawRectangle({
      x,
      y: y - fontSize * 0.25,
      width: tw,
      height: fontSize * 1.3,
      color: rgb(...highlightColor),
    });
  }

  // Faux bold: FillThenStroke rendering mode with thin stroke width
  // Faux italic: skew via cm (concat matrix) operator
  const condenseFactor = condense > 0 ? (100 - condense) / 100 : 1;
  const needsWrap = bold || italic || condenseFactor !== 1;

  if (needsWrap) {
    page.pushOperators(pushGraphicsState());
    if (condenseFactor !== 1) {
      // Apply horizontal scaling via text matrix
      // concatTransformationMatrix scales x by condenseFactor around the text origin
      page.pushOperators(concatTransformationMatrix(condenseFactor, 0, 0, 1, x * (1 - condenseFactor), 0));
    }
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
    const baseW = measureText(text, font, fontSize) + (charSpacing ? charSpacing * Math.max(0, text.length - 1) : 0);
    return condenseFactor !== 1 ? baseW * condenseFactor : baseW;
  } catch {
    for (const ch of text) {
      try {
        page.drawText(ch, { x: drawX, y, size: fontSize, font, color: rgb(...color) });
        if (ch === ' ') {
          const actualW = font.widthOfTextAtSize(' ', fontSize);
          const targetW = fontSize * 0.22;
          drawX += (actualW > targetW ? targetW : actualW) + charSpacing;
        } else {
          drawX += font.widthOfTextAtSize(ch, fontSize) + charSpacing;
        }
      } catch {
        drawX += fontSize * ((ch.codePointAt(0) ?? 0) > 0x2E80 ? 1.0 : 0.5) + charSpacing;
      }
    }
    if (needsWrap) page.pushOperators(popGraphicsState());
    const fallbackW = drawX - x;
    return condenseFactor !== 1 ? fallbackW * condenseFactor : fallbackW;
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

// ── Floating position detection ──

interface FloatingPos {
  treatAsChar: boolean;
  vertRelTo: string;   // PAPER, PAGE, PARA, etc.
  horzRelTo: string;   // PAPER, PAGE, COLUMN, PARA, etc.
  vertAlign: string;
  horzAlign: string;
  vertOffset: number;  // HWP units
  horzOffset: number;  // HWP units
  width: number;       // HWP units (from hp:sz)
  height: number;      // HWP units (from hp:sz)
}

/** Extract floating position info from a shape/image element */
function getFloatingPos(element: GenericElement): FloatingPos | null {
  const posEl = element.children.find(c => {
    const t = c.tag.includes(':') ? c.tag.split(':').pop()! : c.tag;
    return t === 'pos';
  });
  if (!posEl) return null;

  const treatAsChar = posEl.attrs['treatAsChar'] !== '0';
  if (treatAsChar) return null; // inline, not floating

  const szEl = element.children.find(c => {
    const t = c.tag.includes(':') ? c.tag.split(':').pop()! : c.tag;
    return t === 'sz';
  });
  const width = Number(szEl?.attrs['width'] ?? 0);
  const height = Number(szEl?.attrs['height'] ?? 0);

  // Handle unsigned 32-bit overflow for negative offsets (e.g. 4294898560 → -68736)
  let vertOffset = Number(posEl.attrs['vertOffset'] ?? 0);
  let horzOffset = Number(posEl.attrs['horzOffset'] ?? 0);
  if (vertOffset > 2147483647) vertOffset = vertOffset - 4294967296;
  if (horzOffset > 2147483647) horzOffset = horzOffset - 4294967296;

  return {
    treatAsChar: false,
    vertRelTo: posEl.attrs['vertRelTo'] ?? 'PARA',
    horzRelTo: posEl.attrs['horzRelTo'] ?? 'COLUMN',
    vertAlign: posEl.attrs['vertAlign'] ?? 'TOP',
    horzAlign: posEl.attrs['horzAlign'] ?? 'LEFT',
    vertOffset,
    horzOffset,
    width,
    height,
  };
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
          const lh = calcLineHeight(cps, cts.fontSize, cf);
          for (const cc of cr.children) {
            if (cc.type === 'text') {
              const text = cc.content;
              if (!text) { h += lh; continue; }
              h += wrapText(text, cf, cts.fontSize, Math.max(innerW, 1), cts.charSpacing, cps.condense).length * lh;
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
      } else if (ext === 'gif') {
        // GIF: extract first frame as PNG-compatible data
        // pdf-lib only supports PNG/JPEG — try embedding as PNG (works for single-frame GIFs
        // that share the same LZW-compressed structure)
        try { data = gifToPng(data); format = 'png'; } catch { continue; }
      } else if (ext === 'tif' || ext === 'tiff') {
        // TIFF: skip — pdf-lib doesn't support TIFF and conversion is complex
        continue;
      } else if (ext === 'wmf' || ext === 'emf') {
        // WMF/EMF: Windows vector formats — cannot convert without native dependencies
        continue;
      }
      if (format === 'png') imageCache.set(img.path, await pdfDoc.embedPng(data));
      else if (format === 'jpg' || format === 'jpeg') imageCache.set(img.path, await pdfDoc.embedJpg(data));
    } catch { /* skip */ }
  }

  // Helper: find image by binRef with exact basename matching (avoid image1 matching image10)
  function findImageByRef(binRef: string) {
    if (!binRef) return undefined;
    // Try exact path match first
    let img = doc.images.find(i => i.path === binRef || i.path === `BinData/${binRef}`);
    if (img) return img;
    // Try matching basename (without extension) — binRef is usually like "image1"
    // and path is "BinData/image1.PNG"
    const refLower = binRef.toLowerCase();
    img = doc.images.find(i => {
      const fname = i.path.split('/').pop() ?? '';
      const base = fname.substring(0, fname.lastIndexOf('.')).toLowerCase();
      return base === refLower;
    });
    if (img) return img;
    // Fallback: includes match
    return doc.images.find(i => i.path.includes(binRef));
  }

  // Track pages that have actual body content rendered (for empty page removal)
  const pagesWithContent = new Set<PDFPage>();

  for (const section of doc.sections) {
    const sp = section.sectionProps;

    // Handle landscape (NARROWLY): swap width/height since HWPX stores portrait dimensions
    const isLandscape = sp?.landscape ?? false;
    const rawW = sp ? hwpToPt(sp.pageWidth) : 595.28;
    const rawH = sp ? hwpToPt(sp.pageHeight) : 841.89;
    const pageW = isLandscape && rawW < rawH ? rawH : rawW;
    const pageH = isLandscape && rawW < rawH ? rawW : rawH;
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

    // Track column separator info per page for post-rendering
    interface ColSepInfo { layouts: ColLayout[]; separator?: { type: string; width: string; color: string } }
    const pageColSeps = new Map<PDFPage, ColSepInfo>();
    function recordColSep() {
      if (colLayouts.length > 1) {
        const sep = sp?.columns?.separator;
        pageColSeps.set(page, { layouts: [...colLayouts], separator: sep });
      }
    }
    recordColSep();

    // ── Per-section header/footer collection ──
    const sectionHeaders: import('@handoc/hwpx-parser').HeaderFooter[] = [];
    const sectionFooters: import('@handoc/hwpx-parser').HeaderFooter[] = [];
    for (const para of section.paragraphs) {
      for (const run of para.runs) {
        for (const child of run.children) {
          if (child.type === 'ctrl') {
            const hf = parseHeaderFooter(child.element);
            if (hf) {
              if (hf.type === 'header') sectionHeaders.push(hf);
              else sectionFooters.push(hf);
            }
          }
        }
      }
    }

    // ── Footnote tracking ──
    let footnoteCounter = 0;
    const pageFootnotes = new Map<PDFPage, { num: number; text: string; lines: WLine[] }[]>();
    /** Estimated footnote area height per page (used to reduce available body space) */
    const pageFootnoteHeight = new Map<PDFPage, number>();

    function newColumn() {
      curCol++;
      if (curCol >= colLayouts.length) {
        // All columns full — new page
        page = pdfDoc.addPage([pageW, pageH]);
        sectionPages.push(page);
        curCol = 0;
        recordColSep();
      }
      curY = pageH - mT;
    }

    function newPage() {
      page = pdfDoc.addPage([pageW, pageH]);
      sectionPages.push(page);
      curY = pageH - mT;
      curCol = 0;
      recordColSep();
    }

    function checkBreak(h: number) {
      const fnH = pageFootnoteHeight.get(page) ?? 0;
      if (curY - h < mB + fnH) {
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
                // Parse inline column separator line
                const inlineColLine = colPrEl.children.find((c: GenericElement) => c.tag === 'colLine');
                if (inlineColLine && sp) {
                  if (!sp.columns) sp.columns = { count: newColCount, gap: 0, type: 'NEWSPAPER' };
                  sp.columns.separator = {
                    type: inlineColLine.attrs['type'] ?? 'SOLID',
                    width: inlineColLine.attrs['width'] ?? '0.12 mm',
                    color: inlineColLine.attrs['color'] ?? '#000000',
                  };
                }
                curCol = 0;
                curY = pageH - mT;
                recordColSep();
              } else {
                // Back to single column
                colLayouts.length = 0;
                colLayouts.push({ x: mL, width: cW });
                curCol = 0;
                recordColSep();
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

      // ── LineSeg-based rendering: use pre-computed line layout from HWPX ──
      const lineSegs = para.lineSegArray;
      const useLineSeg = lineSegs.length > 1; // Only use lineseg for multi-line paragraphs
      if (useLineSeg) {
        // Step 1: Collect all text content and styled spans from runs
        interface StyledSpan { text: string; ts: TextStyle; font: PDFFont; start: number; end: number; }
        const spans: StyledSpan[] = [];
        let fullText = '';
        const nonTextChildren: Array<{ type: string; child: any; ts: TextStyle; font: PDFFont }> = [];

        for (const run of para.runs) {
          const ts = resolveTextStyle(doc, run.charPrIDRef);
          const font = getFont(ts);
          for (const child of run.children) {
            if (child.type === 'text' && child.content) {
              let content = child.content;
              if (paraPrefix && !prefixApplied) {
                content = paraPrefix + content;
                prefixApplied = true;
              }
              const start = fullText.length;
              fullText += content;
              spans.push({ text: content, ts, font, start, end: fullText.length });
            } else if (child.type !== 'text') {
              nonTextChildren.push({ type: child.type, child, ts, font });
            }
          }
        }

        if (fullText.length > 0) {
          // Step 2: Split text into lines by lineseg textpos boundaries
          let prevVertPos = -1;
          for (let si = 0; si < lineSegs.length; si++) {
            const seg = lineSegs[si];
            const nextSeg = lineSegs[si + 1];
            const lineStart = seg.textpos;
            const lineEnd = nextSeg ? nextSeg.textpos : fullText.length;
            if (lineStart >= fullText.length) break;
            const lineText = fullText.substring(lineStart, Math.min(lineEnd, fullText.length)).replace(/\n$/, '');
            if (!lineText && si > 0) continue; // Skip empty continuation lines

            // Page break detection: vertpos resets to a smaller value
            if (prevVertPos >= 0 && seg.vertpos < prevVertPos - 100) {
              newPage();
            }
            prevVertPos = seg.vertpos;

            // Compute Y position from lineseg vertpos (relative to page content top)
            const segVertPt = hwpToPt(seg.vertpos);
            const segBaselinePt = hwpToPt(seg.baseline);
            const segHorzPosPt = hwpToPt(seg.horzpos);
            const segHorzSizePt = hwpToPt(seg.horzsize);

            // Use absolute positioning from lineseg
            const lineY = pageH - mT - segVertPt - segBaselinePt;

            // Compute X position
            const activeCol = colLayouts[curCol];
            const basePL = activeCol.x + ps.marginLeft;
            let x = basePL + segHorzPosPt;

            // Find spans that overlap this line's character range
            const lineSpans: Array<{ text: string; ts: TextStyle; font: PDFFont }> = [];
            for (const span of spans) {
              const overlapStart = Math.max(span.start, lineStart);
              const overlapEnd = Math.min(span.end, lineEnd);
              if (overlapStart < overlapEnd) {
                const subText = span.text.substring(overlapStart - span.start, overlapEnd - span.start);
                if (subText) lineSpans.push({ text: subText, ts: span.ts, font: span.font });
              }
            }

            // Measure total line width for alignment
            let totalLineW = 0;
            for (const ls of lineSpans) {
              totalLineW += measureText(ls.text, ls.font, ls.ts.fontSize);
              if (ls.ts.charSpacing && ls.text.length > 1) totalLineW += ls.ts.charSpacing * (ls.text.length - 1);
            }

            // Apply alignment
            const effectiveW = segHorzSizePt;
            let justifyCs = 0;
            if (ps.align === 'center') x += (effectiveW - totalLineW) / 2;
            else if (ps.align === 'right') x += effectiveW - totalLineW;
            else if (ps.align === 'justify' && si < lineSegs.length - 1 && lineText.length > 1) {
              const extra = effectiveW - totalLineW;
              justifyCs = extra / (lineText.length - 1);
            }

            // Draw each styled span
            let drawX = x;
            for (const ls of lineSpans) {
              const spanJustifyCs = ls.ts.charSpacing + justifyCs;
              drawText(page, ls.text, drawX, lineY, ls.font, ls.ts.fontSize, ls.ts.color, spanJustifyCs, ls.ts.bold, ls.ts.italic, ls.ts.highlightColor, ps.condense);

              let spanW = measureText(ls.text, ls.font, ls.ts.fontSize);
              if (spanJustifyCs && ls.text.length > 1) spanW += spanJustifyCs * (ls.text.length - 1);
              const condenseFactor = ps.condense > 0 ? (100 - ps.condense) / 100 : 1;
              if (condenseFactor !== 1) spanW *= condenseFactor;

              if (ls.ts.underline) {
                page.drawLine({
                  start: { x: drawX, y: lineY - 2 },
                  end: { x: drawX + spanW, y: lineY - 2 },
                  thickness: 0.5,
                  color: rgb(...ls.ts.color),
                });
              }
              if (ls.ts.strikeout) {
                page.drawLine({
                  start: { x: drawX, y: lineY + ls.ts.fontSize * 0.35 },
                  end: { x: drawX + spanW, y: lineY + ls.ts.fontSize * 0.35 },
                  thickness: 0.5,
                  color: rgb(...ls.ts.color),
                });
              }

              drawX += spanW;
            }

            // Update curY to track position for subsequent elements
            curY = lineY;
            hasContent = true;
            firstLine = false;
          }

          // After lineseg rendering, set curY below the last line
          if (lineSegs.length > 0) {
            const lastSeg = lineSegs[lineSegs.length - 1];
            const lastSegBottom = hwpToPt(lastSeg.vertpos + lastSeg.vertsize + lastSeg.spacing);
            curY = pageH - mT - lastSegBottom;
          }
        }

        // Handle non-text children (tables, inline objects, etc.)
        for (const ntc of nonTextChildren) {
          if (ntc.child.type === 'table') {
            hasContent = true;
            const activeCol = colLayouts[curCol];
            renderTable(doc, ntc.child.element, activeCol.x + ps.marginLeft, activeCol.width - ps.marginLeft - ps.marginRight, getFont);
          } else if (ntc.child.type === 'inlineObject') {
            hasContent = true;
            const activeCol = colLayouts[curCol];
            const activePL = activeCol.x + ps.marginLeft;
            const activePW = activeCol.width - ps.marginLeft - ps.marginRight;
            const floatPos = getFloatingPos(ntc.child.element);
            if (floatPos) {
              renderFloatingElement(doc, ntc.child, floatPos, getFont, ntc.font, ntc.ts, ps);
              if (floatPos.vertRelTo === 'PARA') {
                const fh = floatPos.height > 0 ? hwpToPt(floatPos.height) : 0;
                if (fh > 0) { checkBreak(fh); curY -= fh; }
              }
            } else if (ntc.child.name === 'picture' || ntc.child.name === 'pic') {
              renderImage(doc, ntc.child.element, activePL, activePW);
            } else {
              renderShapeContent(doc, ntc.child.element, activePL, activePW, ntc.font, ntc.ts, ps, getFont);
            }
          } else if (ntc.child.type === 'ctrl') {
            const fn = parseFootnote(ntc.child.element);
            if (fn) {
              footnoteCounter++;
              const fnText = extractAnnotationText(fn);
              const fnFontLocal = fonts.sans;
              const fnFontSizeLocal = 8;
              const fnLineHLocal = fnFontSizeLocal * 1.4;
              const fnNumStr = `${footnoteCounter}) `;
              const fnNumW = measureText(fnNumStr, fnFontLocal, fnFontSizeLocal);
              const fnTextWidth = cW - fnNumW;
              const fnLines = wrapText(fnText, fnFontLocal, fnFontSizeLocal, Math.max(fnTextWidth, 1));
              if (!pageFootnotes.has(page)) pageFootnotes.set(page, []);
              pageFootnotes.get(page)!.push({ num: footnoteCounter, text: fnText, lines: fnLines });
              const fns = pageFootnotes.get(page)!;
              let totalFnLines = 0;
              for (const f of fns) totalFnLines += f.lines.length;
              const newFnH = fnLineHLocal * totalFnLines + 10;
              pageFootnoteHeight.set(page, newFnH);
            }
          }
        }

        // Skip empty paragraph handling if lineseg had content
        if (!hasContent) {
          const defaultTs = resolveTextStyle(doc, para.runs[0]?.charPrIDRef ?? null);
          const defaultLineH = calcLineHeight(ps, defaultTs.fontSize, getFont(defaultTs));
          const emptyH = defaultLineH * 0.75;
          checkBreak(emptyH);
          curY -= emptyH;
        } else {
          pagesWithContent.add(page);
        }
        curY -= ps.marginBottom;
        continue; // Skip the regular run-by-run rendering below
      }

      for (const run of para.runs) {
        const ts = resolveTextStyle(doc, run.charPrIDRef);
        const font = getFont(ts);
        const lineH = calcLineHeight(ps, ts.fontSize, font);

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
              const firstLines = wrapText(content, font, ts.fontSize, firstLineWidth, ts.charSpacing, ps.condense);
              if (firstLines.length <= 1) {
                lines = firstLines;
              } else {
                // Take only the first line, re-wrap the rest at continuation width
                lines = [firstLines[0]];
                const usedText = firstLines[0].text;
                const remaining = content.substring(usedText.length).trimStart();
                if (remaining) {
                  lines.push(...wrapText(remaining, font, ts.fontSize, contWidth, ts.charSpacing, ps.condense));
                }
              }
            } else {
              lines = wrapText(content, font, ts.fontSize, curPW, ts.charSpacing, ps.condense);
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
              drawText(page, line.text, x, textY, font, ts.fontSize, ts.color, justifyCs, ts.bold, ts.italic, ts.highlightColor, ps.condense);

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
            // Check for floating positioning (treatAsChar="0")
            const floatPos = getFloatingPos(child.element);
            if (floatPos) {
              renderFloatingElement(doc, child, floatPos, getFont, font, ts, ps);
              // PARA-relative floating elements (vertRelTo=PARA, vertOffset=0) act like
              // anchored-in-place images — advance curY so content doesn't overlap.
              if (floatPos.vertRelTo === 'PARA') {
                const fh = floatPos.height > 0 ? hwpToPt(floatPos.height) : 0;
                if (fh > 0) { checkBreak(fh); curY -= fh; }
              }
            } else if (child.name === 'picture' || child.name === 'pic') {
              renderImage(doc, child.element, activePL, activePW);
            } else {
              // Shape/drawing: render internal content (tables, images, text)
              renderShapeContent(doc, child.element, activePL, activePW, font, ts, ps, getFont);
            }
          } else if (child.type === 'ctrl') {
            // Check for footnote/endnote
            const fn = parseFootnote(child.element);
            if (fn) {
              footnoteCounter++;
              const fnText = extractAnnotationText(fn);

              // Pre-wrap footnote text for accurate height estimation
              const fnFontLocal = fonts.sans;
              const fnFontSizeLocal = 8;
              const fnLineHLocal = fnFontSizeLocal * 1.4;
              const fnNumStr = `${footnoteCounter}) `;
              const fnNumW = measureText(fnNumStr, fnFontLocal, fnFontSizeLocal);
              const fnTextWidth = cW - fnNumW;
              const fnLines = wrapText(fnText, fnFontLocal, fnFontSizeLocal, Math.max(fnTextWidth, 1));

              // Collect footnote for rendering at page bottom
              if (!pageFootnotes.has(page)) pageFootnotes.set(page, []);
              pageFootnotes.get(page)!.push({ num: footnoteCounter, text: fnText, lines: fnLines });

              // Update footnote height reservation for this page
              const fns = pageFootnotes.get(page)!;
              let totalFnLines = 0;
              for (const f of fns) totalFnLines += f.lines.length;
              const newFnH = fnLineHLocal * totalFnLines + 10; // 10pt for separator + spacing
              pageFootnoteHeight.set(page, newFnH);
            }
          }
        }
      }

      // If paragraph had no content at all, advance by reduced height
      // Empty paragraphs in HWP typically render shorter than full line height
      if (!hasContent) {
        const defaultLineH = calcLineHeight(ps, 10, fonts.serif);
        const emptyLineH = defaultLineH * 0.75;
        checkBreak(emptyLineH);
        curY -= emptyLineH;
      } else {
        pagesWithContent.add(page);
      }

      curY -= ps.marginBottom;
    }


    // ── Table rendering with proper rowSpan/colSpan support ──
    function renderTable(doc: HanDoc, element: GenericElement, tableX: number, maxWidth: number, getFont: (s: TextStyle) => PDFFont) {
      const tbl = parseTable(element);
      const szEl = element.children.find(c => c.tag === 'sz');
      const tblW = szEl ? hwpToPt(Number(szEl.attrs['width'])) : maxWidth;

      // ── Build grid column widths ──
      // First pass: collect widths from colSpan=1 cells
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

      // Second pass: infer missing column widths from multi-span cells.
      // Sort cells by colSpan ascending so smaller spans fill first.
      const multiSpanCells: { col: number; span: number; width: number }[] = [];
      for (const row of tbl.rows) {
        for (const cell of row.cells) {
          if (cell.cellSpan.colSpan > 1 && cell.cellSz.width > 0) {
            multiSpanCells.push({
              col: cell.cellAddr.colAddr,
              span: cell.cellSpan.colSpan,
              width: hwpToPt(cell.cellSz.width),
            });
          }
        }
      }
      multiSpanCells.sort((a, b) => a.span - b.span);
      for (const mc of multiSpanCells) {
        let knownInSpan = 0;
        let unknownInSpan = 0;
        for (let i = mc.col; i < Math.min(mc.col + mc.span, tbl.colCnt); i++) {
          if (colWidths[i] > 0) knownInSpan += colWidths[i];
          else unknownInSpan++;
        }
        if (unknownInSpan > 0 && mc.width > knownInSpan) {
          const eachUnknown = (mc.width - knownInSpan) / unknownInSpan;
          for (let i = mc.col; i < Math.min(mc.col + mc.span, tbl.colCnt); i++) {
            if (colWidths[i] === 0) colWidths[i] = eachUnknown;
          }
        }
      }

      // Fill any remaining missing columns with equal distribution
      const knownW = colWidths.reduce((a, b) => a + b, 0);
      const missingCols = colWidths.filter(w => w === 0).length;
      if (missingCols > 0 && tblW > knownW) {
        const eachW = (tblW - knownW) / missingCols;
        for (let i = 0; i < colWidths.length; i++) {
          if (colWidths[i] === 0) colWidths[i] = eachW;
        }
      }

      // HWP-converted timetable tables often omit <tbl><sz>, while each cell keeps
      // small base widths/heights (e.g., 1500/1000) that must be scaled to page width.
      // When this pattern is detected, scale table geometry uniformly.
      let tableScale = 1;
      const colSum = colWidths.reduce((a, b) => a + b, 0);
      if (!szEl && tbl.colCnt >= 10 && colSum > 0) {
        const ratio = maxWidth / colSum;
        if (ratio > 1.15 && ratio < 1.8) {
          tableScale = ratio;
          for (let i = 0; i < colWidths.length; i++) colWidths[i] *= tableScale;
        }
      }

      // Column X offsets
      const colX: number[] = [0];
      for (let i = 0; i < colWidths.length; i++) {
        colX.push(colX[i] + colWidths[i]);
      }

      // Helper: get cell width — prefer cell's declared width for accuracy in
      // complex merged tables where the grid column widths may be inaccurate.
      function gridCellW(cell: any): number {
        const declW = cell.cellSz.width > 0 ? hwpToPt(cell.cellSz.width) : 0;
        if (declW > 0) return declW;
        const ci = cell.cellAddr.colAddr;
        const cs = cell.cellSpan.colSpan;
        if (ci + cs <= colX.length) return colX[ci + cs] - colX[ci];
        return (tblW / tbl.colCnt) * cs;
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
        // HWP declared row height is a minimum; content can expand rows.
        // estimateCellHeight already applies a 50% discount on excess over
        // declared height to compensate for wider embedded fonts. Apply a
        // light row-level cap only for very dense tables to prevent over-
        // expansion, but keep it generous to avoid content clipping.
        if (declaredRowH > 0 && rh > declaredRowH) {
          const maxExpansion = tbl.rows.length > 30 ? 0.6 : 1.0;
          const excess = rh - declaredRowH;
          rh = declaredRowH + excess * maxExpansion;
        }
        rowHeights.push(rh);
      }

      // Adjust for rowSpan>1 cells (skip for dense tables to preserve layout)
      if (tbl.rows.length <= 20) {
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
      }

      if (tableScale > 1) {
        for (let i = 0; i < rowHeights.length; i++) rowHeights[i] *= tableScale;
      }

      // ── Pass 2: Render ──
      for (let ri = 0; ri < tbl.rows.length; ri++) {
        let rowH = Math.min(rowHeights[ri], contentH);

        // Page break: when a row doesn't fit in remaining space, move to
        // next page. Previously attempted partial row rendering, but that
        // caused content loss since the remainder was never re-rendered.
        const remaining = curY - mB;
        if (remaining < rowH) {
          newPage();
        }

        // Compute cell X positions per-row by accumulating declared cell widths.
        // This is more accurate than the grid for complex merged tables.
        let rowCellX = tableX;
        for (const cell of tbl.rows[ri].cells) {
          const ci = cell.cellAddr.colAddr;
          const cellW = gridCellW(cell);
          const cellX = rowCellX;

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

          // Cell borders (draw each side individually with proper type/dash/double)
          const bx = cellX, by = curY - cellH;
          drawBorderLine(page, { x: bx, y: by }, { x: bx, y: by + cellH }, bf.left);
          drawBorderLine(page, { x: bx + cellW, y: by }, { x: bx + cellW, y: by + cellH }, bf.right);
          drawBorderLine(page, { x: bx, y: by + cellH }, { x: bx + cellW, y: by + cellH }, bf.top);
          drawBorderLine(page, { x: bx, y: by }, { x: bx + cellW, y: by }, bf.bottom);
          // Diagonal border (top-left to bottom-right)
          if (bf.diagonal.type !== 'NONE' && bf.diagonal.width > 0) {
            drawBorderLine(page, { x: bx, y: by + cellH }, { x: bx + cellW, y: by }, bf.diagonal);
          }

          // Cell text
          renderCellContent(doc, cell, cellX, curY, cellW, cellH, getFont);
          pagesWithContent.add(page);
          rowCellX += cellW;
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
        // Use lineseg data when available — 한/글's pre-computed line layout
        // gives much more accurate heights than wrapText + calcLineHeight
        const cellLineSegs = cp.lineSegArray ?? [];
        if (cellLineSegs.length > 0) {
          let hasNonTextContent = false;
          for (const cr of cp.runs) {
            for (const cc of cr.children) {
              if (cc.type === 'table' || (cc.type === 'inlineObject' && (cc.name === 'pic' || cc.name === 'picture')) || cc.type === 'shape') {
                hasNonTextContent = true; break;
              }
            }
            if (hasNonTextContent) break;
          }
          if (!hasNonTextContent) {
            for (const seg of cellLineSegs) {
              h += hwpToPt(seg.vertsize + seg.spacing);
            }
            h += cps.marginBottom;
            continue;
          }
        }
        // Fallback: wrapText-based estimation (no lineseg or non-text content)
        for (const cr of cp.runs) {
          const cts = resolveTextStyle(doc, cr.charPrIDRef);
          const cf = getFont(cts);
          const lh = calcLineHeight(cps, cts.fontSize, cf);
          for (const cc of cr.children) {
            if (cc.type === 'text') {
              const text = cc.content;
              if (!text) { h += lh; continue; }
              h += wrapText(text, cf, cts.fontSize, Math.max(innerW, 1), cts.charSpacing, cps.condense).length * lh;
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
      // Declared height is a minimum — content can legitimately exceed it (e.g. long
      // text in narrow cells that auto-expand in HWP). Our embedded fonts are ~30%
      // wider than native Korean fonts, causing extra text wrapping that inflates
      // height estimates. Discount the excess to compensate, but keep enough to
      // prevent content clipping (which causes missing pages).
      if (cellDeclaredH > 0 && h > cellDeclaredH) {
        return cellDeclaredH + (h - cellDeclaredH) * 0.5;
      }
      return Math.max(cellDeclaredH, h);
    }

    /** Render cell content (text + nested tables). Returns actual content height used. */
    function renderCellContent(doc: HanDoc, cell: any, cellX: number, cellTop: number, cellW: number, cellH: number, getFont: (s: TextStyle) => PDFFont): number {
      const cm = getCellPadding(cell);
      const innerW = cellW - cm.left - cm.right;
      // Vertical alignment: estimate content height first
      const vAlign = cell.vertAlign ?? 'TOP';
      let contentHeight = 0;
      if (vAlign === 'CENTER' || vAlign === 'BOTTOM') {
        contentHeight = estimateCellHeight(doc, cell, cellW, getFont) - cm.top - cm.bottom;
      }
      let yOffset = 0;
      const innerH = cellH - cm.top - cm.bottom;
      if (vAlign === 'CENTER') yOffset = Math.max(0, (innerH - contentHeight) / 2);
      else if (vAlign === 'BOTTOM') yOffset = Math.max(0, innerH - contentHeight);

      let ty = cellTop - cm.top - yOffset;
      for (const cp of cell.paragraphs) {
        const cps = resolveParaStyle(doc, cp.paraPrIDRef);
        ty -= cps.marginTop;
        for (const cr of cp.runs) {
          const cts = resolveTextStyle(doc, cr.charPrIDRef);
          const cf = getFont(cts);
          const lh = calcLineHeight(cps, cts.fontSize, cf);
          for (const cc of cr.children) {
            if (cc.type === 'text') {
              const text = cc.content;
              if (!text) { ty -= lh; continue; }
              const cls = wrapText(text, cf, cts.fontSize, Math.max(innerW, 1), cts.charSpacing, cps.condense);
              for (const cl of cls) {
                ty -= cts.fontSize;
                let tx = cellX + cm.left;
                let cellJustifyCs = cts.charSpacing;
                if (cps.align === 'center') tx = cellX + cm.left + (innerW - cl.width) / 2;
                else if (cps.align === 'right') tx = cellX + cellW - cm.right - cl.width;
                else if (cps.align === 'justify' && cl.isWrapped && cl.text.length > 1) {
                  const extra = innerW - cl.width;
                  cellJustifyCs = cts.charSpacing + extra / (cl.text.length - 1);
                }
                if (ty > cellTop - cellH) {
                  drawText(page, cl.text, tx, ty, cf, cts.fontSize, cts.color, cellJustifyCs, cts.bold, cts.italic, cts.highlightColor, cps.condense);

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
      // Return actual content height consumed
      return cellTop - ty;
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
      const img = findImageByRef(binRef);
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
      pagesWithContent.add(page);
      curY -= h;
    }

    // ── Floating element rendering (absolute positioning) ──
    function renderFloatingElement(
      doc: HanDoc,
      child: { type: string; name: string; element: GenericElement },
      fp: FloatingPos,
      getFont: (s: TextStyle) => PDFFont,
      defaultFont: PDFFont, defaultTs: TextStyle, defaultPs: ParaStyle,
    ) {
      const w = fp.width > 0 ? hwpToPt(fp.width) : 100;
      const h = fp.height > 0 ? hwpToPt(fp.height) : 50;

      // Compute absolute X position
      let x: number;
      if (fp.horzRelTo === 'PAPER' || fp.horzRelTo === 'PAGE') {
        x = hwpToPt(fp.horzOffset);
      } else if (fp.horzRelTo === 'COLUMN') {
        const activeCol = colLayouts[curCol];
        x = activeCol.x + hwpToPt(fp.horzOffset);
      } else {
        // PARA or other — relative to current paragraph position
        const activeCol = colLayouts[curCol];
        x = activeCol.x + hwpToPt(fp.horzOffset);
      }

      // Compute absolute Y position (PDF Y is bottom-up)
      let y: number;
      if (fp.vertRelTo === 'PAPER' || fp.vertRelTo === 'PAGE') {
        // From top of page
        y = pageH - hwpToPt(fp.vertOffset) - h;
      } else {
        // PARA or other — relative to current Y position
        y = curY - hwpToPt(fp.vertOffset) - h;
      }

      // Clamp to page bounds
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x + w > pageW) x = pageW - w;

      // Render the element at absolute position
      if (child.name === 'picture' || child.name === 'pic') {
        // Direct image draw at absolute position
        const fileRef = findDesc(child.element, 'fileRef');
        const imgTag = findDesc(child.element, 'img');
        const binRef = fileRef?.attrs['binItemIDRef']
          ?? imgTag?.attrs['binaryItemIDRef']
          ?? imgTag?.attrs['binItemIDRef']
          ?? '';
        if (binRef) {
          const img = findImageByRef(binRef);
          if (img) {
            const pdfImg = imageCache.get(img.path);
            if (pdfImg) {
              page.drawImage(pdfImg, { x, y, width: w, height: h });
              pagesWithContent.add(page);
            }
          }
        }
      } else {
        // Shape: save/restore curY and render content at absolute position
        const savedCurY = curY;
        const savedPage = page;
        curY = y + h; // Set curY to top of the floating box
        renderShapeContent(doc, child.element, x, w, defaultFont, defaultTs, defaultPs, getFont);
        curY = savedCurY; // Restore — floating doesn't affect text flow
        page = savedPage;
      }
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
              const lineH = calcLineHeight(defaultPs, defaultTs.fontSize, defaultFont);
              const lines = wrapText(text, defaultFont, defaultTs.fontSize, shapeW, defaultTs.charSpacing);
              for (const line of lines) {
                checkBreak(lineH);
                drawText(page, line.text, shapeX, curY - defaultTs.fontSize, defaultFont, defaultTs.fontSize, defaultTs.color);
                curY -= lineH;
              }
              hasContent = true;
              pagesWithContent.add(page);
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
            const lineH = calcLineHeight(defaultPs, defaultTs.fontSize, defaultFont);
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
      // Calculate total footnote area height using pre-wrapped lines
      let totalFnLines = 0;
      for (const fn of footnotes) totalFnLines += fn.lines.length;
      const totalFnH = fnLineH * totalFnLines + 10; // 10pt for separator line + spacing
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

      // Draw each footnote with text wrapping
      for (const fn of footnotes) {
        const numStr = `${fn.num}) `;
        const numW = fnFont.widthOfTextAtSize(numStr, fnFontSize);
        // Draw number on first line
        drawText(pg, numStr, mL, fnY - fnFontSize, fnFont, fnFontSize, [0, 0, 0]);
        // Draw wrapped text lines
        for (let li = 0; li < fn.lines.length; li++) {
          const lineX = li === 0 ? mL + numW : mL + numW; // hanging indent
          drawText(pg, fn.lines[li].text, lineX, fnY - fnFontSize, fnFont, fnFontSize, [0, 0, 0]);
          fnY -= fnLineH;
        }
      }
    }

    // ── Column separator line rendering ──
    for (const [pg, colSep] of pageColSeps) {
      if (!colSep.separator || colSep.layouts.length < 2) continue;
      const sepWidthMm = parseFloat(colSep.separator.width) || 0.12;
      const sepThickness = sepWidthMm * 2.8346; // mm to pt
      const sepColorParsed = parseColor(colSep.separator.color ?? '#000000');
      const sepRgb = sepColorParsed ? rgb(sepColorParsed.red, sepColorParsed.green, sepColorParsed.blue) : rgb(0, 0, 0);
      for (let ci = 0; ci < colSep.layouts.length - 1; ci++) {
        const leftCol = colSep.layouts[ci];
        const rightCol = colSep.layouts[ci + 1];
        const gapCenter = leftCol.x + leftCol.width + (rightCol.x - leftCol.x - leftCol.width) / 2;
        pg.drawLine({
          start: { x: gapCenter, y: pageH - mT },
          end: { x: gapCenter, y: mB },
          thickness: sepThickness,
          color: sepRgb,
        });
      }
    }

    // ── Header/Footer rendering ──
    const headerMarginPt = sp ? hwpToPt(sp.margins.header) : 0;
    const footerMarginPt = sp ? hwpToPt(sp.margins.footer) : 0;
    const pageStartNum = sp?.pageStartNumber ?? 1;
    const hfFont = fonts.sans;
    const hfFontSize = 10;

    // Total page count for {{pages}} placeholder
    const totalPages = sectionPages.length;

    /** Check if a header/footer applies to this page based on applyPageType */
    function hfApplies(applyPageType: string, pageIndex: number, pageNum: number): boolean {
      const apt = applyPageType.toUpperCase();
      if (apt === 'BOTH') return true;
      if (apt === 'EVEN') return pageNum % 2 === 0;
      if (apt === 'ODD') return pageNum % 2 !== 0;
      if (apt === 'FIRST') return pageIndex === 0;
      return true;
    }

    for (let pi = 0; pi < sectionPages.length; pi++) {
      const pg = sectionPages[pi];
      const pageNum = pageStartNum + pi;

      // Helper to replace field placeholders
      const replacePlaceholders = (text: string): string =>
        text.replace(/\{\{page\}\}/g, String(pageNum))
            .replace(/\{\{pages\}\}/g, String(totalPages));

      // Render headers — FIRST takes precedence over BOTH on first page
      const hasFirstHeader = sectionHeaders.some(h => h.applyPageType.toUpperCase() === 'FIRST');
      for (const hdr of sectionHeaders) {
        const apt = hdr.applyPageType.toUpperCase();
        if (!hfApplies(hdr.applyPageType, pi, pageNum)) continue;
        if (pi === 0 && hasFirstHeader && apt === 'BOTH') continue;
        if (pi > 0 && apt === 'FIRST') continue;
        let text = extractAnnotationText(hdr);
        if (!text.trim()) continue;
        text = replacePlaceholders(text);
        const textW = hfFont.widthOfTextAtSize(text, hfFontSize);
        const hdrY = pageH - headerMarginPt - hfFontSize;
        const hdrX = mL + (cW - textW) / 2;
        drawText(pg, text, hdrX, hdrY, hfFont, hfFontSize, [0, 0, 0]);
      }

      // Render footers — FIRST takes precedence over BOTH on first page
      const hasFirstFooter = sectionFooters.some(f => f.applyPageType.toUpperCase() === 'FIRST');
      for (const ftr of sectionFooters) {
        const apt = ftr.applyPageType.toUpperCase();
        if (!hfApplies(ftr.applyPageType, pi, pageNum)) continue;
        if (pi === 0 && hasFirstFooter && apt === 'BOTH') continue;
        if (pi > 0 && apt === 'FIRST') continue;
        let text = extractAnnotationText(ftr);
        if (!text.trim()) continue;
        text = replacePlaceholders(text);
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
          pnX = mL + (cW - numW) / 2;
        }

        let pnY: number;
        if (pos.includes('TOP')) {
          pnY = pageH - headerMarginPt - hfFontSize;
        } else {
          pnY = footerMarginPt;
        }

        drawText(pg, numStr, pnX, pnY, hfFont, hfFontSize, [0, 0, 0]);
      }
    }
  }

  // Empty page removal disabled — was causing regressions where pages with
  // headers/footers/page numbers (but no body text) were incorrectly removed.
  // In HWP documents these pages are intentional and must be preserved.

  return new Uint8Array(await pdfDoc.save());
}
