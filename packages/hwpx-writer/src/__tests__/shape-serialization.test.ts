import { describe, it, expect } from 'vitest';
import type { GenericElement } from '@handoc/document-model';
import { serializeShape } from '../serializers/shape-serializer';

describe('serializeShape', () => {
  it('serializes a simple rect shape', () => {
    const rectElement: GenericElement = {
      tag: 'rect',
      attrs: {},
      children: [
        {
          tag: 'sz',
          attrs: { width: '10775', height: '5950' },
          children: [],
          text: null,
        },
      ],
      text: null,
    };

    const xml = serializeShape(rectElement, 'hp');
    
    expect(xml).toContain('<hp:rect>');
    expect(xml).toContain('<hp:sz width="10775" height="5950"/>');
    expect(xml).toContain('</hp:rect>');
  });

  it('serializes a shape with drawText', () => {
    const rectWithText: GenericElement = {
      tag: 'rect',
      attrs: {},
      children: [
        {
          tag: 'sz',
          attrs: { width: '100', height: '200' },
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
                  attrs: { paraPrIDRef: '0', styleIDRef: '0', pageBreak: '0', columnBreak: '0', merged: '0' },
                  children: [
                    {
                      tag: 'run',
                      attrs: { charPrIDRef: '0' },
                      children: [
                        {
                          tag: 't',
                          attrs: {},
                          children: [],
                          text: 'Hello World',
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

    const xml = serializeShape(rectWithText, 'hp');
    
    expect(xml).toContain('<hp:rect>');
    expect(xml).toContain('<hp:drawText>');
    expect(xml).toContain('<hp:subList>');
    expect(xml).toContain('<hp:p');
    expect(xml).toContain('<hp:run');
    expect(xml).toContain('<hp:t>Hello World</hp:t>');
    expect(xml).toContain('</hp:drawText>');
    expect(xml).toContain('</hp:rect>');
  });

  it('serializes ellipse shape', () => {
    const ellipse: GenericElement = {
      tag: 'ellipse',
      attrs: {},
      children: [
        {
          tag: 'sz',
          attrs: { width: '5000', height: '3000' },
          children: [],
          text: null,
        },
      ],
      text: null,
    };

    const xml = serializeShape(ellipse, 'hp');
    
    expect(xml).toContain('<hp:ellipse>');
    expect(xml).toContain('<hp:sz width="5000" height="3000"/>');
    expect(xml).toContain('</hp:ellipse>');
  });

  it('handles XML escaping in text content', () => {
    const shapeWithSpecialChars: GenericElement = {
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
                  children: [
                    {
                      tag: 'run',
                      attrs: {},
                      children: [
                        {
                          tag: 't',
                          attrs: {},
                          children: [],
                          text: '<test> & "quotes"',
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

    const xml = serializeShape(shapeWithSpecialChars, 'hp');
    
    expect(xml).toContain('&lt;test&gt; &amp; &quot;quotes&quot;');
    expect(xml).not.toContain('<test>');
  });

  it('serializes line shape', () => {
    const line: GenericElement = {
      tag: 'line',
      attrs: {},
      children: [
        {
          tag: 'sz',
          attrs: { width: '10000', height: '1' },
          children: [],
          text: null,
        },
      ],
      text: null,
    };

    const xml = serializeShape(line, 'hp');
    
    expect(xml).toContain('<hp:line>');
    expect(xml).toContain('</hp:line>');
  });
});
