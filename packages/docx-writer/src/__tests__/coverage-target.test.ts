import { describe, it, expect, vi } from 'vitest';
import { __testing } from '../converter';
import type { GenericElement, DocumentHeader, Paragraph, Section } from '@handoc/document-model';
import { HanDoc, parseTable } from '@handoc/hwpx-parser';
import { Paragraph as DocxParagraph } from 'docx';

/**
 * Targeted coverage tests for uncovered lines:
 * - Lines 214-236: convertHeaderFooterToDocxHeader/Footer
 * - Lines 314, 328, 334-335: convertParagraph table/inlineObject branches
 * - Lines 490, 493, 512, 517, 525, 553: convertTable (rowSpan, bgColor, borders, empty cells)
 * - Various uncovered branches
 */

const mockHeader: DocumentHeader = {
  refList: {
    fontFaces: [],
    charProperties: [
      { id: 0, bold: false, height: 1000 },
      { id: 1, bold: true, height: 1200 },
    ],
    paraProperties: [
      { id: 0, align: 'left' },
      { id: 1, align: 'center' },
    ],
    borderFills: [],
  },
} as any;

describe('Header/Footer Conversion (Lines 214-236)', () => {
  it('converts headers with paragraphs to DocxHeader', () => {
    const headers = [
      {
        type: 'both',
        paragraphs: [
          {
            paraPrIDRef: 0,
            runs: [
              {
                charPrIDRef: 0,
                children: [{ type: 'text' as const, content: 'Header Text' }],
              },
            ],
          },
        ] as any[],
      },
    ];
    const result = __testing.convertHeaderFooterToDocxHeader(headers, mockHeader);
    expect(result).toBeDefined();
  });

  it('converts empty headers (fallback to empty paragraph)', () => {
    const headers = [
      {
        type: 'both',
        paragraphs: [] as any[],
      },
    ];
    const result = __testing.convertHeaderFooterToDocxHeader(headers, mockHeader);
    expect(result).toBeDefined();
  });

  it('converts footers with paragraphs to DocxFooter', () => {
    const footers = [
      {
        type: 'both',
        paragraphs: [
          {
            paraPrIDRef: 1,
            runs: [
              {
                charPrIDRef: 1,
                children: [{ type: 'text' as const, content: 'Footer Text' }],
              },
            ],
          },
        ] as any[],
      },
    ];
    const result = __testing.convertHeaderFooterToDocxFooter(footers, mockHeader);
    expect(result).toBeDefined();
  });

  it('converts empty footers (fallback to empty paragraph)', () => {
    const footers = [
      {
        type: 'both',
        paragraphs: [] as any[],
      },
    ];
    const result = __testing.convertHeaderFooterToDocxFooter(footers, mockHeader);
    expect(result).toBeDefined();
  });

  it('converts multiple header entries with multiple paragraphs', () => {
    const headers = [
      {
        type: 'even',
        paragraphs: [
          {
            runs: [{ children: [{ type: 'text' as const, content: 'Even header' }] }],
          },
        ] as any[],
      },
      {
        type: 'odd',
        paragraphs: [
          {
            runs: [{ children: [{ type: 'text' as const, content: 'Odd header' }] }],
          },
        ] as any[],
      },
    ];
    const result = __testing.convertHeaderFooterToDocxHeader(headers, mockHeader);
    expect(result).toBeDefined();
  });
});

