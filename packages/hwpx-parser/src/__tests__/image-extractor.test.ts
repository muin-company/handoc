import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { HanDoc } from '../handoc';
import { extractImages } from '../image-extractor';
import { OpcPackage } from '@handoc/hwpx-core';

const REAL_WORLD = '/Users/mj/handoc-fixtures/real-world/20260220';
const IMAGE_DOC = resolve(
  REAL_WORLD,
  '2. 제안요청서_25년 홈택스 고도화 구축(2단계) 사업.hwpx',
);
const hasImageDoc = existsSync(IMAGE_DOC);

const FIXTURES = resolve(__dirname, '../../../../fixtures/hwpx');

describe('extractImages', () => {
  it('returns empty array for document without images', async () => {
    const buf = readFileSync(resolve(FIXTURES, 'simple-text.hwpx'));
    const pkg = await OpcPackage.open(buf);
    const images = extractImages(pkg);
    expect(images).toEqual([]);
  });

  it.skipIf(!hasImageDoc)(
    'extracts images from real document with BinData',
    async () => {
      const buf = readFileSync(IMAGE_DOC);
      const pkg = await OpcPackage.open(buf);
      const images = extractImages(pkg);
      expect(images.length).toBeGreaterThan(0);
      for (const img of images) {
        expect(img.path).toMatch(/BinData\//);
        expect(img.data.length).toBeGreaterThan(0);
        expect(img.mimeType).not.toBe('');
      }
      // Check specific known image
      const jpg = images.find((i) => i.path === 'BinData/image1.jpg');
      expect(jpg).toBeDefined();
      expect(jpg!.mimeType).toBe('image/jpeg');
      expect(jpg!.data.length).toBe(103377);
    },
  );
});

describe('HanDoc image API', () => {
  it.skipIf(!hasImageDoc)('images getter returns images lazily', async () => {
    const doc = await HanDoc.open(readFileSync(IMAGE_DOC));
    const images = doc.images;
    expect(images.length).toBeGreaterThan(0);
    // Second access should return same cached array
    expect(doc.images).toBe(images);
  });

  it.skipIf(!hasImageDoc)('getImage returns data for valid path', async () => {
    const doc = await HanDoc.open(readFileSync(IMAGE_DOC));
    const data = doc.getImage('BinData/image1.jpg');
    expect(data).not.toBeNull();
    expect(data!.length).toBe(103377);
  });

  it.skipIf(!hasImageDoc)(
    'getImage returns null for non-existent path',
    async () => {
      const doc = await HanDoc.open(readFileSync(IMAGE_DOC));
      expect(doc.getImage('BinData/nonexistent.png')).toBeNull();
    },
  );

  it('getImage returns null on doc without images', async () => {
    const doc = await HanDoc.open(
      readFileSync(resolve(FIXTURES, 'simple-text.hwpx')),
    );
    expect(doc.images).toHaveLength(0);
    expect(doc.getImage('BinData/foo.png')).toBeNull();
  });
});
