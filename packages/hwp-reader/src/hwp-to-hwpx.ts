/**
 * HWP 5.x → HWPX converter (v2 with formatting)
 *
 * Reads an HWP binary, extracts text paragraphs per section,
 * and produces an HWPX ZIP via HwpxBuilder with font/style information.
 */

import { inflateRawSync, inflateSync } from 'node:zlib';
import { readHwp } from './hwp-reader.js';
import { parseRecords, HWPTAG } from './record-parser.js';
import { parseDocInfo, type DocInfo, type BinDataItem } from './docinfo-parser.js';
import { HwpxBuilder } from '@handoc/hwpx-writer';
import type { CfbFile } from './cfb-reader.js';

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

/** Rich cell data extracted from HWP binary */
export interface HwpCellData {
  rowAddr: number;
  colAddr: number;
  rowSpan: number;
  colSpan: number;
  width: number;   // HWP units
  height: number;  // HWP units
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  borderFillId: number;
  text: string;
  charShapeId: number;
  paraShapeId: number;
}

export interface HwpRichTable {
  type: 'richTable';
  rows: number;
  cols: number;
  cells: HwpCellData[];
}

export interface HwpImageData {
  type: 'image';
  binDataIndex: number; // 0-based index into docInfo.binDataItems
  width: number;   // HWP units
  height: number;  // HWP units
}

