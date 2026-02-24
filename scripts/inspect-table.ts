#!/usr/bin/env tsx
import { HanDoc } from '../packages/hwpx-parser/src/index.js';
import * as fs from 'fs';

async function main() {
  const buf = fs.readFileSync('/Users/mj/handoc-fixtures/real-world/20260220/참석자 사전 의견서.hwpx');
  const doc = await HanDoc.open(buf);

  function findTables(paras: any[]) {
    for (const p of paras) {
      for (const r of p.runs) {
        for (const c of r.children) {
          if (c.type === 'table') {
            const tbl = c.element;
            console.log('Table keys:', Object.keys(tbl).join(', '));
            console.log('colCnt:', tbl.colCnt);
            const rowsArr = tbl.rows || tbl.tableRows || [];
            console.log('rows type:', typeof tbl.rows, 'length:', rowsArr.length);
            if (rowsArr.length === 0) {
              // Try to find rows from cells directly
              if (tbl.cells) console.log('cells:', tbl.cells.length);
            }
            for (let ri = 0; ri < Math.min(rowsArr.length, 3); ri++) {
              const row = rowsArr[ri];
              console.log('  row', ri, 'keys:', Object.keys(row).join(', '));
              const cells = row.cells || [];
              for (const cell of cells) {
                console.log('    cell col:', cell.cellAddr?.colAddr, 'bfID:', cell.borderFillIDRef);
              }
            }
          }
        }
      }
    }
  }
  for (const sec of doc.sections) findTables(sec.paragraphs);
}
main();
