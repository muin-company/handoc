import { HanDocParser } from './packages/hwpx-parser/src/index.js';
import * as fs from 'fs';

async function main() {
  const buf = fs.readFileSync('/Users/mj/handoc-fixtures/real-world/education/2025 진로박람회 ‘진로캠퍼스’ 참가.hwpx');
  const parser = new HanDocParser();
  const doc = await parser.parseBuffer(buf);
  let totalParagraphs = 0;
  let multiRunParagraphs = 0;
  
  for (const section of doc.sections) {
    for (const para of section.paragraphs) {
      totalParagraphs++;
      if (para.runs.length > 1) {
        multiRunParagraphs++;
      } else if (para.runs.length === 1 && para.runs[0].children.length > 1) {
        multiRunParagraphs++;
      }
    }
  }
  console.log(`Total paragraphs: ${totalParagraphs}`);
  console.log(`Multi-run/child paragraphs: ${multiRunParagraphs}`);
}
main().catch(console.error);
