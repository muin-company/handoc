/**
 * Parse DocInfo stream records into structured font/style information.
 */

import { type HwpRecord, HWPTAG } from './record-parser.js';

export interface CharShape {
  /** Font ID references (index into fontNames per language group) */
  fontId: number[];
  /** Font height in HU (1/7200 inch). Divide by 100 for pt. */
  height: number;
  /** Bold flag */
  bold: boolean;
  /** Italic flag */
  italic: boolean;
  /** Text color (RGB, 0xBBGGRR) */
  color: number;
}

export interface ParaShape {
  /** Alignment: 0=justify, 1=left, 2=right, 3=center, 4=distribute, 5=split-justify */
  align: number;
  /** Line spacing value (percentage * 100 or HU, depends on type) */
  lineSpacing: number;
  /** Left margin in HWP units */
  leftMargin: number;
  /** Right margin in HWP units */
  rightMargin: number;
  /** First-line indent in HWP units (negative = hanging) */
  indent: number;
}

export interface BinDataItem {
  /** Binary data type: 'link' | 'embedding' | 'storage' */
  type: number;
  /** Absolute path or relative file name */
  absolutePath: string;
  /** Relative path */
  relativePath: string;
  /** BIN_DATA ID (1-based, maps to BinData/BIN%04X in CFB) */
  binDataId: number;
  /** File extension */
  extension: string;
}

export interface DocInfo {
  fontNames: string[];
  charShapes: CharShape[];
  paraShapes: ParaShape[];
  binDataItems: BinDataItem[];
}

function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

/**
 * Parse HWPTAG_FACE_NAME record.
 * Layout: property byte, then uint16 name length (in chars), then UTF-16LE name.
 */
function parseFaceName(data: Uint8Array): string | null {
  if (data.byteLength < 3) return null;
  const prop = data[0];
  const nameLen = readUint16LE(data, 1);
  if (nameLen === 0) return null;
  const nameBytes = data.slice(3, 3 + nameLen * 2);
  const decoder = new TextDecoder('utf-16le');
  let name = decoder.decode(nameBytes);
  // Strip null terminators
  const nullIdx = name.indexOf('\0');
  if (nullIdx >= 0) name = name.substring(0, nullIdx);
  return name;
}

/**
 * Parse HWPTAG_CHAR_SHAPE record.
 * Layout:
 *   0–13:  7 x uint16 font ID references (per language group)
 *   14–20: 7 x uint8 font width ratios
 *   21–27: 7 x int8 font char spacing
 *   28–34: 7 x uint8 font relative sizes
 *   35–41: 7 x int8 font char offsets
 *   42–45: int32 height (HU, divide by 100 for pt)
 *   46–49: uint32 properties (bit 0=italic, bit 1=bold, bit 2=underline, ...)
 *   50–53: shadow spacing
 *   54–57: uint32 text color (0x00BBGGRR)
 */
function parseCharShape(data: Uint8Array): CharShape | null {
  if (data.byteLength < 58) return null;
  const fontId: number[] = [];
  for (let i = 0; i < 7; i++) {
    fontId.push(readUint16LE(data, i * 2));
  }
  const height = readUint32LE(data, 42);
  const props = readUint32LE(data, 46);
  const italic = !!(props & (1 << 0));
  const bold = !!(props & (1 << 1));
  const color = readUint32LE(data, 54);
  return { fontId, height, bold, italic, color };
}

/**
 * Parse HWPTAG_PARA_SHAPE record.
 * Layout:
 *   0–3: uint32 properties1 (bits 2-4 = alignment)
 *   ...
 *   20–23: int32 line spacing value (depends on type in properties1 bits 0-1)
 *   OR at different offsets depending on version. We try offset 16 for line spacing type + value.
 */
/**
 * Parse HWPTAG_PARA_SHAPE record.
 * Layout (HWP 5.x):
 *   0–3:   uint32 properties1 (bits 2-4 = alignment)
 *   4–7:   int32 left margin (HWP units)
 *   8–11:  int32 right margin (HWP units)
 *   12–15: int32 indent (first line, HWP units; negative = hanging)
 *   16–19: int32 top para spacing
 *   20–23: int32 bottom para spacing
 *   24–27: int32 line spacing value
 */
