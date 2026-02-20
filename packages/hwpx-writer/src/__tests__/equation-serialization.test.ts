import { describe, it, expect } from 'vitest';
import type { GenericElement } from '@handoc/document-model';
import { serializeEquation } from '../serializers/equation-serializer';

describe('serializeEquation', () => {
  it('serializes a simple equation', () => {
    const equation: GenericElement = {
      tag: 'equation',
      attrs: {
        font: 'HYhwpEQ',
        baseUnit: '1100',
        version: 'Equation Version 60',
      },
      children: [
        {
          tag: 'script',
          attrs: {},
          children: [],
          text: '{"123"} over {123 sqrt {3466}} sum _{34} ^{12}',
        },
        {
          tag: 'sz',
          attrs: { width: '3825', height: '3311' },
          children: [],
          text: null,
        },
      ],
      text: null,
    };

    const xml = serializeEquation(equation, 'hc');
    
    expect(xml).toContain('<hc:equation');
    expect(xml).toContain('font="HYhwpEQ"');
    expect(xml).toContain('baseUnit="1100"');
    expect(xml).toContain('version="Equation Version 60"');
    expect(xml).toContain('<hc:script>');
    // Quotes are XML-escaped
    expect(xml).toContain('{&quot;123&quot;} over {123 sqrt {3466}} sum _{34} ^{12}');
    expect(xml).toContain('</hc:script>');
    expect(xml).toContain('<hc:sz width="3825" height="3311"/>');
    expect(xml).toContain('</hc:equation>');
  });

  it('serializes equation with empty script', () => {
    const equation: GenericElement = {
      tag: 'equation',
      attrs: {},
      children: [
        {
          tag: 'script',
          attrs: {},
          children: [],
          text: '',
        },
      ],
      text: null,
    };

    const xml = serializeEquation(equation, 'hc');
    
    expect(xml).toContain('<hc:equation>');
    expect(xml).toContain('<hc:script/>');
    expect(xml).toContain('</hc:equation>');
  });

  it('handles XML escaping in equation script', () => {
    const equation: GenericElement = {
      tag: 'equation',
      attrs: {},
      children: [
        {
          tag: 'script',
          attrs: {},
          children: [],
          text: 'x < y & z > 0',
        },
      ],
      text: null,
    };

    const xml = serializeEquation(equation, 'hc');
    
    expect(xml).toContain('x &lt; y &amp; z &gt; 0');
    expect(xml).not.toContain('x < y & z > 0');
  });

  it('serializes equation with minimal attributes', () => {
    const equation: GenericElement = {
      tag: 'equation',
      attrs: { font: 'Arial' },
      children: [
        {
          tag: 'script',
          attrs: {},
          children: [],
          text: 'a^2 + b^2 = c^2',
        },
      ],
      text: null,
    };

    const xml = serializeEquation(equation, 'hc');
    
    expect(xml).toContain('<hc:equation font="Arial">');
    expect(xml).toContain('<hc:script>a^2 + b^2 = c^2</hc:script>');
  });

  it('preserves equation size information', () => {
    const equation: GenericElement = {
      tag: 'equation',
      attrs: {},
      children: [
        {
          tag: 'script',
          attrs: {},
          children: [],
          text: 'E = mc^2',
        },
        {
          tag: 'sz',
          attrs: { width: '5000', height: '2000' },
          children: [],
          text: null,
        },
      ],
      text: null,
    };

    const xml = serializeEquation(equation, 'hc');
    
    expect(xml).toContain('<hc:sz width="5000" height="2000"/>');
  });
});
