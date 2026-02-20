import { describe, it, expect } from 'vitest';
import { hwpxToEditorState, editorStateToHwpx } from '../converter';
import { HwpxBuilder } from '@handoc/hwpx-writer';
import { hanDocSchema } from '../schema';

describe('converter', () => {
  it('should convert HWPX buffer to EditorState with text', async () => {
    const hwpxBytes = HwpxBuilder.create()
      .addParagraph('테스트 문서입니다')
      .addParagraph('두 번째 문단')
      .build();

    const state = await hwpxToEditorState(hwpxBytes);
    const text = state.doc.textContent;

    expect(text).toContain('테스트 문서입니다');
    expect(text).toContain('두 번째 문단');
  });

  it('should roundtrip EditorState → HWPX → EditorState', async () => {
    // Create initial HWPX
    const original = HwpxBuilder.create()
      .addParagraph('라운드트립 테스트')
      .build();

    // HWPX → EditorState
    const state = await hwpxToEditorState(original);
    expect(state.doc.textContent).toContain('라운드트립 테스트');

    // EditorState → HWPX
    const rewritten = await editorStateToHwpx(state);
    expect(rewritten).toBeInstanceOf(Uint8Array);
    expect(rewritten.length).toBeGreaterThan(0);

    // HWPX → EditorState again
    const state2 = await hwpxToEditorState(rewritten);
    expect(state2.doc.textContent).toContain('라운드트립 테스트');
  });

  it('should roundtrip with bold formatting', async () => {
    const original = HwpxBuilder.create()
      .addParagraph('Bold text', { bold: true })
      .build();

    const state = await hwpxToEditorState(original);
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    expect(state2.doc.textContent).toContain('Bold text');
    // Check that bold mark is present in the document
    let hasBold = false;
    state2.doc.descendants(node => {
      if (node.isText) {
        node.marks.forEach(mark => {
          if (mark.type.name === 'bold') hasBold = true;
        });
      }
    });
    expect(hasBold).toBe(true);
  });

  it('should roundtrip with italic formatting', async () => {
    const original = HwpxBuilder.create()
      .addParagraph('Italic text', { italic: true })
      .build();

    const state = await hwpxToEditorState(original);
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    expect(state2.doc.textContent).toContain('Italic text');
    let hasItalic = false;
    state2.doc.descendants(node => {
      if (node.isText) {
        node.marks.forEach(mark => {
          if (mark.type.name === 'italic') hasItalic = true;
        });
      }
    });
    expect(hasItalic).toBe(true);
  });

  it('should roundtrip with font size', async () => {
    const original = HwpxBuilder.create()
      .addParagraph('Large text', { fontSize: 20 })
      .build();

    const state = await hwpxToEditorState(original);
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    expect(state2.doc.textContent).toContain('Large text');
    let hasFontSize = false;
    state2.doc.descendants(node => {
      if (node.isText) {
        node.marks.forEach(mark => {
          if (mark.type.name === 'fontSize') hasFontSize = true;
        });
      }
    });
    expect(hasFontSize).toBe(true);
  });

  it('should roundtrip with text alignment', async () => {
    const original = HwpxBuilder.create()
      .addParagraph('Centered text', { align: 'center' })
      .build();

    const state = await hwpxToEditorState(original);
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    expect(state2.doc.textContent).toContain('Centered text');
    // Check paragraph alignment
    let hasCenter = false;
    state2.doc.descendants(node => {
      if (node.type.name === 'paragraph' && node.attrs.align === 'center') {
        hasCenter = true;
      }
    });
    expect(hasCenter).toBe(true);
  });

  it('should roundtrip with table', async () => {
    const original = HwpxBuilder.create()
      .addTable([
        ['A', 'B'],
        ['C', 'D'],
      ])
      .build();

    const state = await hwpxToEditorState(original);
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    // Check that table structure is preserved
    let hasTable = false;
    let cellCount = 0;
    state2.doc.descendants(node => {
      if (node.type.name === 'table') hasTable = true;
      if (node.type.name === 'table_cell') cellCount++;
    });
    expect(hasTable).toBe(true);
    expect(cellCount).toBeGreaterThan(0);
  });

  it('should roundtrip with heading', async () => {
    const original = HwpxBuilder.create()
      .addHeading(1, 'Main Title')
      .addParagraph('Content')
      .build();

    const state = await hwpxToEditorState(original);
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    expect(state2.doc.textContent).toContain('Main Title');
    expect(state2.doc.textContent).toContain('Content');
  });

  it('should roundtrip with multiple sections', async () => {
    const original = HwpxBuilder.create()
      .addParagraph('Section 1')
      .addSectionBreak()
      .addParagraph('Section 2')
      .build();

    const state = await hwpxToEditorState(original);
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    expect(state2.doc.textContent).toContain('Section 1');
    expect(state2.doc.textContent).toContain('Section 2');
    
    // Check that we have multiple sections
    let sectionCount = 0;
    state2.doc.forEach(node => {
      if (node.type.name === 'section') sectionCount++;
    });
    expect(sectionCount).toBeGreaterThanOrEqual(2);
  });

  it('should roundtrip complex document with mixed formatting', async () => {
    const original = HwpxBuilder.create()
      .addParagraph('Normal text')
      .addParagraph('Bold text', { bold: true })
      .addParagraph('Italic text', { italic: true })
      .addParagraph('Centered', { align: 'center' })
      .addTable([['Header 1', 'Header 2'], ['Data 1', 'Data 2']])
      .addHeading(2, 'Subheading')
      .addParagraph('More content')
      .build();

    const state = await hwpxToEditorState(original);
    expect(state.doc.textContent).toContain('Normal text');
    expect(state.doc.textContent).toContain('Bold text');

    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    expect(state2.doc.textContent).toContain('Normal text');
    expect(state2.doc.textContent).toContain('Bold text');
    expect(state2.doc.textContent).toContain('Italic text');
    expect(state2.doc.textContent).toContain('Centered');
    expect(state2.doc.textContent).toContain('Subheading');
  });

  it('should preserve table with cell text content', async () => {
    const original = HwpxBuilder.create()
      .addTable([
        ['Name', 'Age', 'City'],
        ['Alice', '25', 'Seoul'],
        ['Bob', '30', 'Busan'],
      ])
      .build();

    const state = await hwpxToEditorState(original);
    
    // Check all cell contents are present
    expect(state.doc.textContent).toContain('Name');
    expect(state.doc.textContent).toContain('Age');
    expect(state.doc.textContent).toContain('City');
    expect(state.doc.textContent).toContain('Alice');
    expect(state.doc.textContent).toContain('25');
    expect(state.doc.textContent).toContain('Seoul');

    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    // Verify all content preserved after roundtrip
    expect(state2.doc.textContent).toContain('Name');
    expect(state2.doc.textContent).toContain('Alice');
    expect(state2.doc.textContent).toContain('Busan');
  });

  it('should handle empty table cells', async () => {
    const original = HwpxBuilder.create()
      .addTable([
        ['A', ''],
        ['', 'D'],
      ])
      .build();

    const state = await hwpxToEditorState(original);
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    let cellCount = 0;
    state2.doc.descendants(node => {
      if (node.type.name === 'table_cell') cellCount++;
    });

    expect(cellCount).toBe(4); // All 4 cells should be preserved
  });

  it('should handle table followed by paragraph', async () => {
    const original = HwpxBuilder.create()
      .addTable([['A', 'B']])
      .addParagraph('After table')
      .build();

    const state = await hwpxToEditorState(original);
    expect(state.doc.textContent).toContain('A');
    expect(state.doc.textContent).toContain('After table');

    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    expect(state2.doc.textContent).toContain('A');
    expect(state2.doc.textContent).toContain('After table');
  });

  it('should handle multiple tables in document', async () => {
    const original = HwpxBuilder.create()
      .addTable([['Table 1']])
      .addParagraph('Between tables')
      .addTable([['Table 2']])
      .build();

    const state = await hwpxToEditorState(original);
    
    let tableCount = 0;
    state.doc.descendants(node => {
      if (node.type.name === 'table') tableCount++;
    });

    expect(tableCount).toBe(2);

    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    tableCount = 0;
    state2.doc.descendants(node => {
      if (node.type.name === 'table') tableCount++;
    });

    expect(tableCount).toBe(2);
  });
});
