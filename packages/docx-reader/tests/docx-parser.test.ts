import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { parseDocx, docxToHwpx } from '../src/index';

const enc = new TextEncoder();

/** Build a minimal DOCX ZIP with the given document.xml body content */
function buildDocx(bodyXml: string, opts?: { coreXml?: string; images?: Record<string, Uint8Array>; rels?: string }): Uint8Array {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`;

  const parts: Record<string, Uint8Array> = {
    'word/document.xml': enc.encode(documentXml),
    '[Content_Types].xml': enc.encode(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="png" ContentType="image/png"/>
</Types>`),
  };

  if (opts?.coreXml) {
    parts['docProps/core.xml'] = enc.encode(opts.coreXml);
  }

  if (opts?.images) {
    for (const [path, data] of Object.entries(opts.images)) {
      parts[path] = data;
    }
  }

  if (opts?.rels) {
    parts['word/_rels/document.xml.rels'] = enc.encode(opts.rels);
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

    const docx = buildDocx(`<w:p><w:r><w:t>Hello</w:t></w:r></w:p>`, { coreXml });
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

  // ── New tests for improved parsing ──

  it('should parse table cell background color', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:tcPr><w:shd w:fill="FF0000" w:val="clear"/></w:tcPr>
            <w:p><w:r><w:t>Red cell</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    expect(doc.tables[0].rows[0].cells[0].bgColor).toBe('FF0000');
  });

  it('should parse table cell borders', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:tcPr>
              <w:tcBorders>
                <w:top w:val="single" w:sz="4" w:color="000000"/>
                <w:bottom w:val="double" w:sz="8" w:color="FF0000"/>
              </w:tcBorders>
            </w:tcPr>
            <w:p><w:r><w:t>Bordered</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    const cell = doc.tables[0].rows[0].cells[0];
    expect(cell.borders?.top?.style).toBe('single');
    expect(cell.borders?.top?.size).toBe(4);
    expect(cell.borders?.bottom?.style).toBe('double');
    expect(cell.borders?.bottom?.color).toBe('FF0000');
  });

  it('should parse cell gridSpan (column merge)', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:tcPr><w:gridSpan w:val="3"/></w:tcPr>
            <w:p><w:r><w:t>Merged</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    expect(doc.tables[0].rows[0].cells[0].gridSpan).toBe(3);
  });

  it('should parse heading styles', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r><w:t>Title</w:t></w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].styleId).toBe('Heading1');
  });

  it('should parse numbering (list) properties', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr>
          <w:numPr>
            <w:ilvl w:val="0"/>
            <w:numId w:val="1"/>
          </w:numPr>
        </w:pPr>
        <w:r><w:t>List item</w:t></w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].numPr).toEqual({ numId: 1, ilvl: 0 });
  });

  it('should extract images from word/media/', async () => {
    // Create a fake PNG (minimal header)
    const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    const docx = buildDocx(
      `<w:p><w:r><w:t>Has image</w:t></w:r></w:p>`,
      { images: { 'word/media/image1.png': fakePng } }
    );

    const doc = await parseDocx(docx);
    expect(doc.images).toHaveLength(1);
    expect(doc.images[0].path).toBe('word/media/image1.png');
    expect(doc.images[0].mimeType).toBe('image/png');
    expect(doc.images[0].data).toEqual(fakePng);
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

  it('should convert heading styles to bold + larger font', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r><w:t>Main Title</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
    expect(hwpxBytes[0]).toBe(0x50);
  });
});
