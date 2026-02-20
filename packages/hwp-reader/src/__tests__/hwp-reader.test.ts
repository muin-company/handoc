import { describe, it, expect } from 'vitest';
import { openCfb } from '../cfb-reader.js';
import { readHwp } from '../hwp-reader.js';
import { parseRecords } from '../record-parser.js';
import { extractTextFromHwp } from '../text-extractor.js';
import { createTestHwp } from './create-test-hwp.js';

describe('cfb-reader', () => {
  it('should list streams from a synthetic HWP', () => {
    const hwpBuffer = createTestHwp();
    const cfb = openCfb(hwpBuffer);
    const streams = cfb.listStreams();
    expect(streams.length).toBeGreaterThanOrEqual(3);
    expect(streams.some(s => s.includes('FileHeader'))).toBe(true);
    expect(streams.some(s => s.includes('DocInfo'))).toBe(true);
    expect(streams.some(s => s.includes('Section0'))).toBe(true);
  });

  it('should get a stream by name', () => {
    const hwpBuffer = createTestHwp();
    const cfb = openCfb(hwpBuffer);
    const fileHeader = cfb.getStream('FileHeader');
    expect(fileHeader.length).toBe(256);
  });

  it('should throw for missing stream', () => {
    const hwpBuffer = createTestHwp();
    const cfb = openCfb(hwpBuffer);
    expect(() => cfb.getStream('NonExistent')).toThrow('Stream not found');
  });
});

describe('hwp-reader', () => {
  it('should parse FileHeader from compressed HWP', () => {
    const hwpBuffer = createTestHwp({ compressed: true });
    const doc = readHwp(hwpBuffer);
    expect(doc.fileHeader.signature).toBe('HWP Document File');
    expect(doc.fileHeader.version.major).toBe(5);
    expect(doc.fileHeader.version.minor).toBe(1);
    expect(doc.fileHeader.compressed).toBe(true);
    expect(doc.fileHeader.encrypted).toBe(false);
  });

  it('should parse FileHeader from uncompressed HWP', () => {
    const hwpBuffer = createTestHwp({ compressed: false });
    const doc = readHwp(hwpBuffer);
    expect(doc.fileHeader.compressed).toBe(false);
    expect(doc.fileHeader.encrypted).toBe(false);
  });

  it('should decompress DocInfo stream', () => {
    const hwpBuffer = createTestHwp({ compressed: true });
    const doc = readHwp(hwpBuffer);
    expect(doc.docInfo.length).toBe(24);
    expect(doc.docInfo[8]).toBe(0x42);
  });

  it('should extract uncompressed DocInfo', () => {
    const hwpBuffer = createTestHwp({ compressed: false });
    const doc = readHwp(hwpBuffer);
    expect(doc.docInfo.length).toBe(24);
  });

  it('should extract BodyText sections', () => {
    const hwpBuffer = createTestHwp({ compressed: true });
    const doc = readHwp(hwpBuffer);
    expect(doc.bodyText.length).toBe(1);
    expect(doc.bodyText[0].length).toBeGreaterThan(0);
  });

  it('should handle multiple sections', () => {
    const hwpBuffer = createTestHwp({
      paragraphs: ['첫 번째 섹션'],
      extraSections: [['두 번째 섹션']],
    });
    const doc = readHwp(hwpBuffer);
    expect(doc.bodyText.length).toBe(2);
  });

  it('should handle different version numbers', () => {
    const hwpBuffer = createTestHwp({ version: { major: 5, minor: 0, build: 3, revision: 2 } });
    const doc = readHwp(hwpBuffer);
    expect(doc.fileHeader.version).toEqual({ major: 5, minor: 0, build: 3, revision: 2 });
  });

  it('should expose cfb for advanced access', () => {
    const hwpBuffer = createTestHwp();
    const doc = readHwp(hwpBuffer);
    expect(doc.cfb.listStreams().length).toBeGreaterThanOrEqual(3);
  });
});

