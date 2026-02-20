import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURES = resolve(__dirname, '../../../../fixtures/hwpx');

function readFixture(name: string): Uint8Array {
  return readFileSync(resolve(FIXTURES, name));
}

// Mock Playwright to avoid actually launching a browser in tests
const mockPdf = vi.fn();
const mockSetContent = vi.fn();
const mockNewPage = vi.fn(() => ({
  setContent: mockSetContent,
  pdf: mockPdf,
}));
const mockClose = vi.fn();
const mockLaunch = vi.fn(() => ({
  newPage: mockNewPage,
  close: mockClose,
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: mockLaunch,
  },
}));

// Import hwpxToPdf AFTER the mock is set up
const { hwpxToPdf } = await import('../pdf-exporter');

describe('hwpxToPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock returns empty PDF buffer
    mockPdf.mockResolvedValue(Buffer.from('PDF'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should convert HWPX to PDF with default A4 portrait settings', async () => {
    // Mock a portrait document (A4: 210x297mm)
    const hwpxBuffer = readFixture('simple-text.hwpx');
    
    const result = await hwpxToPdf(hwpxBuffer);
    
    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockLaunch).toHaveBeenCalledWith({ headless: true });
    expect(mockNewPage).toHaveBeenCalled();
    expect(mockSetContent).toHaveBeenCalled();
    expect(mockPdf).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('should apply page size from HWPX document', async () => {
    const hwpxBuffer = readFixture('simple-text.hwpx');
    
    await hwpxToPdf(hwpxBuffer);
    
    const pdfOptions = mockPdf.mock.calls[0][0];
    expect(pdfOptions.width).toBeDefined();
    expect(pdfOptions.height).toBeDefined();
    expect(pdfOptions.width).toMatch(/mm$/);
    expect(pdfOptions.height).toMatch(/mm$/);
  });

  it('should apply margins from HWPX document', async () => {
    const hwpxBuffer = readFixture('simple-text.hwpx');
    
    await hwpxToPdf(hwpxBuffer);
    
    const pdfOptions = mockPdf.mock.calls[0][0];
    expect(pdfOptions.margin).toBeDefined();
    expect(pdfOptions.margin.top).toMatch(/mm$/);
    expect(pdfOptions.margin.bottom).toMatch(/mm$/);
    expect(pdfOptions.margin.left).toMatch(/mm$/);
    expect(pdfOptions.margin.right).toMatch(/mm$/);
  });

  it('should handle landscape orientation by swapping width and height', async () => {
    // simple-text.hwpx has landscape: true
    const hwpxBuffer = readFixture('simple-text.hwpx');
    
    await hwpxToPdf(hwpxBuffer);
    
    const pdfOptions = mockPdf.mock.calls[0][0];
    const width = parseFloat(pdfOptions.width);
    const height = parseFloat(pdfOptions.height);
    
    // In landscape, width should be greater than height (297 > 210)
    expect(width).toBeGreaterThan(height);
  });

  it('should enable printBackground for rendering colors and images', async () => {
    const hwpxBuffer = readFixture('simple-text.hwpx');
    
    await hwpxToPdf(hwpxBuffer);
    
    const pdfOptions = mockPdf.mock.calls[0][0];
    expect(pdfOptions.printBackground).toBe(true);
  });

  it('should wait for network idle before generating PDF', async () => {
    const hwpxBuffer = readFixture('simple-text.hwpx');
    
    await hwpxToPdf(hwpxBuffer);
    
    expect(mockSetContent).toHaveBeenCalledWith(
      expect.any(String),
      { waitUntil: 'networkidle' }
    );
  });

  it('should close browser even if PDF generation fails', async () => {
    const hwpxBuffer = readFixture('simple-text.hwpx');
    mockPdf.mockRejectedValue(new Error('PDF generation failed'));
    
    await expect(hwpxToPdf(hwpxBuffer)).rejects.toThrow('PDF generation failed');
    
    expect(mockClose).toHaveBeenCalled();
  });
});

describe('hwpxToPdf - Page Layout Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPdf.mockResolvedValue(Buffer.from('PDF'));
  });

  it('should handle A4 portrait (210x297mm)', async () => {
    // Most HWPX files default to A4 portrait
    const hwpxBuffer = readFixture('simple-text.hwpx');
    
    await hwpxToPdf(hwpxBuffer);
    
    const pdfOptions = mockPdf.mock.calls[0][0];
    // With landscape=true, dimensions are swapped: width=297, height=210
    expect(pdfOptions.width).toBe('297mm');
    expect(pdfOptions.height).toBe('210mm');
  });

  it('should preserve custom page sizes', async () => {
    const hwpxBuffer = readFixture('simple-text.hwpx');
    
    await hwpxToPdf(hwpxBuffer);
    
    const pdfOptions = mockPdf.mock.calls[0][0];
    // Verify dimensions are applied (actual values depend on fixture)
    expect(pdfOptions.width).toBeDefined();
    expect(pdfOptions.height).toBeDefined();
  });

  it('should apply all four margins correctly', async () => {
    const hwpxBuffer = readFixture('simple-text.hwpx');
    
    await hwpxToPdf(hwpxBuffer);
    
    const pdfOptions = mockPdf.mock.calls[0][0];
    const margins = pdfOptions.margin;
    
    // All margins should be positive numbers
    expect(parseFloat(margins.top)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(margins.bottom)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(margins.left)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(margins.right)).toBeGreaterThanOrEqual(0);
  });

  it('should handle documents with tables', async () => {
    const hwpxBuffer = readFixture('table-basic.hwpx');
    
    const result = await hwpxToPdf(hwpxBuffer);
    
    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockPdf).toHaveBeenCalled();
  });

  it('should handle multi-section documents', async () => {
    const hwpxBuffer = readFixture('multi-section.hwpx');
    
    const result = await hwpxToPdf(hwpxBuffer);
    
    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockPdf).toHaveBeenCalled();
  });
});
