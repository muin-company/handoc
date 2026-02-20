/**
 * Extract plain text from an HWP 5.x binary buffer.
 *
 * Parses CFB → FileHeader → BodyText sections → records,
 * then decodes HWPTAG_PARA_TEXT (tag 67) as UTF-16LE,
 * filtering out inline control characters (code points 0–31).
 */

import { readHwp } from './hwp-reader.js';
import { parseRecords } from './record-parser.js';

/** HWPTAG_PARA_TEXT base tag id (HWPTAG_BEGIN=16, offset 51 → 67) */
const HWPTAG_PARA_TEXT = 67;

/**
 * Decode a HWPTAG_PARA_TEXT record's data into a string.
 * HWP uses UTF-16LE. Characters 0–31 are inline controls:
 *   0: reserved/null
 *   1–3: extended controls (8 extra WCHARs each = 16 bytes to skip)
 *   4–9: inline controls (8 extra WCHARs each)
 *  10: line break (\n)
 *  11: inline controls (8 extra WCHARs)
 *  12: inline controls (8 extra WCHARs)
 *  13: section/column break → \n
 *  14–23: inline controls (8 extra WCHARs)
 *  24–31: reserved controls (skip as single char)
 *
 * Controls with "extended" inline objects consume the char itself
 * plus 7 additional WCHARs (total 8 WCHARs = 16 bytes per control).
 */
function decodeParaText(data: Uint8Array): string {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const parts: string[] = [];
  let i = 0;

  while (i + 1 < data.byteLength) {
    const ch = view.getUint16(i, true);

    if (ch === 0) {
      // null – skip
      i += 2;
    } else if (ch >= 1 && ch <= 9) {
      // Extended inline control: skip 8 WCHARs total (16 bytes)
      i += 16;
    } else if (ch === 10) {
      parts.push('\n');
      i += 2;
    } else if (ch >= 11 && ch <= 12) {
      // Inline control objects
      i += 16;
    } else if (ch === 13) {
      parts.push('\n');
      i += 2;
    } else if (ch >= 14 && ch <= 23) {
      // Inline control objects
      i += 16;
    } else if (ch >= 24 && ch <= 31) {
      // Reserved controls – skip single char
      i += 2;
    } else {
      // Normal character
      parts.push(String.fromCharCode(ch));
      i += 2;
    }
  }

  return parts.join('');
}

/**
 * Extract all text from an HWP 5.x binary buffer.
 * Returns concatenated plain text from all body sections.
 */
export function extractTextFromHwp(buffer: Uint8Array): string {
  const doc = readHwp(buffer);
  const paragraphs: string[] = [];

  for (const section of doc.bodyText) {
    const records = parseRecords(section);
    for (const rec of records) {
      if (rec.tagId === HWPTAG_PARA_TEXT) {
        const text = decodeParaText(rec.data);
        if (text.length > 0) {
          paragraphs.push(text);
        }
      }
    }
  }

  return paragraphs.join('\n');
}
