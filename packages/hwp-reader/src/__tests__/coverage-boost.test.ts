/**
 * Additional tests to boost coverage to 95%+.
 * Targets uncovered lines in: hwp-reader.ts, record-parser.ts,
 * text-extractor.ts, body-parser.ts, hwp-to-hwpx.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { readHwp } from '../hwp-reader.js';
import { parseRecords, HWPTAG } from '../record-parser.js';
import { extractTextFromHwp, extractRichContent } from '../text-extractor.js';
import { parseSectionContent } from '../body-parser.js';
import { convertHwpToHwpx } from '../hwp-to-hwpx.js';
import { createTestHwp } from './create-test-hwp.js';
import CFB from 'cfb';
import { deflateSync } from 'node:zlib';

// ─── Helpers ───────────────────────────────────────────

/** Build an HWP record header DWORD */
function makeRecordHeader(tagId: number, level: number, size: number): Uint8Array {
  const buf = new Uint8Array(size >= 0xfff ? 8 : 4);
  const view = new DataView(buf.buffer);
  const sizeField = size >= 0xfff ? 0xfff : size;
  const header = (tagId & 0x3ff) | ((level & 0x3ff) << 10) | ((sizeField & 0xfff) << 20);
  view.setUint32(0, header, true);
  if (size >= 0xfff) {
    view.setUint32(4, size, true);
  }
  return buf;
}

function encodeUtf16LE(text: string): Uint8Array {
  const buf = new Uint8Array(text.length * 2);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(i * 2, text.charCodeAt(i), true);
  }
  return buf;
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/** Build a minimal DocInfo stream with font names, char shapes, and para shapes */
function buildDocInfoStream(): Uint8Array {
  const chunks: Uint8Array[] = [];

  // FACE_NAME record (tag 19): property byte + uint16 name length + UTF-16LE name
  const fontName = '함초롬돋움';
  const fontNameBytes = encodeUtf16LE(fontName);
  const faceNameData = new Uint8Array(3 + fontNameBytes.length);
  faceNameData[0] = 0x01; // property
  faceNameData[1] = fontName.length & 0xff;
  faceNameData[2] = (fontName.length >> 8) & 0xff;
  faceNameData.set(fontNameBytes, 3);
  chunks.push(makeRecordHeader(HWPTAG.FACE_NAME, 0, faceNameData.length));
  chunks.push(faceNameData);

  // CHAR_SHAPE record (tag 21): 58+ bytes
  const charShapeData = new Uint8Array(58);
  const csView = new DataView(charShapeData.buffer);
  // fontId[0] = 0 (index into fontNames)
  for (let i = 0; i < 7; i++) csView.setUint16(i * 2, 0, true);
  // height = 1000 (10pt * 100)
  csView.setUint32(42, 1000, true);
  // properties: bold=bit1, italic=bit0
  csView.setUint32(46, 0x03, true); // bold + italic
  // color
  csView.setUint32(54, 0x000000, true);
  chunks.push(makeRecordHeader(HWPTAG.CHAR_SHAPE, 0, charShapeData.length));
  chunks.push(charShapeData);

  // PARA_SHAPE record (tag 25): 28+ bytes
  const paraShapeData = new Uint8Array(28);
  const psView = new DataView(paraShapeData.buffer);
  // props1: align=center (3 << 2 = 12)
  psView.setUint32(0, 3 << 2, true);
  // lineSpacing at offset 24
  psView.setUint32(24, 200, true); // 200%
  chunks.push(makeRecordHeader(HWPTAG.PARA_SHAPE, 0, paraShapeData.length));
  chunks.push(paraShapeData);

  return concatUint8Arrays(...chunks);
}

/** Build a BodyText section stream with PARA_HEADER containing paraShapeId and PARA_CHAR_SHAPE */
function buildRichBodyTextStream(paragraphs: string[]): Uint8Array {
  const chunks: Uint8Array[] = [];

  for (const para of paragraphs) {
    // PARA_HEADER (tag 66): at least 8 bytes. paraShapeId at offset 4 (uint32 for hwp-to-hwpx) or offset 6 (uint16 for body-parser)
    const paraHeaderData = new Uint8Array(22);
    const phView = new DataView(paraHeaderData.buffer);
    phView.setUint32(4, 0, true); // paraShapeId = 0 (for hwp-to-hwpx: uint32 at offset 4)
    // For body-parser: uint16 at offset 6 = 0
    chunks.push(makeRecordHeader(HWPTAG.PARA_HEADER, 0, paraHeaderData.length));
    chunks.push(paraHeaderData);

    // PARA_CHAR_SHAPE (tag 68): pairs of (uint32 pos, uint32 charShapeId)
    const charShapeRef = new Uint8Array(8);
    const csrView = new DataView(charShapeRef.buffer);
    csrView.setUint32(0, 0, true); // pos = 0
    csrView.setUint32(4, 0, true); // charShapeId = 0
    chunks.push(makeRecordHeader(68, 1, charShapeRef.length));
    chunks.push(charShapeRef);

    // PARA_TEXT (tag 67)
    const textData = encodeUtf16LE(para);
    chunks.push(makeRecordHeader(67, 1, textData.length));
    chunks.push(textData);
  }

  return concatUint8Arrays(...chunks);
}

