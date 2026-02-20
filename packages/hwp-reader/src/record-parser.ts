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
