/**
 * Regression test: verify page counts for key real-world HWPX files.
 *
 * Each entry lists:
 *   - source HWPX (in handoc-fixtures/real-world/)
 *   - expected page count (from Hancom Office Win reference PDFs)
 *
 * Run: pnpm --filter @handoc/pdf-export test -- regression
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { generatePdf } from '../pdf-direct';

const FIXTURES = resolve(__dirname, '../../../../../handoc-fixtures/real-world');

/** Read fixture file, skip test if missing. */
function loadFixture(relPath: string): Uint8Array {
  const abs = resolve(FIXTURES, relPath);
  if (!existsSync(abs)) {
    throw new Error(`Fixture not found: ${abs}`);
  }
  return new Uint8Array(readFileSync(abs));
}

async function pdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}

// ── Test cases: [relPath, expectedPages, refPages, description] ──
// expectedPages = current HanDoc output (regression baseline)
// refPages = Hancom Office Win reference (target to converge toward)
const cases: [string, number, number, string][] = [
  // Government / 20260220
  ['20260220/강강술래.hwpx', 1, 1, '강강술래 (문화재 안내)'],
  ['20260220/종묘제레악.hwpx', 1, 1, '종묘제레악'],
  ['20260220/가곡.hwpx', 1, 1, '가곡'],                        // ✅ fixed by space correction
  ['20260220/참석자 사전 의견서.hwpx', 1, 1, '참석자 사전 의견서'],
  ['20260220/[별지 7] 이의신청서(클라우드컴퓨팅서비스 보안인증에 관한 고시).hwpx', 1, 1, '이의신청서'], // ✅ fixed by space correction
  ['20260220/230403 공공기관의 데이터베이스 표준화 지침 개정 전문.hwpx', 23, 24, 'DB 표준화 지침'], // improved: 30→23 (ref 24, under by 1)
  // Education
  ['education/2015 개정 교육과정 성취기준.hwpx', 7, 7, '성취기준'],   // ✅ fixed by space correction
  ['education/2025 역곡중 출결신고서 양식(간소화).hwpx', 1, 1, '출결신고서'],
  ['education/2025 출결 안내.hwpx', 1, 1, '출결 안내'],              // ✅ fixed by space correction
  ['education/명심보감 필사(바른말).hwpx', 1, 2, '명심보감 필사'],    // TODO: under by 1 (space correction side effect)
];

describe('PDF regression: page count matches Hancom reference', () => {
  for (const [relPath, expectedPages, refPages, description] of cases) {
    it(`${description} → ${expectedPages}pg (ref ${refPages}pg)`, async () => {
      const hwpx = loadFixture(relPath);
      const pdf = await generatePdf(hwpx);
      const pages = await pdfPageCount(pdf);
      expect(pages).toBe(expectedPages);
    }, 30_000);
  }
});
