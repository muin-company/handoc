import { describe, it, expect } from 'vitest';
import { HwpxBuilder } from '../builder';
import { OpcPackage } from '@handoc/hwpx-core';
import { HanDoc } from '@handoc/hwpx-parser';

describe('HwpxBuilder', () => {
  it('creates an empty document with valid ZIP', async () => {
    const bytes = HwpxBuilder.create().build();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    // Should be valid ZIP (PK header)
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K

    // Should open as OPC package
    const pkg = await OpcPackage.open(bytes);
    expect(pkg.hasPart('Contents/header.xml')).toBe(true);
    expect(pkg.hasPart('Contents/content.hpf')).toBe(true);
    expect(pkg.hasPart('mimetype')).toBe(true);
  });

  it('creates a text document and reads it back', async () => {
    const bytes = HwpxBuilder.create()
      .addParagraph('안녕하세요')
      .addParagraph('Hello World')
      .build();

    const doc = await HanDoc.open(bytes);
    const text = doc.extractText();

    expect(text).toContain('안녕하세요');
    expect(text).toContain('Hello World');
  });

  it('creates a styled text document', async () => {
    const bytes = HwpxBuilder.create()
      .addParagraph('Bold text', { bold: true })
      .addParagraph('Italic text', { italic: true })
      .addParagraph('Large text', { fontSize: 20 })
      .addParagraph('Centered', { align: 'center' })
      .build();

    const doc = await HanDoc.open(bytes);
    const text = doc.extractText();

    expect(text).toContain('Bold text');
    expect(text).toContain('Italic text');
    expect(text).toContain('Large text');
    expect(text).toContain('Centered');
  });

  it('creates a table document and reads it back', async () => {
    const bytes = HwpxBuilder.create()
      .addParagraph('Table below:')
      .addTable([
        ['Name', 'Age'],
        ['Alice', '30'],
        ['Bob', '25'],
      ])
      .build();

    const doc = await HanDoc.open(bytes);
    const text = doc.extractText();

    expect(text).toContain('Table below:');
    // Table cell text should be extractable
    expect(text).toContain('Name');
    expect(text).toContain('Alice');
  });

  it('creates multi-section document with correct section count', async () => {
    const bytes = HwpxBuilder.create()
      .addParagraph('Section 1')
      .addSectionBreak()
      .addParagraph('Section 2')
      .addSectionBreak()
      .addParagraph('Section 3')
      .build();

    const pkg = await OpcPackage.open(bytes);
    const sectionPaths = pkg.getSectionPaths();

    expect(sectionPaths.length).toBe(3);
  });

  it('supports custom page dimensions', () => {
    const bytes = HwpxBuilder.create({ pageWidth: 50000, pageHeight: 70000 })
      .addParagraph('Custom size')
      .build();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles empty section break (no content in a section)', async () => {
    const bytes = HwpxBuilder.create()
      .addSectionBreak()
      .addParagraph('Second section')
      .build();

    const pkg = await OpcPackage.open(bytes);
    const sectionPaths = pkg.getSectionPaths();
    expect(sectionPaths.length).toBe(2);
  });
});
