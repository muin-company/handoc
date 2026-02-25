import { createRequire } from 'module';
const require = createRequire(import.meta.url + '/../packages/pdf-export/');
const { PDFDocument } = require('pdf-lib');
import fs from 'fs';

// We need the built version
const { generatePdf } = await import('./packages/pdf-export/dist/index.js');

const testFiles = [
  { hwpx: '/Users/mj/handoc-fixtures/real-world/opensource/test_re.hwpx', expected: 15 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/opensource/test.hwpx', expected: 3 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/education/1. 2025학년도 1학기 2차 지필평가 실시 계획.hwpx', expected: 15 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/education/1. 2025학년도 2학기 2차 지필평가 실시 계획(2).hwpx', expected: 16 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/education/경위서(OOO).hwpx', expected: 16 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/opensource/프로젝트 계획서.hwpx', expected: 2 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/education/(새양식)2025학년도 동아리 활동 연간지도계획(독후활동반).hwpx', expected: 1 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/education/(새양식)2025학년도 동아리 활동 연간지도계획(동아리명).hwpx', expected: 1 },
  // Underflow check
  { hwpx: '/Users/mj/handoc-fixtures/real-world/opensource/2015년_12월_재난안전종합상황_분석_및_전망.hwpx', expected: 75 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/20260220/230403 공공기관의 데이터베이스 표준화 지침 개정 전문.hwpx', expected: 24 },
];

for (const { hwpx, expected } of testFiles) {
  try {
    if (!fs.existsSync(hwpx)) { console.log(`SKIP ${hwpx.split('/').pop()} (not found)`); continue; }
    const buf = fs.readFileSync(hwpx);
    const pdfBytes = await generatePdf(buf);
    const pdf = await PDFDocument.load(pdfBytes);
    const pages = pdf.getPageCount();
    const ratio = (pages / expected).toFixed(2);
    const status = pages === expected ? '✅' : Math.abs(pages - expected) <= expected * 0.1 ? '🟡' : '❌';
    console.log(`${status} ${pages}/${expected} (${ratio}x) ${hwpx.split('/').pop()}`);
  } catch (e) {
    console.log(`💥 ERROR ${hwpx.split('/').pop()}: ${e.message?.substring(0, 80)}`);
  }
}