/** Create a test HWP with rich DocInfo (fonts, charShapes, paraShapes) */
function createRichTestHwp(options: {
  compressed?: boolean;
  paragraphs?: string[];
  extraSections?: string[][];
} = {}): Uint8Array {
  const { compressed = true, paragraphs = ['테스트'], extraSections = [] } = options;

  const fileHeader = new Uint8Array(256);
  const encoder = new TextEncoder();
  fileHeader.set(encoder.encode('HWP Document File'), 0);
  const fhView = new DataView(fileHeader.buffer);
  fhView.setUint32(32, (5 << 24) | (1 << 16), true);
  let properties = 0;
  if (compressed) properties |= 1;
  fhView.setUint32(36, properties, true);

  const docInfoRaw = buildDocInfoStream();
  const section0Raw = buildRichBodyTextStream(paragraphs);

  const docInfo = compressed ? new Uint8Array(deflateSync(docInfoRaw)) : docInfoRaw;
  const section0 = compressed ? new Uint8Array(deflateSync(section0Raw)) : section0Raw;

  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
  CFB.utils.cfb_add(cfb, '/DocInfo', docInfo as any);
  CFB.utils.cfb_add(cfb, '/BodyText/Section0', section0 as any);

  for (let i = 0; i < extraSections.length; i++) {
    const secRaw = buildRichBodyTextStream(extraSections[i]);
    const secData = compressed ? new Uint8Array(deflateSync(secRaw)) : secRaw;
    CFB.utils.cfb_add(cfb, `/BodyText/Section${i + 1}`, secData as any);
  }

  return new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
}

// ─── hwp-reader.ts error paths ─────────────────────────

describe('hwp-reader error paths', () => {
  it('should throw on invalid HWP signature', () => {
    const fileHeader = new Uint8Array(256);
    new TextEncoder().encode('NOT A HWP FILE').forEach((b, i) => { fileHeader[i] = b; });
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true);

    const docInfo = new Uint8Array(24);
    const section = new Uint8Array(4);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfo as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', section as any);

    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    expect(() => readHwp(buf)).toThrow('Invalid HWP signature');
  });

  it('should throw on encrypted HWP', () => {
    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0x02, true); // encrypted bit

    const docInfo = new Uint8Array(24);
    const section = new Uint8Array(4);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfo as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', section as any);

    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    expect(() => readHwp(buf)).toThrow('Encrypted HWP');
  });

  it('should throw when FileHeader stream is missing', () => {
    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/DocInfo', new Uint8Array(24) as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', new Uint8Array(4) as any);

    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    expect(() => readHwp(buf)).toThrow('FileHeader stream not found');
  });

  it('should throw when DocInfo stream is missing', () => {
    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', new Uint8Array(4) as any);

    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    expect(() => readHwp(buf)).toThrow('DocInfo stream not found');
  });

  it('should handle data that fails both inflate methods (fallback to raw)', () => {
    // Create HWP with compressed flag but store random non-deflate data
    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 1, true); // compressed=true

    // Store garbage data that won't inflate
    const garbageDocInfo = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04]);
    const garbageSection = new Uint8Array([0xCA, 0xFE, 0xBA, 0xBE]);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', garbageDocInfo as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', garbageSection as any);

    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    // Should not throw - falls back to raw data
    const doc = readHwp(buf);
    // DocInfo should be the raw garbage data
    expect(doc.docInfo).toEqual(garbageDocInfo);
  });

  it('should parse all FileHeader property flags', () => {
    // Set multiple property flags
    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    // Set distribution, hasScript, drm, hasXmlTemplate, hasHistory, hasCertSign, certEncrypted, certDrm, hasCcl
    // But NOT encrypted (bit 1) since that would throw
    const props = (1 << 0) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9) | (1 << 10);
    fhView.setUint32(36, props, true);

    const docInfoRaw = new Uint8Array(24);
    const sectionRaw = new Uint8Array(4);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', new Uint8Array(deflateSync(docInfoRaw)) as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', new Uint8Array(deflateSync(sectionRaw)) as any);

    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    const doc = readHwp(buf);
    expect(doc.fileHeader.compressed).toBe(true);
    expect(doc.fileHeader.distribution).toBe(true);
    expect(doc.fileHeader.hasScript).toBe(true);
    expect(doc.fileHeader.drm).toBe(true);
    expect(doc.fileHeader.hasXmlTemplate).toBe(true);
    expect(doc.fileHeader.hasHistory).toBe(true);
    expect(doc.fileHeader.hasCertSign).toBe(true);
    expect(doc.fileHeader.certEncrypted).toBe(true);
    expect(doc.fileHeader.certDrm).toBe(true);
    expect(doc.fileHeader.hasCcl).toBe(true);
  });
});

