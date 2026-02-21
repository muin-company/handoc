/**
 * Additional table-parser tests for uncovered branches.
 */
import { describe, it, expect } from 'vitest';
import { parseTable, tableToTextGrid } from '../table-parser';
import type { GenericElement } from '../types';

describe('parseTable - edge cases', () => {
  it('handles cells without subList (empty paragraphs)', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {
        id: 't1',
        rowCnt: '1',
        colCnt: '2',
        cellSpacing: '0',
        borderFillIDRef: '0',
      },
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: { name: 'Cell1', header: '0', borderFillIDRef: '0' },
              children: [
                {
                  tag: 'cellAddr',
                  attrs: { colAddr: '0', rowAddr: '0' },
                  children: [],
                  text: null,
                },
                {
                  tag: 'cellSpan',
                  attrs: { colSpan: '1', rowSpan: '1' },
                  children: [],
                  text: null,
                },
                {
                  tag: 'cellSz',
                  attrs: { width: '1000', height: '500' },
                  children: [],
                  text: null,
                },
                // NO subList - this should result in empty paragraphs array
              ],
              text: null,
            },
            {
              tag: 'tc',
              attrs: { name: 'Cell2', header: '1', borderFillIDRef: '1' },
              children: [
                {
                  tag: 'cellAddr',
                  attrs: { colAddr: '1', rowAddr: '0' },
                  children: [],
                  text: null,
                },
                {
                  tag: 'cellSpan',
                  attrs: { colSpan: '2', rowSpan: '3' },
                  children: [],
                  text: null,
                },
                {
                  tag: 'cellSz',
                  attrs: { width: '2000', height: '1000' },
                  children: [],
                  text: null,
                },
              ],
              text: null,
            },
          ],
          text: null,
        },
      ],
      text: null,
    };

    const table = parseTable(tableEl);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].cells).toHaveLength(2);
    
    // First cell - no subList means no paragraphs
    expect(table.rows[0].cells[0].paragraphs).toEqual([]);
    expect(table.rows[0].cells[0].header).toBe(false);
    expect(table.rows[0].cells[0].cellSpan).toEqual({ colSpan: 1, rowSpan: 1 });
    
    // Second cell - header and custom span
    expect(table.rows[0].cells[1].paragraphs).toEqual([]);
    expect(table.rows[0].cells[1].header).toBe(true);
    expect(table.rows[0].cells[1].cellSpan).toEqual({ colSpan: 2, rowSpan: 3 });
  });

  it('handles cells with complex paragraph structures', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {
        id: 't2',
        rowCnt: '1',
        colCnt: '1',
        cellSpacing: '10',
        borderFillIDRef: '5',
        repeatHeader: '1',
        noAdjust: 'true',
      },
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: { name: 'ComplexCell' },
              children: [
                {
                  tag: 'cellAddr',
                  attrs: { colAddr: '0', rowAddr: '0' },
                  children: [],
                  text: null,
                },
                {
                  tag: 'cellSpan',
                  attrs: {},
                  children: [],
                  text: null,
                },
                {
                  tag: 'cellSz',
                  attrs: {},
                  children: [],
                  text: null,
                },
                {
                  tag: 'subList',
                  attrs: {},
                  children: [
                    {
                      tag: 'p',
                      attrs: { paraPrIDRef: '0' },
                      children: [
                        {
                          tag: 'run',
                          attrs: { charPrIDRef: '0' },
                          children: [
                            {
                              tag: 't',
                              attrs: {},
                              children: [],
                              text: 'First paragraph',
                            },
                          ],
                          text: null,
                        },
                      ],
                      text: null,
                    },
                    {
                      tag: 'p',
                      attrs: { paraPrIDRef: '0' },
                      children: [
                        {
                          tag: 'run',
                          attrs: { charPrIDRef: '0' },
                          children: [
                            {
                              tag: 't',
                              attrs: {},
                              children: [],
                              text: 'Second paragraph',
                            },
                          ],
                          text: null,
                        },
                      ],
                      text: null,
                    },
                  ],
                  text: null,
                },
              ],
              text: null,
            },
          ],
          text: null,
        },
      ],
      text: null,
    };

    const table = parseTable(tableEl);
    expect(table.repeatHeader).toBe(true);
    expect(table.noAdjust).toBe(true);
    expect(table.cellSpacing).toBe(10);
    expect(table.borderFillIDRef).toBe(5);
    
    const cell = table.rows[0].cells[0];
    expect(cell.paragraphs).toHaveLength(2);
    expect(cell.cellSpan).toEqual({ colSpan: 1, rowSpan: 1 }); // defaults when attrs missing
  });

  it('tableToTextGrid handles empty cells and complex runs', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: { id: 't3', rowCnt: '2', colCnt: '2' },
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: { name: 'c1' },
              children: [
                {
                  tag: 'cellAddr',
                  attrs: { colAddr: '0', rowAddr: '0' },
                  children: [],
                  text: null,
                },
                {
                  tag: 'subList',
                  attrs: {},
                  children: [
                    {
                      tag: 'p',
                      attrs: {},
                      children: [
                        {
                          tag: 'run',
                          attrs: {},
                          children: [
                            { tag: 't', attrs: {}, children: [], text: 'A' },
                          ],
                          text: null,
                        },
                        {
                          tag: 'run',
                          attrs: {},
                          children: [
                            { tag: 't', attrs: {}, children: [], text: 'B' },
                          ],
                          text: null,
                        },
                      ],
                      text: null,
                    },
                  ],
                  text: null,
                },
              ],
              text: null,
            },
            {
              tag: 'tc',
              attrs: { name: 'c2' },
              children: [
                {
                  tag: 'cellAddr',
                  attrs: { colAddr: '1', rowAddr: '0' },
                  children: [],
                  text: null,
                },
                // No subList - empty cell
              ],
              text: null,
            },
          ],
          text: null,
        },
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: { name: 'c3' },
              children: [
                {
                  tag: 'cellAddr',
                  attrs: { colAddr: '0', rowAddr: '1' },
                  children: [],
                  text: null,
                },
                {
                  tag: 'subList',
                  attrs: {},
                  children: [
                    {
                      tag: 'p',
                      attrs: {},
                      children: [
                        {
                          tag: 'run',
                          attrs: {},
                          children: [
                            // Non-text child (e.g., image)
                            { tag: 'img', attrs: {}, children: [], text: null },
                          ],
                          text: null,
                        },
                      ],
                      text: null,
                    },
                  ],
                  text: null,
                },
              ],
              text: null,
            },
            {
              tag: 'tc',
              attrs: { name: 'c4' },
              children: [
                {
                  tag: 'cellAddr',
                  attrs: { colAddr: '1', rowAddr: '1' },
                  children: [],
                  text: null,
                },
                {
                  tag: 'subList',
                  attrs: {},
                  children: [
                    {
                      tag: 'p',
                      attrs: {},
                      children: [
                        {
                          tag: 'run',
                          attrs: {},
                          children: [
                            { tag: 't', attrs: {}, children: [], text: 'D' },
                          ],
                          text: null,
                        },
                      ],
                      text: null,
                    },
                  ],
                  text: null,
                },
              ],
              text: null,
            },
          ],
          text: null,
        },
      ],
      text: null,
    };

    const table = parseTable(tableEl);
    const grid = tableToTextGrid(table);
    
    expect(grid).toEqual([
      ['AB', ''],  // First row: multiple runs + empty cell
      ['', 'D'],   // Second row: non-text child (empty) + text
    ]);
  });

  it('handles missing or invalid attributes gracefully', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {
        // Missing id, using defaults for numeric fields
        rowCnt: 'invalid',
        colCnt: 'NaN',
        cellSpacing: '',
      },
      children: [],
      text: null,
    };

    const table = parseTable(tableEl);
    expect(table.id).toBe('');
    expect(table.rowCnt).toBe(0); // fallback for invalid number
    expect(table.colCnt).toBe(0);
    expect(table.cellSpacing).toBe(0);
    expect(table.borderFillIDRef).toBe(0);
    expect(table.repeatHeader).toBe(false);
    expect(table.noAdjust).toBe(false);
    expect(table.rows).toEqual([]);
  });
});