describe('convertTable with cell formatting (Lines 490-553)', () => {
  const emptyBorderFills = new Map<number, ReturnType<typeof __testing.parseBorderFill>>();
  const mockDoc = {} as any as HanDoc;

  // Helper to create a proper HWPX table cell GenericElement
  function makeCell(text: string, opts: { colSpan?: number; rowSpan?: number; borderFillIDRef?: number; colAddr?: number; rowAddr?: number } = {}): GenericElement {
    return {
      tag: 'tc',
      attrs: { borderFillIDRef: String(opts.borderFillIDRef ?? 0) },
      children: [
        { tag: 'cellAddr', attrs: { colAddr: String(opts.colAddr ?? 0), rowAddr: String(opts.rowAddr ?? 0) }, children: [], text: '' },
        { tag: 'cellSpan', attrs: { colSpan: String(opts.colSpan ?? 1), rowSpan: String(opts.rowSpan ?? 1) }, children: [], text: '' },
        { tag: 'cellSz', attrs: { width: '1000', height: '500' }, children: [], text: '' },
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
                    { tag: 't', attrs: {}, children: [], text },
                  ],
                  text: '',
                },
              ],
              text: '',
            },
          ],
          text: '',
        },
      ],
      text: '',
    };
  }

  function makeTable(rows: GenericElement[][]): GenericElement {
    return {
      tag: 'tbl',
      attrs: { rowCnt: String(rows.length), colCnt: String(rows[0]?.length ?? 0) },
      children: rows.map(cells => ({
        tag: 'tr',
        attrs: {},
        children: cells,
        text: '',
      })),
      text: '',
    };
  }

  it('returns null for table with no rows after parsing', () => {
    const tableEl: GenericElement = { tag: 'tbl', attrs: {}, children: [], text: '' };
    const result = __testing.convertTable(tableEl, mockHeader, mockDoc, emptyBorderFills);
    expect(result).toBeNull();
  });

  it('converts table with colSpan > 1 (Line 512)', () => {
    const tableEl = makeTable([
      [makeCell('Merged', { colSpan: 2, colAddr: 0 })],
      [makeCell('A', { colAddr: 0 }), makeCell('B', { colAddr: 1 })],
    ]);
    const result = __testing.convertTable(tableEl, mockHeader, mockDoc, emptyBorderFills);
    expect(result).not.toBeNull();
  });

  it('converts table with rowSpan > 1 (Line 517)', () => {
    const tableEl = makeTable([
      [makeCell('Merged', { rowSpan: 2, colAddr: 0, rowAddr: 0 }), makeCell('B', { colAddr: 1, rowAddr: 0 })],
      [makeCell('D', { colAddr: 1, rowAddr: 1 })],
    ]);
    const result = __testing.convertTable(tableEl, mockHeader, mockDoc, emptyBorderFills);
    expect(result).not.toBeNull();
  });

  it('converts table with borderFillIDRef for bgColor (Line 525)', () => {
    const borderFills = new Map<number, ReturnType<typeof __testing.parseBorderFill>>();
    borderFills.set(5, { bgColor: 'ff0000', borders: {} });

    const tableEl = makeTable([
      [makeCell('Colored', { borderFillIDRef: 5 })],
    ]);
    const result = __testing.convertTable(tableEl, mockHeader, mockDoc, borderFills);
    expect(result).not.toBeNull();
  });

  it('converts table with borderFillIDRef for borders (Lines 530-537)', () => {
    const borderFills = new Map<number, ReturnType<typeof __testing.parseBorderFill>>();
    borderFills.set(3, {
      borders: {
        top: { style: 'SINGLE', width: 1 },
        bottom: { style: 'SINGLE', width: 1 },
      },
      bgColor: undefined,
    });

    const tableEl = makeTable([
      [makeCell('Bordered', { borderFillIDRef: 3 })],
    ]);
    const result = __testing.convertTable(tableEl, mockHeader, mockDoc, borderFills);
    expect(result).not.toBeNull();
  });

  it('converts table with borderFillIDRef that has no match', () => {
    const tableEl = makeTable([
      [makeCell('No match', { borderFillIDRef: 99 })],
    ]);
    const result = __testing.convertTable(tableEl, mockHeader, mockDoc, emptyBorderFills);
    expect(result).not.toBeNull();
  });

  it('handles row with empty cells (Line 553)', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        { tag: 'tr', attrs: {}, children: [], text: '' }, // Row with no tc children
      ],
      text: '',
    };
    const result = __testing.convertTable(tableEl, mockHeader, mockDoc, emptyBorderFills);
    expect(result).not.toBeNull();
  });

  it('handles convertTableSimple with tr/tc rows', () => {
    const tableEl: GenericElement = {
      tag: 'tbl', attrs: {},
      children: [
        { tag: 'tr', attrs: {}, children: [
          { tag: 'tc', attrs: {}, children: [], text: 'A' },
          { tag: 'tc', attrs: {}, children: [], text: 'B' },
        ], text: '' },
      ],
      text: '',
    };
    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('handles convertTableSimple with empty row (no cells)', () => {
    const tableEl: GenericElement = {
      tag: 'tbl', attrs: {},
      children: [{ tag: 'tr', attrs: {}, children: [], text: '' }],
      text: '',
    };
    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('handles convertTableSimple with namespaced tr/tc tags', () => {
    const tableEl: GenericElement = {
      tag: 'hp:tbl', attrs: {},
      children: [
        { tag: 'hp:tr', attrs: {}, children: [
          { tag: 'hp:tc', attrs: {}, children: [], text: 'X' },
        ], text: '' },
      ],
      text: '',
    };
    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('returns null from convertTableSimple when no tr rows', () => {
    const tableEl: GenericElement = {
      tag: 'tbl', attrs: {},
      children: [{ tag: 'colWidth', attrs: {}, children: [], text: '' }],
      text: '',
    };
    const result = __testing.convertTableSimple(tableEl);
    expect(result).toBeNull();
  });

  it('converts table with bgColor and borders combined', () => {
    const borderFills = new Map<number, ReturnType<typeof __testing.parseBorderFill>>();
    borderFills.set(7, {
      bgColor: '00ff00',
      borders: {
        top: { style: 'SINGLE', width: 2, color: 'ff0000' },
        left: { style: 'DOUBLE' },
      },
    });

    const tableEl = makeTable([
      [makeCell('Both', { borderFillIDRef: 7 })],
    ]);
    const result = __testing.convertTable(tableEl, mockHeader, mockDoc, borderFills);
    expect(result).not.toBeNull();
  });
});

describe('convertParagraph with tables and inline objects (Lines 314-335)', () => {
  const emptyBorderFills = new Map<number, ReturnType<typeof __testing.parseBorderFill>>();
  const mockDoc = {
    getImage: () => null,
  } as any as HanDoc;

  it('converts paragraph with table child', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            { tag: 'tc', attrs: {}, children: [], text: 'cell' },
          ],
          text: '',
        },
      ],
      text: '',
    };

    const para: Paragraph = {
      paraPrIDRef: 0,
      pageBreak: false,
      runs: [
        {
          charPrIDRef: 0,
          children: [
            { type: 'text', content: 'Before table' },
            { type: 'table', element: tableEl } as any,
            { type: 'text', content: 'After table' },
          ],
        },
      ],
    } as any;

    const result = __testing.convertParagraph(para, mockHeader, mockDoc, emptyBorderFills);
    expect(result.length).toBeGreaterThan(0);
  });

  it('converts paragraph with inline object (no image data)', () => {
    const imgEl: GenericElement = {
      tag: 'pic',
      attrs: {},
      children: [
        { tag: 'binItem', attrs: { src: 'Pictures/test.png' }, children: [], text: '' },
      ],
      text: '',
    };

    const para: Paragraph = {
      runs: [
        {
          children: [
            {
              type: 'inlineObject',
              name: 'pic',
              element: imgEl,
            } as any,
          ],
        },
      ],
    } as any;

    const result = __testing.convertParagraph(para, mockHeader, mockDoc, emptyBorderFills);
    expect(result.length).toBeGreaterThan(0);
  });

  it('converts paragraph with pageBreak', () => {
    const para: Paragraph = {
      pageBreak: true,
      runs: [
        {
          children: [{ type: 'text', content: 'After break' }],
        },
      ],
    } as any;

    const result = __testing.convertParagraph(para, mockHeader, mockDoc, emptyBorderFills);
    expect(result.length).toBeGreaterThan(0);
  });

  it('converts paragraph with text before and after table', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [],
      text: '',
    };

    const para: Paragraph = {
      runs: [
        {
          children: [
            { type: 'text', content: 'Text first' },
            { type: 'table', element: tableEl } as any,
          ],
        },
      ],
    } as any;

    const result = __testing.convertParagraph(para, mockHeader, mockDoc, emptyBorderFills);
    // Should have flushed text runs as paragraph before table
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('convertSection', () => {
  const emptyBorderFills = new Map<number, ReturnType<typeof __testing.parseBorderFill>>();
  const mockDoc = { getImage: () => null } as any as HanDoc;

  it('converts section with multiple paragraphs', () => {
    const section: Section = {
      paragraphs: [
        {
          runs: [{ children: [{ type: 'text', content: 'Para 1' }] }],
        },
        {
          runs: [{ children: [{ type: 'text', content: 'Para 2' }] }],
        },
      ],
    } as any;

    const result = __testing.convertSection(section, mockHeader, mockDoc, emptyBorderFills);
    expect(result.length).toBe(2);
  });
});

describe('convertInlineObject edge cases', () => {
  it('returns null when no image path found', () => {
    const mockDoc = { getImage: () => null } as any as HanDoc;
    const child = {
      type: 'inlineObject' as const,
      name: 'pic',
      element: { tag: 'pic', attrs: {}, children: [], text: '' } as GenericElement,
    };
    const result = __testing.convertInlineObject(child, mockDoc);
    expect(result).toBeNull();
  });

  it('returns null when image data not found in doc', () => {
    const mockDoc = { getImage: () => null } as any as HanDoc;
    const child = {
      type: 'inlineObject' as const,
      name: 'pic',
      element: {
        tag: 'pic',
        attrs: {},
        children: [
          { tag: 'binItem', attrs: { src: 'Pictures/missing.png' }, children: [], text: '' },
        ],
        text: '',
      } as GenericElement,
    };
    const result = __testing.convertInlineObject(child, mockDoc);
    expect(result).toBeNull();
  });

  it('creates ImageRun when image data exists', () => {
    const imgBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const mockDoc = { getImage: () => imgBuffer } as any as HanDoc;
    const child = {
      type: 'inlineObject' as const,
      name: 'pic',
      element: {
        tag: 'pic',
        attrs: { width: '7200', height: '5400' },
        children: [
          { tag: 'binItem', attrs: { src: 'Pictures/test.png' }, children: [], text: '' },
        ],
        text: '',
      } as GenericElement,
    };
    const result = __testing.convertInlineObject(child, mockDoc);
    expect(result).not.toBeNull();
  });

  it('handles different image extensions (jpg, gif, bmp)', () => {
    const imgBuffer = new Uint8Array([0xff, 0xd8]);
    const mockDoc = { getImage: () => imgBuffer } as any as HanDoc;

    for (const ext of ['jpg', 'jpeg', 'gif', 'bmp']) {
      const child = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: {},
          children: [
            { tag: 'binItem', attrs: { src: `Pictures/test.${ext}` }, children: [], text: '' },
          ],
          text: '',
        } as GenericElement,
      };
      const result = __testing.convertInlineObject(child, mockDoc);
      expect(result).not.toBeNull();
    }
  });

  it('uses default dimensions when none specified', () => {
    const imgBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const mockDoc = { getImage: () => imgBuffer } as any as HanDoc;
    const child = {
      type: 'inlineObject' as const,
      name: 'pic',
      element: {
        tag: 'pic',
        attrs: {},
        children: [
          { tag: 'binItem', attrs: { src: 'Pictures/nodim.png' }, children: [], text: '' },
        ],
        text: '',
      } as GenericElement,
    };
    const result = __testing.convertInlineObject(child, mockDoc);
    expect(result).not.toBeNull();
  });
});

