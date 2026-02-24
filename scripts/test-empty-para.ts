#!/usr/bin/env tsx
/**
 * Test empty paragraph height optimization - before/after page count comparison
 */
import { generatePdf } from '../packages/pdf-export/src/pdf-direct.js';
import * as fs from 'fs';
import * as path from 'path';

const fixturesDir = '/Users/mj/handoc-fixtures';
const files = [
  'real-world/education/2025 2학기 원안지 양식(A4)-3학년_역사.hwpx',
  'real-world/education/1. 2025학년도 1학기 2차 지필평가 실시 계획.hwpx',
  'real-world/education/제16회  나라(독도)사랑 글짓기 국제대회 계획서.hwpx',
];

const outDir = '/tmp/empty-para-test';
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  for (const f of files) {
    const base = path.basename(f, path.extname(f));
    const fullPath = path.join(fixturesDir, f);
    if (!fs.existsSync(fullPath)) {
      console.log(`SKIP: ${f} (not found)`);
      continue;
    }
    try {
      const buf = new Uint8Array(fs.readFileSync(fullPath));
      const pdf = await generatePdf(buf, f);
      const outPath = path.join(outDir, `${base}.pdf`);
      fs.writeFileSync(outPath, pdf);
      // Count pages via pdf-lib
      const { PDFDocument } = await import('../packages/pdf-export/node_modules/pdf-lib/es/index.js');
      const pdfDoc = await PDFDocument.load(pdf);
      const pageCount = pdfDoc.getPageCount();
      console.log(`${base}: ${pageCount} pages`);
    } catch (e: any) {
      console.error(`ERR: ${base} - ${e.message}`);
    }
  }
}
main();
