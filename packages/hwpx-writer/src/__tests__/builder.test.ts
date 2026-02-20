import { describe, it, expect } from 'vitest';
import { HwpxBuilder } from '../builder';
import { OpcPackage } from '@handoc/hwpx-core';
import { HanDoc } from '@handoc/hwpx-parser';
import { extractAnnotationText } from '@handoc/hwpx-parser';
import type { RunChild } from '@handoc/document-model';

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

  it('creates image document with BinData in ZIP', async () => {
    const fakeImage = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header stub
    const bytes = HwpxBuilder.create()
      .addParagraph('Image below:')
      .addImage(fakeImage, 'png')
      .build();

    const pkg = await OpcPackage.open(bytes);
    expect(pkg.hasPart('Contents/BinData/image0.png')).toBe(true);
    const imgData = pkg.getPart('Contents/BinData/image0.png');
    expect(imgData[0]).toBe(0x89);
  });

  it('creates header and footer readable by HanDoc', async () => {
    const bytes = HwpxBuilder.create()
      .setHeader('My Header')
      .setFooter('My Footer')
      .addParagraph('Body text')
      .build();

    const doc = await HanDoc.open(bytes);
    expect(doc.headers.length).toBeGreaterThan(0);
    expect(extractAnnotationText(doc.headers[0])).toContain('My Header');
    expect(doc.footers.length).toBeGreaterThan(0);
    expect(extractAnnotationText(doc.footers[0])).toContain('My Footer');
  });

  it('creates footnote readable by HanDoc', async () => {
    const bytes = HwpxBuilder.create()
      .addFootnote('See note', 'This is the footnote text')
      .build();

    const doc = await HanDoc.open(bytes);
    const text = doc.extractText();
    expect(text).toContain('See note');
    expect(doc.footnotes.length).toBeGreaterThan(0);
    expect(extractAnnotationText(doc.footnotes[0])).toContain('This is the footnote text');
  });

  it('creates headings with appropriate style', async () => {
    const bytes = HwpxBuilder.create()
      .addHeading(1, 'Title')
      .addHeading(2, 'Subtitle')
      .addParagraph('Normal text')
      .build();

    const doc = await HanDoc.open(bytes);
    const text = doc.extractText();
    expect(text).toContain('Title');
    expect(text).toContain('Subtitle');
    expect(text).toContain('Normal text');

    // Heading 1 should be bold with fontSize 28 → charPr height 2800
    const sections = doc.sections;
    const firstPara = sections[0].paragraphs[0];
    const charPrIdx = firstPara.runs[0].charPrIDRef;
    expect(charPrIdx).not.toBeNull();
    const charPr = doc.header.refList.charProperties[charPrIdx!];
    expect(charPr.bold).toBe(true);
    expect(charPr.height).toBe(2800);
  });

  it('supports extended paragraph styles', async () => {
    const bytes = HwpxBuilder.create()
      .addParagraph('Colored', { color: 'FF0000' })
      .addParagraph('Indented', { indent: 10 })
      .build();

    const doc = await HanDoc.open(bytes);
    const text = doc.extractText();
    expect(text).toContain('Colored');
    expect(text).toContain('Indented');
  });

  it('supports page number setting', async () => {
    const bytes = HwpxBuilder.create()
      .setPageNumber('footer', 'center')
      .addParagraph('Content')
      .build();

    const doc = await HanDoc.open(bytes);
    // Page number creates a footer ctrl element
    expect(doc.footers.length).toBeGreaterThan(0);
  });

  it('creates a shape (rect) element', async () => {
    const bytes = HwpxBuilder.create()
      .addParagraph('Before shape')
      .addShape({
        shapeType: 'rect',
        width: 5000,
        height: 3000,
        x: 1000,
        y: 1000,
        text: 'Shape text',
      })
      .addParagraph('After shape')
      .build();

    const doc = await HanDoc.open(bytes);
    const text = doc.extractText();
    expect(text).toContain('Before shape');
    expect(text).toContain('After shape');

    // Find the shape in the document
    const sections = doc.sections;
    let foundShape = false;
    for (const section of sections) {
      for (const para of section.paragraphs) {
        for (const run of para.runs) {
          for (const child of run.children) {
            if (child.type === 'shape') {
              foundShape = true;
              expect(child.name).toBe('rect');
              expect(child.element.tag).toBe('rect');
            }
          }
        }
      }
    }
    expect(foundShape).toBe(true);
  });

  it('creates an equation element', async () => {
    const bytes = HwpxBuilder.create()
      .addParagraph('Before equation')
      .addEquation({
        script: 'x = {-b +- sqrt{b^2 - 4ac}} over {2a}',
        width: 6000,
        height: 1200,
      })
      .addParagraph('After equation')
      .build();

    const doc = await HanDoc.open(bytes);
    const text = doc.extractText();
    expect(text).toContain('Before equation');
    expect(text).toContain('After equation');

    // Find the equation in the document
    const sections = doc.sections;
    let foundEquation = false;
    for (const section of sections) {
      for (const para of section.paragraphs) {
        for (const run of para.runs) {
          for (const child of run.children) {
            if (child.type === 'equation') {
              foundEquation = true;
              expect(child.element.tag).toBe('equation');
              expect(child.element.attrs.font).toBe('HWP_Equation');
              // Check script child
              const scriptChild = child.element.children.find((c) => c.tag === 'script');
              expect(scriptChild).toBeDefined();
              expect(scriptChild!.text).toContain('sqrt');
            }
          }
        }
      }
    }
    expect(foundEquation).toBe(true);
  });
});
