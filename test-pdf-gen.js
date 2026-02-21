#!/usr/bin/env node
const fs = require('fs');
const { generatePdf } = require('./packages/pdf-export/dist/index.js');

const testFile = process.env.HOME + '/handoc-fixtures/real-world/20260220/[별지 2] 취약점 점검 및 침투테스트 동의서(클라우드컴퓨팅서비스 보안인증에 관한 고시).hwpx';
const outputFile = '/tmp/test-output.pdf';

(async () => {
  console.log('Reading HWPX file...');
  const hwpxBuffer = fs.readFileSync(testFile);
  
  console.log('Generating PDF...');
  const pdfBytes = await generatePdf(hwpxBuffer);
  
  console.log('Writing PDF...');
  fs.writeFileSync(outputFile, pdfBytes);
  
  console.log(`PDF generated: ${outputFile}`);
  console.log(`File size: ${(pdfBytes.length / 1024).toFixed(2)} KB`);
  
  // Count pages using pdf-lib
  const { PDFDocument } = require('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  console.log(`Page count: ${pdfDoc.getPageCount()}`);
})();
