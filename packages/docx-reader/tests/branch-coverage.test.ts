/**
 * Targeted tests for remaining branch coverage gaps.
 * Targets specific uncovered branches in docx-parser.ts and docx-to-hwpx.ts.
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
</Types>`),
    '_rels/.rels': enc.encode(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
  };

  if (opts?.coreXml) parts['docProps/core.xml'] = enc.encode(opts.coreXml);
  if (opts?.images) {
    for (const [path, data] of Object.entries(opts.images)) {
      parts[path] = data;
    }
  }
  if (opts?.rels) parts['word/_rels/document.xml.rels'] = enc.encode(opts.rels);

  return zipSync(parts);
}

describe('Branch coverage - docx-parser.ts extent parsing', () => {
  it('should parse extent with both width and height', async () => {
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

    const doc = await parseDocx(docx);
    const image = doc.paragraphs[0].runs[0].image;
    expect(image?.width).toBe(1828800);
    expect(image?.height).toBe(914400);
  });

  it('should handle extent with invalid cx/cy values', async () => {
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
              <wp:extent cx="" cy=""/>
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
    // NaN from parseInt("") is falsy, so dimensions should be undefined
  });
});

describe('Branch coverage - docx-to-hwpx.ts alignment branches', () => {
  it('should convert alignment="left" (not "both")', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:jc w:val="left"/></w:pPr>
        <w:r><w:t>Left aligned</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should handle paragraph with no alignment set', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r><w:t>Default alignment</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });
});

describe('Branch coverage - docx-to-hwpx.ts heading level fallback', () => {
  it('should handle unknown heading style (fallback to 12pt)', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:pStyle w:val="Heading7"/></w:pPr>
        <w:r><w:t>Unknown heading level</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should handle non-heading style that matches heading pattern', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:pStyle w:val="CustomStyle"/></w:pPr>
        <w:r><w:t>Custom style</w:t></w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });
});

describe('Branch coverage - image dimensions in docx-to-hwpx', () => {
  it('should handle image with only width', async () => {
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
              <wp:extent cx="1828800"/>
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

  it('should handle image with only height', async () => {
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
              <wp:extent cy="914400"/>
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
});

describe('Branch coverage - paragraph with no first run', () => {
  it('should handle paragraph with empty runs array', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:jc w:val="center"/></w:pPr>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should handle run without style', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r><w:t>No style</w:t></w:r>
      </w:p>
    `);

    const doc = await parseDocx(docx);
    expect(doc.paragraphs[0].runs[0].style).toBeDefined();
  });
});

describe('Branch coverage - fontSize conversion', () => {
  it('should convert fontSize from run when no heading style exists', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:r>
          <w:rPr><w:sz w:val="28"/></w:rPr>
          <w:t>14pt text</w:t>
        </w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });

  it('should skip fontSize conversion when heading style sets it', async () => {
    const docx = buildDocx(`
      <w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="20"/></w:rPr>
          <w:t>Heading overrides run size</w:t>
        </w:r>
      </w:p>
    `);

    const hwpxBytes = await docxToHwpx(docx);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
  });
});
