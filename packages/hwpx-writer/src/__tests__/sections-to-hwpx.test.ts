import { describe, it, expect } from 'vitest';
import { sectionsToHwpx } from '../sections-to-hwpx';
import type { Section, Paragraph, Run, RunChild } from '@handoc/document-model';

function makeSimpleParagraph(text: string): Paragraph {
  return {
    id: null,
    paraPrIDRef: 0,
    styleIDRef: 0,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs: [{
      charPrIDRef: 0,
      children: [{ type: 'text', content: text }],
    }],
    lineSegArray: [],
  };
}

describe('sectionsToHwpx', () => {
  it('should produce valid HWPX bytes from a single section', () => {
    const sections: Section[] = [
      { paragraphs: [makeSimpleParagraph('Hello World')] },
    ];
    const result = sectionsToHwpx(sections);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle multiple sections', () => {
    const sections: Section[] = [
      { paragraphs: [makeSimpleParagraph('Section 1')] },
      { paragraphs: [makeSimpleParagraph('Section 2')] },
    ];
    const result = sectionsToHwpx(sections);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle empty paragraphs', () => {
    const sections: Section[] = [
      { paragraphs: [makeSimpleParagraph('')] },
    ];
    const result = sectionsToHwpx(sections);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle section with multiple paragraphs', () => {
    const sections: Section[] = [
      {
        paragraphs: [
          makeSimpleParagraph('Paragraph 1'),
          makeSimpleParagraph('Paragraph 2'),
          makeSimpleParagraph('Paragraph 3'),
        ],
      },
    ];
    const result = sectionsToHwpx(sections);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
