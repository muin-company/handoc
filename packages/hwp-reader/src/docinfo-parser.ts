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
}

export interface DocInfo {
  fontNames: string[];
  charShapes: CharShape[];
  paraShapes: ParaShape[];
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
 * Layout (first 72+ bytes):
 *   0–13:  7 x uint16 font ID references (per language group)
 *   14–27: 7 x uint16 font width ratios
 *   28–41: 7 x uint16 font char spacing
 *   42–55: 7 x uint16 font relative sizes
 *   56–69: 7 x int16 font char offsets
 *   70–73: int32 height (HU)
 *   74–77: uint32 properties (bit 0=italic, bit 1=bold)
 *   ...
 *   Color at offset 82: uint32 (0xBBGGRR)
 */
function parseCharShape(data: Uint8Array): CharShape | null {
  if (data.byteLength < 86) return null;
  const fontId: number[] = [];
  for (let i = 0; i < 7; i++) {
    fontId.push(readUint16LE(data, i * 2));
  }
  const height = readUint32LE(data, 70);
  const props = readUint32LE(data, 74);
  const italic = !!(props & 1);
  const bold = !!(props & 2);
  const color = readUint32LE(data, 82);
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
function parseParaShape(data: Uint8Array): ParaShape | null {
  if (data.byteLength < 8) return null;
  const props1 = readUint32LE(data, 0);
  const align = (props1 >> 2) & 0x7;
  // Line spacing: offset 16 = lineSpacingType(4 bytes not always present),
  // in practice line spacing value is at different offsets per version.
  // Simple approach: try to get from a known offset.
  let lineSpacing = 160; // default 160%
  if (data.byteLength >= 24) {
    lineSpacing = readUint32LE(data, 20);
  }
  return { align, lineSpacing };
}

/**
 * Parse all DocInfo records into structured info.
 */
export function parseDocInfo(records: HwpRecord[]): DocInfo {
  const fontNames: string[] = [];
  const charShapes: CharShape[] = [];
  const paraShapes: ParaShape[] = [];

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
    }
  }

  return { fontNames, charShapes, paraShapes };
}
