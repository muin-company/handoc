/**
 * Tests for extraParts handling, including BinData files
 * to improve coverage of index.ts
 */

import { describe, it, expect } from 'vitest';
import { writeHwpx } from '../index';
import { OpcPackage } from '@handoc/hwpx-core';

const createMinimalHeader = () => ({
  version: '1.5' as const,
  secCnt: 1,
  beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
  refList: {
    fontFaces: [],
    borderFills: [],
    charProperties: [],
    paraProperties: [],
    styles: [],
    others: [],
  },
});

const createMinimalSection = () => ({
  paragraphs: [{
    id: '1',
    paraPrIDRef: 0,
    styleIDRef: 0,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs: [{
      charPrIDRef: 0,
      children: [{ type: 'text' as const, content: 'Test' }],
    }],
    lineSegArray: [],
  }],
});

describe('extraParts with BinData files', () => {
  it('should handle PNG images in BinData', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    const pngData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG signature
    extraParts.set('BinData/0001.png', pngData);

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    expect(pkg.hasPart('Contents/BinData/0001.png')).toBe(true);
    const retrieved = pkg.getPart('Contents/BinData/0001.png');
    expect(retrieved).toEqual(pngData);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('BinData/0001.png');
    expect(manifest).toContain('image/png');
  });

  it('should handle JPG images in BinData', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    const jpgData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG signature
    extraParts.set('BinData/image.jpg', jpgData);

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    expect(pkg.hasPart('Contents/BinData/image.jpg')).toBe(true);
    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('BinData/image.jpg');
    expect(manifest).toContain('image/jpeg');
  });

  it('should handle JPEG extension', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('BinData/photo.jpeg', new Uint8Array([0xFF, 0xD8]));

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('BinData/photo.jpeg');
    expect(manifest).toContain('image/jpeg');
  });

  it('should handle GIF images in BinData', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('BinData/anim.gif', new Uint8Array([0x47, 0x49, 0x46]));

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('BinData/anim.gif');
    expect(manifest).toContain('image/gif');
  });

  it('should handle BMP images in BinData', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('BinData/bitmap.bmp', new Uint8Array([0x42, 0x4D]));

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('BinData/bitmap.bmp');
    expect(manifest).toContain('image/bmp');
  });

  it('should handle TIFF images in BinData', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('BinData/scan.tiff', new Uint8Array([0x49, 0x49]));

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('BinData/scan.tiff');
    expect(manifest).toContain('image/tiff');
  });

  it('should handle unknown file extension with default MIME type', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('BinData/file.xyz', new Uint8Array([0x00, 0x01, 0x02]));

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('BinData/file.xyz');
    expect(manifest).toContain('application/octet-stream');
  });

  it('should handle file without extension', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('BinData/noext', new Uint8Array([0xAB, 0xCD]));

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('BinData/noext');
    expect(manifest).toContain('application/octet-stream');
  });

  it('should handle multiple BinData files', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('BinData/img1.png', new Uint8Array([0x89, 0x50]));
    extraParts.set('BinData/img2.jpg', new Uint8Array([0xFF, 0xD8]));
    extraParts.set('BinData/img3.gif', new Uint8Array([0x47, 0x49]));

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    expect(pkg.hasPart('Contents/BinData/img1.png')).toBe(true);
    expect(pkg.hasPart('Contents/BinData/img2.jpg')).toBe(true);
    expect(pkg.hasPart('Contents/BinData/img3.gif')).toBe(true);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('image/png');
    expect(manifest).toContain('image/jpeg');
    expect(manifest).toContain('image/gif');
  });

  it('should handle string content in extraParts', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('Custom/notes.txt', 'Some notes here');

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    expect(pkg.hasPart('Custom/notes.txt')).toBe(true);
    expect(pkg.getPartAsText('Custom/notes.txt')).toBe('Some notes here');
  });

  it('should handle non-BinData files (custom parts)', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('Scripts/main.js', 'console.log("test");');
    extraParts.set('Metadata/author.xml', '<author>Test Author</author>');

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    expect(pkg.hasPart('Scripts/main.js')).toBe(true);
    expect(pkg.hasPart('Metadata/author.xml')).toBe(true);
    expect(pkg.getPartAsText('Scripts/main.js')).toBe('console.log("test");');
    expect(pkg.getPartAsText('Metadata/author.xml')).toBe('<author>Test Author</author>');

    // Non-BinData files should NOT appear in manifest
    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).not.toContain('Scripts/main.js');
    expect(manifest).not.toContain('Metadata/author.xml');
  });

  it('should handle mixed BinData and non-BinData files', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    extraParts.set('BinData/logo.png', new Uint8Array([0x89, 0x50]));
    extraParts.set('Custom/data.json', '{"key":"value"}');

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    expect(pkg.hasPart('Contents/BinData/logo.png')).toBe(true);
    expect(pkg.hasPart('Custom/data.json')).toBe(true);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('BinData/logo.png');
    expect(manifest).not.toContain('Custom/data.json');
  });

  it('should sanitize part IDs in manifest', async () => {
    const extraParts = new Map<string, Uint8Array | string>();
    // Name with special characters that need sanitization
    extraParts.set('BinData/img-001.png', new Uint8Array([0x89, 0x50]));
    extraParts.set('BinData/file@2x.jpg', new Uint8Array([0xFF, 0xD8]));

    const doc = {
      header: createMinimalHeader(),
      sections: [createMinimalSection()],
      extraParts,
    };

    const zipBytes = writeHwpx(doc);
    const pkg = await OpcPackage.open(zipBytes);

    const manifest = pkg.getPartAsText('Contents/content.hpf');
    // Check that IDs are sanitized (special chars replaced with _)
    expect(manifest).toContain('id="BinData_img_001_png"');
    expect(manifest).toContain('id="BinData_file_2x_jpg"');
  });
});