describe('record-parser', () => {
  it('should parse records from BodyText stream', () => {
    const hwpBuffer = createTestHwp({ compressed: false });
    const doc = readHwp(hwpBuffer);
    const records = parseRecords(doc.bodyText[0]);
    expect(records.length).toBeGreaterThan(0);
    // Should have PARA_HEADER (66) and PARA_TEXT (67) records
    expect(records.some(r => r.tagId === 66)).toBe(true);
    expect(records.some(r => r.tagId === 67)).toBe(true);
  });

  it('should parse correct tag IDs and levels', () => {
    const hwpBuffer = createTestHwp({ compressed: false, paragraphs: ['테스트'] });
    const doc = readHwp(hwpBuffer);
    const records = parseRecords(doc.bodyText[0]);
    const paraHeader = records.find(r => r.tagId === 66)!;
    const paraText = records.find(r => r.tagId === 67)!;
    expect(paraHeader.level).toBe(0);
    expect(paraText.level).toBe(1);
  });

  it('should handle empty stream', () => {
    const records = parseRecords(new Uint8Array(0));
    expect(records).toEqual([]);
  });
});

describe('text-extractor', () => {
  it('should extract Korean text from HWP', () => {
    const hwpBuffer = createTestHwp({
      paragraphs: ['안녕하세요 한글 문서입니다.', '두 번째 문단입니다.'],
    });
    const text = extractTextFromHwp(hwpBuffer);
    expect(text).toContain('안녕하세요');
    expect(text).toContain('한글 문서입니다');
    expect(text).toContain('두 번째 문단');
  });

  it('should extract text from uncompressed HWP', () => {
    const hwpBuffer = createTestHwp({
      compressed: false,
      paragraphs: ['압축되지 않은 문서'],
    });
    const text = extractTextFromHwp(hwpBuffer);
    expect(text).toContain('압축되지 않은 문서');
  });

  it('should extract text from multiple sections', () => {
    const hwpBuffer = createTestHwp({
      paragraphs: ['섹션1 내용'],
      extraSections: [['섹션2 내용']],
    });
    const text = extractTextFromHwp(hwpBuffer);
    expect(text).toContain('섹션1 내용');
    expect(text).toContain('섹션2 내용');
  });

  it('should handle English text', () => {
    const hwpBuffer = createTestHwp({
      paragraphs: ['Hello World', 'This is a test document.'],
    });
    const text = extractTextFromHwp(hwpBuffer);
    expect(text).toContain('Hello World');
    expect(text).toContain('This is a test document.');
  });

  it('should handle mixed Korean and English', () => {
    const hwpBuffer = createTestHwp({
      paragraphs: ['한글과 English가 섞인 문서입니다.'],
    });
    const text = extractTextFromHwp(hwpBuffer);
    expect(text).toContain('한글과 English가 섞인');
  });

  it('should return non-empty text', () => {
    const hwpBuffer = createTestHwp();
    const text = extractTextFromHwp(hwpBuffer);
    expect(text.length).toBeGreaterThan(0);
  });

  // Variant tests
  for (let i = 0; i < 10; i++) {
    it(`should handle synthetic HWP variant ${i}`, () => {
      const compressed = i % 2 === 0;
      const hwpBuffer = createTestHwp({
        compressed,
        version: { major: 5, minor: i % 4, build: i, revision: 0 },
        paragraphs: [`테스트 문단 ${i}`, `변형 ${i} 두번째 문단`],
      });
      const doc = readHwp(hwpBuffer);
      expect(doc.fileHeader.signature).toBe('HWP Document File');
      expect(doc.fileHeader.version.major).toBe(5);
      expect(doc.fileHeader.compressed).toBe(compressed);

      const text = extractTextFromHwp(hwpBuffer);
      expect(text).toContain(`테스트 문단 ${i}`);
      expect(text).toContain(`변형 ${i}`);
    });
  }
});
