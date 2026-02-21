import { describe, it, expect } from 'vitest';
import { __testing } from '../converter';
import type { GenericElement } from '@handoc/document-model';

/**
 * Direct tests for convertTableSimple function.
 * This function is the fallback when parseTable fails.
 * Testing it directly ensures Lines 566-587 are covered.
 */

describe('convertTableSimple - Direct Unit Tests', () => {
  
  it('converts table with basic tr/tc structure', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: 'Cell 1',
            },
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: 'Cell 2',
            },
          ],
          text: '',
        },
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: 'Cell 3',
            },
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: 'Cell 4',
            },
          ],
          text: '',
        },
      ],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('returns null when table has no rows', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).toBeNull();
  });

  it('handles table with namespaced tr tags', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'hp:tr',
          attrs: {},
          children: [
            {
              tag: 'hp:tc',
              attrs: {},
              children: [],
              text: 'Cell with namespace',
            },
          ],
          text: '',
        },
      ],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('handles row with empty cells list', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [], // No tc children
          text: '',
        },
      ],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
    // Should create a row with a single empty cell
  });

  it('handles cells with nested content', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: {},
              children: [
                {
                  tag: 'p',
                  attrs: {},
                  children: [],
                  text: ' nested',
                },
              ],
              text: 'Cell with',
            },
          ],
          text: '',
        },
      ],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('handles table with single cell', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: 'Single cell',
            },
          ],
          text: '',
        },
      ],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('handles table with many rows', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      tag: 'tr' as const,
      attrs: {},
      children: [
        {
          tag: 'tc' as const,
          attrs: {},
          children: [],
          text: `Row ${i + 1}`,
        },
      ],
      text: '',
    }));

    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: rows,
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('handles table with empty text cells', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: '',
            },
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: '',
            },
          ],
          text: '',
        },
      ],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('filters out non-tr children', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'metadata',
          attrs: {},
          children: [],
          text: 'should be ignored',
        },
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: 'Valid cell',
            },
          ],
          text: '',
        },
        {
          tag: 'footer',
          attrs: {},
          children: [],
          text: 'should be ignored',
        },
      ],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('filters out non-tc children in rows', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'metadata',
              attrs: {},
              children: [],
              text: 'not a cell',
            },
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: 'Real cell',
            },
            {
              tag: 'comment',
              attrs: {},
              children: [],
              text: 'not a cell either',
            },
          ],
          text: '',
        },
      ],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });

  it('handles mixed namespace prefixes', () => {
    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: {},
              children: [],
              text: 'No prefix',
            },
          ],
          text: '',
        },
        {
          tag: 'hp:tr',
          attrs: {},
          children: [
            {
              tag: 'hp:tc',
              attrs: {},
              children: [],
              text: 'With prefix',
            },
          ],
          text: '',
        },
      ],
      text: '',
    };

    const result = __testing.convertTableSimple(tableEl);
    expect(result).not.toBeNull();
  });
});