// ─── record-parser.ts: extended size records ────────────

describe('record-parser extended size', () => {
  it('should parse records with extended size (>= 0xFFF)', () => {
    // Create a record with size >= 0xFFF (4095)
    const dataSize = 5000;
    const header = makeRecordHeader(67, 0, dataSize); // Should be 8 bytes (4 header + 4 extended size)
    expect(header.length).toBe(8);

    const data = new Uint8Array(dataSize);
    for (let i = 0; i < dataSize; i++) data[i] = i & 0xff;

    const stream = concatUint8Arrays(header, data);
    const records = parseRecords(stream);

    expect(records.length).toBe(1);
    expect(records[0].tagId).toBe(67);
    expect(records[0].data.length).toBe(dataSize);
  });

  it('should handle truncated extended size header', () => {
    // Header says size=0xFFF but stream ends before the 4-byte extended size
    const buf = new Uint8Array(4);
    const view = new DataView(buf.buffer);
    const header = (67 & 0x3ff) | (0 << 10) | (0xfff << 20);
    view.setUint32(0, header, true);

    const records = parseRecords(buf);
    expect(records).toEqual([]);
  });

  it('should handle truncated record data', () => {
    // Record header says 100 bytes but stream only has 10 more bytes
    const headerBuf = makeRecordHeader(67, 0, 100);
    const partial = new Uint8Array(10);
    const stream = concatUint8Arrays(headerBuf, partial);

    const records = parseRecords(stream);
    expect(records).toEqual([]);
  });
});

// ─── body-parser.ts: edge cases ─────────────────────────

describe('body-parser edge cases', () => {
  it('should handle CTRL_HEADER records', () => {
    // Build records with a CTRL_HEADER (tag 71)
    const ctrlData = new Uint8Array(4);
    // Control ID for table: 'tbl ' → as uint32 LE
    const ctrlId = (0x74 << 24) | (0x62 << 16) | (0x6c << 8) | 0x20; // 'tbl '
    new DataView(ctrlData.buffer).setUint32(0, ctrlId, true);

    const records = [
      { tagId: HWPTAG.CTRL_HEADER, level: 1, data: ctrlData },
    ];

    const content = parseSectionContent(records);
    expect(content.controls.length).toBe(1);
    expect(content.controls[0].ctrlId).toBe('tbl ');
  });

  it('should handle CTRL_HEADER with insufficient data', () => {
    const records = [
      { tagId: HWPTAG.CTRL_HEADER, level: 1, data: new Uint8Array(2) }, // < 4 bytes
    ];
    const content = parseSectionContent(records);
    expect(content.controls.length).toBe(0); // parseCtrlHeader returns null
  });

  it('should handle TABLE records', () => {
    const tableData = new Uint8Array(8);
    const tv = new DataView(tableData.buffer);
    tv.setUint16(4, 3, true); // rows = 3
    tv.setUint16(6, 2, true); // cols = 2

    const records = [
      { tagId: HWPTAG.TABLE, level: 1, data: tableData },
    ];

    const content = parseSectionContent(records);
    expect(content.tables.length).toBe(1);
    expect(content.tables[0].info.rows).toBe(3);
    expect(content.tables[0].info.cols).toBe(2);
    expect(content.tables[0].info.cellCountPerRow).toEqual([2, 2, 2]);
  });

  it('should handle TABLE with insufficient data', () => {
    const records = [
      { tagId: HWPTAG.TABLE, level: 1, data: new Uint8Array(4) }, // < 8 bytes
    ];
    const content = parseSectionContent(records);
    expect(content.tables.length).toBe(0);
  });

  it('should flush paragraph when new PARA_HEADER arrives', () => {
    const paraHeader1 = new Uint8Array(22);
    const text1 = encodeUtf16LE('First');
    const paraHeader2 = new Uint8Array(22);
    const text2 = encodeUtf16LE('Second');

    const records = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, data: paraHeader1 },
      { tagId: HWPTAG.PARA_TEXT, level: 1, data: text1 },
      { tagId: HWPTAG.PARA_HEADER, level: 0, data: paraHeader2 },
      { tagId: HWPTAG.PARA_TEXT, level: 1, data: text2 },
    ];

    const content = parseSectionContent(records);
    expect(content.paragraphs.length).toBe(2);
    expect(content.paragraphs[0].text).toBe('First');
    expect(content.paragraphs[1].text).toBe('Second');
  });

  it('should handle PARA_HEADER with small data (< 8 bytes)', () => {
    const smallHeader = new Uint8Array(4); // < 8 bytes, paraShapeId defaults to 0
    const text = encodeUtf16LE('Test');

    const records = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, data: smallHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 1, data: text },
    ];

    const content = parseSectionContent(records);
    expect(content.paragraphs.length).toBe(1);
    expect(content.paragraphs[0].paraShapeId).toBe(0);
  });

  it('should parse PARA_CHAR_SHAPE records', () => {
    const paraHeader = new Uint8Array(22);
    const charShapeData = new Uint8Array(16); // 2 entries of 8 bytes each
    const csv = new DataView(charShapeData.buffer);
    csv.setUint32(0, 0, true);  // pos = 0
    csv.setUint32(4, 1, true);  // charShapeId = 1
    csv.setUint32(8, 5, true);  // pos = 5
    csv.setUint32(12, 2, true); // charShapeId = 2

    const text = encodeUtf16LE('Hello World');

    const records = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, data: paraHeader },
      { tagId: HWPTAG.PARA_CHAR_SHAPE, level: 1, data: charShapeData },
      { tagId: HWPTAG.PARA_TEXT, level: 1, data: text },
    ];

    const content = parseSectionContent(records);
    expect(content.paragraphs[0].charShapes.length).toBe(2);
    expect(content.paragraphs[0].charShapes[0]).toEqual({ pos: 0, charShapeId: 1 });
    expect(content.paragraphs[0].charShapes[1]).toEqual({ pos: 5, charShapeId: 2 });
  });

  it('should handle empty records array', () => {
    const content = parseSectionContent([]);
    expect(content.paragraphs).toEqual([]);
    expect(content.tables).toEqual([]);
    expect(content.controls).toEqual([]);
  });
});

