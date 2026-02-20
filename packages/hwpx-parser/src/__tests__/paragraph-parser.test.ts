import { describe, it, expect } from 'vitest';
import { parseGenericElement, parseRun } from '../paragraph-parser';

describe('parseRun', () => {
  it('parses run with text', () => {
    const node = { t: '안녕하세요', '@_charPrIDRef': '0' };
    const result = parseRun(node);
    expect(result.charPrIDRef).toBe(0);
    expect(result.children).toEqual([{ type: 'text', content: '안녕하세요' }]);
  });

  it('parses run with empty text', () => {
    const node = { t: '', '@_charPrIDRef': '0' };
    const result = parseRun(node);
    expect(result.children).toEqual([{ type: 'text', content: '' }]);
  });

  it('parses run with secPr', () => {
    const node = { secPr: { '@_id': '1' }, '@_charPrIDRef': '0' };
    const result = parseRun(node);
    expect(result.children[0].type).toBe('secPr');
  });

  it('parses run with ctrl', () => {
    const node = { ctrl: { colPr: { '@_type': 'NEWSPAPER' } }, '@_charPrIDRef': '0' };
    const result = parseRun(node);
    expect(result.children[0].type).toBe('ctrl');
  });

  it('parses run with tbl', () => {
    const node = { tbl: { '@_rowCnt': '3' }, '@_charPrIDRef': '0' };
    const result = parseRun(node);
    expect(result.children[0].type).toBe('table');
  });

  it('parses run with inline object', () => {
    const node = { picture: { '@_id': '1' }, '@_charPrIDRef': '0' };
    const result = parseRun(node);
    expect(result.children[0].type).toBe('inlineObject');
    if (result.children[0].type === 'inlineObject') {
      expect(result.children[0].name).toBe('picture');
    }
  });
});

describe('parseGenericElement', () => {
  it('parses element with attrs and children', () => {
    const node = { '@_type': 'NEWSPAPER', '@_colCount': '1' };
    const result = parseGenericElement(node, 'colPr');
    expect(result.tag).toBe('colPr');
    expect(result.attrs['type']).toBe('NEWSPAPER');
  });
});
