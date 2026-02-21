/**
 * Additional shape-parser tests for uncovered branches.
 */
import { describe, it, expect } from 'vitest';
import { parseShape } from '../shape-parser';
import type { GenericElement } from '../types';

describe('parseShape - edge cases', () => {
  it('handles shape without sz child (no width/height)', () => {
    const shapeEl: GenericElement = {
      tag: 'rect',
      attrs: {},
      children: [
        // No sz child - width and height should be undefined
        {
          tag: 'drawText',
          attrs: {},
          children: [
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
                        { tag: 't', attrs: {}, children: [], text: 'No size' },
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

    const shape = parseShape(shapeEl);
    expect(shape.type).toBe('rect');
    expect(shape.width).toBeUndefined();
    expect(shape.height).toBeUndefined();
    expect(shape.textContent).toBe('No size');
  });

  it('handles drawText without subList (paragraphs directly under drawText)', () => {
    const shapeEl: GenericElement = {
      tag: 'ellipse',
      attrs: {},
      children: [
        {
          tag: 'sz',
          attrs: { width: '5000', height: '3000' },
          children: [],
          text: null,
        },
        {
          tag: 'drawText',
          attrs: {},
          children: [
            // Paragraph directly under drawText, not in subList
            {
              tag: 'p',
              attrs: {},
              children: [
                {
                  tag: 'run',
                  attrs: {},
                  children: [
                    { tag: 't', attrs: {}, children: [], text: 'Direct P1' },
                  ],
                  text: null,
                },
              ],
              text: null,
            },
            {
              tag: 'p',
              attrs: {},
              children: [
                {
                  tag: 'run',
                  attrs: {},
                  children: [
                    { tag: 't', attrs: {}, children: [], text: 'Direct P2' },
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

    const shape = parseShape(shapeEl);
    expect(shape.type).toBe('ellipse');
    expect(shape.width).toBe(5000);
    expect(shape.height).toBe(3000);
    expect(shape.paragraphs).toHaveLength(2);
    expect(shape.textContent).toBe('Direct P1\nDirect P2');
  });

  it('handles shape with invalid or missing sz attributes', () => {
    const shapeEl: GenericElement = {
      tag: 'line',
      attrs: {},
      children: [
        {
          tag: 'sz',
          attrs: {
            width: 'invalid',
            height: '', // Number('') === 0, not NaN
          },
          children: [],
          text: null,
        },
      ],
      text: null,
    };

    const shape = parseShape(shapeEl);
    expect(shape.type).toBe('line');
    expect(shape.width).toBeUndefined(); // NaN becomes undefined
    expect(shape.height).toBe(0); // empty string parses to 0
  });

  it('handles shape with no drawText (no paragraphs)', () => {
    const shapeEl: GenericElement = {
      tag: 'polygon',
      attrs: {},
      children: [
        {
          tag: 'sz',
          attrs: { width: '1000', height: '2000' },
          children: [],
          text: null,
        },
        // No drawText child
      ],
      text: null,
    };

    const shape = parseShape(shapeEl);
    expect(shape.type).toBe('polygon');
    expect(shape.paragraphs).toEqual([]);
    expect(shape.textContent).toBeUndefined();
  });

  it('handles paragraphs with multiple runs and text content', () => {
    const shapeEl: GenericElement = {
      tag: 'textBox',
      attrs: {},
      children: [
        {
          tag: 'sz',
          attrs: { width: '7200', height: '4800' },
          children: [],
          text: null,
        },
        {
          tag: 'drawText',
          attrs: {},
          children: [
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
                        { tag: 't', attrs: {}, children: [], text: 'Run1 ' },
                      ],
                      text: null,
                    },
                    {
                      tag: 'run',
                      attrs: {},
                      children: [
                        { tag: 't', attrs: {}, children: [], text: 'Run2 ' },
                      ],
                      text: null,
                    },
                    {
                      tag: 'run',
                      attrs: {},
                      children: [
                        { tag: 't', attrs: {}, children: [], text: 'Run3' },
                      ],
                      text: null,
                    },
                  ],
                  text: null,
                },
                {
                  tag: 'p',
                  attrs: {},
                  children: [
                    {
                      tag: 'run',
                      attrs: {},
                      children: [
                        { tag: 't', attrs: {}, children: [], text: 'Line2' },
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

    const shape = parseShape(shapeEl);
    expect(shape.paragraphs).toHaveLength(2);
    expect(shape.textContent).toBe('Run1 Run2 Run3\nLine2');
  });

  it('handles empty paragraphs (no runs)', () => {
    const shapeEl: GenericElement = {
      tag: 'rect',
      attrs: {},
      children: [
        {
          tag: 'drawText',
          attrs: {},
          children: [
            {
              tag: 'subList',
              attrs: {},
              children: [
                {
                  tag: 'p',
                  attrs: {},
                  children: [], // Empty paragraph
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

    const shape = parseShape(shapeEl);
    expect(shape.paragraphs).toHaveLength(1);
    expect(shape.textContent).toBeUndefined(); // Empty content
  });

  it('preserves children GenericElements', () => {
    const shapeEl: GenericElement = {
      tag: 'custom',
      attrs: { id: 'shape1' },
      children: [
        {
          tag: 'sz',
          attrs: { width: '100', height: '200' },
          children: [],
          text: null,
        },
        {
          tag: 'customProp',
          attrs: { value: 'test' },
          children: [],
          text: null,
        },
      ],
      text: null,
    };

    const shape = parseShape(shapeEl);
    expect(shape.children).toHaveLength(2);
    expect(shape.children[0].tag).toBe('sz');
    expect(shape.children[1].tag).toBe('customProp');
  });

  it('handles genericToRaw with text nodes', () => {
    const shapeEl: GenericElement = {
      tag: 'shape',
      attrs: {},
      children: [
        {
          tag: 'drawText',
          attrs: {},
          children: [
            {
              tag: 'subList',
              attrs: {},
              children: [
                {
                  tag: 'p',
                  attrs: { id: 'p1' },
                  children: [
                    {
                      tag: 'run',
                      attrs: { charPrIDRef: '5' },
                      children: [
                        {
                          tag: 't',
                          attrs: {},
                          children: [],
                          text: 'Text with attrs',
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

    const shape = parseShape(shapeEl);
    expect(shape.paragraphs).toHaveLength(1);
    const para = shape.paragraphs[0];
    expect(para.runs).toHaveLength(1);
    expect(para.runs[0].children).toHaveLength(1);
    expect(para.runs[0].children[0]).toEqual({
      type: 'text',
      content: 'Text with attrs',
    });
  });

  it('handles grouped children in genericToRaw', () => {
    const shapeEl: GenericElement = {
      tag: 'complex',
      attrs: {},
      children: [
        {
          tag: 'drawText',
          attrs: {},
          children: [
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
                        { tag: 't', attrs: {}, children: [], text: 'Part1' },
                      ],
                      text: null,
                    },
                    {
                      tag: 'run',
                      attrs: {},
                      children: [
                        { tag: 't', attrs: {}, children: [], text: 'Part2' },
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

    const shape = parseShape(shapeEl);
    expect(shape.paragraphs[0].runs).toHaveLength(2);
    expect(shape.textContent).toBe('Part1Part2');
  });
});
