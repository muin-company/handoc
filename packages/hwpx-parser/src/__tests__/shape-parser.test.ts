import { describe, it, expect } from 'vitest';
import { parseShape } from '../shape-parser';
import { HanDoc } from '../handoc';
import * as path from 'path';
import * as fs from 'fs';

const FIXTURES_DIR = '/Users/mj/handoc-fixtures/real-world/opensource';

describe('parseShape', () => {
  it('parses a minimal shape element', () => {
    const shape = parseShape({
      tag: 'rect',
      attrs: {},
      children: [
        { tag: 'sz', attrs: { width: '10775', height: '5950' }, children: [], text: null },
      ],
      text: null,
    });

    expect(shape.type).toBe('rect');
    expect(shape.width).toBe(10775);
    expect(shape.height).toBe(5950);
    expect(shape.textContent).toBeUndefined();
    expect(shape.paragraphs).toHaveLength(0);
  });

  it('parses a shape with drawText containing paragraphs', () => {
    const shape = parseShape({
      tag: 'rect',
      attrs: {},
      children: [
        { tag: 'sz', attrs: { width: '100', height: '200' }, children: [], text: null },
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
                  attrs: { id: '0', paraPrIDRef: '0', styleIDRef: '0', pageBreak: '0', columnBreak: '0', merged: '0' },
                  children: [
                    {
                      tag: 'run',
                      attrs: { charPrIDRef: '0' },
                      children: [
                        { tag: 't', attrs: {}, children: [], text: 'Hello World' },
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
    });

    expect(shape.type).toBe('rect');
    expect(shape.textContent).toBe('Hello World');
    expect(shape.paragraphs).toHaveLength(1);
  });

  it('returns graceful result for empty element', () => {
    const shape = parseShape({ tag: 'unknown', attrs: {}, children: [], text: null });
    expect(shape.type).toBe('unknown');
    expect(shape.width).toBeUndefined();
    expect(shape.textContent).toBeUndefined();
    expect(shape.paragraphs).toHaveLength(0);
  });

  it('parses shapes from RectInPara.hwpx', async () => {
    const filePath = path.join(FIXTURES_DIR, 'RectInPara.hwpx');
    if (!fs.existsSync(filePath)) return;

    const doc = await HanDoc.open(fs.readFileSync(filePath));
    const sections = doc.sections;
    expect(sections.length).toBeGreaterThan(0);

    // Find rect inlineObjects
    const rects: ReturnType<typeof parseShape>[] = [];
    for (const section of sections) {
      for (const para of section.paragraphs) {
        for (const run of para.runs) {
          for (const child of run.children) {
            if (child.type === 'inlineObject' && child.name === 'rect') {
              rects.push(parseShape(child.element));
            }
          }
        }
      }
    }

    expect(rects.length).toBeGreaterThanOrEqual(2);
    expect(rects[0].type).toBe('rect');
    expect(rects[0].width).toBe(10775);
    expect(rects[0].height).toBe(5950);
    expect(rects[0].textContent).toContain('사각');
    expect(rects[0].paragraphs.length).toBeGreaterThan(0);
  });
});
