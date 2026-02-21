/**
 * Additional paragraph-parser tests for uncovered paths.
 */
import { describe, it, expect } from 'vitest';
import { parseGenericElement, parseRunChild, parseParagraph, parseRun } from '../paragraph-parser';

describe('parseGenericElement edge cases', () => {
  it('caps recursion at depth > 50', () => {
    // depth > 50 returns empty element immediately
    const el = parseGenericElement({ child: { nested: {} }, '@_id': '1' }, 'root', 51);
    expect(el.tag).toBe('root');
    expect(el.attrs).toEqual({});
    expect(el.children).toHaveLength(0);
  });

  it('handles null/undefined values in node', () => {
    const el = parseGenericElement({ foo: null, bar: undefined, '@_id': '1' }, 'test');
    expect(el.attrs['id']).toBe('1');
    // null/undefined values are skipped
    expect(el.children).toHaveLength(0);
  });

  it('handles numeric #text', () => {
    const el = parseGenericElement({ '#text': 42 }, 'test');
    expect(el.text).toBe('42');
  });

  it('handles primitive child values (string)', () => {
    const el = parseGenericElement({ label: 'hello' }, 'test');
    expect(el.children).toHaveLength(1);
    expect(el.children[0].tag).toBe('label');
    expect(el.children[0].text).toBe('hello');
  });

  it('handles primitive child values (number)', () => {
    const el = parseGenericElement({ count: 5 }, 'test');
    expect(el.children).toHaveLength(1);
    expect(el.children[0].text).toBe('5');
  });

  it('handles primitive child values (boolean)', () => {
    const el = parseGenericElement({ flag: true }, 'test');
    expect(el.children).toHaveLength(1);
    expect(el.children[0].text).toBe('true');
  });

  it('handles array with primitive items', () => {
    const el = parseGenericElement({ items: ['a', 'b'] }, 'test');
    expect(el.children).toHaveLength(2);
    expect(el.children[0].text).toBe('a');
    expect(el.children[1].text).toBe('b');
  });

  it('handles array with mixed object and primitive items', () => {
    const el = parseGenericElement({ items: [{ '@_id': '1' }, 'text'] }, 'test');
    expect(el.children).toHaveLength(2);
    expect(el.children[0].attrs['id']).toBe('1');
    expect(el.children[1].text).toBe('text');
  });

  it('handles array with null items', () => {
    const el = parseGenericElement({ items: [null, 'text'] }, 'test');
    expect(el.children).toHaveLength(2);
    expect(el.children[0].text).toBeNull();
    expect(el.children[1].text).toBe('text');
  });
});

