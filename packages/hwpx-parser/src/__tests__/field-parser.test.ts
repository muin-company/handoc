import { describe, it, expect } from 'vitest';
import { parseField, parseFieldEnd } from '../field-parser';

describe('parseField', () => {
  it('parses a hyperlink field from ctrl element', () => {
    const field = parseField({
      tag: 'ctrl',
      attrs: {},
      children: [
        {
          tag: 'fieldBegin',
          attrs: { id: '123', type: 'HYPERLINK', name: '', editable: '0' },
          children: [
            {
              tag: 'parameters',
              attrs: { cnt: '6', name: '' },
              children: [
                { tag: 'integerParam', attrs: { name: 'Prop' }, children: [], text: '0' },
                { tag: 'stringParam', attrs: { name: 'Command' }, children: [], text: 'https\\://example.com;1;0;0;' },
                { tag: 'stringParam', attrs: { name: 'Path' }, children: [], text: 'https://example.com' },
                { tag: 'stringParam', attrs: { name: 'Category' }, children: [], text: 'HWPHYPERLINK_TYPE_URL' },
              ],
              text: null,
            },
          ],
          text: null,
        },
      ],
      text: null,
    });

    expect(field).not.toBeNull();
    expect(field!.type).toBe('HYPERLINK');
    expect(field!.url).toBe('https://example.com');
    expect(field!.id).toBe('123');
    expect(field!.parameters['Path']).toBe('https://example.com');
  });

  it('returns null for ctrl without fieldBegin', () => {
    const field = parseField({
      tag: 'ctrl',
      attrs: {},
      children: [
        { tag: 'colPr', attrs: {}, children: [], text: null },
      ],
      text: null,
    });
    expect(field).toBeNull();
  });

  it('returns graceful result for unknown field type', () => {
    const field = parseField({
      tag: 'ctrl',
      attrs: {},
      children: [
        {
          tag: 'fieldBegin',
          attrs: { type: 'DATE' },
          children: [],
          text: null,
        },
      ],
      text: null,
    });

    expect(field).not.toBeNull();
    expect(field!.type).toBe('DATE');
    expect(field!.url).toBeUndefined();
  });
});

describe('parseFieldEnd', () => {
  it('extracts beginIDRef from fieldEnd', () => {
    const ref = parseFieldEnd({
      tag: 'ctrl',
      attrs: {},
      children: [
        { tag: 'fieldEnd', attrs: { beginIDRef: '123', fieldid: '456' }, children: [], text: null },
      ],
      text: null,
    });
    expect(ref).toBe('123');
  });

  it('returns null when no fieldEnd', () => {
    const ref = parseFieldEnd({ tag: 'ctrl', attrs: {}, children: [], text: null });
    expect(ref).toBeNull();
  });
});
