import fs from 'fs';
import path from 'path';
import { parseDocument } from './packages/parser/src/index.ts';
import { exportToPdf } from './packages/pdf-export/src/index.ts';
import { PDFDocument } from 'pdf-lib';

const files = [
  "education/2025학년도 1학기 학교생활기록부 기재요령 및 점검 일정 연수자료.pdf",
  "education/2025학년도 2학기 학교생활기록부 기재요령 및 점검 일정 연수자료.pdf",
  "education/2학기 행특_1.pdf",
  "education-hwp/2025학년도 1학기 기말대비_개념잡기.pdf",
  "education-hwp/2025학년도 2학기 기말대비_개념잡기.pdf"
];

async function main() {
  const resultJson = JSON.parse(fs.readFileSync('/Users/mj/handoc-fixtures/comparison-v27/comparison-results.json', 'utf-8'));
  
  for (const f of files) {
    const fPath = f.replace('.pdf', '');
    let hwpPath = `/Users/mj/handoc-fixtures/test-files/${fPath}.hwp`;
    if (!fs.existsSync(hwpPath)) {
      hwpPath = `/Users/mj/handoc-fixtures/test-files/${fPath}.hwpx`;
    }
    
    const r = resultJson.results.find(x => x.reference === f);
    
    console.log(`Processing ${hwpPath}...`);
    try {
      const doc = await parseDocument(fs.readFileSync(hwpPath));
      const pdfBytes = await exportToPdf(doc);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const newPages = pdfDoc.getPageCount();
      
      console.log(`  File: ${f}`);
      console.log(`  Ref pages: ${r.ref_pages}`);
      console.log(`  Old Test pages: ${r.test_pages}`);
      console.log(`  New Test pages: ${newPages}`);
      console.log(`  Ratio: ${(newPages / r.ref_pages).toFixed(2)}x`);
      if (newPages === r.ref_pages) {
        console.log(`  => PERFECT MATCH!`);
      } else if (Math.abs(newPages - r.ref_pages) <= 1) {
        console.log(`  => VERY CLOSE!`);
      }
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
  }
}
main();