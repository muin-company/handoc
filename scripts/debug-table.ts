#!/usr/bin/env tsx
import { generatePdf } from '../packages/pdf-export/src/pdf-direct.js';
import * as fs from 'fs';

async function main() {
  // Monkey-patch to add debug
  const buf = fs.readFileSync('/Users/mj/handoc-fixtures/real-world/20260220/참석자 사전 의견서.hwpx');
  
  // Set env to trigger debug
  process.env.HANDOC_DEBUG_TABLE = '1';
  
  const pdf = await generatePdf(buf, 'test.hwpx');
  fs.writeFileSync('/tmp/debug_out.pdf', pdf);
  console.log('Done');
}
main();
