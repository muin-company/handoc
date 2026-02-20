import { describe, it, expect } from 'vitest';
import { parseHTML } from '../html-parser';

describe('parseHTML', () => {
  describe('basic paragraphs', () => {
    it('should parse simple paragraph', () => {
      const html = '<p>Hello world</p>';
      const sections = parseHTML(html);

      expect(sections).toHaveLength(1);
      expect(sections[0].paragraphs).toHaveLength(1);
      expect(sections[0].paragraphs[0].runs).toHaveLength(1);
      expect(sections[0].paragraphs[0].runs[0].children[0]).toEqual({
        type: 'text',
        content: 'Hello world',
      });
    });

    it('should parse multiple paragraphs', () => {
      const html = '<p>First paragraph</p><p>Second paragraph</p>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(2);
      expect(sections[0].paragraphs[0].runs[0].children[0]).toEqual({
        type: 'text',
        content: 'First paragraph',
      });
      expect(sections[0].paragraphs[1].runs[0].children[0]).toEqual({
        type: 'text',
        content: 'Second paragraph',
      });
    });

    it('should handle empty HTML', () => {
      const html = '';
      const sections = parseHTML(html);

      expect(sections).toHaveLength(1);
      expect(sections[0].paragraphs).toHaveLength(1);
      expect(sections[0].paragraphs[0].runs[0].children[0]).toEqual({
        type: 'text',
        content: '',
      });
    });

    it('should handle whitespace-only HTML', () => {
      const html = '   \n   ';
      const sections = parseHTML(html);

      expect(sections).toHaveLength(1);
      expect(sections[0].paragraphs).toHaveLength(1);
    });
  });

  describe('headings', () => {
    it('should parse h1 heading', () => {
      const html = '<h1>Main Title</h1>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(1);
      expect(sections[0].paragraphs[0].styleIDRef).toBe(1);
      expect(sections[0].paragraphs[0].runs[0].children[0]).toEqual({
        type: 'text',
        content: 'Main Title',
      });
    });

    it('should parse h2 heading', () => {
      const html = '<h2>Subtitle</h2>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs[0].styleIDRef).toBe(2);
    });

    it('should parse h3-h6 headings', () => {
      const html = '<h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(4);
      expect(sections[0].paragraphs[0].styleIDRef).toBe(3);
      expect(sections[0].paragraphs[1].styleIDRef).toBe(4);
      expect(sections[0].paragraphs[2].styleIDRef).toBe(5);
      expect(sections[0].paragraphs[3].styleIDRef).toBe(6);
    });
  });

  describe('text formatting', () => {
    it('should parse bold text', () => {
      const html = '<p>Normal <b>bold</b> text</p>';
      const sections = parseHTML(html);

      const runs = sections[0].paragraphs[0].runs;
      expect(runs.length).toBeGreaterThanOrEqual(2);
      expect(runs.some(r => r.children.some(c => c.type === 'text' && c.content.includes('bold')))).toBe(true);
    });

    it('should parse italic text', () => {
      const html = '<p>Normal <i>italic</i> text</p>';
      const sections = parseHTML(html);

      const runs = sections[0].paragraphs[0].runs;
      expect(runs.length).toBeGreaterThanOrEqual(2);
      expect(runs.some(r => r.children.some(c => c.type === 'text' && c.content.includes('italic')))).toBe(true);
    });

    it('should parse underlined text', () => {
      const html = '<p>Normal <u>underlined</u> text</p>';
      const sections = parseHTML(html);

      const runs = sections[0].paragraphs[0].runs;
      expect(runs.length).toBeGreaterThanOrEqual(2);
      expect(runs.some(r => r.children.some(c => c.type === 'text' && c.content.includes('underlined')))).toBe(true);
    });

    it('should parse strikethrough text', () => {
      const html = '<p>Normal <s>strikethrough</s> text</p>';
      const sections = parseHTML(html);

      const runs = sections[0].paragraphs[0].runs;
      expect(runs.length).toBeGreaterThanOrEqual(2);
      expect(runs.some(r => r.children.some(c => c.type === 'text' && c.content.includes('strikethrough')))).toBe(true);
    });

    it('should parse nested formatting', () => {
      const html = '<p><b>Bold <i>and italic</i></b></p>';
      const sections = parseHTML(html);

      const runs = sections[0].paragraphs[0].runs;
      expect(runs.length).toBeGreaterThanOrEqual(2);
    });

    it('should parse styled span', () => {
      const html = '<p><span style="font-weight:bold">Bold via style</span></p>';
      const sections = parseHTML(html);

      const runs = sections[0].paragraphs[0].runs;
      expect(runs.some(r => r.children.some(c => c.type === 'text' && c.content.includes('Bold')))).toBe(true);
    });
  });

  describe('lists', () => {
    it('should parse unordered list', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(3);
      sections[0].paragraphs.forEach(p => {
        const firstRun = p.runs[0];
        const firstChild = firstRun.children[0];
        expect(firstChild.type).toBe('text');
        if (firstChild.type === 'text') {
          expect(firstChild.content).toContain('•');
        }
      });
    });

    it('should parse ordered list', () => {
      const html = '<ol><li>First</li><li>Second</li><li>Third</li></ol>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(3);
      
      const firstPara = sections[0].paragraphs[0];
      const firstChild = firstPara.runs[0].children[0];
      expect(firstChild.type).toBe('text');
      if (firstChild.type === 'text') {
        expect(firstChild.content).toContain('1.');
      }

      const secondPara = sections[0].paragraphs[1];
      const secondChild = secondPara.runs[0].children[0];
      expect(secondChild.type).toBe('text');
      if (secondChild.type === 'text') {
        expect(secondChild.content).toContain('2.');
      }
    });

    it('should handle empty list items', () => {
      const html = '<ul><li></li><li>Content</li></ul>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(2);
    });
  });

  describe('tables', () => {
    it('should parse simple table', () => {
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
      
      if (para.runs[0].children[0].type === 'table') {
        const table = para.runs[0].children[0].element;
        expect(table.tag).toBe('table');
        expect(table.children).toHaveLength(2); // 2 rows
      }
    });

    it('should parse table with headers', () => {
      const html = `
        <table>
          <tr><th>Header 1</th><th>Header 2</th></tr>
          <tr><td>Data 1</td><td>Data 2</td></tr>
        </table>
      `;
      const sections = parseHTML(html);

      const para = sections[0].paragraphs[0];
      if (para.runs[0].children[0].type === 'table') {
        const table = para.runs[0].children[0].element;
        expect(table.children).toHaveLength(2);
      }
    });

    it('should handle colspan and rowspan', () => {
      const html = `
        <table>
          <tr><td colspan="2">Wide cell</td></tr>
          <tr><td>A</td><td>B</td></tr>
        </table>
      `;
      const sections = parseHTML(html);

      const para = sections[0].paragraphs[0];
      if (para.runs[0].children[0].type === 'table') {
        const table = para.runs[0].children[0].element;
        const firstRow = table.children[0];
        const firstCell = firstRow.children[0];
        expect(firstCell.attrs['colspan']).toBe('2');
      }
    });
  });

  describe('images', () => {
    it('should parse image element', () => {
      const html = '<p><img src="test.png" alt="Test image"/></p>';
      const sections = parseHTML(html);

      const para = sections[0].paragraphs[0];
      const imgRun = para.runs.find(r => 
        r.children.some(c => c.type === 'inlineObject')
      );
      
      expect(imgRun).toBeDefined();
      if (imgRun) {
        const imgChild = imgRun.children.find(c => c.type === 'inlineObject');
        expect(imgChild?.type).toBe('inlineObject');
        if (imgChild?.type === 'inlineObject') {
          expect(imgChild.name).toBe('picture');
          expect(imgChild.element.attrs['src']).toBe('test.png');
          expect(imgChild.element.attrs['alt']).toBe('Test image');
        }
      }
    });

    it('should parse image with dimensions', () => {
      const html = '<img src="pic.jpg" width="200" height="100"/>';
      const sections = parseHTML(html);

      const para = sections[0].paragraphs[0];
      const imgChild = para.runs[0].children[0];
      
      if (imgChild.type === 'inlineObject') {
        expect(imgChild.element.attrs['width']).toBe('200');
        expect(imgChild.element.attrs['height']).toBe('100');
      }
    });
  });

  describe('div elements', () => {
    it('should process div children', () => {
      const html = '<div><p>Para 1</p><p>Para 2</p></div>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(2);
    });

    it('should treat text-only div as paragraph', () => {
      const html = '<div>Simple text in div</div>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(1);
      expect(sections[0].paragraphs[0].runs[0].children[0]).toEqual({
        type: 'text',
        content: 'Simple text in div',
      });
    });
  });

  describe('special elements', () => {
    it('should handle br tags', () => {
      const html = '<p>Line 1<br/>Line 2</p>';
      const sections = parseHTML(html);

      const runs = sections[0].paragraphs[0].runs;
      expect(runs.some(r => r.children.some(c => c.type === 'text' && c.content === '\n'))).toBe(true);
    });

    it('should handle hr tags', () => {
      const html = '<p>Before</p><hr/><p>After</p>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(3);
      const hrPara = sections[0].paragraphs[1];
      expect(hrPara.runs[0].children[0].type).toBe('ctrl');
      if (hrPara.runs[0].children[0].type === 'ctrl') {
        expect(hrPara.runs[0].children[0].element.tag).toBe('hr');
      }
    });
  });

  describe('complex documents', () => {
    it('should parse mixed content', () => {
      const html = `
        <h1>Document Title</h1>
        <p>Introduction with <b>bold</b> and <i>italic</i> text.</p>
        <ul>
          <li>First item</li>
          <li>Second item</li>
        </ul>
        <p>Conclusion</p>
      `;
      const sections = parseHTML(html);

      expect(sections[0].paragraphs.length).toBeGreaterThan(3);
    });

    it('should handle nested structures', () => {
      const html = `
        <div>
          <h2>Section</h2>
          <div>
            <p>Nested paragraph</p>
            <table>
              <tr><td>Cell</td></tr>
            </table>
          </div>
        </div>
      `;
      const sections = parseHTML(html);

      expect(sections[0].paragraphs.length).toBeGreaterThan(1);
    });
  });

  describe('edge cases', () => {
    it('should handle HTML entities', () => {
      const html = '<p>&lt;div&gt; &amp; &quot;quotes&quot;</p>';
      const sections = parseHTML(html);

      const text = sections[0].paragraphs[0].runs[0].children[0];
      if (text.type === 'text') {
        expect(text.content).toContain('<div>');
        expect(text.content).toContain('&');
        expect(text.content).toContain('"quotes"');
      }
    });

    it('should skip unknown tags gracefully', () => {
      const html = '<p>Before <custom>unknown</custom> after</p>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(1);
      const runs = sections[0].paragraphs[0].runs;
      expect(runs.some(r => r.children.some(c => c.type === 'text' && c.content.includes('unknown')))).toBe(true);
    });

    it('should handle deeply nested formatting', () => {
      const html = '<p><b><i><u>Triple formatted</u></i></b></p>';
      const sections = parseHTML(html);

      expect(sections[0].paragraphs).toHaveLength(1);
      const runs = sections[0].paragraphs[0].runs;
      expect(runs.some(r => r.children.some(c => c.type === 'text' && c.content.includes('Triple')))).toBe(true);
    });
  });
});
