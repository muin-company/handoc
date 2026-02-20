/**
 * HWP 5.x record structure parser.
 *
 * Each record header is a 32-bit LE DWORD:
 *   - TagID: bits 0–9   (10 bits)
 *   - Level: bits 10–19  (10 bits)
 *   - Size:  bits 20–31  (12 bits)
 *
 * If Size == 0xFFF, the next 4 bytes (LE uint32) hold the actual size.
 */

export interface HwpRecord {
  tagId: number;
  level: number;
  data: Uint8Array;
}

/** HWPTAG_BEGIN = 16; tag = BEGIN + offset */
export const HWPTAG = {
  DOCUMENT_PROPERTIES: 16,    // BEGIN + 0
  ID_MAPPINGS: 17,            // BEGIN + 1
  BIN_DATA: 18,               // BEGIN + 2
  FACE_NAME: 19,              // BEGIN + 3
  BORDER_FILL: 20,            // BEGIN + 4
  CHAR_SHAPE: 21,             // BEGIN + 5
  TAB_DEF: 22,                // BEGIN + 6
  NUMBERING: 23,              // BEGIN + 7
  BULLET: 24,                 // BEGIN + 8
  PARA_SHAPE: 25,             // BEGIN + 9
  STYLE: 26,                  // BEGIN + 10
  PARA_HEADER: 66,            // BEGIN + 50
  PARA_TEXT: 67,              // BEGIN + 51
  PARA_CHAR_SHAPE: 68,        // BEGIN + 52
  PARA_LINE_SEG: 69,          // BEGIN + 53
  CTRL_HEADER: 71,            // BEGIN + 55
  LIST_HEADER: 72,            // BEGIN + 56
  TABLE: 73,                  // BEGIN + 57
  PAGE_DEF: 74,               // BEGIN + 58
} as const;

/**
 * Parse a raw HWP stream (e.g. DocInfo or BodyText/SectionN) into records.
 */
export function parseRecords(stream: Uint8Array): HwpRecord[] {
  const records: HwpRecord[] = [];
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  let offset = 0;

  while (offset + 4 <= stream.byteLength) {
    const header = view.getUint32(offset, true);
    offset += 4;

    const tagId = header & 0x3ff;
    const level = (header >> 10) & 0x3ff;
    let size = (header >> 20) & 0xfff;

    if (size === 0xfff) {
      if (offset + 4 > stream.byteLength) break;
      size = view.getUint32(offset, true);
      offset += 4;
    }

    if (offset + size > stream.byteLength) break;

    const data = stream.slice(offset, offset + size);
    offset += size;

    records.push({ tagId, level, data });
  }

  return records;
}
