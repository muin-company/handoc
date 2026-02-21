/**
 * Additional field-parser tests for uncovered branches.
 */
import { describe, it, expect } from 'vitest';
import { parseField, parseFieldEnd } from '../field-parser';
import type { GenericElement } from '../types';

describe('parseField - HYPERLINK with Command fallback', () => {
  it('extracts URL from Command when Path is missing', () => {
    const field = parseField({
      tag: 'ctrl',
      attrs: {},
      children: [{
        tag: 'fieldBegin',
        attrs: { type: 'HYPERLINK' },
        children: [{
          tag: 'parameters',
          attrs: {},
          children: [
            { tag: 'stringParam', attrs: { name: 'Command' }, children: [], text: 'https\\://example.com;1;0' },
          ],
          text: null,
        }],
        text: null,
      }],
      text: null,
    });
    expect(field).not.toBeNull();
    expect(field!.url).toBe('https\\://example.com');
  });

  it('handles HYPERLINK with no Path and no Command', () => {
    const field = parseField({
      tag: 'ctrl',
      attrs: {},
      children: [{
        tag: 'fieldBegin',
        attrs: { type: 'HYPERLINK' },
        children: [{
          tag: 'parameters',
          attrs: {},
          children: [],
          text: null,
        }],
        text: null,
      }],
      text: null,
    });
    expect(field).not.toBeNull();
    expect(field!.url).toBeUndefined();
  });

  it('parses fieldBegin with no name or id', () => {
    const field = parseField({
      tag: 'ctrl',
      attrs: {},
      children: [{
        tag: 'fieldBegin',
        attrs: { type: 'PAGENO' },
        children: [],
        text: null,
      }],
      text: null,
    });
    expect(field).not.toBeNull();
    expect(field!.type).toBe('PAGENO');
    expect(field!.name).toBeUndefined();
    expect(field!.id).toBeUndefined();
    expect(field!.url).toBeUndefined();
  });

  it('parses fieldBegin with missing type defaults to UNKNOWN', () => {
    const field = parseField({
      tag: 'ctrl',
      attrs: {},
      children: [{
        tag: 'fieldBegin',
        attrs: {},
        children: [],
        text: null,
      }],
      text: null,
    });
    expect(field!.type).toBe('UNKNOWN');
  });

  it('handles parameter with no name (skipped)', () => {
    const field = parseField({
      tag: 'ctrl',
      attrs: {},
      children: [{
        tag: 'fieldBegin',
        attrs: { type: 'TEST' },
        children: [{
          tag: 'parameters',
          attrs: {},
          children: [
            { tag: 'param', attrs: {}, children: [], text: 'value' },
            { tag: 'param', attrs: { name: 'valid' }, children: [], text: 'data' },
          ],
          text: null,
        }],
        text: null,
      }],
      text: null,
    });
    expect(field!.parameters['valid']).toBe('data');
  });
});

describe('parseFieldEnd edge cases', () => {
  it('handles fieldEnd as element itself', () => {
    const ref = parseFieldEnd({
      tag: 'fieldEnd',
      attrs: { beginIDRef: '999' },
      children: [],
      text: null,
    });
    expect(ref).toBe('999');
  });

  it('returns null for fieldEnd without beginIDRef', () => {
    const ref = parseFieldEnd({
      tag: 'fieldEnd',
      attrs: {},
      children: [],
      text: null,
    });
    expect(ref).toBeNull();
  });
});
