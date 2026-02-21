/**
 * Additional section-props-parser tests for uncovered branches.
 */
import { describe, it, expect } from 'vitest';
import { parseSectionProps } from '../section-props-parser';
import type { GenericElement } from '../types';

describe('parseSectionProps - columns', () => {
  it('parses colPr with column properties', () => {
    const el: GenericElement = {
      tag: 'secPr',
      attrs: {},
      children: [
        {
          tag: 'pagePr',
          attrs: { width: '59528', height: '84188' },
          children: [
            {
              tag: 'margin',
              attrs: { left: '8504', right: '8504', top: '5668', bottom: '4252', header: '4252', footer: '4252', gutter: '0' },
              children: [],
              text: null,
            },
          ],
          text: null,
        },
        {
          tag: 'colPr',
          attrs: { colCount: '2', sameGap: '1134', type: 'BALANCE' },
          children: [],
          text: null,
        },
      ],
      text: null,
    };
    const props = parseSectionProps(el);
    expect(props.columns).toBeDefined();
    expect(props.columns!.count).toBe(2);
    expect(props.columns!.gap).toBe(1134);
    expect(props.columns!.type).toBe('BALANCE');
  });

  it('defaults column type to NEWSPAPER when not specified', () => {
    const el: GenericElement = {
      tag: 'secPr',
      attrs: {},
      children: [{
        tag: 'colPr',
        attrs: { colCount: '1' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const props = parseSectionProps(el);
    expect(props.columns!.type).toBe('NEWSPAPER');
  });
});

describe('parseSectionProps - pageStartNumber', () => {
  it('parses startNum with page number', () => {
    const el: GenericElement = {
      tag: 'secPr',
      attrs: {},
      children: [{
        tag: 'startNum',
        attrs: { page: '5' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const props = parseSectionProps(el);
    expect(props.pageStartNumber).toBe(5);
  });

  it('does not set pageStartNumber for page=0', () => {
    const el: GenericElement = {
      tag: 'secPr',
      attrs: {},
      children: [{
        tag: 'startNum',
        attrs: { page: '0' },
        children: [],
        text: null,
      }],
      text: null,
    };
    const props = parseSectionProps(el);
    expect(props.pageStartNumber).toBeUndefined();
  });
});

describe('parseSectionProps - no pagePr', () => {
  it('returns zeros when no pagePr element', () => {
    const el: GenericElement = {
      tag: 'secPr',
      attrs: {},
      children: [],
      text: null,
    };
    const props = parseSectionProps(el);
    expect(props.pageWidth).toBe(0);
    expect(props.pageHeight).toBe(0);
    expect(props.landscape).toBe(false);
  });
});
