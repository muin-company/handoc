/**
 * Comprehensive tests for docinfo-parser.ts to achieve 95%+ coverage
 */

import { describe, it, expect } from 'vitest';
import { parseDocInfo, type CharShape, type ParaShape } from '../docinfo-parser.js';
import { HWPTAG, type HwpRecord } from '../record-parser.js';

describe('parseDocInfo', () => {
  it('should parse empty records', () => {
    const result = parseDocInfo([]);
    expect(result.fontNames).toEqual([]);
    expect(result.charShapes).toEqual([]);
    expect(result.paraShapes).toEqual([]);
  });

  it('should parse FACE_NAME with valid UTF-16LE string', () => {
    // FACE_NAME: prop (1 byte), name length in chars (2 bytes), then UTF-16LE name
    const data = new Uint8Array(15);
    data[0] = 0x00; // property
    data[1] = 0x05; // name length = 5 chars
    data[2] = 0x00;
    // UTF-16LE "Arial"
    data[3] = 0x41; // A
    data[4] = 0x00;
    data[5] = 0x72; // r
    data[6] = 0x00;
    data[7] = 0x69; // i
    data[8] = 0x00;
    data[9] = 0x61; // a
    data[10] = 0x00;
    data[11] = 0x6c; // l
    data[12] = 0x00;
    data[13] = 0x00; // null terminator
    data[14] = 0x00;

    const records: HwpRecord[] = [
      { tagId: HWPTAG.FACE_NAME, level: 0, size: data.byteLength, data },
    ];

    const result = parseDocInfo(records);
    expect(result.fontNames).toHaveLength(1);
    expect(result.fontNames[0]).toBe('Arial');
  });

  it('should parse FACE_NAME with Korean characters', () => {
    const data = new Uint8Array(9);
    data[0] = 0x00; // property
    data[1] = 0x02; // name length = 2 chars
    data[2] = 0x00;
    // UTF-16LE "한글" (Hangul)
    // '한' = U+D55C → 0x5C 0xD5, '글' = U+AE00 → 0x00 0xAE
    data[3] = 0x5C; // 한 low byte
    data[4] = 0xD5; // 한 high byte
    data[5] = 0x00; // 글 low byte
    data[6] = 0xAE; // 글 high byte
    data[7] = 0x00; // null
    data[8] = 0x00;

    const records: HwpRecord[] = [
      { tagId: HWPTAG.FACE_NAME, level: 0, size: data.byteLength, data },
    ];

    const result = parseDocInfo(records);
    expect(result.fontNames).toHaveLength(1);
    expect(result.fontNames[0]).toBe('한글');
  });

  it('should handle FACE_NAME with null terminator in name', () => {
    const data = new Uint8Array(13);
    data[0] = 0x00;
    data[1] = 0x04; // name length = 4 chars
    data[2] = 0x00;
    // "Ab\0c" (null in middle)
    data[3] = 0x41; // A
    data[4] = 0x00;
    data[5] = 0x62; // b
    data[6] = 0x00;
    data[7] = 0x00; // null terminator
    data[8] = 0x00;
    data[9] = 0x63; // c
    data[10] = 0x00;
    data[11] = 0x00;
    data[12] = 0x00;

    const records: HwpRecord[] = [
      { tagId: HWPTAG.FACE_NAME, level: 0, size: data.byteLength, data },
    ];

    const result = parseDocInfo(records);
    expect(result.fontNames).toHaveLength(1);
    expect(result.fontNames[0]).toBe('Ab'); // Should strip after null
  });

  it('should ignore FACE_NAME with insufficient data', () => {
    const data = new Uint8Array(2); // Too short (< 3 bytes)

    const records: HwpRecord[] = [
      { tagId: HWPTAG.FACE_NAME, level: 0, size: 2, data },
    ];

    const result = parseDocInfo(records);
    expect(result.fontNames).toHaveLength(0);
  });

  it('should ignore FACE_NAME with zero length', () => {
    const data = new Uint8Array(3);
    data[0] = 0x00; // property
    data[1] = 0x00; // name length = 0
    data[2] = 0x00;

    const records: HwpRecord[] = [
      { tagId: HWPTAG.FACE_NAME, level: 0, size: 3, data },
    ];

    const result = parseDocInfo(records);
    expect(result.fontNames).toHaveLength(0);
  });

  it('should parse CHAR_SHAPE with all properties', () => {
    // CHAR_SHAPE layout (minimum 58 bytes):
    // 0-13: 7 x uint16 font ID
    // 14-20: widths (ignored in this parser)
    // 21-27: spacing (ignored)
    // 28-34: relative sizes (ignored)
    // 35-41: offsets (ignored)
    // 42-45: int32 height
    // 46-49: uint32 properties (bit 0=italic, bit 1=bold)
    // 50-53: shadow spacing (ignored)
    // 54-57: uint32 color (0xBBGGRR)

    const data = new Uint8Array(58);
    const view = new DataView(data.buffer);

    // Font IDs (7 x uint16)
    for (let i = 0; i < 7; i++) {
      view.setUint16(i * 2, i + 10, true); // fontId[i] = i + 10
    }

    view.setUint32(42, 1200, true); // height = 1200 HU (12pt)
    view.setUint32(46, 0b11, true); // props: bit 0 (italic) + bit 1 (bold)
    view.setUint32(54, 0x0000ff, true); // color = red (0x0000FF)

    const records: HwpRecord[] = [
      { tagId: HWPTAG.CHAR_SHAPE, level: 0, size: 58, data },
    ];

    const result = parseDocInfo(records);
    expect(result.charShapes).toHaveLength(1);
    const cs = result.charShapes[0];
    expect(cs.fontId).toEqual([10, 11, 12, 13, 14, 15, 16]);
    expect(cs.height).toBe(1200);
    expect(cs.bold).toBe(true);
    expect(cs.italic).toBe(true);
    expect(cs.color).toBe(0x0000ff);
  });

  it('should parse CHAR_SHAPE with no bold/italic', () => {
    const data = new Uint8Array(58);
    const view = new DataView(data.buffer);

    // Font IDs
    for (let i = 0; i < 7; i++) {
      view.setUint16(i * 2, 1, true);
    }

    view.setUint32(42, 1000, true); // height
    view.setUint32(46, 0, true); // props = 0 (no italic, no bold)
    view.setUint32(54, 0x000000, true); // color = black

    const records: HwpRecord[] = [
      { tagId: HWPTAG.CHAR_SHAPE, level: 0, size: 58, data },
    ];

    const result = parseDocInfo(records);
    expect(result.charShapes[0].bold).toBe(false);
    expect(result.charShapes[0].italic).toBe(false);
  });

  it('should ignore CHAR_SHAPE with insufficient data', () => {
    const data = new Uint8Array(50); // Less than 58 bytes

    const records: HwpRecord[] = [
      { tagId: HWPTAG.CHAR_SHAPE, level: 0, size: 50, data },
    ];

    const result = parseDocInfo(records);
    expect(result.charShapes).toHaveLength(0);
  });

  it('should parse PARA_SHAPE with alignment and line spacing', () => {
    // PARA_SHAPE layout:
    // 0-3: uint32 properties1 (bits 2-4 = alignment)
    // ...
    // 24-27: int32 line spacing value

    const data = new Uint8Array(28);
    const view = new DataView(data.buffer);

    // props1: align=2 (right), bits 2-4 = 0b010
    const props1 = (2 << 2); // align = 2 (right)
    view.setUint32(0, props1, true);
    view.setUint32(24, 180, true); // line spacing = 180%

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_SHAPE, level: 0, size: 28, data },
    ];

    const result = parseDocInfo(records);
    expect(result.paraShapes).toHaveLength(1);
    expect(result.paraShapes[0].align).toBe(2);
    expect(result.paraShapes[0].lineSpacing).toBe(180);
  });

  it('should parse PARA_SHAPE with different alignments', () => {
    const testCases = [
      { align: 0, name: 'justify' },
      { align: 1, name: 'left' },
      { align: 2, name: 'right' },
      { align: 3, name: 'center' },
      { align: 4, name: 'distribute' },
      { align: 5, name: 'split-justify' },
    ];

    for (const { align } of testCases) {
      const data = new Uint8Array(28);
      const view = new DataView(data.buffer);
      const props1 = align << 2;
      view.setUint32(0, props1, true);
      view.setUint32(24, 160, true);

      const records: HwpRecord[] = [
        { tagId: HWPTAG.PARA_SHAPE, level: 0, size: 28, data },
      ];

      const result = parseDocInfo(records);
      expect(result.paraShapes[0].align).toBe(align);
    }
  });

  it('should use default line spacing if data is short', () => {
    // Less than 28 bytes, so lineSpacing should default to 160
    const data = new Uint8Array(10);
    const view = new DataView(data.buffer);
    const props1 = (1 << 2); // align = 1
    view.setUint32(0, props1, true);

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_SHAPE, level: 0, size: 10, data },
    ];

    const result = parseDocInfo(records);
    expect(result.paraShapes[0].align).toBe(1);
    expect(result.paraShapes[0].lineSpacing).toBe(160); // default
  });

  it('should ignore PARA_SHAPE with insufficient data (< 8 bytes)', () => {
    const data = new Uint8Array(6); // Too short

    const records: HwpRecord[] = [
      { tagId: HWPTAG.PARA_SHAPE, level: 0, size: 6, data },
    ];

    const result = parseDocInfo(records);
    expect(result.paraShapes).toHaveLength(0);
  });

  it('should parse multiple font names, char shapes, and para shapes', () => {
    const fontData1 = new Uint8Array(9);
    fontData1[0] = 0x00;
    fontData1[1] = 0x02;
    fontData1[2] = 0x00;
    fontData1[3] = 0x41; fontData1[4] = 0x00; // A
    fontData1[5] = 0x42; fontData1[6] = 0x00; // B
    fontData1[7] = 0x00; fontData1[8] = 0x00;

    const fontData2 = new Uint8Array(9);
    fontData2[0] = 0x00;
    fontData2[1] = 0x02;
    fontData2[2] = 0x00;
    fontData2[3] = 0x43; fontData2[4] = 0x00; // C
    fontData2[5] = 0x44; fontData2[6] = 0x00; // D
    fontData2[7] = 0x00; fontData2[8] = 0x00;

    const charShapeData = new Uint8Array(58);
    const view1 = new DataView(charShapeData.buffer);
    for (let i = 0; i < 7; i++) view1.setUint16(i * 2, 5, true);
    view1.setUint32(42, 1000, true);
    view1.setUint32(46, 0, true);
    view1.setUint32(54, 0, true);

    const paraShapeData = new Uint8Array(28);
    const view2 = new DataView(paraShapeData.buffer);
    view2.setUint32(0, (3 << 2), true); // align = 3 (center)
    view2.setUint32(24, 200, true);

    const records: HwpRecord[] = [
      { tagId: HWPTAG.FACE_NAME, level: 0, size: fontData1.byteLength, data: fontData1 },
      { tagId: HWPTAG.FACE_NAME, level: 0, size: fontData2.byteLength, data: fontData2 },
      { tagId: HWPTAG.CHAR_SHAPE, level: 0, size: 58, data: charShapeData },
      { tagId: HWPTAG.PARA_SHAPE, level: 0, size: 28, data: paraShapeData },
    ];

    const result = parseDocInfo(records);
    expect(result.fontNames).toEqual(['AB', 'CD']);
    expect(result.charShapes).toHaveLength(1);
    expect(result.paraShapes).toHaveLength(1);
    expect(result.paraShapes[0].align).toBe(3);
  });

  it('should handle records with unknown tag IDs (ignore them)', () => {
    const fontData = new Uint8Array(9);
    fontData[0] = 0x00;
    fontData[1] = 0x01;
    fontData[2] = 0x00;
    fontData[3] = 0x58; fontData[4] = 0x00; // X
    fontData[5] = 0x00; fontData[6] = 0x00;

    const records: HwpRecord[] = [
      { tagId: HWPTAG.FACE_NAME, level: 0, size: 9, data: fontData },
      { tagId: 9999 as any, level: 0, size: 4, data: new Uint8Array(4) }, // Unknown tag
    ];

    const result = parseDocInfo(records);
    expect(result.fontNames).toEqual(['X']);
  });

  it('should handle CHAR_SHAPE with only italic (bit 0)', () => {
    const data = new Uint8Array(58);
    const view = new DataView(data.buffer);

    for (let i = 0; i < 7; i++) view.setUint16(i * 2, 0, true);
    view.setUint32(42, 1100, true);
    view.setUint32(46, 0b01, true); // Only italic
    view.setUint32(54, 0xff0000, true); // Blue

    const records: HwpRecord[] = [
      { tagId: HWPTAG.CHAR_SHAPE, level: 0, size: 58, data },
    ];

    const result = parseDocInfo(records);
    expect(result.charShapes[0].italic).toBe(true);
    expect(result.charShapes[0].bold).toBe(false);
    expect(result.charShapes[0].color).toBe(0xff0000);
  });

  it('should handle CHAR_SHAPE with only bold (bit 1)', () => {
    const data = new Uint8Array(58);
    const view = new DataView(data.buffer);

    for (let i = 0; i < 7; i++) view.setUint16(i * 2, 0, true);
    view.setUint32(42, 1100, true);
    view.setUint32(46, 0b10, true); // Only bold
    view.setUint32(54, 0x00ff00, true); // Green

    const records: HwpRecord[] = [
      { tagId: HWPTAG.CHAR_SHAPE, level: 0, size: 58, data },
    ];

    const result = parseDocInfo(records);
    expect(result.charShapes[0].italic).toBe(false);
    expect(result.charShapes[0].bold).toBe(true);
    expect(result.charShapes[0].color).toBe(0x00ff00);
  });
});
