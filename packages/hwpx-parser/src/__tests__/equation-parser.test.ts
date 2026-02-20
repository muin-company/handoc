import { describe, it, expect } from 'vitest';
import { parseEquation } from '../equation-parser';
import { HanDoc } from '../handoc';
import * as path from 'path';
import * as fs from 'fs';

const FIXTURES_DIR = '/Users/mj/handoc-fixtures/real-world/opensource';

describe('parseEquation', () => {
  it('parses equation with script', () => {
    const eq = parseEquation({
      tag: 'equation',
      attrs: { font: 'HYhwpEQ', baseUnit: '1100', version: 'Equation Version 60' },
      children: [
        { tag: 'script', attrs: {}, children: [], text: '{"123"} over {123 sqrt {3466}} sum _{34} ^{12}' },
        { tag: 'sz', attrs: { width: '3825', height: '3311' }, children: [], text: null },
      ],
      text: null,
    });

    expect(eq.script).toBe('{"123"} over {123 sqrt {3466}} sum _{34} ^{12}');
    expect(eq.font).toBe('HYhwpEQ');
    expect(eq.baseUnit).toBe(1100);
    expect(eq.version).toBe('Equation Version 60');
  });

  it('returns empty script for element without script child', () => {
    const eq = parseEquation({ tag: 'equation', attrs: {}, children: [], text: null });
    expect(eq.script).toBe('');
  });

  it('parses equation from SimpleEquation.hwpx', async () => {
    const filePath = path.join(FIXTURES_DIR, 'SimpleEquation.hwpx');
    if (!fs.existsSync(filePath)) return;

    const doc = await HanDoc.open(fs.readFileSync(filePath));
    const sections = doc.sections;

    const equations: ReturnType<typeof parseEquation>[] = [];
    for (const section of sections) {
      for (const para of section.paragraphs) {
        for (const run of para.runs) {
          for (const child of run.children) {
            if (child.type === 'inlineObject' && child.name === 'equation') {
              equations.push(parseEquation(child.element));
            }
          }
        }
      }
    }

    expect(equations.length).toBeGreaterThanOrEqual(1);
    expect(equations[0].script).toContain('over');
    expect(equations[0].font).toBe('HYhwpEQ');
  });
});
