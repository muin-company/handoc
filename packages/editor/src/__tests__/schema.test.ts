import { describe, it, expect } from 'vitest';
import { hanDocSchema } from '../schema';

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
});