describe('resolveFontName edge cases', () => {
  it('returns undefined when fontRef is null', () => {
    const charProp = { height: 1000 } as any;
    const result = __testing.resolveFontName(charProp, mockHeader);
    expect(result).toBeUndefined();
  });

  it('tries latin fallback when hangul not found', () => {
    const charProp = { fontRef: { latin: 0 }, height: 1000 } as any;
    const header = {
      refList: {
        fontFaces: [
          { lang: 'latin', fonts: [{ id: 0, face: 'Arial', type: 'ttf' }] },
        ],
        charProperties: [],
        paraProperties: [],
        borderFills: [],
      },
    } as any;
    const result = __testing.resolveFontName(charProp, header);
    expect(result).toBe('Arial');
  });

  it('tries hanja fallback', () => {
    const charProp = { fontRef: { hanja: 0 }, height: 1000 } as any;
    const header = {
      refList: {
        fontFaces: [
          { lang: 'hanja', fonts: [{ id: 0, face: '궁서', type: 'ttf' }] },
        ],
        charProperties: [],
        paraProperties: [],
        borderFills: [],
      },
    } as any;
    const result = __testing.resolveFontName(charProp, header);
    expect(result).toBe('Gungsuh');
  });

  it('returns undefined when font declaration not found', () => {
    const charProp = { fontRef: { hangul: 99 }, height: 1000 } as any;
    const header = {
      refList: {
        fontFaces: [
          { lang: 'hangul', fonts: [{ id: 0, face: 'Batang', type: 'ttf' }] },
        ],
        charProperties: [],
        paraProperties: [],
        borderFills: [],
      },
    } as any;
    const result = __testing.resolveFontName(charProp, header);
    expect(result).toBeUndefined();
  });

  it('returns undefined when no font face declaration for lang', () => {
    const charProp = { fontRef: { hangul: 0 }, height: 1000 } as any;
    const header = {
      refList: {
        fontFaces: [
          { lang: 'latin', fonts: [{ id: 0, face: 'Arial', type: 'ttf' }] },
        ],
        charProperties: [],
        paraProperties: [],
        borderFills: [],
      },
    } as any;
    const result = __testing.resolveFontName(charProp, header);
    expect(result).toBeUndefined();
  });
});

