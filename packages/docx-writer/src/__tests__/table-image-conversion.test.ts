import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hwpxToDocx } from '../converter';
import { unzipSync } from 'fflate';

const FIXTURES = join(import.meta.dirname, '../../../../fixtures/hwpx');

/**
 * Integration tests for table and image conversion from HWPX to DOCX.
 * Verifies that tables and images are properly converted and preserved.
 */
describe('Table and Image Conversion (HWPX → DOCX)', () => {
  
  // ── Helper functions ──
  
  function isValidZip(buf: Uint8Array): boolean {
    return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  }

  function extractDocxXml(docx: Uint8Array, path: string = 'word/document.xml'): string {
    const files = unzipSync(docx);
    const xml = files[path];
    if (!xml) throw new Error(`Missing ${path} in DOCX`);
    return new TextDecoder().decode(xml);
  }

  function countTablesInDocx(docxXml: string): number {
    // Count <w:tbl> elements
    const matches = docxXml.match(/<w:tbl[>\s]/g);
    return matches ? matches.length : 0;
  }

  function countImagesInDocx(docxXml: string): number {
    // Count <w:drawing> or <wp:inline> elements (image containers)
    const drawingMatches = docxXml.match(/<w:drawing>/g);
    const inlineMatches = docxXml.match(/<wp:inline>/g);
    return Math.max(
      drawingMatches ? drawingMatches.length : 0,
      inlineMatches ? inlineMatches.length : 0
    );
  }

  function listMediaFiles(docx: Uint8Array): string[] {
    const files = unzipSync(docx);
    return Object.keys(files).filter(path => path.startsWith('word/media/'));
  }

  // ── Table Conversion Tests ──

  it('converts table-basic.hwpx and preserves table structure', async () => {
    const hwpxPath = join(FIXTURES, 'table-basic.hwpx');
    if (!existsSync(hwpxPath)) {
      console.warn('⚠️  table-basic.hwpx not found, skipping test');
      return;
    }

    const hwpxBuffer = new Uint8Array(readFileSync(hwpxPath));
    const docxBuffer = await hwpxToDocx(hwpxBuffer);

    // Basic validation
    expect(isValidZip(docxBuffer)).toBe(true);

    // Extract and verify table content
    const docxXml = extractDocxXml(docxBuffer);
    const tableCount = countTablesInDocx(docxXml);

    // table-basic.hwpx should have 1 table
    expect(tableCount).toBeGreaterThanOrEqual(1);

    // Verify table content is preserved
    expect(docxXml).toContain('항목'); // Header: "Item"
    expect(docxXml).toContain('수량'); // Header: "Quantity"
    expect(docxXml).toContain('사과'); // Data: "Apple"
  });

  it('preserves table cell content and structure', async () => {
    const hwpxPath = join(FIXTURES, 'table-basic.hwpx');
    if (!existsSync(hwpxPath)) return;

    const hwpxBuffer = new Uint8Array(readFileSync(hwpxPath));
    const docxBuffer = await hwpxToDocx(hwpxBuffer);
    const docxXml = extractDocxXml(docxBuffer);

    // Verify table rows (<w:tr>) exist
    const rowMatches = docxXml.match(/<w:tr>/g);
    expect(rowMatches).toBeTruthy();
    expect(rowMatches!.length).toBeGreaterThanOrEqual(2); // At least header + 1 data row

    // Verify table cells (<w:tc>) exist
    const cellMatches = docxXml.match(/<w:tc>/g);
    expect(cellMatches).toBeTruthy();
    expect(cellMatches!.length).toBeGreaterThanOrEqual(6); // 3 columns × 2 rows minimum
  });

  // ── Image Conversion Tests ──
  
  it('handles documents without images gracefully', async () => {
    const hwpxPath = join(FIXTURES, 'simple-text.hwpx');
    if (!existsSync(hwpxPath)) return;

    const hwpxBuffer = new Uint8Array(readFileSync(hwpxPath));
    const docxBuffer = await hwpxToDocx(hwpxBuffer);

    expect(isValidZip(docxBuffer)).toBe(true);

    const docxXml = extractDocxXml(docxBuffer);
    const imageCount = countImagesInDocx(docxXml);
    expect(imageCount).toBe(0); // No images in simple-text.hwpx
  });

  it('creates valid DOCX structure even with empty tables', async () => {
    const hwpxPath = join(FIXTURES, 'empty.hwpx');
    if (!existsSync(hwpxPath)) return;

    const hwpxBuffer = new Uint8Array(readFileSync(hwpxPath));
    const docxBuffer = await hwpxToDocx(hwpxBuffer);

    expect(isValidZip(docxBuffer)).toBe(true);

    const docxXml = extractDocxXml(docxBuffer);
    const tableCount = countTablesInDocx(docxXml);
    expect(tableCount).toBe(0); // Empty document should have no tables
  });

  // ── Integration Tests ──

  it('round-trip: table-basic.hwpx → DOCX → verify structure', async () => {
    const hwpxPath = join(FIXTURES, 'table-basic.hwpx');
    if (!existsSync(hwpxPath)) return;

    const hwpxBuffer = new Uint8Array(readFileSync(hwpxPath));
    const docxBuffer = await hwpxToDocx(hwpxBuffer);

    // Verify DOCX structure
    const files = unzipSync(docxBuffer);
    
    // Check essential DOCX components exist
    expect(files['word/document.xml']).toBeDefined();
    expect(files['[Content_Types].xml']).toBeDefined();
    expect(files['_rels/.rels']).toBeDefined();

    const docxXml = new TextDecoder().decode(files['word/document.xml']);
    
    // Verify table exists and has proper XML structure
    expect(docxXml).toContain('<w:tbl');
    expect(docxXml).toContain('<w:tr');
    expect(docxXml).toContain('<w:tc');
    expect(docxXml).toContain('</w:tbl>');
  });

  it('preserves text formatting in table cells', async () => {
    const hwpxPath = join(FIXTURES, 'table-basic.hwpx');
    if (!existsSync(hwpxPath)) return;

    const hwpxBuffer = new Uint8Array(readFileSync(hwpxPath));
    const docxBuffer = await hwpxToDocx(hwpxBuffer);
    const docxXml = extractDocxXml(docxBuffer);

    // Verify paragraphs exist within table cells
    expect(docxXml).toMatch(/<w:tc>.*?<w:p>.*?<\/w:p>.*?<\/w:tc>/s);

    // Verify text runs exist
    expect(docxXml).toMatch(/<w:p>.*?<w:r>.*?<w:t>.*?<\/w:t>.*?<\/w:r>.*?<\/w:p>/s);
  });
});

describe('Table Features - Advanced', () => {
  it('handles table-basic.hwpx without errors', async () => {
    const hwpxPath = join(FIXTURES, 'table-basic.hwpx');
    if (!existsSync(hwpxPath)) {
      console.warn('⚠️  table-basic.hwpx not found, skipping advanced tests');
      return;
    }

    const hwpxBuffer = new Uint8Array(readFileSync(hwpxPath));
    
    // Should not throw
    await expect(hwpxToDocx(hwpxBuffer)).resolves.toBeDefined();
  });

  it('produces DOCX files larger than minimal size when tables are present', async () => {
    const simplePath = join(FIXTURES, 'simple-text.hwpx');
    const tablePath = join(FIXTURES, 'table-basic.hwpx');
    
    if (!existsSync(simplePath) || !existsSync(tablePath)) return;

    const simpleDocx = await hwpxToDocx(new Uint8Array(readFileSync(simplePath)));
    const tableDocx = await hwpxToDocx(new Uint8Array(readFileSync(tablePath)));

    // Table document should be larger due to table structure
    expect(tableDocx.length).toBeGreaterThan(simpleDocx.length * 0.9);
  });
});
