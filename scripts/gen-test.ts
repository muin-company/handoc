#!/usr/bin/env tsx
import { generatePdf } from '../packages/pdf-export/src/pdf-direct.js';
import * as fs from 'fs';
import * as path from 'path';

const files = [
  'real-world/20260220/참석자 사전 의견서.hwpx',
  'real-world/20260220/[별표 8] 인증 수수료 산정 및 평가원 보수 기준(제12조 관련)(클라우드컴퓨팅서비스 보안인증에 관한 고시).hwpx',
  'real-world/20260220/[별표 5] 업무수행 요건·능력 심사 제출서류(제3조 관련)(클라우드컴퓨팅서비스 보안인증에 관한 고시).hwpx',
];

const outDir = '/tmp/border-test-new';
fs.mkdirSync(outDir, { recursive: true });

const fixturesDir = '/Users/mj/handoc-fixtures';

async function main() {
  for (const f of files) {
    const base = path.basename(f, '.hwpx');
    console.log(`Generating: ${base}`);
    try {
      const buf = fs.readFileSync(path.join(fixturesDir, f));
      const pdf = await generatePdf(buf, f);
      fs.writeFileSync(path.join(outDir, `${base}.pdf`), pdf);
      console.log(`  OK: ${base}.pdf`);
    } catch (e: any) {
      console.error(`  ERR: ${e.message}`);
    }
  }
}
main();
