import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';

const CLI = resolve(__dirname, '../index.ts');
const FIXTURES = resolve(__dirname, '../../../../fixtures/hwpx');

function run(...args: string[]): string {
  return execFileSync('npx', ['tsx', CLI, ...args], {
    encoding: 'utf-8',
    cwd: resolve(__dirname, '../../../..'),
    timeout: 30_000,
  }).trim();
}

describe('handoc cli', () => {
  const simpleText = resolve(FIXTURES, 'simple-text.hwpx');
  const multiSection = resolve(FIXTURES, 'multi-section.hwpx');
  const tableBasic = resolve(FIXTURES, 'table-basic.hwpx');

  describe('info', () => {
    it('shows document info for simple-text', () => {
      const out = run('info', simpleText);
      expect(out).toContain('File:');
      expect(out).toContain('simple-text.hwpx');
      expect(out).toContain('Sections:');
      expect(out).toContain('Paragraphs:');
    });

    it('shows multiple sections', () => {
      if (!existsSync(multiSection)) return;
      const out = run('info', multiSection);
      expect(out).toContain('Sections:');
    });
  });

  describe('text', () => {
    it('extracts text from simple-text', () => {
      const out = run('text', simpleText);
      expect(out.length).toBeGreaterThan(0);
    });
  });

  describe('inspect', () => {
    it('lists parts', () => {
      const out = run('inspect', simpleText);
      expect(out).toContain('Parts');
      expect(out).toContain('Contents/');
    });

    it('shows specific part content', () => {
      const out = run('inspect', simpleText, '--part', 'mimetype');
      expect(out).toContain('hwp');
    });
  });

  describe('to-docx', () => {
    it('converts HWPX to DOCX', () => {
      const outPath = resolve(FIXTURES, 'simple-text.docx');
      try {
        const out = run('to-docx', simpleText, '-o', outPath);
        expect(out).toContain('Converted:');
        expect(existsSync(outPath)).toBe(true);
      } finally {
        if (existsSync(outPath)) unlinkSync(outPath);
      }
    });
  });

  describe('to-hwpx', () => {
    it('converts DOCX to HWPX', () => {
      // First create a DOCX from HWPX, then convert back
      const docxPath = resolve(FIXTURES, 'roundtrip.docx');
      const hwpxPath = resolve(FIXTURES, 'roundtrip.hwpx');
      try {
        run('to-docx', simpleText, '-o', docxPath);
        const out = run('to-hwpx', docxPath, '-o', hwpxPath);
        expect(out).toContain('Converted:');
        expect(existsSync(hwpxPath)).toBe(true);
      } finally {
        if (existsSync(docxPath)) unlinkSync(docxPath);
        if (existsSync(hwpxPath)) unlinkSync(hwpxPath);
      }
    });
  });

  describe('to-html', () => {
    it('converts HWPX to HTML', () => {
      const outPath = resolve(FIXTURES, 'simple-text.html');
      try {
        const out = run('to-html', simpleText, '-o', outPath);
        expect(out).toContain('Converted:');
        expect(existsSync(outPath)).toBe(true);
      } finally {
        if (existsSync(outPath)) unlinkSync(outPath);
      }
    });
  });

  describe('to-pdf', () => {
    it('converts HWPX to PDF (skipped without Playwright)', () => {
      let hasPlaywright = false;
      try {
        require.resolve('playwright');
        hasPlaywright = true;
      } catch { /* skip */ }
      if (!hasPlaywright) return;

      const outPath = resolve(FIXTURES, 'simple-text.pdf');
      try {
        const out = run('to-pdf', simpleText, '-o', outPath);
        expect(out).toContain('Converted:');
        expect(existsSync(outPath)).toBe(true);
      } finally {
        if (existsSync(outPath)) unlinkSync(outPath);
      }
    });
  });

  describe('help', () => {
    it('shows help', () => {
      const out = run('--help');
      expect(out).toContain('info');
      expect(out).toContain('text');
      expect(out).toContain('convert');
      expect(out).toContain('inspect');
      expect(out).toContain('to-docx');
      expect(out).toContain('to-hwpx');
      expect(out).toContain('to-pdf');
      expect(out).toContain('to-html');
    });
  });
});
