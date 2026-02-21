/**
 * Comprehensive coverage tests to reach 95%+ on all metrics.
 * Targets uncovered branches, edge cases, and missing code paths.
 */

import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { parseDocx, docxToHwpx } from '../src/index';

const enc = new TextEncoder();

function buildDocx(bodyXml: string, opts?: {
  coreXml?: string;
  images?: Record<string, Uint8Array>;
  rels?: string;
}): Uint8Array {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>${bodyXml}</w:body>
</w:document>`;

  const parts: Record<string, Uint8Array> = {
    'word/document.xml': enc.encode(documentXml),
    '[Content_Types].xml': enc.encode(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
</Types>`),
    '_rels/.rels': enc.encode(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
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

describe('docx-parser.ts - Missing branches', () => {
  it('should parse line breaks (w:br)', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:t>Line 1</w:t>
          <w:br/>
          <w:t>Line 2</w:t>
        </w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].runs[0].text).toBe('Line 1\nLine 2');
  });

  it('should parse tabs (w:tab)', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:t>Column 1</w:t>
          <w:tab/>
          <w:t>Column 2</w:t>
        </w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].runs[0].text).toBe('Column 1\tColumn 2');
  });

  it('should parse font family (rFonts)', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
          </w:rPr>
          <w:t>Arial text</w:t>
        </w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].runs[0].style.fontFamily).toBe('Arial');
  });

  it('should parse font family from eastAsia', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:rPr>
            <w:rFonts w:eastAsia="Malgun Gothic"/>
          </w:rPr>
          <w:t>한글 텍스트</w:t>
        </w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].runs[0].style.fontFamily).toBe('Malgun Gothic');
  });

  it('should skip auto color and treat as undefined', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:rPr>
            <w:color w:val="auto"/>
          </w:rPr>
          <w:t>Auto color</w:t>
        </w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].runs[0].style.color).toBeUndefined();
  });

  it('should handle drawing without blip', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline>
              <wp:extent cx="914400" cy="914400"/>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].runs[0].image).toBeUndefined();
  });

  it('should handle blip without embed attribute', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline>
              <a:graphic>
                <a:graphicData>
                  <pic:pic>
                    <pic:blipFill>
                      <a:blip/>
                    </pic:blipFill>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].runs[0].image).toBeUndefined();
  });

  it('should handle invalid relationship ID', async () => {
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline>
              <a:graphic>
                <a:graphicData>
                  <pic:pic>
                    <pic:blipFill>
                      <a:blip r:embed="rId999"/>
                    </pic:blipFill>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `, { rels });

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].runs[0].image).toBeUndefined();
  });

  it('should handle image without dimensions', async () => {
    const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline>
              <a:graphic>
                <a:graphicData>
                  <pic:pic>
                    <pic:blipFill>
                      <a:blip r:embed="rId1"/>
                    </pic:blipFill>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `, { images: { 'word/media/image1.png': fakePng }, rels });

    const doc = await parseDocx(docx);
    const image = doc.paragraphs[0].runs[0].image;
    expect(image).toBeDefined();
    expect(image?.width).toBeUndefined();
    expect(image?.height).toBeUndefined();
  });
});