// ─── text-extractor.ts: control character branches ──────

describe('text-extractor control characters', () => {
  it('should handle inline control characters (codes 1-9, 11-12, 14-23)', () => {
    // Build a PARA_TEXT with inline controls
    // Each inline control: the control char (2 bytes) + 7 more WCHARs (14 bytes) = 16 bytes total
    // Then a normal character after
    const data = new Uint8Array(20); // 16 bytes control + 4 bytes normal char
    const view = new DataView(data.buffer);

    // Inline control char 5 at position 0
    view.setUint16(0, 5, true);
    // 7 dummy WCHARs (14 bytes)
    for (let i = 1; i < 8; i++) view.setUint16(i * 2, 0xFFFF, true);

    // Normal char 'A' at position 16
    view.setUint16(16, 0x41, true);
    // Normal char 'B' at position 18
    view.setUint16(18, 0x42, true);

    // Now test via a complete HWP-like flow
    // We test directly via the body-parser path which uses decodeParaText
    const records = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, data: new Uint8Array(22) },
      { tagId: HWPTAG.PARA_TEXT, level: 1, data },
    ];

    const content = parseSectionContent(records);
    expect(content.paragraphs[0].text).toBe('AB');
  });

  it('should handle null characters (code 0)', () => {
    const data = new Uint8Array(6);
    const view = new DataView(data.buffer);
    view.setUint16(0, 0, true);    // null - skipped
    view.setUint16(2, 0x41, true);  // 'A'
    view.setUint16(4, 0, true);    // null - skipped

    const records = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, data: new Uint8Array(22) },
      { tagId: HWPTAG.PARA_TEXT, level: 1, data },
    ];

    const content = parseSectionContent(records);
    expect(content.paragraphs[0].text).toBe('A');
  });

  it('should handle line break (code 10) and section break (code 13)', () => {
    const data = new Uint8Array(8);
    const view = new DataView(data.buffer);
    view.setUint16(0, 0x41, true);  // 'A'
    view.setUint16(2, 10, true);    // line break
    view.setUint16(4, 0x42, true);  // 'B'
    view.setUint16(6, 13, true);    // section break

    const records = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, data: new Uint8Array(22) },
      { tagId: HWPTAG.PARA_TEXT, level: 1, data },
    ];

    const content = parseSectionContent(records);
    expect(content.paragraphs[0].text).toContain('A');
    expect(content.paragraphs[0].text).toContain('\n');
    expect(content.paragraphs[0].text).toContain('B');
  });

  it('should handle reserved controls (codes 24-31)', () => {
    const data = new Uint8Array(6);
    const view = new DataView(data.buffer);
    view.setUint16(0, 24, true);   // reserved
    view.setUint16(2, 0x41, true); // 'A'
    view.setUint16(4, 31, true);   // reserved

    const records = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, data: new Uint8Array(22) },
      { tagId: HWPTAG.PARA_TEXT, level: 1, data },
    ];

    const content = parseSectionContent(records);
    expect(content.paragraphs[0].text).toBe('A');
  });

  it('should handle all inline control ranges in text-extractor decodeParaText', () => {
    // Test via extractTextFromHwp with custom section data containing controls
    // Build a section with control chars 1, 11, 12, 14, 23
    for (const controlChar of [1, 2, 9, 11, 12, 14, 23]) {
      const data = new Uint8Array(18); // 16 bytes control + 2 bytes 'X'
      const view = new DataView(data.buffer);
      view.setUint16(0, controlChar, true);
      for (let i = 1; i < 8; i++) view.setUint16(i * 2, 0, true);
      view.setUint16(16, 0x58, true); // 'X'

      const records = [
        { tagId: HWPTAG.PARA_HEADER, level: 0, data: new Uint8Array(22) },
        { tagId: HWPTAG.PARA_TEXT, level: 1, data },
      ];

      const content = parseSectionContent(records);
      expect(content.paragraphs[0].text).toBe('X');
    }
  });
});

