/**
 * HWP 5.x → HWPX converter (v2 with formatting)
 *
 * Reads an HWP binary, extracts text paragraphs per section,
 * and produces an HWPX ZIP via HwpxBuilder with font/style information.
 */

import { readHwp } from './hwp-reader.js';
import { parseRecords, HWPTAG } from './record-parser.js';
import { parseDocInfo, type DocInfo } from './docinfo-parser.js';
import { HwpxBuilder } from '@handoc/hwpx-writer';

/** HWPTAG_PARA_TEXT tag id */
const HWPTAG_PARA_TEXT = 67;
/** HWPTAG_PARA_CHAR_SHAPE tag id */
const HWPTAG_PARA_CHAR_SHAPE = 68;

interface ParagraphStyle {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineSpacing?: number;
  indent?: number;
}

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

interface ParagraphData {
  text: string;
  style: ParagraphStyle;
}

/**
 * Extract paragraph texts and styles from a single body text section stream.
 */
function extractSectionParagraphs(
  sectionData: Uint8Array,
  docInfo: DocInfo,
): ParagraphData[] {
  const records = parseRecords(sectionData);
  const paragraphs: ParagraphData[] = [];
  
  let currentParaShapeId = 0;
  let currentCharShapeIds: number[] = [];

  for (const rec of records) {
    if (rec.tagId === HWPTAG.PARA_HEADER) {
      // Parse PARA_HEADER to get shape IDs
      // Layout: multiple fields, paraPrIDRef at offset 4 (uint32)
      if (rec.data.byteLength >= 8) {
        const view = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);
        currentParaShapeId = view.getUint32(4, true);
      }
      currentCharShapeIds = [];
    } else if (rec.tagId === HWPTAG_PARA_CHAR_SHAPE) {
      // PARA_CHAR_SHAPE: array of uint32 (char pos, char shape ID) pairs
      const view = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);
      const count = rec.data.byteLength / 8;
      for (let i = 0; i < count; i++) {
        const charShapeId = view.getUint32(i * 8 + 4, true);
        currentCharShapeIds.push(charShapeId);
      }
    } else if (rec.tagId === HWPTAG_PARA_TEXT) {
      const text = decodeParaText(rec.data);
      const style = extractStyle(docInfo, currentParaShapeId, currentCharShapeIds[0] ?? 0);
      paragraphs.push({
        text: text.replace(/\n+$/, ''),
        style,
      });
    }
  }

  return paragraphs;
}

/**
 * Extract style information from DocInfo based on para/char shape IDs.
 */
function extractStyle(
  docInfo: DocInfo,
  paraShapeId: number,
  charShapeId: number,
): ParagraphStyle {
  const style: ParagraphStyle = {};

  // Extract character style
  if (charShapeId < docInfo.charShapes.length) {
    const charShape = docInfo.charShapes[charShapeId];
    if (charShape) {
      style.bold = charShape.bold;
      style.italic = charShape.italic;
      style.fontSize = charShape.height / 100; // Convert HU to pt
      
      // Get font name from font ID (use first language group)
      const fontId = charShape.fontId[0];
      if (fontId < docInfo.fontNames.length) {
        style.fontFamily = docInfo.fontNames[fontId];
      }
    }
  }

  // Extract paragraph style
  if (paraShapeId < docInfo.paraShapes.length) {
    const paraShape = docInfo.paraShapes[paraShapeId];
    if (paraShape) {
      // Map HWP alignment to HWPX
      const alignMap: Record<number, 'left' | 'center' | 'right' | 'justify'> = {
        0: 'justify',
        1: 'left',
        2: 'right',
        3: 'center',
        4: 'justify', // distribute → justify
        5: 'justify', // split-justify → justify
      };
      style.align = alignMap[paraShape.align] ?? 'left';
      
      // Line spacing (convert to percentage)
      if (paraShape.lineSpacing > 0 && paraShape.lineSpacing !== 160) {
        style.lineSpacing = paraShape.lineSpacing;
      }
    }
  }

  return style;
}

/**
 * Convert an HWP 5.x binary buffer to HWPX format.
 * Converts text content with font and formatting information (v2).
 * Tables and images are still skipped with console warnings.
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

  // Parse DocInfo for font and style information
  const docInfoRecords = parseRecords(doc.docInfo);
  const docInfo = parseDocInfo(docInfoRecords);

  const builder = HwpxBuilder.create();
  let isFirstSection = true;

  for (const sectionData of doc.bodyText) {
    if (!isFirstSection) {
      builder.addSectionBreak();
    }
    isFirstSection = false;

    const paragraphs = extractSectionParagraphs(sectionData, docInfo);

    if (paragraphs.length === 0) {
      // Empty section — add empty paragraph
      builder.addParagraph('');
    } else {
      for (const para of paragraphs) {
        builder.addParagraph(para.text, para.style);
      }
    }

    // Log warnings for non-text records we're skipping
    const records = parseRecords(sectionData);
    const skippedTags = new Set<number>();
    for (const rec of records) {
      // Tags we handle: 66 (PARA_HEADER), 67 (PARA_TEXT), 68 (PARA_CHAR_SHAPE)
      // Everything else is potentially unsupported content
      if (rec.tagId !== 66 && rec.tagId !== 67 && rec.tagId !== 68) {
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
