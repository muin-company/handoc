#!/usr/bin/env node
const { readFileSync } = require('fs');
const { join } = require('path');

// Simple script to analyze table-basic.hwpx
const { HanDoc } = require('./handoc/packages/hwpx-parser/dist/index.cjs');
const { parseTable } = require('./handoc/packages/hwpx-parser/dist/index.cjs');

async function analyze() {
  const hwpxPath = join(__dirname, 'handoc/fixtures/hwpx/table-basic.hwpx');
  const buf = new Uint8Array(readFileSync(hwpxPath));
  const doc = await HanDoc.open(buf);

  console.log('BorderFills:', doc.header.refList.borderFills.length);
  console.log('BorderFills IDs:', doc.header.refList.borderFills.map(bf => bf.attrs.id));

  let foundBorderFillRef = false;
  let foundColSpan = false;
  let foundRowSpan = false;

  for (const section of doc.sections) {
    for (const para of section.paragraphs) {
      for (const run of para.runs) {
        for (const child of run.children) {
          if (child.type === 'table') {
            try {
              const parsed = parseTable(child.element);
              console.log('\\nTable found with', parsed.rows.length, 'rows');
              
              for (const row of parsed.rows) {
                for (const cell of row.cells) {
                  if (cell.borderFillIDRef > 0) {
                    console.log('  Cell with borderFillIDRef:', cell.borderFillIDRef);
                    foundBorderFillRef = true;
                  }
                  if (cell.cellSpan.colSpan > 1) {
                    console.log('  Cell with colSpan:', cell.cellSpan.colSpan);
                    foundColSpan = true;
                  }
                  if (cell.cellSpan.rowSpan > 1) {
                    console.log('  Cell with rowSpan:', cell.cellSpan.rowSpan);
                    foundRowSpan = true;
                  }
                }
              }
            } catch (e) {
              console.log('  parseTable failed:', e.message);
            }
          }
        }
      }
    }
  }

  console.log('\\nSummary:');
  console.log('  Has borderFillIDRef > 0:', foundBorderFillRef);
  console.log('  Has colSpan > 1:', foundColSpan);
  console.log('  Has rowSpan > 1:', foundRowSpan);
}

analyze().catch(console.error);