describe('parseBorderFill edge cases', () => {
  it('handles namespaced fillBrush and winBrush', () => {
    const bf: GenericElement = {
      tag: 'borderFill',
      attrs: { id: '1' },
      children: [
        {
          tag: 'hp:fillBrush',
          attrs: {},
          children: [
            {
              tag: 'hp:winBrush',
              attrs: { faceColor: 'aabb00' },
              children: [],
              text: '',
            },
          ],
          text: '',
        },
      ],
      text: '',
    };
    const result = __testing.parseBorderFill(bf);
    expect(result.bgColor).toBe('aabb00');
  });

  it('ignores winBrush with faceColor=none', () => {
    const bf: GenericElement = {
      tag: 'borderFill',
      attrs: { id: '1' },
      children: [
        {
          tag: 'fillBrush',
          attrs: {},
          children: [
            { tag: 'winBrush', attrs: { faceColor: 'none' }, children: [], text: '' },
          ],
          text: '',
        },
      ],
      text: '',
    };
    const result = __testing.parseBorderFill(bf);
    expect(result.bgColor).toBeUndefined();
  });

  it('ignores winBrush with faceColor=ffffff', () => {
    const bf: GenericElement = {
      tag: 'borderFill',
      attrs: { id: '1' },
      children: [
        {
          tag: 'fillBrush',
          attrs: {},
          children: [
            { tag: 'winBrush', attrs: { faceColor: 'ffffff' }, children: [], text: '' },
          ],
          text: '',
        },
      ],
      text: '',
    };
    const result = __testing.parseBorderFill(bf);
    expect(result.bgColor).toBeUndefined();
  });

  it('parses border with style attr instead of type', () => {
    const bf: GenericElement = {
      tag: 'borderFill',
      attrs: { id: '1' },
      children: [
        { tag: 'top', attrs: { style: 'solid', width: '3' }, children: [], text: '' },
      ],
      text: '',
    };
    const result = __testing.parseBorderFill(bf);
    expect(result.borders.top).toBeDefined();
    expect(result.borders.top!.width).toBe(3);
  });

  it('parses namespaced border tags (topBorder, etc.)', () => {
    const bf: GenericElement = {
      tag: 'borderFill',
      attrs: { id: '1' },
      children: [
        { tag: 'topBorder', attrs: { type: 'solid' }, children: [], text: '' },
        { tag: 'hp:bottomBorder', attrs: { type: 'dashed' }, children: [], text: '' },
        { tag: 'hp:left', attrs: { type: 'dotted', width: '2' }, children: [], text: '' },
        { tag: 'rightBorder', attrs: { type: 'double' }, children: [], text: '' },
      ],
      text: '',
    };
    const result = __testing.parseBorderFill(bf);
    expect(result.borders.top).toBeDefined();
    expect(result.borders.bottom).toBeDefined();
    expect(result.borders.left).toBeDefined();
    expect(result.borders.right).toBeDefined();
  });

  it('handles border with width but no explicit width attr', () => {
    const bf: GenericElement = {
      tag: 'borderFill',
      attrs: { id: '1' },
      children: [
        { tag: 'top', attrs: { type: 'solid' }, children: [], text: '' },
      ],
      text: '',
    };
    const result = __testing.parseBorderFill(bf);
    expect(result.borders.top).toBeDefined();
    expect(result.borders.top!.width).toBeUndefined();
  });
});

