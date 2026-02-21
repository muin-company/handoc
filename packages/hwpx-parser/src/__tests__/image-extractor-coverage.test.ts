/**
 * Additional image-extractor tests for guessMimeType coverage.
 */
import { describe, it, expect } from 'vitest';
import { extractImages } from '../image-extractor';

// Create a mock OpcPackage to test extractImages with BinData entries
function mockPkg(parts: Record<string, Uint8Array>) {
  return {
    partNames: () => Object.keys(parts),
    getPart: (name: string) => parts[name] ?? new Uint8Array(0),
  } as any;
}

describe('extractImages - mime type detection', () => {
  it('detects .png mime type', () => {
    const pkg = mockPkg({ 'BinData/img.png': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe('image/png');
  });

  it('detects .jpg mime type', () => {
    const pkg = mockPkg({ 'BinData/img.jpg': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('image/jpeg');
  });

  it('detects .jpeg mime type', () => {
    const pkg = mockPkg({ 'BinData/img.jpeg': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('image/jpeg');
  });

  it('detects .gif mime type', () => {
    const pkg = mockPkg({ 'BinData/img.gif': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('image/gif');
  });

  it('detects .bmp mime type', () => {
    const pkg = mockPkg({ 'BinData/img.bmp': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('image/bmp');
  });

  it('detects .emf mime type', () => {
    const pkg = mockPkg({ 'BinData/img.emf': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('image/x-emf');
  });

  it('detects .wmf mime type', () => {
    const pkg = mockPkg({ 'BinData/img.wmf': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('image/x-wmf');
  });

  it('detects .tif mime type', () => {
    const pkg = mockPkg({ 'BinData/img.tif': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('image/tiff');
  });

  it('detects .tiff mime type', () => {
    const pkg = mockPkg({ 'BinData/img.tiff': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('image/tiff');
  });

  it('detects .svg mime type', () => {
    const pkg = mockPkg({ 'BinData/img.svg': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('image/svg+xml');
  });

  it('returns octet-stream for unknown extension', () => {
    const pkg = mockPkg({ 'BinData/file.xyz': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('application/octet-stream');
  });

  it('returns octet-stream for no extension', () => {
    const pkg = mockPkg({ 'BinData/noext': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images[0].mimeType).toBe('application/octet-stream');
  });

  it('handles Contents/BinData/ prefix', () => {
    const pkg = mockPkg({ 'Contents/BinData/img.png': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images).toHaveLength(1);
    expect(images[0].path).toBe('Contents/BinData/img.png');
  });

  it('skips non-BinData parts', () => {
    const pkg = mockPkg({
      'Contents/header.xml': new Uint8Array([1]),
      'BinData/img.png': new Uint8Array([2]),
    });
    const images = extractImages(pkg);
    expect(images).toHaveLength(1);
  });

  it('returns empty for no BinData entries', () => {
    const pkg = mockPkg({ 'Contents/header.xml': new Uint8Array([1]) });
    const images = extractImages(pkg);
    expect(images).toHaveLength(0);
  });
});
