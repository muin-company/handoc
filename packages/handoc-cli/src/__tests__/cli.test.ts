import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

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

  describe('help', () => {
    it('shows help', () => {
      const out = run('--help');
      expect(out).toContain('info');
      expect(out).toContain('text');
      expect(out).toContain('convert');
      expect(out).toContain('inspect');
    });
  });
});
