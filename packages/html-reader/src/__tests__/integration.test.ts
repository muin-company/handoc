import { describe, it, expect } from 'vitest';
import { parseHTML } from '../html-parser';
import { writeHwpx } from '@handoc/hwpx-writer';
import { HanDoc } from '@handoc/hwpx-parser';
import { renderToHtml } from '@handoc/pdf-export';

// Helper function to convert sections to HWPX
function sectionsToHwpx(sections: any) {
  return writeHwpx({
    header: {
      version: '1.5.0.0',
      secCnt: sections.length,
      beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
      refList: {
        fontFaces: [],
        borderFills: [],
        charProperties: [],
        paraProperties: [],
        styles: [],
        others: [],
      },
    },
    sections,
  });
}

describe('HTML → HWPX integration tests', () => {
  it('should convert simple HTML to HWPX and back', async () => {
    const html = '<h1>Hello World</h1><p>This is a test.</p>';
    
    // HTML → document-model
    const sections = parseHTML(html);
    expect(sections).toHaveLength(1);
    expect(sections[0].paragraphs.length).toBeGreaterThan(0);
    
    // document-model → HWPX
    const hwpxBytes = sectionsToHwpx(sections);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
    expect(hwpxBytes.length).toBeGreaterThan(0);
    
    // Verify HWPX can be parsed back
    const doc = await HanDoc.open(hwpxBytes);
    expect(doc.sections.length).toBeGreaterThan(0);
    
    // Extract text to verify content
    const text = doc.extractText();
    expect(text).toContain('Hello World');
    expect(text).toContain('This is a test');
  });

  it('should preserve paragraph structure', async () => {
    const html = `
      <p>First paragraph</p>
      <p>Second paragraph</p>
      <p>Third paragraph</p>
    `;
    
    const sections = parseHTML(html);
    const hwpxBytes = sectionsToHwpx(sections);
    const doc = await HanDoc.open(hwpxBytes);
    
    expect(doc.sections[0].paragraphs.length).toBeGreaterThanOrEqual(3);
    
    const text = doc.extractText();
    expect(text).toContain('First paragraph');
    expect(text).toContain('Second paragraph');
    expect(text).toContain('Third paragraph');
  });

  it('should preserve heading structure', async () => {
    const html = `
      <h1>Main Title</h1>
      <h2>Subtitle</h2>
      <p>Content</p>
    `;
    
    const sections = parseHTML(html);
    const hwpxBytes = sectionsToHwpx(sections);
    const doc = await HanDoc.open(hwpxBytes);
    
    const text = doc.extractText();
    expect(text).toContain('Main Title');
    expect(text).toContain('Subtitle');
    expect(text).toContain('Content');
  });

  it('should preserve formatted text', async () => {
    const html = '<p>Normal <b>bold</b> <i>italic</i> <u>underlined</u> text</p>';
    
    const sections = parseHTML(html);
    const hwpxBytes = sectionsToHwpx(sections);
    const doc = await HanDoc.open(hwpxBytes);
    
    const text = doc.extractText();
    expect(text).toContain('bold');
    expect(text).toContain('italic');
    expect(text).toContain('underlined');
  });

  it('should preserve list structure', async () => {
    const html = `
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </ul>
    `;
    
    const sections = parseHTML(html);
    const hwpxBytes = sectionsToHwpx(sections);
    const doc = await HanDoc.open(hwpxBytes);
    
    const text = doc.extractText();
    expect(text).toContain('Item 1');
    expect(text).toContain('Item 2');
    expect(text).toContain('Item 3');
  });

  it('should handle table structure', async () => {
    const html = `
      <table>
        <tr><td>A1</td><td>B1</td></tr>
        <tr><td>A2</td><td>B2</td></tr>
      </table>
    `;
    
    const sections = parseHTML(html);
    expect(sections[0].paragraphs).toHaveLength(1);
    
    const para = sections[0].paragraphs[0];
    expect(para.runs[0].children[0].type).toBe('table');
    
    const hwpxBytes = sectionsToHwpx(sections);
    const doc = await HanDoc.open(hwpxBytes);
    
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('should handle complex nested HTML', async () => {
    const html = `
      <h1>Document Title</h1>
      <p>Introduction with <b>bold</b> and <i>italic</i> text.</p>
      <ul>
        <li>First item</li>
        <li>Second item</li>
      </ul>
      <h2>Section 2</h2>
      <p>More content here.</p>
      <table>
        <tr><th>Header 1</th><th>Header 2</th></tr>
        <tr><td>Data 1</td><td>Data 2</td></tr>
      </table>
    `;
    
    const sections = parseHTML(html);
    const hwpxBytes = sectionsToHwpx(sections);
    const doc = await HanDoc.open(hwpxBytes);
    
    const text = doc.extractText();
    expect(text).toContain('Document Title');
    expect(text).toContain('Introduction');
    expect(text).toContain('First item');
    expect(text).toContain('Section 2');
    expect(text).toContain('More content');
  });

  it('should round-trip HTML → HWPX → HTML', async () => {
    const originalHtml = `
      <h1>Title</h1>
      <p>This is a paragraph with <b>bold</b> text.</p>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    `;
    
    // HTML → document-model → HWPX
    const sections = parseHTML(originalHtml);
    const hwpxBytes = sectionsToHwpx(sections);
    
    // HWPX → document-model → HTML
    const doc = await HanDoc.open(hwpxBytes);
    const renderedHtml = renderToHtml(doc);
    
    // Verify key content is preserved
    expect(renderedHtml).toContain('Title');
    expect(renderedHtml).toContain('paragraph');
    expect(renderedHtml).toContain('bold');
    expect(renderedHtml).toContain('Item 1');
    expect(renderedHtml).toContain('Item 2');
  });

  it('should handle empty HTML gracefully', async () => {
    const html = '';
    
    const sections = parseHTML(html);
    const hwpxBytes = sectionsToHwpx(sections);
    const doc = await HanDoc.open(hwpxBytes);
    
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('should handle HTML with only whitespace', async () => {
    const html = '   \n   ';
    
    const sections = parseHTML(html);
    const hwpxBytes = sectionsToHwpx(sections);
    const doc = await HanDoc.open(hwpxBytes);
    
    expect(doc.sections.length).toBeGreaterThan(0);
  });
});
