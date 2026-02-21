import { describe, it, expect, vi } from 'vitest';
import { __testing } from '../converter';
import type { GenericElement, DocumentHeader } from '@handoc/document-model';
import * as hwpxParser from '@handoc/hwpx-parser';

/**
 * Target line 490: parseTable exception fallback to convertTableSimple
 */

describe('Line 490 - parseTable Exception Fallback', () => {
  
  const createMockDoc = () => ({ getImage: () => null } as any);
  const createMockHeader = (): DocumentHeader => ({
    refList: { fontFaces: [], charProperties: [], paraProperties: [], borderFills: [] },
  } as any);

  it('handles parseTable throwing an exception', () => {
    // Mock parseTable to throw
    const originalParseTable = hwpxParser.parseTable;
    vi.spyOn(hwpxParser, 'parseTable').mockImplementation(() => {
      throw new Error('Parse error');
    });

    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [{
        tag: 'tr',
        attrs: {},
        children: [{
          tag: 'tc',
          attrs: {},
          children: [],
          text: 'Cell',
        }],
        text: '',
      }],
      text: '',
    };

    // This should catch the exception and fall back to convertTableSimple
    const result = __testing.convertTable(tableEl, createMockHeader(), createMockDoc(), new Map());
    
    expect(result).toBeDefined();
    
    // Restore
    vi.restoreAllMocks();
  });

  it('handles parseTable throwing for malformed table', () => {
    vi.spyOn(hwpxParser, 'parseTable').mockImplementation(() => {
      throw new TypeError('Cannot read property of undefined');
    });

    const tableEl: GenericElement = {
      tag: 'tbl',
      attrs: {},
      children: [],
      text: '',
    };

    const result = __testing.convertTable(tableEl, createMockHeader(), createMockDoc(), new Map());
    
    // Should return null from convertTableSimple (no rows)
    expect(result).toBeNull();
    
    vi.restoreAllMocks();
  });
});
