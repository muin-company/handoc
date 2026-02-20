import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { OpcPackage } from '../opc-package';

const FIXTURES_DIR = '/Users/mj/clawd/research/handoc-fixtures/hwpx';
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
});
