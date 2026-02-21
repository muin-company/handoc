/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { hanDocSchema } from '../schema';
import { DOMParser, DOMSerializer } from 'prosemirror-model';

describe('hanDocSchema', () => {
  it('should create a schema with expected node types', () => {
    expect(hanDocSchema.nodes.doc).toBeDefined();
    expect(hanDocSchema.nodes.section).toBeDefined();
    expect(hanDocSchema.nodes.paragraph).toBeDefined();
    expect(hanDocSchema.nodes.text).toBeDefined();
    expect(hanDocSchema.nodes.table).toBeDefined();
    expect(hanDocSchema.nodes.table_row).toBeDefined();
    expect(hanDocSchema.nodes.table_cell).toBeDefined();
    expect(hanDocSchema.nodes.image).toBeDefined();
    expect(hanDocSchema.nodes.heading).toBeDefined();
  });

  it('should create a schema with expected mark types', () => {
    expect(hanDocSchema.marks.bold).toBeDefined();
    expect(hanDocSchema.marks.italic).toBeDefined();
    expect(hanDocSchema.marks.underline).toBeDefined();
    expect(hanDocSchema.marks.strikeout).toBeDefined();
    expect(hanDocSchema.marks.textColor).toBeDefined();
    expect(hanDocSchema.marks.fontSize).toBeDefined();
    expect(hanDocSchema.marks.fontFamily).toBeDefined();
  });

  it('should create a valid document', () => {
    const doc = hanDocSchema.nodes.doc.create(null, [
      hanDocSchema.nodes.section.create(null, [
        hanDocSchema.nodes.paragraph.create(null, [
          hanDocSchema.text('Hello, HanDoc!'),
        ]),
      ]),
    ]);

    expect(doc.type.name).toBe('doc');
    expect(doc.content.childCount).toBe(1);
    expect(doc.textContent).toBe('Hello, HanDoc!');
  });

  it('should support bold marks on text', () => {
    const boldMark = hanDocSchema.marks.bold.create();
    const text = hanDocSchema.text('Bold text', [boldMark]);
    expect(text.marks).toHaveLength(1);
    expect(text.marks[0].type.name).toBe('bold');
  });

  describe('Node toDOM/parseDOM', () => {
    const serializer = DOMSerializer.fromSchema(hanDocSchema);
    const parser = DOMParser.fromSchema(hanDocSchema);

    it('should serialize section node to DOM', () => {
      const section = hanDocSchema.nodes.section.create(
        { pageWidth: 800, pageHeight: 1200, landscape: true },
        [hanDocSchema.nodes.paragraph.create()]
      );
      const dom = serializer.serializeNode(section);
      expect(dom.tagName).toBe('SECTION');
    });

    it('should serialize paragraph with align to DOM', () => {
      const para = hanDocSchema.nodes.paragraph.create(
        { align: 'center' },
        [hanDocSchema.text('centered')]
      );
      const dom = serializer.serializeNode(para) as HTMLElement;
      expect(dom.tagName).toBe('P');
      expect(dom.style.textAlign).toBe('center');
    });

    it('should serialize paragraph without align to DOM', () => {
      const para = hanDocSchema.nodes.paragraph.create(null, [
        hanDocSchema.text('normal')
      ]);
      const dom = serializer.serializeNode(para) as HTMLElement;
      expect(dom.tagName).toBe('P');
    });

    it('should serialize heading to DOM', () => {
      for (let level = 1; level <= 6; level++) {
        const heading = hanDocSchema.nodes.heading.create(
          { level },
          [hanDocSchema.text(`Heading ${level}`)]
        );
        const dom = serializer.serializeNode(heading);
        expect(dom.tagName).toBe(`H${level}`);
      }
    });

    it('should serialize image to DOM', () => {
      const image = hanDocSchema.nodes.image.create({
        src: 'data:image/png;base64,abc',
        alt: 'Test',
        width: '100',
        height: '50'
      });
      const dom = serializer.serializeNode(image) as HTMLImageElement;
      expect(dom.tagName).toBe('IMG');
      expect(dom.src).toContain('data:image/png');
      expect(dom.alt).toBe('Test');
      expect(dom.width).toBe(100);
      expect(dom.height).toBe(50);
    });

    it('should serialize table to DOM', () => {
      const table = hanDocSchema.nodes.table.create(null, [
        hanDocSchema.nodes.table_row.create(null, [
          hanDocSchema.nodes.table_cell.create(null, [
            hanDocSchema.nodes.paragraph.create()
          ])
        ])
      ]);
      const dom = serializer.serializeNode(table);
      expect(dom.tagName).toBe('TABLE');
      expect(dom.querySelector('tbody')).toBeTruthy();
    });

    it('should serialize table_row to DOM', () => {
      const row = hanDocSchema.nodes.table_row.create(null, [
        hanDocSchema.nodes.table_cell.create(null, [
          hanDocSchema.nodes.paragraph.create()
        ])
      ]);
      const dom = serializer.serializeNode(row);
      expect(dom.tagName).toBe('TR');
    });

    it('should serialize table_cell with colspan/rowspan to DOM', () => {
      const cell = hanDocSchema.nodes.table_cell.create(
        { colspan: 2, rowspan: 3, colwidth: [100, 200] },
        [hanDocSchema.nodes.paragraph.create()]
      );
      const dom = serializer.serializeNode(cell) as HTMLTableCellElement;
      expect(dom.tagName).toBe('TD');
      expect(dom.colSpan).toBe(2);
      expect(dom.rowSpan).toBe(3);
      expect(dom.getAttribute('colwidth')).toBe('100,200');
    });

    it('should serialize table_cell without colspan/rowspan to DOM', () => {
      const cell = hanDocSchema.nodes.table_cell.create(null, [
        hanDocSchema.nodes.paragraph.create()
      ]);
      const dom = serializer.serializeNode(cell) as HTMLTableCellElement;
      expect(dom.tagName).toBe('TD');
      expect(dom.colSpan).toBe(1);
      expect(dom.rowSpan).toBe(1);
    });

    it('should serialize table_header with colspan/rowspan to DOM', () => {
      const header = hanDocSchema.nodes.table_header.create(
        { colspan: 2, rowspan: 1, colwidth: [150] },
        [hanDocSchema.nodes.paragraph.create()]
      );
      const dom = serializer.serializeNode(header) as HTMLTableCellElement;
      expect(dom.tagName).toBe('TH');
      expect(dom.colSpan).toBe(2);
      expect(dom.getAttribute('colwidth')).toBe('150');
    });

    it('should parse paragraph with alignment from DOM', () => {
      const html = '<section><p style="text-align: right">Right aligned</p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      expect(para?.type.name).toBe('paragraph');
      expect(para?.attrs.align).toBe('right');
    });

    it('should parse heading from DOM', () => {
      const html = '<section><h2>Level 2</h2></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const heading = doc.firstChild?.firstChild;
      expect(heading?.type.name).toBe('heading');
      expect(heading?.attrs.level).toBe(2);
    });

    it('should parse image from DOM', () => {
      const html = '<section><img src="test.png" alt="Alt text" width="200" height="100" /></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const img = doc.firstChild?.firstChild;
      expect(img?.type.name).toBe('image');
      expect(img?.attrs.src).toBe('test.png');
      expect(img?.attrs.alt).toBe('Alt text');
      expect(img?.attrs.width).toBe('200');
      expect(img?.attrs.height).toBe('100');
    });

    it('should parse table_cell with colspan/rowspan from DOM', () => {
      const html = '<section><table><tbody><tr><td colspan="2" rowspan="3" colwidth="100,200">Cell</td></tr></tbody></table></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const table = doc.firstChild?.firstChild;
      const row = table?.firstChild;
      const cell = row?.firstChild;
      
      expect(cell?.type.name).toBe('table_cell');
      expect(cell?.attrs.colspan).toBe(2);
      expect(cell?.attrs.rowspan).toBe(3);
      expect(cell?.attrs.colwidth).toEqual([100, 200]);
    });

    it('should parse table_header with colspan/rowspan from DOM', () => {
      const html = '<section><table><tbody><tr><th colspan="2" colwidth="150,150">Header</th></tr></tbody></table></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const table = doc.firstChild?.firstChild;
      const row = table?.firstChild;
      const header = row?.firstChild;
      
      expect(header?.type.name).toBe('table_header');
      expect(header?.attrs.colspan).toBe(2);
      expect(header?.attrs.colwidth).toEqual([150, 150]);
    });
  });

  describe('Mark toDOM/parseDOM', () => {
    const serializer = DOMSerializer.fromSchema(hanDocSchema);
    const parser = DOMParser.fromSchema(hanDocSchema);

    it('should serialize bold mark to DOM', () => {
      const text = hanDocSchema.text('Bold', [hanDocSchema.marks.bold.create()]);
      const para = hanDocSchema.nodes.paragraph.create(null, [text]);
      const dom = serializer.serializeNode(para) as HTMLElement;
      expect(dom.querySelector('strong')).toBeTruthy();
    });

    it('should serialize italic mark to DOM', () => {
      const text = hanDocSchema.text('Italic', [hanDocSchema.marks.italic.create()]);
      const para = hanDocSchema.nodes.paragraph.create(null, [text]);
      const dom = serializer.serializeNode(para) as HTMLElement;
      expect(dom.querySelector('em')).toBeTruthy();
    });

    it('should serialize underline mark to DOM', () => {
      const text = hanDocSchema.text('Underline', [hanDocSchema.marks.underline.create()]);
      const para = hanDocSchema.nodes.paragraph.create(null, [text]);
      const dom = serializer.serializeNode(para) as HTMLElement;
      expect(dom.querySelector('u')).toBeTruthy();
    });

    it('should serialize strikeout mark to DOM', () => {
      const text = hanDocSchema.text('Strike', [hanDocSchema.marks.strikeout.create()]);
      const para = hanDocSchema.nodes.paragraph.create(null, [text]);
      const dom = serializer.serializeNode(para) as HTMLElement;
      expect(dom.querySelector('s')).toBeTruthy();
    });

    it('should serialize textColor mark to DOM', () => {
      const mark = hanDocSchema.marks.textColor.create({ color: '#ff0000' });
      const text = hanDocSchema.text('Red', [mark]);
      const para = hanDocSchema.nodes.paragraph.create(null, [text]);
      const dom = serializer.serializeNode(para) as HTMLElement;
      const span = dom.querySelector('span');
      expect(span?.style.color).toBe('rgb(255, 0, 0)');
    });

    it('should serialize fontSize mark to DOM', () => {
      const mark = hanDocSchema.marks.fontSize.create({ size: '18px' });
      const text = hanDocSchema.text('Large', [mark]);
      const para = hanDocSchema.nodes.paragraph.create(null, [text]);
      const dom = serializer.serializeNode(para) as HTMLElement;
      const span = dom.querySelector('span');
      expect(span?.style.fontSize).toBe('18px');
    });

    it('should serialize fontFamily mark to DOM', () => {
      const mark = hanDocSchema.marks.fontFamily.create({ family: 'Arial' });
      const text = hanDocSchema.text('Arial text', [mark]);
      const para = hanDocSchema.nodes.paragraph.create(null, [text]);
      const dom = serializer.serializeNode(para) as HTMLElement;
      const span = dom.querySelector('span');
      expect(span?.style.fontFamily).toBe('Arial');
    });

    it('should parse bold mark from DOM', () => {
      const html = '<section><p><strong>Bold</strong></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some(m => m.type.name === 'bold')).toBe(true);
    });

    it('should parse bold mark from <b> tag', () => {
      const html = '<section><p><b>Bold</b></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some(m => m.type.name === 'bold')).toBe(true);
    });

    it('should parse italic mark from <em> tag', () => {
      const html = '<section><p><em>Italic</em></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some(m => m.type.name === 'italic')).toBe(true);
    });

    it('should parse italic mark from <i> tag', () => {
      const html = '<section><p><i>Italic</i></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some(m => m.type.name === 'italic')).toBe(true);
    });

    it('should parse underline mark from DOM', () => {
      const html = '<section><p><u>Underline</u></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some(m => m.type.name === 'underline')).toBe(true);
    });

    it('should parse strikeout mark from <s> tag', () => {
      const html = '<section><p><s>Strike</s></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some(m => m.type.name === 'strikeout')).toBe(true);
    });

    it('should parse strikeout mark from <del> tag', () => {
      const html = '<section><p><del>Strike</del></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some(m => m.type.name === 'strikeout')).toBe(true);
    });

    it('should parse textColor mark from DOM', () => {
      const html = '<section><p><span style="color: blue">Blue</span></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      const colorMark = textNode?.marks.find(m => m.type.name === 'textColor');
      expect(colorMark).toBeTruthy();
      expect(colorMark?.attrs.color).toBeTruthy();
    });

    it('should parse fontSize mark from DOM', () => {
      const html = '<section><p><span style="font-size: 20px">Large</span></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      const sizeMark = textNode?.marks.find(m => m.type.name === 'fontSize');
      expect(sizeMark).toBeTruthy();
      expect(sizeMark?.attrs.size).toBeTruthy();
    });

    it('should parse fontFamily mark from DOM', () => {
      const html = '<section><p><span style="font-family: Courier">Courier</span></p></section>';
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = parser.parse(div);
      
      const para = doc.firstChild?.firstChild;
      const textNode = para?.firstChild;
      const familyMark = textNode?.marks.find(m => m.type.name === 'fontFamily');
      expect(familyMark).toBeTruthy();
      expect(familyMark?.attrs.family).toBeTruthy();
    });
  });
});