describe('mimeToImageType', () => {
  it('maps jpeg to jpg', () => expect(__testing.mimeToImageType('image/jpeg')).toBe('jpg'));
  it('maps jpg to jpg', () => expect(__testing.mimeToImageType('image/jpg')).toBe('jpg'));
  it('maps gif to gif', () => expect(__testing.mimeToImageType('image/gif')).toBe('gif'));
  it('maps bmp to bmp', () => expect(__testing.mimeToImageType('image/bmp')).toBe('bmp'));
  it('defaults to png', () => expect(__testing.mimeToImageType('image/unknown')).toBe('png'));
  it('handles png', () => expect(__testing.mimeToImageType('image/png')).toBe('png'));
});

describe('mapBorderStyle edge cases', () => {
  it('maps solid', () => expect(__testing.mapBorderStyle('solid')).toBeDefined());
  it('maps double', () => expect(__testing.mapBorderStyle('double')).toBeDefined());
  it('maps dashed', () => expect(__testing.mapBorderStyle('dashed')).toBeDefined());
  it('maps dotted', () => expect(__testing.mapBorderStyle('dotted')).toBeDefined());
  it('maps dash_dot', () => expect(__testing.mapBorderStyle('dash_dot')).toBeDefined());
  it('maps none', () => expect(__testing.mapBorderStyle('none')).toBeDefined());
  it('defaults unknown to SINGLE', () => expect(__testing.mapBorderStyle('unknown_style')).toBeDefined());
  it('handles undefined', () => expect(__testing.mapBorderStyle(undefined as any)).toBeDefined());
});

