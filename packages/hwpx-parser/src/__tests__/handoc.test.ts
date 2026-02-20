import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HanDoc } from '../handoc';

const FIXTURES = resolve(__dirname, '../../../../fixtures/hwpx');
const REAL_WORLD = '/Users/mj/handoc-fixtures/real-world/20260220';

function readFixture(name: string): Uint8Array {
  return readFileSync(resolve(FIXTURES, name));
}

describe('HanDoc', () => {
  describe('fromBuffer / open', () => {
    it('opens simple-text.hwpx', async () => {
      const doc = await HanDoc.fromBuffer(readFixture('simple-text.hwpx'));
      expect(doc.sections.length).toBeGreaterThan(0);
    });

    it('opens styled-text.hwpx', async () => {
      const doc = await HanDoc.open(readFixture('styled-text.hwpx'));
      expect(doc.sections.length).toBeGreaterThan(0);
    });

    it('opens table-basic.hwpx', async () => {
      const doc = await HanDoc.open(readFixture('table-basic.hwpx'));
      expect(doc.sections.length).toBeGreaterThan(0);
    });

    it('opens multi-section.hwpx', async () => {
      const doc = await HanDoc.open(readFixture('multi-section.hwpx'));
      expect(doc.sections.length).toBeGreaterThanOrEqual(1);
    });

    it('opens empty.hwpx', async () => {
      const doc = await HanDoc.open(readFixture('empty.hwpx'));
      expect(doc.sections).toBeDefined();
    });
  });

  describe('extractText', () => {
    it('extracts text from simple-text', async () => {
      const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
      const text = doc.extractText();
      expect(text.length).toBeGreaterThan(0);
    });

    it('extractTextBySection returns array', async () => {
      const doc = await HanDoc.open(readFixture('multi-section.hwpx'));
      const texts = doc.extractTextBySection();
      expect(texts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('header', () => {
    it('parses header from simple-text', async () => {
      const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
      const header = doc.header;
      expect(header.version).toBeDefined();
      expect(header.secCnt).toBeGreaterThanOrEqual(1);
    });
  });

  describe('metadata', () => {
    it('returns metadata object', async () => {
      const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
      const meta = doc.metadata;
      expect(meta).toBeDefined();
      // metadata may or may not have title/creator depending on fixture
      expect(typeof meta).toBe('object');
    });
  });

  describe('error handling', () => {
    it('rejects invalid ZIP data', async () => {
      await expect(HanDoc.open(new Uint8Array([1, 2, 3]))).rejects.toThrow();
    });

    it('rejects empty buffer', async () => {
      await expect(HanDoc.open(new Uint8Array(0))).rejects.toThrow();
    });
  });

  describe('real-world documents', () => {
    it('opens 제안요청서', async () => {
      const buf = readFileSync(resolve(REAL_WORLD, '2. 제안요청서_25년 홈택스 고도화 구축(2단계) 사업.hwpx'));
      const doc = await HanDoc.open(buf);
      const text = doc.extractText();
      expect(text.length).toBeGreaterThan(100);
      expect(doc.sections.length).toBeGreaterThan(0);
    });

    it('opens 데이터베이스 표준화 지침', async () => {
      const buf = readFileSync(resolve(REAL_WORLD, '230403 공공기관의 데이터베이스 표준화 지침 개정 전문.hwpx'));
      const doc = await HanDoc.open(buf);
      const text = doc.extractText();
      expect(text.length).toBeGreaterThan(100);
      const meta = doc.metadata;
      expect(meta).toBeDefined();
    });
  });
});
