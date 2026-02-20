import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSection } from '../section-parser';
import { parseTable, tableToTextGrid } from '../table-parser';
import type { GenericElement } from '../types';

const fixtureDir = join(__dirname, '../../../../fixtures/xml-dumps');

function loadFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf-8');
}

function findTableElements(section: ReturnType<typeof parseSection>): GenericElement[] {
  const tables: GenericElement[] = [];
  for (const p of section.paragraphs) {
    for (const r of p.runs) {
      for (const c of r.children) {
        if (c.type === 'table') {
          tables.push(c.element);
        }
      }
    }
  }
  return tables;
}

describe('parseTable', () => {
  it('parses table-basic fixture into rows and cells', () => {
    const xml = loadFixture('table-basic-section0.xml');
    const section = parseSection(xml);
    const tableEls = findTableElements(section);
    expect(tableEls).toHaveLength(1);

    const table = parseTable(tableEls[0]);
    expect(table.rowCnt).toBe(3);
    expect(table.colCnt).toBe(3);
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0].cells).toHaveLength(3);
  });

  it('extracts cell text correctly', () => {
    const xml = loadFixture('table-basic-section0.xml');
    const section = parseSection(xml);
    const table = parseTable(findTableElements(section)[0]);
    const grid = tableToTextGrid(table);

    expect(grid).toEqual([
      ['항목', '수량', '가격'],
      ['사과', '10', '5,000'],
      ['바나나', '5', '3,000'],
    ]);
  });

  it('parses cell address and span', () => {
    const xml = loadFixture('table-basic-section0.xml');
    const section = parseSection(xml);
    const table = parseTable(findTableElements(section)[0]);

    const cell = table.rows[1].cells[2]; // row 1, col 2
    expect(cell.cellAddr).toEqual({ colAddr: 2, rowAddr: 1 });
    expect(cell.cellSpan).toEqual({ colSpan: 1, rowSpan: 1 });
    expect(cell.cellSz.width).toBe(7200);
  });

  it('preserves GenericElement access (opt-in)', () => {
    const xml = loadFixture('table-basic-section0.xml');
    const section = parseSection(xml);
    const tableEls = findTableElements(section);
    // GenericElement is still accessible
    expect(tableEls[0].tag).toBe('tbl');
    expect(tableEls[0].attrs['rowCnt']).toBe('3');
  });

  it('cell paragraphs have proper structure', () => {
    const xml = loadFixture('table-basic-section0.xml');
    const section = parseSection(xml);
    const table = parseTable(findTableElements(section)[0]);

    const cell = table.rows[0].cells[0];
    expect(cell.paragraphs).toHaveLength(1);
    expect(cell.paragraphs[0].runs).toHaveLength(1);
    expect(cell.paragraphs[0].runs[0].children[0]).toEqual({
      type: 'text',
      content: '항목',
    });
  });
});