describe('findImageDimensions edge cases', () => {
  it('finds dimensions from namespaced sz tag', () => {
    const el: GenericElement = {
      tag: 'pic',
      attrs: {},
      children: [
        { tag: 'hp:sz', attrs: { width: '3000', height: '2000' }, children: [], text: '' },
      ],
      text: '',
    };
    const result = __testing.findImageDimensions(el);
    expect(result.width).toBe(3000);
    expect(result.height).toBe(2000);
  });

  it('finds dimensions from namespaced imgRect tag', () => {
    const el: GenericElement = {
      tag: 'pic',
      attrs: {},
      children: [
        { tag: 'hp:imgRect', attrs: { cx: '4000', cy: '3000' }, children: [], text: '' },
      ],
      text: '',
    };
    const result = __testing.findImageDimensions(el);
    expect(result.width).toBe(4000);
    expect(result.height).toBe(3000);
  });

  it('skips sz with zero dimensions and recurses', () => {
    const el: GenericElement = {
      tag: 'pic',
      attrs: {},
      children: [
        { tag: 'sz', attrs: { width: '0', height: '0' }, children: [], text: '' },
        {
          tag: 'inner',
          attrs: {},
          children: [
            { tag: 'sz', attrs: { width: '1000', height: '800' }, children: [], text: '' },
          ],
          text: '',
        },
      ],
      text: '',
    };
    const result = __testing.findImageDimensions(el);
    expect(result.width).toBe(1000);
  });
});

describe('findImagePath edge cases', () => {
  it('finds path from namespaced binItem', () => {
    const el: GenericElement = {
      tag: 'pic',
      attrs: {},
      children: [
        { tag: 'hp:binItem', attrs: { src: 'Pictures/ns.png' }, children: [], text: '' },
      ],
      text: '',
    };
    expect(__testing.findImagePath(el)).toBe('Pictures/ns.png');
  });

  it('finds path from namespaced img', () => {
    const el: GenericElement = {
      tag: 'pic',
      attrs: {},
      children: [
        { tag: 'hp:img', attrs: { binaryItemIDRef: 'Pictures/ns2.jpg' }, children: [], text: '' },
      ],
      text: '',
    };
    expect(__testing.findImagePath(el)).toBe('Pictures/ns2.jpg');
  });
});
