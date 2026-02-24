import { generatePdf } from './packages/pdf-export/src/pdf-direct.js';
import * as fs from 'fs';

async function main() {
  const buf = fs.readFileSync('/Users/mj/handoc-fixtures/real-world/education/2025 진로박람회 ‘진로캠퍼스’ 참가.hwpx');
  const pdfBytes = await generatePdf(buf);
  console.log("PDF generated, size:", pdfBytes.length);
}
main().catch(console.error);