// ─── text-extractor.ts & hwp-to-hwpx.ts: decodeParaText branches ─

describe('text-extractor decodeParaText via extractTextFromHwp', () => {
  /** Create HWP with raw PARA_TEXT data containing control characters */
  function createHwpWithRawParaText(paraTextData: Uint8Array): Uint8Array {
    const chunks: Uint8Array[] = [];
    const paraHeaderData = new Uint8Array(22);
    chunks.push(makeRecordHeader(HWPTAG.PARA_HEADER, 0, paraHeaderData.length));
    chunks.push(paraHeaderData);
    chunks.push(makeRecordHeader(67, 1, paraTextData.length));
    chunks.push(paraTextData);
    const sectionRaw = concatUint8Arrays(...chunks);

    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true); // uncompressed

    const docInfoRaw = new Uint8Array(24);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', sectionRaw as any);

    return new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
  }

  it('should handle null chars (code 0) via extractTextFromHwp', () => {
    const data = new Uint8Array(6);
    const v = new DataView(data.buffer);
    v.setUint16(0, 0, true);
    v.setUint16(2, 0x41, true); // 'A'
    v.setUint16(4, 0, true);

    const text = extractTextFromHwp(createHwpWithRawParaText(data));
    expect(text).toBe('A');
  });

  it('should handle inline controls (1-9) via extractTextFromHwp', () => {
    // Control char 3 + 7 dummy WCHARs + 'X'
    const data = new Uint8Array(18);
    const v = new DataView(data.buffer);
    v.setUint16(0, 3, true);
    for (let i = 1; i < 8; i++) v.setUint16(i * 2, 0, true);
    v.setUint16(16, 0x58, true); // 'X'

    const text = extractTextFromHwp(createHwpWithRawParaText(data));
    expect(text).toBe('X');
  });

  it('should handle line break (code 10) via extractTextFromHwp', () => {
    const data = new Uint8Array(6);
    const v = new DataView(data.buffer);
    v.setUint16(0, 0x41, true); // 'A'
    v.setUint16(2, 10, true);   // \n
    v.setUint16(4, 0x42, true); // 'B'

    const text = extractTextFromHwp(createHwpWithRawParaText(data));
    expect(text).toContain('A');
    expect(text).toContain('B');
  });

  it('should handle inline controls (11-12) via extractTextFromHwp', () => {
    for (const ch of [11, 12]) {
      const data = new Uint8Array(18);
      const v = new DataView(data.buffer);
      v.setUint16(0, ch, true);
      for (let i = 1; i < 8; i++) v.setUint16(i * 2, 0, true);
      v.setUint16(16, 0x59, true); // 'Y'

      const text = extractTextFromHwp(createHwpWithRawParaText(data));
      expect(text).toBe('Y');
    }
  });

  it('should handle section break (code 13) via extractTextFromHwp', () => {
    const data = new Uint8Array(6);
    const v = new DataView(data.buffer);
    v.setUint16(0, 0x41, true); // 'A'
    v.setUint16(2, 13, true);   // section break
    v.setUint16(4, 0x42, true); // 'B'

    const text = extractTextFromHwp(createHwpWithRawParaText(data));
    expect(text).toContain('A');
    expect(text).toContain('B');
  });

  it('should handle inline controls (14-23) via extractTextFromHwp', () => {
    for (const ch of [14, 23]) {
      const data = new Uint8Array(18);
      const v = new DataView(data.buffer);
      v.setUint16(0, ch, true);
      for (let i = 1; i < 8; i++) v.setUint16(i * 2, 0, true);
      v.setUint16(16, 0x5A, true); // 'Z'

      const text = extractTextFromHwp(createHwpWithRawParaText(data));
      expect(text).toBe('Z');
    }
  });

  it('should handle reserved controls (24-31) via extractTextFromHwp', () => {
    const data = new Uint8Array(6);
    const v = new DataView(data.buffer);
    v.setUint16(0, 25, true);   // reserved
    v.setUint16(2, 0x41, true); // 'A'
    v.setUint16(4, 30, true);   // reserved

    const text = extractTextFromHwp(createHwpWithRawParaText(data));
    expect(text).toBe('A');
  });
});