type SectionItem = ParagraphData | { type: 'table'; rows: string[][] } | HwpRichTable | HwpImageData;

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
  let currentCellText = '';
  let cellCount = 0;
  // Rich cell data
  let richCells: HwpCellData[] = [];
  let currentCellData: Partial<HwpCellData> = {};
  let currentCellCharShapeId = 0;
  let currentCellParaShapeId = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // Detect table or image control: CTRL_HEADER
    if (rec.tagId === HWPTAG.CTRL_HEADER) {
      if (rec.data.byteLength >= 4) {
        const id = readUint32LE(rec.data, 0);
        const ctrlId = String.fromCharCode(
          (id >> 24) & 0xff, (id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff,
        );
        if (ctrlId === 'tbl ') {
          inTable = true;
          tableBaseLevel = rec.level;
          richCells = [];
          cellCount = 0;
          continue;
        }
        // Detect picture/OLE control: 'pic ' or 'ole '
        if (ctrlId === 'pic ' || ctrlId === 'ole ') {
          // Search forward for the image info in subsequent records at deeper levels
          const ctrlLevel = rec.level;
          let imgBinDataIndex = -1;
          let imgWidth = 0;
          let imgHeight = 0;
          for (let j = i + 1; j < records.length; j++) {
            const sub = records[j];
            if (sub.level <= ctrlLevel && sub.tagId !== HWPTAG.TABLE) break;
            // LIST_HEADER (72) at ctrlLevel+1 often contains shape size info
            // SHAPE_COMPONENT or pic info: look for binDataId reference
            // In HWP 5.x, the image data appears in a specific sub-record structure
            // The TABLE record (73) after CTRL_HEADER for 'pic' contains image dimensions
            if (sub.tagId === HWPTAG.TABLE && sub.data.byteLength >= 8) {
              // For pic control, tag 73 data: offset 0-3 = property, offset varies
              // Try to extract width/height from the shape container
            }
            // Look for binDataId in records — typically in a record following LIST_HEADER
            // The pic control stores binDataId in the shape's image info
            // Common pattern: after CTRL_HEADER(pic), there are shape records
            // with binDataId stored at known offsets
            if (sub.data.byteLength >= 4) {
              // Tag 75 or similar: check for binary data references
              // In many HWP implementations, the picture info record contains:
              // - binDataId (0-based or 1-based) at a specific offset
              const tagId = sub.tagId;
              // SHAPE_COMPONENT_PICTURE = HWPTAG_BEGIN + 63 = 79 or similar
              if (tagId === 79 && sub.data.byteLength >= 4) {
                // Picture shape component: binDataId at offset 0 (int32)
                const binRef = readUint32LE(sub.data, 0);
                if (binRef > 0 && binRef <= docInfo.binDataItems.length) {
                  imgBinDataIndex = binRef - 1; // convert 1-based to 0-based
                }
              }
            }
          }
          // Also try to get dimensions from the CTRL_HEADER data itself
          // Offset 20-27 in CTRL_HEADER often contains width/height for GSO
          if (rec.data.byteLength >= 28) {
            imgWidth = readUint32LE(rec.data, 20);
            imgHeight = readUint32LE(rec.data, 24);
          }
          if (imgBinDataIndex >= 0) {
            items.push({
              type: 'image',
              binDataIndex: imgBinDataIndex,
              width: imgWidth || 28346, // default ~100mm
              height: imgHeight || 21260, // default ~75mm
            });
          }
          // Skip remaining sub-records of this control
          while (i + 1 < records.length && records[i + 1].level > ctrlLevel) {
            i++;
          }
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

    // When inside a table, collect cell data with structure
    if (inTable) {
      // LIST_HEADER marks start of a new cell — extract cell properties
      if (rec.tagId === HWPTAG.LIST_HEADER && rec.level === tableBaseLevel + 1) {
        // Save previous cell if any
        if (cellCount > 0) {
          richCells.push({
            ...currentCellData as HwpCellData,
            text: currentCellText.trim(),
            charShapeId: currentCellCharShapeId,
            paraShapeId: currentCellParaShapeId,
          });
        }
        currentCellText = '';
        currentCellCharShapeId = 0;
        currentCellParaShapeId = 0;

        // Parse cell properties from LIST_HEADER data
        const d = rec.data;
        if (d.byteLength >= 34) {
          currentCellData = {
            colAddr: readUint16LE(d, 8),
            rowAddr: readUint16LE(d, 10),
            colSpan: readUint16LE(d, 12),
            rowSpan: readUint16LE(d, 14),
            width: readUint32LE(d, 16),
            height: readUint32LE(d, 20),
            marginLeft: readUint16LE(d, 24),
            marginRight: readUint16LE(d, 26),
            marginTop: readUint16LE(d, 28),
            marginBottom: readUint16LE(d, 30),
            borderFillId: readUint16LE(d, 32),
          };
        } else {
          currentCellData = {
            colAddr: cellCount % tableCols,
            rowAddr: Math.floor(cellCount / tableCols),
            colSpan: 1, rowSpan: 1,
            width: 0, height: 0,
            marginLeft: 283, marginRight: 283,
            marginTop: 283, marginBottom: 283,
            borderFillId: 0,
          };
        }
        cellCount++;
        continue;
      }

      // Collect para shape ID
      if (rec.tagId === HWPTAG.PARA_HEADER && rec.level > tableBaseLevel) {
        if (rec.data.byteLength >= 10) {
          const view = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);
          currentCellParaShapeId = view.getUint16(8, true);
        }
        continue;
      }

      // Collect char shape ID
      if (rec.tagId === HWPTAG_PARA_CHAR_SHAPE && rec.level > tableBaseLevel) {
        if (rec.data.byteLength >= 8) {
          const view = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);
          currentCellCharShapeId = view.getUint32(4, true);
        }
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
          richCells.push({
            ...currentCellData as HwpCellData,
            text: currentCellText.trim(),
            charShapeId: currentCellCharShapeId,
            paraShapeId: currentCellParaShapeId,
          });
        }

        // Emit rich table
        if (richCells.length > 0) {
          items.push({
            type: 'richTable',
            rows: tableRows,
            cols: tableCols,
            cells: richCells,
          });
        }

        inTable = false;
        richCells = [];
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
    richCells.push({
      ...currentCellData as HwpCellData,
      text: currentCellText.trim(),
      charShapeId: currentCellCharShapeId,
      paraShapeId: currentCellParaShapeId,
    });
    if (richCells.length > 0) {
      items.push({
        type: 'richTable',
        rows: tableRows,
        cols: tableCols,
        cells: richCells,
      });
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

      // Left margin + indent (convert HWP units to mm for builder)
      const HWP_TO_MM = 1 / 283.46;
      if (paraShape.leftMargin > 0 || paraShape.indent !== 0) {
        const totalIndent = (paraShape.leftMargin + paraShape.indent) * HWP_TO_MM;
        if (totalIndent > 0.5) { // Only apply meaningful indents
          style.indent = totalIndent;
        }
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
interface PageDimensions {
  width: number;
  height: number;
  margins?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    header: number;
    footer: number;
    gutter: number;
  };
}

function extractPageDimensions(sectionData: Uint8Array): PageDimensions | null {
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
            const result: PageDimensions = { width: w, height: h };
            // Extract margins if available (offsets 8-36)
            if (d.length >= 36) {
              result.margins = {
                left: d.readUInt32LE(8),
                right: d.readUInt32LE(12),
                top: d.readUInt32LE(16),
                bottom: d.readUInt32LE(20),
                header: d.readUInt32LE(24),
                footer: d.readUInt32LE(28),
                gutter: d.readUInt32LE(32),
              };
            }
            return result;
          }
        }
        break;
      }
    }
  }
  return null;
}

