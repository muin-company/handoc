/**
 * HWP 5.x → HWPX converter (text-only, v1)
 *
 * Reads an HWP binary, extracts text paragraphs per section,
 * and produces an HWPX ZIP via HwpxBuilder.
 */

import { readHwp } from './hwp-reader.js';
import { parseRecords } from './record-parser.js';
import { HwpxBuilder } from '@handoc/hwpx-writer';

/** HWPTAG_PARA_TEXT tag id */
const HWPTAG_PARA_TEXT = 67;

/**
 * Decode HWPTAG_PARA_TEXT record data (UTF-16LE) into a string,
 * skipping HWP inline control characters.
 */
function decodeParaText(data: Uint8Array): string {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const parts: string[] = [];
  let i = 0;

  while (i + 1 < data.byteLength) {
    const ch = view.getUint16(i, true);

    if (ch === 0) {
      i += 2;
    } else if ((ch >= 1 && ch <= 9) || (ch >= 11 && ch <= 12) || (ch >= 14 && ch <= 23)) {
      // Inline control objects: skip 8 WCHARs (16 bytes)
      i += 16;
    } else if (ch === 10 || ch === 13) {
      parts.push('\n');
      i += 2;
    } else if (ch >= 24 && ch <= 31) {
      i += 2;
    } else {
      parts.push(String.fromCharCode(ch));
      i += 2;
    }
  }

  return parts.join('');
}

/**
 * Extract paragraph texts from a single body text section stream.
 */
function extractSectionParagraphs(sectionData: Uint8Array): string[] {
  const records = parseRecords(sectionData);
  const paragraphs: string[] = [];

  for (const rec of records) {
    if (rec.tagId === HWPTAG_PARA_TEXT) {
      const text = decodeParaText(rec.data);
      // Keep even empty strings to preserve paragraph structure,
      // but trim trailing newlines
      paragraphs.push(text.replace(/\n+$/, ''));
    }
  }

  return paragraphs;
}

/**
 * Convert an HWP 5.x binary buffer to HWPX format.
 * Currently converts text content only (v1). Tables, images, and
 * formatting are silently skipped with console warnings.
 *
 * @param hwpBuffer - Raw bytes of an HWP 5.x file
 * @returns HWPX ZIP as Uint8Array
 */
export function convertHwpToHwpx(hwpBuffer: Uint8Array): Uint8Array {
  const doc = readHwp(hwpBuffer);

  if (doc.bodyText.length === 0) {
    // No sections — return empty HWPX
    return HwpxBuilder.create().build();
  }

  const builder = HwpxBuilder.create();
  let isFirstSection = true;

  for (const sectionData of doc.bodyText) {
    if (!isFirstSection) {
      builder.addSectionBreak();
    }
    isFirstSection = false;

    const paragraphs = extractSectionParagraphs(sectionData);

    if (paragraphs.length === 0) {
      // Empty section — add empty paragraph
      builder.addParagraph('');
    } else {
      for (const text of paragraphs) {
        builder.addParagraph(text);
      }
    }

    // Log warnings for non-text records we're skipping
    const records = parseRecords(sectionData);
    const skippedTags = new Set<number>();
    for (const rec of records) {
      // Tags we handle: 66 (PARA_HEADER), 67 (PARA_TEXT)
      // Everything else is potentially unsupported content
      if (rec.tagId !== 66 && rec.tagId !== 67) {
        skippedTags.add(rec.tagId);
      }
    }
    if (skippedTags.size > 0) {
      console.warn(
        `[hwp-to-hwpx] Skipped unsupported HWP record tags: ${[...skippedTags].join(', ')}`,
      );
    }
  }

  return builder.build();
}