describe('hwp-to-hwpx decodeParaText via convertHwpToHwpx', () => {
  function createHwpWithRawParaTextForConvert(paraTextData: Uint8Array): Uint8Array {
    const docInfoRaw = buildDocInfoStream();
    const chunks: Uint8Array[] = [];
    const paraHeaderData = new Uint8Array(22);
    chunks.push(makeRecordHeader(HWPTAG.PARA_HEADER, 0, paraHeaderData.length));
    chunks.push(paraHeaderData);
    // Add PARA_CHAR_SHAPE
    const charShapeRef = new Uint8Array(8);
    chunks.push(makeRecordHeader(68, 1, charShapeRef.length));
    chunks.push(charShapeRef);
    chunks.push(makeRecordHeader(67, 1, paraTextData.length));
    chunks.push(paraTextData);
    const sectionRaw = concatUint8Arrays(...chunks);

    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', sectionRaw as any);

    return new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
  }

  it('should handle null, line break, section break in hwp-to-hwpx', () => {
    const data = new Uint8Array(10);
    const v = new DataView(data.buffer);
    v.setUint16(0, 0, true);    // null
    v.setUint16(2, 0x41, true); // 'A'
    v.setUint16(4, 10, true);   // \n
    v.setUint16(6, 13, true);   // section break \n
    v.setUint16(8, 0x42, true); // 'B'

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = convertHwpToHwpx(createHwpWithRawParaTextForConvert(data));
    expect(result).toBeInstanceOf(Uint8Array);
    spy.mockRestore();
  });

  it('should handle inline controls (1-9, 11-12, 14-23) in hwp-to-hwpx', () => {
    for (const ch of [1, 9, 11, 12, 14, 23]) {
      const data = new Uint8Array(18);
      const v = new DataView(data.buffer);
      v.setUint16(0, ch, true);
      for (let i = 1; i < 8; i++) v.setUint16(i * 2, 0, true);
      v.setUint16(16, 0x41, true); // 'A'

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = convertHwpToHwpx(createHwpWithRawParaTextForConvert(data));
      expect(result).toBeInstanceOf(Uint8Array);
      spy.mockRestore();
    }
  });

  it('should handle reserved controls (24-31) in hwp-to-hwpx', () => {
    const data = new Uint8Array(6);
    const v = new DataView(data.buffer);
    v.setUint16(0, 24, true);
    v.setUint16(2, 0x41, true);
    v.setUint16(4, 31, true);

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = convertHwpToHwpx(createHwpWithRawParaTextForConvert(data));
    expect(result).toBeInstanceOf(Uint8Array);
    spy.mockRestore();
  });
});

// ─── hwp-to-hwpx.ts: style extraction and edge cases ───

