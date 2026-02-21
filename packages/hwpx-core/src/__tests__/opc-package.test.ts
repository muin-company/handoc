import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { OpcPackage } from '../opc-package';

const FIXTURES_DIR = join(__dirname, '../../../../fixtures/hwpx');
const fixture = readFileSync(`${FIXTURES_DIR}/simple-text.hwpx`);

describe('OpcPackage', () => {
  it('opens simple-text.hwpx and lists parts', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    const names = pkg.partNames();
    expect(names).toContain('Contents/content.hpf');
    expect(names).toContain('Contents/section0.xml');
    expect(names).toContain('Contents/header.xml');
    expect(names).toContain('mimetype');
  });

  it('getSectionPaths returns section paths', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    expect(pkg.getSectionPaths()).toEqual(['Contents/section0.xml']);
  });

  it('getHeaderPaths returns header paths', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    expect(pkg.getHeaderPaths()).toEqual(['Contents/header.xml']);
  });

  it('getPartAsText returns XML string', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    const xml = pkg.getPartAsText('Contents/section0.xml');
    expect(xml).toContain('<?xml');
  });

  it('getMetadata returns metadata', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    const meta = pkg.getMetadata();
    expect(meta.language).toBe('ko');
    expect(meta.creator).toBe('kokyu');
  });

  it('round-trip: open -> save -> open -> same partNames', async () => {
    const pkg1 = await OpcPackage.open(new Uint8Array(fixture));
    const saved = await pkg1.save();
    const pkg2 = await OpcPackage.open(saved);
    expect(pkg2.partNames()).toEqual(pkg1.partNames());
  });

  it('throws on invalid input', async () => {
    await expect(OpcPackage.open(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });

  it('opens all 5 fixture HWPX files', async () => {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.hwpx'));
    expect(files.length).toBe(5);
    for (const file of files) {
      const data = readFileSync(`${FIXTURES_DIR}/${file}`);
      const pkg = await OpcPackage.open(new Uint8Array(data));
      expect(pkg.partNames().length).toBeGreaterThan(0);
      expect(pkg.hasPart('Contents/content.hpf')).toBe(true);
    }
  });

  it('setPart adds or updates a part', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    const initialCount = pkg.partNames().length;

    // Add new part with string
    pkg.setPart('test/new.txt', 'Hello World');
    expect(pkg.hasPart('test/new.txt')).toBe(true);
    expect(pkg.getPartAsText('test/new.txt')).toBe('Hello World');
    expect(pkg.partNames().length).toBe(initialCount + 1);

    // Update existing part with Uint8Array
    const data = new Uint8Array([72, 105]); // "Hi"
    pkg.setPart('test/new.txt', data);
    expect(pkg.getPartAsText('test/new.txt')).toBe('Hi');
    expect(pkg.partNames().length).toBe(initialCount + 1);
  });

  it('setPart updates manifest when setting content.hpf', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    const newManifest = `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0">
  <opf:metadata>
    <opf:language>en</opf:language>
    <opf:title>New Title</opf:title>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`;

    pkg.setPart('Contents/content.hpf', newManifest);
    const meta = pkg.getMetadata();
    expect(meta.language).toBe('en');
    expect(meta.title).toBe('New Title');
  });

  it('deletePart removes a part', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    const initialCount = pkg.partNames().length;

    pkg.setPart('test/delete-me.txt', 'To be deleted');
    expect(pkg.hasPart('test/delete-me.txt')).toBe(true);
    expect(pkg.partNames().length).toBe(initialCount + 1);

    pkg.deletePart('test/delete-me.txt');
    expect(pkg.hasPart('test/delete-me.txt')).toBe(false);
    expect(pkg.partNames().length).toBe(initialCount);
  });

  it('getPart throws when part not found', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    expect(() => pkg.getPart('nonexistent/part.xml')).toThrow('Part not found');
  });

  it('getPartAsText throws when part not found', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    expect(() => pkg.getPartAsText('nonexistent/part.xml')).toThrow('Part not found');
  });

  it('can save and re-open a modified package', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    pkg.setPart('custom/data.txt', 'Custom content');
    pkg.deletePart('Contents/header.xml');
    
    const saved = await pkg.save();
    const reopened = await OpcPackage.open(saved);
    
    expect(reopened.hasPart('custom/data.txt')).toBe(true);
    expect(reopened.getPartAsText('custom/data.txt')).toBe('Custom content');
    expect(reopened.hasPart('Contents/header.xml')).toBe(false);
  });
});
