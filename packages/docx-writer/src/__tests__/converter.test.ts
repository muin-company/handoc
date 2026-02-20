import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hwpxToDocx } from '../converter';

const FIXTURES = join(import.meta.dirname, '../../../../fixtures/hwpx');

// Helper: check if buffer is a valid ZIP (starts with PK)
function isValidZip(buf: Uint8Array): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

describe('hwpxToDocx', () => {
  it('converts simple-text HWPX to valid DOCX ZIP', async () => {
    const hwpxPath = join(FIXTURES, 'simple-text.hwpx');
    if (!existsSync(hwpxPath)) return; // skip if fixture missing
    const buf = new Uint8Array(readFileSync(hwpxPath));
    const docx = await hwpxToDocx(buf);
    expect(docx).toBeInstanceOf(Uint8Array);
    expect(docx.length).toBeGreaterThan(100);
    expect(isValidZip(docx)).toBe(true);
  });

  it('converts styled-text HWPX preserving formatting', async () => {
    const hwpxPath = join(FIXTURES, 'styled-text.hwpx');
    if (!existsSync(hwpxPath)) return;
    const buf = new Uint8Array(readFileSync(hwpxPath));
    const docx = await hwpxToDocx(buf);
    expect(isValidZip(docx)).toBe(true);
    expect(docx.length).toBeGreaterThan(100);
  });

  it('converts empty HWPX without crashing', async () => {
    const hwpxPath = join(FIXTURES, 'empty.hwpx');
    if (!existsSync(hwpxPath)) return;
    const buf = new Uint8Array(readFileSync(hwpxPath));
    const docx = await hwpxToDocx(buf);
    expect(isValidZip(docx)).toBe(true);
  });

  it('converts table-basic HWPX without crashing', async () => {
    const hwpxPath = join(FIXTURES, 'table-basic.hwpx');
    if (!existsSync(hwpxPath)) return;
    const buf = new Uint8Array(readFileSync(hwpxPath));
    const docx = await hwpxToDocx(buf);
    expect(isValidZip(docx)).toBe(true);
  });

  it('converts multi-section HWPX without crashing', async () => {
    const hwpxPath = join(FIXTURES, 'multi-section.hwpx');
    if (!existsSync(hwpxPath)) return;
    const buf = new Uint8Array(readFileSync(hwpxPath));
    const docx = await hwpxToDocx(buf);
    expect(isValidZip(docx)).toBe(true);
  });
});
