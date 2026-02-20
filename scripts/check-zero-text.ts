import { readFileSync } from 'fs';
import { OpcPackage } from '../packages/hwpx-core/src/index';
import { parseSection, extractText } from '../packages/hwpx-parser/src/index';

const files = [
  '/Users/mj/handoc-fixtures/real-world/education/(새양식)2025학년도 동아리 활동 연간지도계획(독후활동반).hwpx',
  '/Users/mj/handoc-fixtures/real-world/20260220/종묘제레악.hwpx',
];

async function main() {
  for (const f of files) {
    const buf = readFileSync(f);
    const pkg = await OpcPackage.open(new Uint8Array(buf));
    const parts = pkg.partNames();
    const sections = parts.filter(p => /section\d*\.xml$/i.test(p));
    console.log(`\n=== ${f.split('/').pop()} ===`);
    console.log(`Parts: ${parts.length}, Sections: ${sections.length}`);
    for (const sp of sections) {
      const xml = pkg.getPartAsText(sp);
      const sec = parseSection(xml);
      const text = extractText(sec);
      const nonEmpty = text.filter(l => l.trim());
      console.log(`  ${sp}: ${sec.paragraphs.length} paras, ${nonEmpty.length} text lines`);
      if (nonEmpty.length === 0 && sec.paragraphs.length > 0) {
        const p = sec.paragraphs[0];
        console.log(`  First para runs: ${p.runs.length}, children: ${JSON.stringify(p.runs[0]?.children?.slice(0, 3))}`);
      }
      if (nonEmpty.length > 0) {
        console.log(`  Sample: "${nonEmpty[0].substring(0, 80)}"`);
      }
    }
  }
}
main();
