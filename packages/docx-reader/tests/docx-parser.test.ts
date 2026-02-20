import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { parseDocx, docxToHwpx } from '../src/index';

const enc = new TextEncoder();

/** Build a minimal DOCX ZIP with the given document.xml body content */
function buildDocx(bodyXml: string, coreXml?: string): Uint8Array {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyXml}</w:body>
</w:document>`;

  const parts: Record<string, Uint8Array> = {
    'word/document.xml': enc.encode(documentXml),
    '[Content_Types].xml': enc.encode(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
</Types>`),
  };

  if (coreXml) {
    parts['docProps/core.xml'] = enc.encode(coreXml);
  }

  return zipSync(parts);
}

describe('parseDocx', () => {
  it('should parse simple text paragraphs', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r><w:t>Hello World</w:t></w:r>
      </w:p>
      <w:p>
        <w:r><w:t>Second paragraph</w:t></w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs).toHaveLength(2);
    expect(doc.paragraphs[0].runs[0].text).toBe('Hello World');
    expect(doc.paragraphs[1].runs[0].text).toBe('Second paragraph');
  });

  it('should extract run formatting (bold, italic, fontSize, color)', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:i/>
            <w:sz w:val="24"/>
            <w:color w:val="FF0000"/>
          </w:rPr>
          <w:t>Styled text</w:t>
        </w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    const run = doc.paragraphs[0].runs[0];
    expect(run.style.bold).toBe(true);
    expect(run.style.italic).toBe(true);
    expect(run.style.fontSize).toBe(24);
    expect(run.style.color).toBe('FF0000');
  });

  it('should parse paragraph alignment', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:jc w:val="center"/></w:pPr>
        <w:r><w:t>Centered</w:t></w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].align).toBe('center');
  });

  it('should parse tables', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:p><w:r><w:t>A2</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>B2</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    expect(doc.tables).toHaveLength(1);
    expect(doc.tables[0].rows).toHaveLength(2);
    expect(doc.tables[0].rows[0].cells[0].paragraphs[0].runs[0].text).toBe('A1');
    expect(doc.tables[0].rows[1].cells[1].paragraphs[0].runs[0].text).toBe('B2');
  });

  it('should extract metadata from core.xml', async () => {
    const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Test Document</dc:title>
  <dc:creator>John Doe</dc:creator>
</cp:coreProperties>`;

    const docx = buildDocx(`<w:p><w:r><w:t>Hello</w:t></w:r></w:p>`, coreXml);
    const doc = await parseDocx(docx);
    expect(doc.metadata.title).toBe('Test Document');
    expect(doc.metadata.author).toBe('John Doe');
  });

  it('should parse section properties', async () => {
    const docx = buildDocx(`
      <w:p><w:r><w:t>Content</w:t></w:r></w:p>
      <w:sectPr>
        <w:pgSz w:w="12240" w:h="15840"/>
        <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
      </w:sectPr>
    `);

    const doc = await parseDocx(docx);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].pageWidth).toBe(12240);
    expect(doc.sections[0].pageHeight).toBe(15840);
    expect(doc.sections[0].margins?.top).toBe(1440);
  });

  it('should preserve body element order', async () => {
    const docx = buildDocx(`
      <w:p><w:r><w:t>Before table</w:t></w:r></w:p>
      <w:tbl>
        <w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr>
      </w:tbl>
      <w:p><w:r><w:t>After table</w:t></w:r></w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.body).toHaveLength(3);
    expect(doc.body[0].type).toBe('paragraph');
    expect(doc.body[1].type).toBe('table');
    expect(doc.body[2].type).toBe('paragraph');
  });
});

describe('docxToHwpx', () => {
  it('should convert simple DOCX to HWPX', async () => {
    const docx = buildDocx(`
      <w:p><w:r><w:t>Hello from DOCX</w:t></w:r></w:p>
      <w:p>
        <w:r>
          <w:rPr><w:b/></w:rPr>
          <w:t>Bold text</w:t>
        </w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
    expect(hwpxBytes.length).toBeGreaterThan(0);

    // Verify it's a valid ZIP (starts with PK)
    expect(hwpxBytes[0]).toBe(0x50); // 'P'
    expect(hwpxBytes[1]).toBe(0x4B); // 'K'
  });

  it('should produce HWPX readable by HanDoc', async () => {
    // Dynamic import to avoid hard build dependency
    const { HanDoc } = await import('@handoc/hwpx-parser');

    const docx = buildDocx(`
      <w:p><w:r><w:t>Roundtrip test</w:t></w:r></w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    const handoc = await HanDoc.open(hwpxBytes);
    const text = handoc.extractText();
    expect(text).toContain('Roundtrip test');
  });

  it('should convert tables from DOCX to HWPX', async () => {
    const { HanDoc } = await import('@handoc/hwpx-parser');

    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>Cell A</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>Cell B</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    const handoc = await HanDoc.open(hwpxBytes);
    const text = handoc.extractText();
    expect(text).toContain('Cell A');
    expect(text).toContain('Cell B');
  });
});