describe('parseRunChild edge cases', () => {
  it('parses text from object with #text', () => {
    const results = parseRunChild('t', { '#text': 'hello' });
    expect(results.some(r => r.type === 'text' && r.content === 'hello')).toBe(true);
  });

  it('parses text with inline elements (track change marks)', () => {
    const results = parseRunChild('t', {
      '#text': 'before',
      'insertBegin': { '@_Id': '1', '@_TcId': '2' },
    });
    // Should have both text and track change
    const text = results.find(r => r.type === 'text');
    const tc = results.find(r => r.type === 'trackChange');
    expect(text).toBeDefined();
    expect(tc).toBeDefined();
  });

  it('parses text with namespaced inline elements', () => {
    const results = parseRunChild('t', {
      '#text': 'text',
      'hp:insertBegin': { '@_Id': '5' },
    });
    expect(results.some(r => r.type === 'trackChange')).toBe(true);
  });

  it('parses equation child', () => {
    const results = parseRunChild('equation', { '@_script': 'x^2' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('equation');
  });

  it('parses shape objects (rect)', () => {
    const results = parseRunChild('rect', { '@_id': '1' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('shape');
  });

  it('parses shape objects (ellipse)', () => {
    const results = parseRunChild('ellipse', {});
    expect(results[0].type).toBe('shape');
  });

  it('parses shape objects (line)', () => {
    const results = parseRunChild('line', {});
    expect(results[0].type).toBe('shape');
  });

  it('parses track change marks with paraend', () => {
    const results = parseRunChild('deleteBegin', { '@_Id': '1', '@_TcId': '3', '@_paraend': '1' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('trackChange');
    if (results[0].type === 'trackChange') {
      expect(results[0].mark).toBe('deleteBegin');
      expect(results[0].id).toBe(1);
      expect(results[0].tcId).toBe(3);
      expect(results[0].paraEnd).toBe(true);
    }
  });

  it('parses deleteEnd mark', () => {
    const results = parseRunChild('deleteEnd', { '@_Id': '2' });
    expect(results[0].type).toBe('trackChange');
  });

  it('parses insertEnd mark', () => {
    const results = parseRunChild('insertEnd', { '@_Id': '2' });
    expect(results[0].type).toBe('trackChange');
  });

  it('parses hiddenComment', () => {
    const results = parseRunChild('hiddenComment', {
      p: { run: { t: 'Comment text' } },
    });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('hiddenComment');
  });

  it('parses HIDDENCOMMENT (uppercase)', () => {
    const results = parseRunChild('HIDDENCOMMENT', {
      p: { run: { t: 'Comment' } },
    });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('hiddenComment');
  });

  it('parses unknown element as inlineObject', () => {
    const results = parseRunChild('unknownTag', { '@_id': '1' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('inlineObject');
  });

  it('handles inline objects (pic, ole, chart, video, audio)', () => {
    for (const tag of ['pic', 'ole', 'chart', 'video', 'audio']) {
      const results = parseRunChild(tag, {});
      expect(results[0].type).toBe('inlineObject');
    }
  });

  it('handles more shape objects', () => {
    for (const tag of ['arc', 'polyline', 'polygon', 'curve', 'connectLine', 'container', 'textart']) {
      const results = parseRunChild(tag, {});
      expect(results[0].type).toBe('shape');
    }
  });
});

describe('parseParagraph', () => {
  it('parses paragraph with linesegarray', () => {
    const node = {
      '@_id': '1',
      '@_paraPrIDRef': '2',
      '@_styleIDRef': '3',
      '@_pageBreak': '1',
      '@_columnBreak': 'true',
      '@_merged': '0',
      run: { t: 'text', '@_charPrIDRef': '1' },
      linesegarray: {
        lineseg: {
          '@_textpos': '0',
          '@_vertpos': '100',
          '@_vertsize': '200',
          '@_textheight': '150',
          '@_baseline': '120',
          '@_spacing': '10',
          '@_horzpos': '0',
          '@_horzsize': '500',
          '@_flags': '0',
        },
      },
    };
    const result = parseParagraph(node);
    expect(result.id).toBe('1');
    expect(result.paraPrIDRef).toBe(2);
    expect(result.styleIDRef).toBe(3);
    expect(result.pageBreak).toBe(true);
    expect(result.columnBreak).toBe(true);
    expect(result.lineSegArray).toHaveLength(1);
    expect(result.lineSegArray[0].textpos).toBe(0);
  });

  it('parses paragraph with multiple runs', () => {
    const node = {
      run: [
        { t: 'Hello ', '@_charPrIDRef': '1' },
        { t: 'World', '@_charPrIDRef': '2' },
      ],
    };
    const result = parseParagraph(node);
    expect(result.runs).toHaveLength(2);
  });

  it('parses paragraph with no runs', () => {
    const result = parseParagraph({});
    expect(result.runs).toHaveLength(0);
    expect(result.lineSegArray).toHaveLength(0);
  });
});

describe('parseRun edge cases', () => {
  it('parses run with array of text elements', () => {
    const node = { t: ['first', 'second'], '@_charPrIDRef': '0' };
    const result = parseRun(node);
    const texts = result.children.filter(c => c.type === 'text');
    expect(texts.length).toBe(2);
  });

  it('parses run with no charPrIDRef', () => {
    const node = { t: 'text' };
    const result = parseRun(node);
    expect(result.charPrIDRef).toBeNull();
  });

  it('parses text from numeric value', () => {
    const results = parseRunChild('t', 123);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('text');
    if (results[0].type === 'text') {
      expect(results[0].content).toBe('123');
    }
  });
});