/**
 * Decompress BinData if it's zlib/deflate compressed.
 * HWP BinData entries may be stored compressed even separately from body streams.
 */
function decompressBinData(data: Uint8Array): Uint8Array {
  // Check for common image signatures first (not compressed)
  if (data.byteLength >= 4) {
    // PNG: 89 50 4E 47
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) return data;
    // JPEG: FF D8 FF
    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) return data;
    // GIF: 47 49 46
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return data;
    // BMP: 42 4D
    if (data[0] === 0x42 && data[1] === 0x4D) return data;
    // TIFF: 49 49 or 4D 4D
    if ((data[0] === 0x49 && data[1] === 0x49) || (data[0] === 0x4D && data[1] === 0x4D)) return data;
    // EMF: 01 00 00 00
    if (data[0] === 0x01 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x00) return data;
    // WMF: D7 CD C6 9A
    if (data[0] === 0xD7 && data[1] === 0xCD && data[2] === 0xC6 && data[3] === 0x9A) return data;
  }
  // Try decompression
  try {
    return new Uint8Array(inflateRawSync(data));
  } catch {
    try {
      return new Uint8Array(inflateSync(data));
    } catch {
      return data;
    }
  }
}

/**
 * Extract binary data (image) from CFB BinData storage.
 * HWP stores embedded binaries as BinData/BIN%04X.<ext> in the CFB.
 */
function extractBinData(
  cfb: CfbFile,
  binDataItems: BinDataItem[],
  index: number,
): { data: Uint8Array; ext: string } | null {
  if (index < 0 || index >= binDataItems.length) return null;
  const item = binDataItems[index];
  if (!item) return null;

  const ext = item.extension || 'png';
  const binId = item.binDataId;

  // Try various naming conventions used in HWP files
  const candidates = [
    `BinData/BIN${String(binId).padStart(4, '0')}.${ext}`,
    `BinData/BIN${String(binId).padStart(4, '0')}.${ext.toUpperCase()}`,
    `Root Entry/BinData/BIN${String(binId).padStart(4, '0')}.${ext}`,
  ];

  const streams = cfb.listStreams();
  for (const candidate of candidates) {
    try {
      const data = cfb.getStream(candidate);
      if (data && data.byteLength > 0) {
        return { data: decompressBinData(data), ext };
      }
    } catch {
      // Stream not found, try next candidate
    }
  }

  // Try to find by pattern match in stream list
  const pattern = new RegExp(`BIN${String(binId).padStart(4, '0')}`, 'i');
  const match = streams.find(s => pattern.test(s));
  if (match) {
    try {
      const data = cfb.getStream(match);
      if (data && data.byteLength > 0) {
        return { data: decompressBinData(data), ext };
      }
    } catch {
      // Failed to extract
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
  const builderOpts: Record<string, unknown> = {};
  if (pageDims) {
    builderOpts.pageWidth = pageDims.width;
    builderOpts.pageHeight = pageDims.height;
    if (pageDims.margins) {
      builderOpts.margins = pageDims.margins;
    }
  }
  const builder = HwpxBuilder.create(Object.keys(builderOpts).length > 0 ? builderOpts as any : undefined);
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
        if ('type' in item && item.type === 'richTable') {
          builder.addRichTable(item as HwpRichTable);
        } else if ('type' in item && item.type === 'image') {
          const imgItem = item as HwpImageData;
          const imageData = extractBinData(doc.cfb, docInfo.binDataItems, imgItem.binDataIndex);
          if (imageData) {
            builder.addImage(imageData.data, imageData.ext, imgItem.width, imgItem.height);
          }
        } else if ('type' in item && item.type === 'table') {
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