describe('hwp-to-hwpx style extraction', () => {
  it('should convert HWP with rich DocInfo (fonts, charShapes, paraShapes)', async () => {
    const hwp = createRichTestHwp({ paragraphs: ['스타일 테스트'] });
    const hwpxBytes = convertHwpToHwpx(hwp);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
    expect(hwpxBytes.length).toBeGreaterThan(0);
  });

  it('should handle empty body text (no sections)', () => {
    // Create HWP with no BodyText sections
    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true); // uncompressed

    const docInfoRaw = buildDocInfoStream();

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    // No BodyText sections

    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    const result = convertHwpToHwpx(buf);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle section with no paragraphs (empty section)', async () => {
    // Section with no PARA_TEXT records
    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true);

    const docInfoRaw = buildDocInfoStream();
    // Empty section - no records
    const emptySectionRaw = new Uint8Array(0);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', emptySectionRaw as any);

    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    const result = convertHwpToHwpx(buf);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle multi-section with warnings for unsupported tags', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const hwp = createRichTestHwp({
      paragraphs: ['Section 1'],
      extraSections: [['Section 2']],
    });
    const result = convertHwpToHwpx(hwp);
    expect(result).toBeInstanceOf(Uint8Array);

    spy.mockRestore();
  });

  it('should extract style with charShapeId out of range', () => {
    // Create HWP where charShapeId references beyond docInfo.charShapes
    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true); // uncompressed

    const docInfoRaw = buildDocInfoStream(); // has 1 charShape, 1 paraShape

    // Build section with charShapeId = 99 (out of range)
    const chunks: Uint8Array[] = [];
    const paraHeaderData = new Uint8Array(22);
    new DataView(paraHeaderData.buffer).setUint32(4, 99, true); // paraShapeId = 99 (out of range)
    chunks.push(makeRecordHeader(HWPTAG.PARA_HEADER, 0, paraHeaderData.length));
    chunks.push(paraHeaderData);

    const charShapeRef = new Uint8Array(8);
    const csvView = new DataView(charShapeRef.buffer);
    csvView.setUint32(0, 0, true);
    csvView.setUint32(4, 99, true); // charShapeId = 99 (out of range)
    chunks.push(makeRecordHeader(68, 1, charShapeRef.length));
    chunks.push(charShapeRef);

    const text = encodeUtf16LE('Out of range test');
    chunks.push(makeRecordHeader(67, 1, text.length));
    chunks.push(text);

    const sectionRaw = concatUint8Arrays(...chunks);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', sectionRaw as any);

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    const result = convertHwpToHwpx(buf);
    expect(result).toBeInstanceOf(Uint8Array);
    spy.mockRestore();
  });

  it('should handle various para alignment values', () => {
    // Test with different alignment values in paraShape
    for (const align of [0, 1, 2, 3, 4, 5, 6]) {
      const docInfoChunks: Uint8Array[] = [];

      // Font
      const fontName = 'Test';
      const fontNameBytes = encodeUtf16LE(fontName);
      const faceNameData = new Uint8Array(3 + fontNameBytes.length);
      faceNameData[0] = 0x01;
      faceNameData[1] = fontName.length;
      faceNameData[2] = 0;
      faceNameData.set(fontNameBytes, 3);
      docInfoChunks.push(makeRecordHeader(HWPTAG.FACE_NAME, 0, faceNameData.length));
      docInfoChunks.push(faceNameData);

      // CharShape
      const charShapeData = new Uint8Array(58);
      new DataView(charShapeData.buffer).setUint32(42, 1000, true);
      docInfoChunks.push(makeRecordHeader(HWPTAG.CHAR_SHAPE, 0, charShapeData.length));
      docInfoChunks.push(charShapeData);

      // ParaShape with specific alignment
      const paraShapeData = new Uint8Array(28);
      new DataView(paraShapeData.buffer).setUint32(0, align << 2, true);
      new DataView(paraShapeData.buffer).setUint32(24, 160, true); // default line spacing
      docInfoChunks.push(makeRecordHeader(HWPTAG.PARA_SHAPE, 0, paraShapeData.length));
      docInfoChunks.push(paraShapeData);

      const docInfoRaw = concatUint8Arrays(...docInfoChunks);
      const sectionRaw = buildRichBodyTextStream([`Align ${align}`]);

      const fileHeader = new Uint8Array(256);
      fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
      const fhView = new DataView(fileHeader.buffer);
      fhView.setUint32(32, (5 << 24) | (1 << 16), true);
      fhView.setUint32(36, 0, true);

      const cfb = CFB.utils.cfb_new();
      CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
      CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
      CFB.utils.cfb_add(cfb, '/BodyText/Section0', sectionRaw as any);

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
      const result = convertHwpToHwpx(buf);
      expect(result).toBeInstanceOf(Uint8Array);
      spy.mockRestore();
    }
  });

  it('should handle PARA_HEADER with insufficient data in hwp-to-hwpx path', () => {
    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true);

    const docInfoRaw = buildDocInfoStream();

    // Section with small PARA_HEADER (< 8 bytes)
    const chunks: Uint8Array[] = [];
    const smallHeader = new Uint8Array(4);
    chunks.push(makeRecordHeader(HWPTAG.PARA_HEADER, 0, smallHeader.length));
    chunks.push(smallHeader);
    const text = encodeUtf16LE('Small header');
    chunks.push(makeRecordHeader(67, 1, text.length));
    chunks.push(text);
    const sectionRaw = concatUint8Arrays(...chunks);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', sectionRaw as any);

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    const result = convertHwpToHwpx(buf);
    expect(result).toBeInstanceOf(Uint8Array);
    spy.mockRestore();
  });

  it('should handle charShape with fontId out of fontNames range', () => {
    const docInfoChunks: Uint8Array[] = [];

    // No font names - skip FACE_NAME

    // CharShape with fontId = 5 (out of range since no fonts)
    const charShapeData = new Uint8Array(58);
    const csView = new DataView(charShapeData.buffer);
    for (let i = 0; i < 7; i++) csView.setUint16(i * 2, 5, true); // fontId = 5
    csView.setUint32(42, 1200, true);
    csView.setUint32(46, 0, true);
    docInfoChunks.push(makeRecordHeader(HWPTAG.CHAR_SHAPE, 0, charShapeData.length));
    docInfoChunks.push(charShapeData);

    // ParaShape
    const paraShapeData = new Uint8Array(28);
    new DataView(paraShapeData.buffer).setUint32(24, 200, true);
    docInfoChunks.push(makeRecordHeader(HWPTAG.PARA_SHAPE, 0, paraShapeData.length));
    docInfoChunks.push(paraShapeData);

    const docInfoRaw = concatUint8Arrays(...docInfoChunks);
    const sectionRaw = buildRichBodyTextStream(['Font out of range']);

    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', sectionRaw as any);

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    const result = convertHwpToHwpx(buf);
    expect(result).toBeInstanceOf(Uint8Array);
    spy.mockRestore();
  });

  it('should handle paraShape with default lineSpacing (160)', () => {
    const docInfoChunks: Uint8Array[] = [];

    const fontName = 'Arial';
    const fontNameBytes = encodeUtf16LE(fontName);
    const faceNameData = new Uint8Array(3 + fontNameBytes.length);
    faceNameData[0] = 0x01;
    faceNameData[1] = fontName.length;
    faceNameData[2] = 0;
    faceNameData.set(fontNameBytes, 3);
    docInfoChunks.push(makeRecordHeader(HWPTAG.FACE_NAME, 0, faceNameData.length));
    docInfoChunks.push(faceNameData);

    const charShapeData = new Uint8Array(58);
    new DataView(charShapeData.buffer).setUint32(42, 1000, true);
    docInfoChunks.push(makeRecordHeader(HWPTAG.CHAR_SHAPE, 0, charShapeData.length));
    docInfoChunks.push(charShapeData);

    // ParaShape with lineSpacing = 160 (default, should NOT set style.lineSpacing)
    const paraShapeData = new Uint8Array(28);
    new DataView(paraShapeData.buffer).setUint32(0, 1 << 2, true); // left align
    new DataView(paraShapeData.buffer).setUint32(24, 160, true);
    docInfoChunks.push(makeRecordHeader(HWPTAG.PARA_SHAPE, 0, paraShapeData.length));
    docInfoChunks.push(paraShapeData);

    const docInfoRaw = concatUint8Arrays(...docInfoChunks);
    const sectionRaw = buildRichBodyTextStream(['Default spacing']);

    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', sectionRaw as any);

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    const result = convertHwpToHwpx(buf);
    expect(result).toBeInstanceOf(Uint8Array);
    spy.mockRestore();
  });

  it('should handle paraShape with lineSpacing = 0', () => {
    const docInfoChunks: Uint8Array[] = [];

    const charShapeData = new Uint8Array(58);
    new DataView(charShapeData.buffer).setUint32(42, 1000, true);
    docInfoChunks.push(makeRecordHeader(HWPTAG.CHAR_SHAPE, 0, charShapeData.length));
    docInfoChunks.push(charShapeData);

    const paraShapeData = new Uint8Array(28);
    new DataView(paraShapeData.buffer).setUint32(24, 0, true); // lineSpacing = 0
    docInfoChunks.push(makeRecordHeader(HWPTAG.PARA_SHAPE, 0, paraShapeData.length));
    docInfoChunks.push(paraShapeData);

    const docInfoRaw = concatUint8Arrays(...docInfoChunks);
    const sectionRaw = buildRichBodyTextStream(['Zero spacing']);

    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', sectionRaw as any);

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    const result = convertHwpToHwpx(buf);
    expect(result).toBeInstanceOf(Uint8Array);
    spy.mockRestore();
  });

  it('should handle paragraph with no PARA_CHAR_SHAPE (default charShapeId 0)', () => {
    const fileHeader = new Uint8Array(256);
    fileHeader.set(new TextEncoder().encode('HWP Document File'), 0);
    const fhView = new DataView(fileHeader.buffer);
    fhView.setUint32(32, (5 << 24) | (1 << 16), true);
    fhView.setUint32(36, 0, true);

    const docInfoRaw = buildDocInfoStream();

    // Section with PARA_HEADER + PARA_TEXT but no PARA_CHAR_SHAPE
    const chunks: Uint8Array[] = [];
    const paraHeaderData = new Uint8Array(22);
    chunks.push(makeRecordHeader(HWPTAG.PARA_HEADER, 0, paraHeaderData.length));
    chunks.push(paraHeaderData);
    const text = encodeUtf16LE('No char shape');
    chunks.push(makeRecordHeader(67, 1, text.length));
    chunks.push(text);
    const sectionRaw = concatUint8Arrays(...chunks);

    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoRaw as any);
    CFB.utils.cfb_add(cfb, '/BodyText/Section0', sectionRaw as any);

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const buf = new Uint8Array(CFB.write(cfb, { type: 'array' }) as ArrayBuffer);
    const result = convertHwpToHwpx(buf);
    expect(result).toBeInstanceOf(Uint8Array);
    spy.mockRestore();
  });
});
