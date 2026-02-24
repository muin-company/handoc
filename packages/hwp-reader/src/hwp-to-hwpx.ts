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

type SectionItem = ParagraphData | { type: 'table'; rows: string[][] };

function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

/**
 * Extract section items (paragraphs and tables) from a body text section stream.
 * Tables are parsed using record-level nesting:
 *   CTRL_HEADER(tbl) → TABLE(rows/cols) → LIST_HEADER(cell) → PARA_HEADER/TEXT
 */
function extractSectionItems(
  sectionData: Uint8Array,
  docInfo: DocInfo,
): SectionItem[] {
  const records = parseRecords(sectionData);
  const items: SectionItem[] = [];

  // State for current paragraph
  let currentParaShapeId = 0;
  let currentCharShapeIds: number[] = [];
  // State for table parsing
  let inTable = false;
  let tableRows = 0;
  let tableCols = 0;
  let tableBaseLevel = 0;
  let cellTexts: string[] = [];     // text per cell
  let currentCellText = '';
  let cellCount = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // Detect table control: CTRL_HEADER with 'tbl ' control ID
    if (rec.tagId === HWPTAG.CTRL_HEADER) {
      if (rec.data.byteLength >= 4) {
        const id = readUint32LE(rec.data, 0);
        // 'tbl ' in HWP = 0x7462_6C20 but stored reversed
        const ctrlId = String.fromCharCode(
          (id >> 24) & 0xff, (id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff,
        );
        if (ctrlId === 'tbl ') {
          inTable = true;
          tableBaseLevel = rec.level;
          cellTexts = [];
          cellCount = 0;
          continue;
        }
      }
    }

    // Parse table info record (tag 77) to get dimensions
    if (rec.tagId === 77 && inTable) {
      if (rec.data.byteLength >= 8) {
        tableRows = readUint16LE(rec.data, 4);
        tableCols = readUint16LE(rec.data, 6);
      }
      continue;
    }

    // When inside a table, collect cell text
    if (inTable) {
      // LIST_HEADER marks start of a new cell
      if (rec.tagId === HWPTAG.LIST_HEADER && rec.level === tableBaseLevel + 1) {
        // Save previous cell if any
        if (cellCount > 0) {
          cellTexts.push(currentCellText.trim());
        }
        currentCellText = '';
        cellCount++;
        continue;
      }

      // Collect text within table cells
      if (rec.tagId === HWPTAG.PARA_TEXT && rec.level > tableBaseLevel) {
        const text = decodeParaText(rec.data).replace(/\n+$/, '');
        if (currentCellText && text) currentCellText += '\n';
        currentCellText += text;
        continue;
      }

      // Check if we've left the table (level drops back to or below base)
      if (rec.level <= tableBaseLevel && rec.tagId !== HWPTAG.TABLE) {
        // Flush last cell
        if (cellCount > 0) {
          cellTexts.push(currentCellText.trim());
        }

        // Build table rows
        if (tableCols > 0 && cellTexts.length > 0) {
          const rows: string[][] = [];
          for (let c = 0; c < cellTexts.length; c += tableCols) {
            rows.push(cellTexts.slice(c, c + tableCols));
          }
          items.push({ type: 'table', rows });
        }

        inTable = false;
        cellTexts = [];
        cellCount = 0;
        // Fall through to process current record normally
      } else {
        continue; // Still inside table, skip other records
      }
    }

    // Normal paragraph processing
    if (rec.tagId === HWPTAG.PARA_HEADER) {
      if (rec.data.byteLength >= 10) {
        const view = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);
        currentParaShapeId = view.getUint16(8, true);
      }
      currentCharShapeIds = [];
    } else if (rec.tagId === HWPTAG_PARA_CHAR_SHAPE) {
      const view = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);
      const count = rec.data.byteLength / 8;
      for (let j = 0; j < count; j++) {
        const charShapeId = view.getUint32(j * 8 + 4, true);
        currentCharShapeIds.push(charShapeId);
      }
    } else if (rec.tagId === HWPTAG.PARA_TEXT) {
      const text = decodeParaText(rec.data);
      const style = extractStyle(docInfo, currentParaShapeId, currentCharShapeIds[0] ?? 0);
      items.push({
        text: text.replace(/\n+$/, ''),
        style,
      });
    }
  }

  // Flush any remaining table
  if (inTable && cellCount > 0) {
    cellTexts.push(currentCellText.trim());
    if (tableCols > 0 && cellTexts.length > 0) {
      const rows: string[][] = [];
      for (let c = 0; c < cellTexts.length; c += tableCols) {
        rows.push(cellTexts.slice(c, c + tableCols));
      }
      items.push({ type: 'table', rows });
    }
  }

  return items;
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
 * Extract page width/height from a section's "secd" (section definition) control.
 * In HWP 5.x, the section definition control (CTRL_HEADER "dces") is followed by
 * a TABLE record (tag 73) containing: pageWidth(U32LE), pageHeight(U32LE), margins...
 */
function extractPageDimensions(sectionData: Uint8Array): { width: number; height: number } | null {
  const records = parseRecords(sectionData);
  for (let i = 0; i < records.length - 1; i++) {
    const rec = records[i];
    // Look for CTRL_HEADER with "dces" (= "secd" reversed = section definition)
    if (rec.tagId === HWPTAG.CTRL_HEADER && rec.data.length >= 4) {
      const ctrlId = String.fromCharCode(rec.data[0], rec.data[1], rec.data[2], rec.data[3]);
      if (ctrlId === 'dces') {
        // Next record should be TABLE (tag 73) with page dimensions
        const next = records[i + 1];
        if (next && next.tagId === HWPTAG.TABLE && next.data.length >= 8) {
          const d = next.data instanceof Buffer ? next.data : Buffer.from(next.data);
          const w = d.readUInt32LE(0);
          const h = d.readUInt32LE(4);
          if (w > 0 && h > 0) {
            return { width: w, height: h };
          }
        }
        break;
      }
    }
  }
  return null;
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

  // Extract page dimensions from first section's "secd" control
  const pageDims = extractPageDimensions(doc.bodyText[0]);
  const builder = HwpxBuilder.create(pageDims ? { pageWidth: pageDims.width, pageHeight: pageDims.height } : undefined);
  let isFirstSection = true;

  for (const sectionData of doc.bodyText) {
    if (!isFirstSection) {
      builder.addSectionBreak();
    }
    isFirstSection = false;

    const sectionItems = extractSectionItems(sectionData, docInfo);

    if (sectionItems.length === 0) {
      builder.addParagraph('');
    } else {
      for (const item of sectionItems) {
        if ('type' in item && item.type === 'table') {
          builder.addTable(item.rows);
        } else {
          const para = item as ParagraphData;
          builder.addParagraph(para.text, para.style);
        }
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
