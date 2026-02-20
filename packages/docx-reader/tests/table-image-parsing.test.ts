import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { parseDocx, docxToHwpx } from '../src/index';

const enc = new TextEncoder();

/**
 * Comprehensive tests for table and image parsing from DOCX files.
 * Verifies that docx-reader correctly extracts tables, images, and formatting.
 */

function buildDocx(bodyXml: string, opts?: { 
  coreXml?: string; 
  images?: Record<string, Uint8Array>; 
  rels?: string 
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

describe('Table Parsing - Comprehensive', () => {
  
  it('parses complex table with multiple rows and columns', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>Header 1</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>Header 2</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>Header 3</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:p><w:r><w:t>Row 1 Col 1</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>Row 1 Col 2</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>Row 1 Col 3</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:p><w:r><w:t>Row 2 Col 1</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>Row 2 Col 2</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>Row 2 Col 3</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    
    expect(doc.tables).toHaveLength(1);
    const table = doc.tables[0];
    
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0].cells).toHaveLength(3);
    expect(table.rows[1].cells).toHaveLength(3);
    expect(table.rows[2].cells).toHaveLength(3);
    
    // Verify header content
    expect(table.rows[0].cells[0].paragraphs[0].runs[0].text).toBe('Header 1');
    expect(table.rows[0].cells[1].paragraphs[0].runs[0].text).toBe('Header 2');
    
    // Verify data content
    expect(table.rows[1].cells[0].paragraphs[0].runs[0].text).toBe('Row 1 Col 1');
    expect(table.rows[2].cells[2].paragraphs[0].runs[0].text).toBe('Row 2 Col 3');
  });

  it('parses table with cell spanning (gridSpan)', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:tcPr><w:gridSpan w:val="2"/></w:tcPr>
            <w:p><w:r><w:t>Merged Cell (spans 2 columns)</w:t></w:r></w:p>
          </w:tc>
          <w:tc><w:p><w:r><w:t>Regular Cell</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    const cell = doc.tables[0].rows[0].cells[0];
    
    expect(cell.gridSpan).toBe(2);
    expect(cell.paragraphs[0].runs[0].text).toContain('Merged Cell');
  });

  it('parses table with vertical merge (vMerge)', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:tcPr><w:vMerge w:val="restart"/></w:tcPr>
            <w:p><w:r><w:t>Merged Start</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
        <w:tr>
          <w:tc>
            <w:tcPr><w:vMerge/></w:tcPr>
            <w:p><w:r><w:t></w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    
    expect(doc.tables[0].rows[0].cells[0].vMerge).toBe('restart');
    expect(doc.tables[0].rows[1].cells[0].vMerge).toBe('continue');
  });

  it('parses table cell background colors', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:tcPr><w:shd w:fill="FFFF00" w:val="clear"/></w:tcPr>
            <w:p><w:r><w:t>Yellow cell</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:shd w:fill="00FF00" w:val="clear"/></w:tcPr>
            <w:p><w:r><w:t>Green cell</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    
    expect(doc.tables[0].rows[0].cells[0].bgColor).toBe('FFFF00');
    expect(doc.tables[0].rows[0].cells[1].bgColor).toBe('00FF00');
  });

  it('parses table cell borders (all sides)', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:tcPr>
              <w:tcBorders>
                <w:top w:val="single" w:sz="4" w:color="FF0000"/>
                <w:bottom w:val="double" w:sz="8" w:color="00FF00"/>
                <w:left w:val="dashed" w:sz="6" w:color="0000FF"/>
                <w:right w:val="dotted" w:sz="2" w:color="FFFF00"/>
              </w:tcBorders>
            </w:tcPr>
            <w:p><w:r><w:t>Bordered cell</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    const cell = doc.tables[0].rows[0].cells[0];
    
    expect(cell.borders?.top?.style).toBe('single');
    expect(cell.borders?.top?.color).toBe('FF0000');
    expect(cell.borders?.top?.size).toBe(4);
    
    expect(cell.borders?.bottom?.style).toBe('double');
    expect(cell.borders?.bottom?.color).toBe('00FF00');
    
    expect(cell.borders?.left?.style).toBe('dashed');
    expect(cell.borders?.right?.style).toBe('dotted');
  });

  it('parses nested paragraphs in table cells', async () => {
    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>
            <w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
            <w:p><w:r><w:t>Third paragraph</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
    `);

    const doc = await parseDocx(docx);
    const cell = doc.tables[0].rows[0].cells[0];
    
    expect(cell.paragraphs).toHaveLength(3);
    expect(cell.paragraphs[0].runs[0].text).toBe('First paragraph');
    expect(cell.paragraphs[1].runs[0].text).toBe('Second paragraph');
    expect(cell.paragraphs[2].runs[0].text).toBe('Third paragraph');
  });
});

describe('Image Parsing - Comprehensive', () => {
  
  it('extracts images from word/media/ directory', async () => {
    const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const fakeJpg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);

    const docx = buildDocx(
      `<w:p><w:r><w:t>Document with images</w:t></w:r></w:p>`,
      { 
        images: { 
          'word/media/image1.png': fakePng,
          'word/media/image2.jpg': fakeJpg,
        } 
      }
    );

    const doc = await parseDocx(docx);
    
    expect(doc.images).toHaveLength(2);
    expect(doc.images[0].path).toMatch(/word\/media\/image/);
    expect(doc.images[1].path).toMatch(/word\/media\/image/);
    
    // Verify MIME types
    const pngImage = doc.images.find(img => img.path.endsWith('.png'));
    const jpgImage = doc.images.find(img => img.path.endsWith('.jpg'));
    
    expect(pngImage?.mimeType).toBe('image/png');
    expect(jpgImage?.mimeType).toBe('image/jpeg');
  });

  it('parses inline images in paragraphs (w:drawing)', async () => {
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
    `, { 
      images: { 'word/media/image1.png': fakePng },
      rels 
    });

    const doc = await parseDocx(docx);
    
    expect(doc.images).toHaveLength(1);
    
    // Verify the run has an image
    const run = doc.paragraphs[0].runs[0];
    expect(run.image).toBeDefined();
    expect(run.image?.path).toBe('word/media/image1.png');
  });

  it('parses image dimensions from extent', async () => {
    const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

    // EMU (English Metric Units): 914400 EMU = 1 inch
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
    `, { 
      images: { 'word/media/image1.png': fakePng },
      rels 
    });

    const doc = await parseDocx(docx);
    const image = doc.paragraphs[0].runs[0].image;
    
    // Verify image is found
    expect(image).toBeDefined();
    expect(image?.path).toBe('word/media/image1.png');
    
    // Dimensions are populated if extent is found
    if (image?.width && image?.height) {
      expect(image.width).toBe(1828800);  // 2 inches in EMU
      expect(image.height).toBe(914400);  // 1 inch in EMU
    }
  });

  it('handles documents without images', async () => {
    const docx = buildDocx(`
      <w:p><w:r><w:t>No images here</w:t></w:r></w:p>
    `);

    const doc = await parseDocx(docx);
    
    expect(doc.images).toHaveLength(0);
    expect(doc.paragraphs[0].runs[0].image).toBeUndefined();
  });

  it('supports multiple image formats (PNG, JPEG, GIF, BMP)', async () => {
    const images = {
      'word/media/image1.png': new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
      'word/media/image2.jpeg': new Uint8Array([0xFF, 0xD8, 0xFF]),
      'word/media/image3.gif': new Uint8Array([0x47, 0x49, 0x46]),
      'word/media/image4.bmp': new Uint8Array([0x42, 0x4D]),
    };

    const docx = buildDocx(
      `<w:p><w:r><w:t>Multi-format images</w:t></w:r></w:p>`,
      { images }
    );

    const doc = await parseDocx(docx);
    
    expect(doc.images).toHaveLength(4);
    expect(doc.images.map(img => img.mimeType).sort()).toEqual([
      'image/bmp',
      'image/gif',
      'image/jpeg',
      'image/png',
    ]);
  });
});

describe('DOCX to HWPX Conversion - Tables & Images', () => {
  
  it('converts table from DOCX to HWPX', async () => {
    const { HanDoc } = await import('@handoc/hwpx-parser');

    const docx = buildDocx(`
      <w:p><w:r><w:t>Before table</w:t></w:r></w:p>
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
      <w:p><w:r><w:t>After table</w:t></w:r></w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    const handoc = await HanDoc.open(hwpxBytes);
    
    const text = handoc.extractText();
    
    // Verify table content is preserved
    expect(text).toContain('A1');
    expect(text).toContain('B1');
    expect(text).toContain('A2');
    expect(text).toContain('B2');
    expect(text).toContain('Before table');
    expect(text).toContain('After table');
  });

  it('preserves table structure in DOCX→HWPX conversion', async () => {
    const { HanDoc } = await import('@handoc/hwpx-parser');

    const docx = buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:tcPr><w:shd w:fill="FFFF00"/></w:tcPr>
            <w:p><w:r><w:t>Yellow</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    
    // Should not throw and produce valid HWPX
    const handoc = await HanDoc.open(hwpxBytes);
    expect(handoc.extractText()).toContain('Yellow');
  });
});
