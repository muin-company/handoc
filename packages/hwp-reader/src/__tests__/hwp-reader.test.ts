import { describe, it, expect } from 'vitest';
import { openCfb } from '../cfb-reader.js';
import { readHwp } from '../hwp-reader.js';
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
    // Decompressed DocInfo should be 24 bytes (8 header + 16 data)
    expect(doc.docInfo.length).toBe(24);
    expect(doc.docInfo[8]).toBe(0x42);
  });

  it('should extract uncompressed DocInfo', () => {
    const hwpBuffer = createTestHwp({ compressed: false });
    const doc = readHwp(hwpBuffer);
    expect(doc.docInfo.length).toBe(24);
  });

  it('should extract BodyText sections in order', () => {
    const hwpBuffer = createTestHwp({ compressed: true });
    const doc = readHwp(hwpBuffer);
    expect(doc.bodyText.length).toBe(2);
    expect(doc.bodyText[0].length).toBe(16); // 8 header + 8 data
    expect(doc.bodyText[0][8]).toBe(0x43);
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

  // Tests with multiple variations
  for (let i = 0; i < 10; i++) {
    it(`should handle synthetic HWP variant ${i}`, () => {
      const compressed = i % 2 === 0;
      const hwpBuffer = createTestHwp({
        compressed,
        version: { major: 5, minor: i % 4, build: i, revision: 0 },
      });
      const doc = readHwp(hwpBuffer);
      expect(doc.fileHeader.signature).toBe('HWP Document File');
      expect(doc.fileHeader.version.major).toBe(5);
      expect(doc.fileHeader.compressed).toBe(compressed);
      expect(doc.bodyText.length).toBe(2);
      expect(doc.docInfo.length).toBeGreaterThan(0);
    });
  }
});
