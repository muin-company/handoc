import * as fs from 'fs';

async function loadDeps() {
  const { generatePdf } = await import('./packages/pdf-export/src/pdf-direct.js');
  const { PDFDocument } = await import('/Users/mj/handoc/node_modules/pdf-lib/es/index.js');
  return { generatePdf, PDFDocument };
}


const testFiles = [
  { hwpx: '/Users/mj/handoc-fixtures/real-world/opensource/test_re.hwpx', expected: 15 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/opensource/test.hwpx', expected: 3 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/education/1. 2025학년도 1학기 2차 지필평가 실시 계획.hwpx', expected: 15 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/education/1. 2025학년도 2학기 2차 지필평가 실시 계획(2).hwpx', expected: 16 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/education/경위서(OOO).hwpx', expected: 16 },
  { hwpx: '/Users/mj/handoc-fixtures/real-world/opensource/프로젝트 계획서.hwpx', expected: 2 },
];

async function main() {
  for (const { hwpx, expected } of testFiles) {
    try {
      if (!fs.existsSync(hwpx)) { console.log(`SKIP ${hwpx} (not found)`); continue; }
      const buf = fs.readFileSync(hwpx);
      const pdfBytes = await generatePdf(buf);
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = pdf.getPageCount();
      const ratio = (pages / expected).toFixed(2);
      const status = pages === expected ? '✅' : pages <= expected * 1.1 ? '🟡' : '❌';
      console.log(`${status} ${pages}/${expected} (${ratio}x) ${hwpx.split('/').pop()}`);
    } catch (e: any) {
      console.log(`💥 ERROR ${hwpx.split('/').pop()}: ${e.message?.substring(0, 80)}`);
    }
  }
}
main();
