import { HanDocParser } from './packages/hwpx-parser/src/index.js';
import * as fs from 'fs';

async function main() {
  const buf = fs.readFileSync('/Users/mj/handoc-fixtures/real-world/education/2025 진로박람회 ‘진로캠퍼스’ 참가.hwpx');
  const doc = await HanDoc.fromBuffer(buf);
  for (let i = 0; i < Math.min(5, doc.sections[0].paragraphs.length); i++) {
    const p = doc.sections[0].paragraphs[i];
    console.log(`Paragraph ${i}:`);
    for (const run of p.runs) {
      console.log(`  Run charPrIDRef=${run.charPrIDRef}`);
      for (const child of run.children) {
        if (child.type === 'text') {
          console.log(`    text: "${child.content}"`);
        } else {
          console.log(`    ${child.type}`);
        }
      }
    }
  }
}

main().catch(console.error);
