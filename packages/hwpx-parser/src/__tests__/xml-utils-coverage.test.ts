/**
 * Additional xml-utils tests for uncovered paths.
 */
import { describe, it, expect } from 'vitest';
import { getChildren, getAttr, localName, parseBool, parseIntSafe } from '../xml-utils';

describe('getChildren', () => {
  it('returns empty array for null value', () => {
    expect(getChildren({ tag: null }, 'tag')).toEqual([]);
  });

  it('returns array as-is when value is array', () => {
    const arr = [{ id: 1 }, { id: 2 }];
    expect(getChildren({ items: arr }, 'items')).toBe(arr);
  });

  it('wraps single value in array', () => {
    const obj = { id: 1 };
    expect(getChildren({ item: obj }, 'item')).toEqual([obj]);
  });

  it('returns empty array for missing key', () => {
    expect(getChildren({}, 'missing')).toEqual([]);
  });
});

describe('getAttr', () => {
  it('returns undefined for missing attribute', () => {
    expect(getAttr({}, 'foo')).toBeUndefined();
  });

  it('converts numeric attribute to string', () => {
    expect(getAttr({ '@_count': 5 }, 'count')).toBe('5');
  });
});

describe('localName', () => {
  it('strips namespace prefix', () => {
    expect(localName('hp:p')).toBe('p');
  });

  it('returns tag as-is without prefix', () => {
    expect(localName('p')).toBe('p');
  });
});

describe('parseBool', () => {
  it('returns false for undefined', () => {
    expect(parseBool(undefined)).toBe(false);
  });

  it('returns true for "1"', () => {
    expect(parseBool('1')).toBe(true);
  });

  it('returns true for "true" (case insensitive)', () => {
    expect(parseBool('TRUE')).toBe(true);
    expect(parseBool('True')).toBe(true);
  });

  it('returns false for "0"', () => {
    expect(parseBool('0')).toBe(false);
  });
});

describe('parseIntSafe', () => {
  it('returns default for undefined', () => {
    expect(parseIntSafe(undefined)).toBe(0);
    expect(parseIntSafe(undefined, 42)).toBe(42);
  });

  it('returns default for NaN', () => {
    expect(parseIntSafe('abc')).toBe(0);
  });

  it('parses valid integer', () => {
    expect(parseIntSafe('123')).toBe(123);
  });
});