function parseParaShape(data: Uint8Array): ParaShape | null {
  if (data.byteLength < 8) return null;
  const props1 = readUint32LE(data, 0);
  const align = (props1 >> 2) & 0x7;

  let leftMargin = 0;
  let rightMargin = 0;
  let indent = 0;
  let lineSpacing = 160; // default 160%

  if (data.byteLength >= 16) {
    // Margins are signed int32 in HWP units
    leftMargin = readUint32LE(data, 4);
    rightMargin = readUint32LE(data, 8);
    indent = readUint32LE(data, 12);
    // Convert unsigned to signed for indent (can be negative for hanging)
    if (indent > 0x7FFFFFFF) indent = indent - 0x100000000;
  }
  if (data.byteLength >= 28) {
    lineSpacing = readUint32LE(data, 24);
  }
  return { align, lineSpacing, leftMargin, rightMargin, indent };
}

/**
 * Parse HWPTAG_BIN_DATA record.
 * Layout:
 *   0–1: uint16 properties (bits 0-3 = type: 0=link, 1=embedding, 2=storage)
 *   2+:  Depends on type. For embedding: uint16 binDataId, uint16 extLen, UTF-16LE ext
 */
function parseBinData(data: Uint8Array, binDataSeq: number): BinDataItem | null {
  if (data.byteLength < 2) return null;
  const props = readUint16LE(data, 0);
  const type = props & 0xf;
  const decoder = new TextDecoder('utf-16le');

  if (type === 1) {
    // Embedding type: binDataId at offset 2, then extension string
    if (data.byteLength < 6) return null;
    const binDataId = readUint16LE(data, 2);
    const extLen = readUint16LE(data, 4);
    let extension = '';
    if (extLen > 0 && data.byteLength >= 6 + extLen * 2) {
      const extBytes = data.slice(6, 6 + extLen * 2);
      extension = decoder.decode(extBytes).replace(/\0/g, '');
    }
    return {
      type, absolutePath: '', relativePath: '',
      binDataId: binDataId || binDataSeq,
      extension: extension.toLowerCase(),
    };
  } else if (type === 0) {
    // Link type: absolute path, relative path
    let offset = 2;
    const absLen = data.byteLength >= offset + 2 ? readUint16LE(data, offset) : 0;
    offset += 2;
    const absolutePath = absLen > 0 && data.byteLength >= offset + absLen * 2
      ? decoder.decode(data.slice(offset, offset + absLen * 2)).replace(/\0/g, '')
      : '';
    offset += absLen * 2;
    const relLen = data.byteLength >= offset + 2 ? readUint16LE(data, offset) : 0;
    offset += 2;
    const relativePath = relLen > 0 && data.byteLength >= offset + relLen * 2
      ? decoder.decode(data.slice(offset, offset + relLen * 2)).replace(/\0/g, '')
      : '';
    return {
      type, absolutePath, relativePath,
      binDataId: binDataSeq,
      extension: absolutePath.split('.').pop()?.toLowerCase() ?? '',
    };
  }
  return null;
}

/**
 * Parse all DocInfo records into structured info.
 */
export function parseDocInfo(records: HwpRecord[]): DocInfo {
  const fontNames: string[] = [];
  const charShapes: CharShape[] = [];
  const paraShapes: ParaShape[] = [];
  const binDataItems: BinDataItem[] = [];
  let binDataSeq = 1; // 1-based sequence for BinData IDs

  for (const rec of records) {
    switch (rec.tagId) {
      case HWPTAG.FACE_NAME: {
        const name = parseFaceName(rec.data);
        if (name) fontNames.push(name);
        break;
      }
      case HWPTAG.CHAR_SHAPE: {
        const cs = parseCharShape(rec.data);
        if (cs) charShapes.push(cs);
        break;
      }
      case HWPTAG.PARA_SHAPE: {
        const ps = parseParaShape(rec.data);
        if (ps) paraShapes.push(ps);
        break;
      }
      case HWPTAG.BIN_DATA: {
        const bd = parseBinData(rec.data, binDataSeq);
        if (bd) binDataItems.push(bd);
        binDataSeq++;
        break;
      }
    }
  }

  return { fontNames, charShapes, paraShapes, binDataItems };
}
