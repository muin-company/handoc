/**
 * Parse BodyText section records into structured paragraphs with formatting and tables.
 */

import { type HwpRecord, HWPTAG } from './record-parser.js';
import { type CharShape, type DocInfo } from './docinfo-parser.js';

export interface ParaCharShapeRange {
  /** Character position (in UTF-16 code units) */
  pos: number;
  /** Index into DocInfo.charShapes */
  charShapeId: number;
}

export interface HwpControl {
  /** Control ID (4-byte ASCII, e.g. 'tbl ' for table) */
  ctrlId: string;
}

export interface HwpTableInfo {
  /** Number of rows */
  rows: number;
  /** Number of columns */
  cols: number;
  /** Cell count per row */
  cellCountPerRow: number[];
}

export interface HwpListHeader {
  /** Number of paragraphs in this list */
  paraCount: number;
  /** Property flags */
  properties: number;
}

export interface HwpParagraph {
  /** Raw text */
  text: string;
  /** Character shape ranges (pos → charShapeId) */
  charShapes: ParaCharShapeRange[];
  /** Para shape ID (index into DocInfo.paraShapes) */
  paraShapeId: number;
  /** Level in record tree */
  level: number;
}

export interface HwpTable {
  info: HwpTableInfo;
  /** Cell paragraphs grouped by cell */
  cells: HwpParagraph[][];
}

export interface SectionContent {
  paragraphs: HwpParagraph[];
  tables: HwpTable[];
  controls: HwpControl[];
}

function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function decodeParaText(data: Uint8Array): string {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const parts: string[] = [];
  let i = 0;
  while (i + 1 < data.byteLength) {
    const ch = view.getUint16(i, true);
    if (ch === 0) { i += 2; }
    else if ((ch >= 1 && ch <= 9) || (ch >= 11 && ch <= 12) || (ch >= 14 && ch <= 23)) { i += 16; }
    else if (ch === 10 || ch === 13) { parts.push('\n'); i += 2; }
    else if (ch >= 24 && ch <= 31) { i += 2; }
    else { parts.push(String.fromCharCode(ch)); i += 2; }
  }
  return parts.join('');
}

function parseParaCharShape(data: Uint8Array): ParaCharShapeRange[] {
  const ranges: ParaCharShapeRange[] = [];
  // Each entry: uint32 pos + uint32 charShapeId
  const count = Math.floor(data.byteLength / 8);
  for (let i = 0; i < count; i++) {
    const pos = readUint32LE(data, i * 8);
    const charShapeId = readUint32LE(data, i * 8 + 4);
    ranges.push({ pos, charShapeId });
  }
  return ranges;
}

function parseCtrlHeader(data: Uint8Array): HwpControl | null {
  if (data.byteLength < 4) return null;
  // Control ID is 4 bytes, stored in reverse order (little-endian DWORD → ASCII)
  const id = readUint32LE(data, 0);
  const ctrlId = String.fromCharCode(
    (id >> 24) & 0xff, (id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff,
  );
  return { ctrlId };
}

function parseTableInfo(data: Uint8Array): HwpTableInfo | null {
  if (data.byteLength < 8) return null;
  // Properties at 0–3, rows at 4–5, cols at 6–7
  const rows = readUint16LE(data, 4);
  const cols = readUint16LE(data, 6);
  const cellCountPerRow: number[] = [];
  // After border fill, there are cellCountPerRow entries
  // Simple: each row has `cols` cells (may be inaccurate for merged cells)
  for (let i = 0; i < rows; i++) {
    cellCountPerRow.push(cols);
  }
  return { rows, cols, cellCountPerRow };
}

function parseListHeader(data: Uint8Array): HwpListHeader | null {
  if (data.byteLength < 8) return null;
  const paraCount = readUint16LE(data, 0);
  const properties = readUint32LE(data, 2);
  return { paraCount, properties };
}

/**
 * Parse a section's records into structured content.
 */
export function parseSectionContent(records: HwpRecord[]): SectionContent {
  const paragraphs: HwpParagraph[] = [];
  const tables: HwpTable[] = [];
  const controls: HwpControl[] = [];

  let currentText = '';
  let currentCharShapes: ParaCharShapeRange[] = [];
  let currentParaShapeId = 0;
  let currentLevel = 0;
  let inPara = false;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    switch (rec.tagId) {
      case HWPTAG.PARA_HEADER: {
        // Flush previous paragraph
        if (inPara) {
          paragraphs.push({
            text: currentText,
            charShapes: currentCharShapes,
            paraShapeId: currentParaShapeId,
            level: currentLevel,
          });
        }
        // New paragraph: para shape ID at offset 6 (uint16)
        currentText = '';
        currentCharShapes = [];
        currentLevel = rec.level;
        currentParaShapeId = rec.data.byteLength >= 8 ? readUint16LE(rec.data, 6) : 0;
        inPara = true;
        break;
      }
      case HWPTAG.PARA_TEXT: {
        currentText = decodeParaText(rec.data);
        break;
      }
      case HWPTAG.PARA_CHAR_SHAPE: {
        currentCharShapes = parseParaCharShape(rec.data);
        break;
      }
      case HWPTAG.CTRL_HEADER: {
        const ctrl = parseCtrlHeader(rec.data);
        if (ctrl) controls.push(ctrl);
        break;
      }
      case HWPTAG.TABLE: {
        const info = parseTableInfo(rec.data);
        if (info) {
          tables.push({ info, cells: [] });
        }
        break;
      }
    }
  }

  // Flush last paragraph
  if (inPara) {
    paragraphs.push({
      text: currentText,
      charShapes: currentCharShapes,
      paraShapeId: currentParaShapeId,
      level: currentLevel,
    });
  }

  return { paragraphs, tables, controls };
}