describe('docx-to-hwpx.ts - Missing branches', () => {
  it('should handle empty tables', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should handle paragraphs with images', async () => {
    const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:t>Caption: </w:t>
          <w:drawing>
            <wp:inline>
              <wp:extent cx="914400" cy="914400"/>
              <a:graphic>
                <a:graphicData>
                  <pic:pic>
                    <pic:blipFill>
                      <a:blip r:embed="rId1"/>
                    </pic:blipFill>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `, { images: { 'word/media/image1.png': fakePng }, rels });

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should convert numbered list (numId > 0)', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr>
          <w:numPr>
            <w:ilvl w:val="0"/>
            <w:numId w:val="1"/>
          </w:numPr>
        </w:pPr>
        <w:r><w:t>First item</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);

    const { HanDoc } = await import('@handoc/hwpx-parser');
    const handoc = await HanDoc.open(hwpxBytes);
    const text = handoc.extractText();
    expect(text).toContain('•');
    expect(text).toContain('First item');
  });

  it('should convert bullet list (numId = 0)', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr>
          <w:numPr>
            <w:ilvl w:val="0"/>
            <w:numId w:val="0"/>
          </w:numPr>
        </w:pPr>
        <w:r><w:t>Bullet item</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should convert all heading levels (1-6)', async () => {
    const headings = Array.from({ length: 6 }, (_, i) => {
      const level = i + 1;
      return `
        <w:p>
          <w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr>
          <w:r><w:t>Heading ${level}</w:t></w:r>
        </w:p>
      `;
    }).join('');

    const docx = buildDocx(headings);
    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);

    const { HanDoc } = await import('@handoc/hwpx-parser');
    const handoc = await HanDoc.open(hwpxBytes);
    const text = handoc.extractText();
    
    for (let i = 1; i <= 6; i++) {
      expect(text).toContain(`Heading ${i}`);
    }
  });

  it('should handle lowercase heading styles', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:pStyle w:val="heading2"/></w:pPr>
        <w:r><w:t>Lowercase heading</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should handle "Heading 1" style (with space)', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:pStyle w:val="Heading 3"/></w:pPr>
        <w:r><w:t>Heading with space</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should convert different alignments', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:jc w:val="center"/></w:pPr>
        <w:r><w:t>Centered</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:jc w:val="right"/></w:pPr>
        <w:r><w:t>Right</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:jc w:val="both"/></w:pPr>
        <w:r><w:t>Justified</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);

    const { HanDoc } = await import('@handoc/hwpx-parser');
    const handoc = await HanDoc.open(hwpxBytes);
    const text = handoc.extractText();
    expect(text).toContain('Centered');
    expect(text).toContain('Right');
    expect(text).toContain('Justified');
  });

  it('should convert images with dimensions', async () => {
    const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline>
              <wp:extent cx="1828800" cy="914400"/>
              <a:graphic>
                <a:graphicData>
                  <pic:pic>
                    <pic:blipFill>
                      <a:blip r:embed="rId1"/>
                    </pic:blipFill>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `, { images: { 'word/media/image1.png': fakePng }, rels });

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
    expect(hwpxBytes.length).toBeGreaterThan(0);
  });

  it('should convert images without dimensions', async () => {
    const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline>
              <a:graphic>
                <a:graphicData>
                  <pic:pic>
                    <pic:blipFill>
                      <a:blip r:embed="rId1"/>
                    </pic:blipFill>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `, { images: { 'word/media/image1.png': fakePng }, rels });

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should handle paragraphs without runs', async () => {
    const docx = buildDocx(`
      <w:p></w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should handle paragraphs with only whitespace', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r><w:t>   </w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should handle paragraphs with run formatting but no heading style', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:sz w:val="32"/>
          </w:rPr>
          <w:t>Large bold text</w:t>
        </w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);

    const { HanDoc } = await import('@handoc/hwpx-parser');
    const handoc = await HanDoc.open(hwpxBytes);
    const text = handoc.extractText();
    expect(text).toContain('Large bold text');
  });

  it('should handle mixed content (paragraphs, tables, images)', async () => {
    const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r><w:t>Document Title</w:t></w:r>
      </w:p>
      <w:p>
        <w:r><w:t>Some text before the table.</w:t></w:r>
      </w:p>
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>Table cell</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline>
              <wp:extent cx="914400" cy="914400"/>
              <a:graphic>
                <a:graphicData>
                  <pic:pic>
                    <pic:blipFill>
                      <a:blip r:embed="rId1"/>
                    </pic:blipFill>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
      <w:p>
        <w:pPr>
          <w:numPr>
            <w:ilvl w:val="0"/>
            <w:numId w:val="1"/>
          </w:numPr>
        </w:pPr>
        <w:r><w:t>List item</w:t></w:r>
      </w:p>
    `, { images: { 'word/media/image1.png': fakePng }, rels });

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);

    const { HanDoc } = await import('@handoc/hwpx-parser');
    const handoc = await HanDoc.open(hwpxBytes);
    const text = handoc.extractText();
    expect(text).toContain('Document Title');
    expect(text).toContain('Table cell');
    expect(text).toContain('List item');
  });
});

describe('index.ts - Export coverage', () => {
  it('should export parseDocx', () => {
    expect(parseDocx).toBeDefined();
    expect(typeof parseDocx).toBe('function');
  });

  it('should export docxToHwpx', () => {
    expect(docxToHwpx).toBeDefined();
    expect(typeof docxToHwpx).toBe('function');
  });

  it('should successfully import and use all exports', async () => {
    const docx = buildDocx(`<w:p><w:r><w:t>Test</w:t></w:r></w:p>`);
    
    // Test parseDocx export
    const doc = await parseDocx(docx);
    expect(doc.paragraphs).toHaveLength(1);
    
    // Test docxToHwpx export
    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });
});

describe('Edge cases and error handling', () => {
  it('should handle completely empty DOCX', async () => {
    const docx = buildDocx('');
    const doc = await parseDocx(docx);
    expect(doc.paragraphs).toHaveLength(0);
    expect(doc.tables).toHaveLength(0);
  });

  it('should handle DOCX with only whitespace', async () => {
    const docx = buildDocx(`
      <w:p><w:r><w:t>  </w:t></w:r></w:p>
      <w:p><w:r><w:t></w:t></w:r></w:p>
    `);
    
    const doc = await parseDocx(docx);
    expect(doc.paragraphs).toHaveLength(2);
  });

  it('should handle table with no rows', async () => {
    const docx = buildDocx(`<w:tbl></w:tbl>`);
    const doc = await parseDocx(docx);
    expect(doc.tables).toHaveLength(1);
    expect(doc.tables[0].rows).toHaveLength(0);
  });

  it('should handle deeply nested formatting', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:i/>
            <w:sz w:val="24"/>
            <w:color w:val="FF0000"/>
            <w:rFonts w:ascii="Calibri"/>
          </w:rPr>
          <w:t>Complex formatted text</w:t>
        </w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    const style = doc.paragraphs[0].runs[0].style;
    expect(style.bold).toBe(true);
    expect(style.italic).toBe(true);
    expect(style.fontSize).toBe(24);
    expect(style.color).toBe('FF0000');
    expect(style.fontFamily).toBe('Calibri');
  });
});
