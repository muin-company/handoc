/**
 * Comprehensive tests for body-parser.ts to achieve 95%+ coverage
 */

import { describe, it, expect } from 'vitest';
import {
  parseSectionContent,
  type ParaCharShapeRange,
  type HwpControl,
  type HwpTableInfo,
  type HwpParagraph,
} from '../body-parser.js';
import { HWPTAG, type HwpRecord } from '../record-parser.js';

describe('parseSectionContent', () => {
  it('should parse empty records', () => {
    const result = parseSectionContent([]);
    expect(result.paragraphs).toEqual([]);
    expect(result.tables).toEqual([]);
    expect(result.controls).toEqual([]);
  });

  it('should parse a simple paragraph with PARA_HEADER and PARA_TEXT', () => {
    // PARA_HEADER: para shape ID at offset 6-7 (uint16)
    const paraHeader = new Uint8Array(10);
    paraHeader[6] = 0x05; // para shape ID = 5
    paraHeader[7] = 0x00;

    // PARA_TEXT: UTF-16LE "안녕"
    // '안' = U+C548 → 0x48 0xC5, '녕' = U+B155 → 0x55 0xB1
    const text = new Uint8Array([0x48, 0xC5, 0x55, 0xB1]); // '안녕' in UTF-16LE

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: 4, data: text },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0].text).toBe('안녕');
    expect(result.paragraphs[0].paraShapeId).toBe(5);
    expect(result.paragraphs[0].level).toBe(0);
    expect(result.paragraphs[0].charShapes).toEqual([]);
  });

  it('should parse paragraph with newline characters (0x0A, 0x0D)', () => {
    const paraHeader = new Uint8Array(10);

    // PARA_TEXT with newlines: char 0x0A (newline), then 'A' (0x0041)
    const text = new Uint8Array([
      0x0a, 0x00, // \n
      0x41, 0x00, // A
      0x0d, 0x00, // \r (also becomes \n)
      0x42, 0x00, // B
    ]);

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: text.byteLength, data: text },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs[0].text).toBe('\nA\nB');
  });

  it('should handle control characters (ch 0, 1-9, 11-12, 14-23, 24-31)', () => {
    const paraHeader = new Uint8Array(10);

    // Test different control character ranges
    const text = new Uint8Array([
      0x00, 0x00, // ch=0 (skip 2 bytes)
      0x01, 0x00, // ch=1 (skip 16 bytes)
      ...new Array(14).fill(0),
      0x41, 0x00, // A
      0x0b, 0x00, // ch=11 (skip 16 bytes)
      ...new Array(14).fill(0),
      0x42, 0x00, // B
      0x18, 0x00, // ch=24 (skip 2 bytes)
      0x43, 0x00, // C
    ]);

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: text.byteLength, data: text },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs[0].text).toBe('ABC');
  });

  it('should parse PARA_CHAR_SHAPE with multiple ranges', () => {
    const paraHeader = new Uint8Array(10);
    const text = new Uint8Array([0x41, 0x00, 0x42, 0x00]); // AB

    // PARA_CHAR_SHAPE: 2 entries (pos=0, charShapeId=1) and (pos=1, charShapeId=2)
    const charShape = new Uint8Array(16);
    const view = new DataView(charShape.buffer);
    view.setUint32(0, 0, true); // pos=0
    view.setUint32(4, 1, true); // charShapeId=1
    view.setUint32(8, 1, true); // pos=1
    view.setUint32(12, 2, true); // charShapeId=2

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: 4, data: text },
      { tagId: HWPTAG.PARA_CHAR_SHAPE, level: 0, size: 16, data: charShape },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs[0].charShapes).toHaveLength(2);
    expect(result.paragraphs[0].charShapes[0]).toEqual({ pos: 0, charShapeId: 1 });
    expect(result.paragraphs[0].charShapes[1]).toEqual({ pos: 1, charShapeId: 2 });
  });

  it('should parse multiple paragraphs with different levels', () => {
    const paraHeader1 = new Uint8Array(10);
    paraHeader1[6] = 1; // paraShapeId=1
    const text1 = new Uint8Array([0x41, 0x00]); // A

    const paraHeader2 = new Uint8Array(10);
    paraHeader2[6] = 2; // paraShapeId=2
    const text2 = new Uint8Array([0x42, 0x00]); // B

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader1 },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: 2, data: text1 },
      { tagId: HWPTAG.PARA_HEADER, level: 1, size: 10, data: paraHeader2 },
      { tagId: HWPTAG.PARA_TEXT, level: 1, size: 2, data: text2 },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs).toHaveLength(2);
    expect(result.paragraphs[0].text).toBe('A');
    expect(result.paragraphs[0].level).toBe(0);
    expect(result.paragraphs[1].text).toBe('B');
    expect(result.paragraphs[1].level).toBe(1);
  });

  it('should parse CTRL_HEADER with control ID', () => {
    const paraHeader = new Uint8Array(10);
    const text = new Uint8Array([0x41, 0x00]); // A

    // CTRL_HEADER: 4 bytes for control ID (reversed ASCII 'tbl ')
    // In little-endian: 0x206c6274 → ' lbt' reversed → 'tbl '
    const ctrlHeader = new Uint8Array(4);
    ctrlHeader[0] = 0x74; // 't'
    ctrlHeader[1] = 0x62; // 'b'
    ctrlHeader[2] = 0x6c; // 'l'
    ctrlHeader[3] = 0x20; // ' '

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.CTRL_HEADER, level: 0, size: 4, data: ctrlHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: 2, data: text },
    ];

    const result = parseSectionContent(records);
    expect(result.controls).toHaveLength(1);
    expect(result.controls[0].ctrlId).toBe(' lbt'); // reversed
  });

  it('should ignore CTRL_HEADER with insufficient data', () => {
    const paraHeader = new Uint8Array(10);
    const ctrlHeader = new Uint8Array(2); // Too short

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.CTRL_HEADER, level: 0, size: 2, data: ctrlHeader },
    ];

    const result = parseSectionContent(records);
    expect(result.controls).toHaveLength(0);
  });

  it('should parse TABLE record with table info', () => {
    const paraHeader = new Uint8Array(10);

    // TABLE: properties (4 bytes), rows (2 bytes), cols (2 bytes)
    const table = new Uint8Array(8);
    const view = new DataView(table.buffer);
    view.setUint32(0, 0, true); // properties
    view.setUint16(4, 3, true); // rows=3
    view.setUint16(6, 2, true); // cols=2

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.TABLE, level: 0, size: 8, data: table },
    ];

    const result = parseSectionContent(records);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].info.rows).toBe(3);
    expect(result.tables[0].info.cols).toBe(2);
    expect(result.tables[0].info.cellCountPerRow).toEqual([2, 2, 2]);
    expect(result.tables[0].cells).toEqual([]);
  });

  it('should ignore TABLE record with insufficient data', () => {
    const paraHeader = new Uint8Array(10);
    const table = new Uint8Array(4); // Too short

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.TABLE, level: 0, size: 4, data: table },
    ];

    const result = parseSectionContent(records);
    expect(result.tables).toHaveLength(0);
  });

  it('should handle PARA_HEADER with insufficient data (default paraShapeId=0)', () => {
    const shortHeader = new Uint8Array(4); // Less than 8 bytes

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 4, data: shortHeader },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0].paraShapeId).toBe(0);
  });

  it('should flush last paragraph at end of records', () => {
    const paraHeader = new Uint8Array(10);
    const text = new Uint8Array([0x5a, 0x00]); // Z

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: 2, data: text },
      // No subsequent PARA_HEADER, so should flush at end
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0].text).toBe('Z');
  });

  it('should handle edge case: control characters 14-23', () => {
    const paraHeader = new Uint8Array(10);

    // ch=14 (skip 16 bytes), then 'X'
    const text = new Uint8Array([
      0x0e, 0x00, // ch=14
      ...new Array(14).fill(0),
      0x58, 0x00, // X
      0x17, 0x00, // ch=23 (skip 16 bytes)
      ...new Array(14).fill(0),
      0x59, 0x00, // Y
    ]);

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: text.byteLength, data: text },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs[0].text).toBe('XY');
  });

  it('should handle empty PARA_CHAR_SHAPE (no ranges)', () => {
    const paraHeader = new Uint8Array(10);
    const text = new Uint8Array([0x41, 0x00]); // A
    const emptyCharShape = new Uint8Array(0);

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: 2, data: text },
      { tagId: HWPTAG.PARA_CHAR_SHAPE, level: 0, size: 0, data: emptyCharShape },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs[0].charShapes).toEqual([]);
  });

  it('should handle normal ASCII characters', () => {
    const paraHeader = new Uint8Array(10);

    // Normal ASCII range (0x20-0x7E)
    const text = new Uint8Array([
      0x48, 0x00, // H
      0x65, 0x00, // e
      0x6c, 0x00, // l
      0x6c, 0x00, // l
      0x6f, 0x00, // o
    ]);

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: text.byteLength, data: text },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs[0].text).toBe('Hello');
  });

  it('should handle mixed control characters and normal text', () => {
    const paraHeader = new Uint8Array(10);

    const text = new Uint8Array([
      0x01, 0x00, // ch=1 (skip 16)
      ...new Array(14).fill(0),
      0x41, 0x00, // A
      0x00, 0x00, // ch=0 (skip 2)
      0x42, 0x00, // B
      0x0a, 0x00, // \n
      0x18, 0x00, // ch=24 (skip 2)
      0x43, 0x00, // C
    ]);

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_HEADER, level: 0, size: 10, data: paraHeader },
      { tagId: HWPTAG.PARA_TEXT, level: 0, size: text.byteLength, data: text },
    ];

    const result = parseSectionContent(records);
    expect(result.paragraphs[0].text).toBe('AB\nC');
  });
});
