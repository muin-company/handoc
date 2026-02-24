import { HanDoc } from '../hwpx-parser/src/handoc.js';
import { generatePdf } from './src/pdf-direct.js';
import { readFileSync } from 'fs';
import { PDFDocument } from 'pdf-lib';

const files = [
  '/Users/mj/handoc-fixtures/real-world/20260220/[별표 1] 관리적 보호조치(클라우드컴퓨팅서비스 보안인증에 관한 고시).hwpx',
  '/Users/mj/handoc-fixtures/real-world/20260220/[별지 2] 취약점 점검 및 침투테스트 동의서(클라우드컴퓨팅서비스 보안인증에 관한 고시).hwpx',
  '/Users/mj/handoc-fixtures/real-world/20260220/소프트웨어사업_계약_및_관리감독에_관한_지침_개정_전문.hwpx',
];

async function main() {
  for (const f of files) {
    try {
      const buf = readFileSync(f);
      const doc = await HanDoc.open(buf);
      const pdf = await generatePdf(doc);
      const pdfDoc = await PDFDocument.load(pdf);
      const name = f.split('/').pop()!.slice(0, 50);
      console.log(`${name}: ${pdfDoc.getPageCount()} pages`);
    } catch (e: any) {
      console.log(`ERROR ${f.split('/').pop()?.slice(0,40)}: ${e.message?.slice(0, 100)}`);
    }
  }
}
main();
