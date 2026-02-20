/**
 * Full Corpus Test — 349 HWPX + 221 HWP
 * Validates all real-world documents through HanDoc processing pipeline.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, relative, basename } from 'path';
import { HanDoc } from '../packages/hwpx-parser/src/index';
import { parseTable } from '../packages/hwpx-parser/src/table-parser';
import { writeHwpx, type OpcPackageLike } from '../packages/hwpx-writer/src/index';
import { readHwp, extractTextFromHwp, convertHwpToHwpx } from '../packages/hwp-reader/src/index';
import type { Section, Paragraph, RunChild } from '../packages/document-model/src/index';

const FIXTURES_DIR = process.env.HANDOC_FIXTURES_DIR;
if (!FIXTURES_DIR) { console.error('HANDOC_FIXTURES_DIR not set'); process.exit(1); }

const REAL_WORLD = join(FIXTURES_DIR, 'real-world');
const HWP_DIR = join(FIXTURES_DIR, 'real-world', 'education-hwp');
const TIMEOUT_MS = 10_000;

// ── Helpers ──

function findFiles(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    try {
      const st = statSync(full);
      if (st.isDirectory()) out.push(...findFiles(full, ext));
      else if (e.endsWith(ext)) out.push(full);
    } catch { /* skip */ }
  }
  return out.sort();
}

function countTables(sections: Section[]): number {
  let n = 0;
  function walk(children: RunChild[]) {
    for (const c of children) {
      if (c.type === 'table') n++;
      if ('element' in c && (c as any).element?.children) {
        // recurse into generic elements that might contain tables
      }
    }
  }
  for (const sec of sections) {
    for (const para of sec.paragraphs) {
      walk(para.children);
    }
  }
  return n;
}

async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
}

// ── HWPX Test ──

interface HwpxResult {
  file: string;
  open: boolean;
  text: boolean;
  textLines: number;
  sections: number;
  hasHeader: boolean;
  hasMetadata: boolean;
  pageSize: string;
  margins: string;
  images: number;
  tables: number;
  headers: number;
  footers: number;
  roundtrip: boolean;
  roundtripTextMatch: boolean;
  error?: string;
}

async function testHwpx(filePath: string): Promise<HwpxResult> {
  const rel = relative(REAL_WORLD, filePath);
  const r: HwpxResult = {
    file: rel, open: false, text: false, textLines: 0,
    sections: 0, hasHeader: false, hasMetadata: false,
    pageSize: '', margins: '', images: 0, tables: 0,
    headers: 0, footers: 0, roundtrip: false, roundtripTextMatch: false,
  };

  try {
    const buf = readFileSync(filePath);
    const doc = await withTimeout(() => HanDoc.open(new Uint8Array(buf)), TIMEOUT_MS);
    r.open = true;

    // text
    try {
      const txt = doc.extractText();
      r.text = true;
      r.textLines = txt.split('\n').filter(l => l.trim()).length;
    } catch (e: any) { r.error = `extractText: ${e.message}`; }

    // sections
    try { r.sections = doc.sections.length; } catch {}

    // header
    try { r.hasHeader = !!doc.header; } catch {}

    // metadata
    try { r.hasMetadata = !!doc.metadata; } catch {}

    // pageSize
    try { const ps = doc.pageSize; r.pageSize = `${ps.width}x${ps.height}`; } catch {}

    // margins
    try { const m = doc.margins; r.margins = `L${m.left}/R${m.right}/T${m.top}/B${m.bottom}`; } catch {}

    // images
    try { r.images = doc.images.length; } catch {}

    // tables
    try { r.tables = countTables(doc.sections); } catch {}

    // headers/footers
    try { r.headers = doc.headers.length; } catch {}
    try { r.footers = doc.footers.length; } catch {}

    // roundtrip
    try {
      const hwpxDoc = { header: doc.header, sections: doc.sections };
      const opcPkg = doc.opcPackage as unknown as OpcPackageLike;
      const written = writeHwpx(hwpxDoc, opcPkg);
      r.roundtrip = written.length > 0;

      // reopen and compare text
      if (r.roundtrip) {
        const doc2 = await HanDoc.open(written);
        const txt2 = doc2.extractText();
        const txt1 = doc.extractText();
        r.roundtripTextMatch = txt1 === txt2;
      }
    } catch (e: any) {
      r.error = (r.error ? r.error + '; ' : '') + `roundtrip: ${e.message}`;
    }

  } catch (e: any) {
    r.error = e.message;
  }

  return r;
}

// ── HWP Test ──

interface HwpResult {
  file: string;
  read: boolean;
  version: string;
  encrypted: boolean;
  text: boolean;
  textLines: number;
  convertToHwpx: boolean;
  hwpxOpen: boolean;
  error?: string;
}

async function testHwp(filePath: string): Promise<HwpResult> {
  const rel = relative(HWP_DIR, filePath);
  const r: HwpResult = {
    file: rel, read: false, version: '', encrypted: false,
    text: false, textLines: 0, convertToHwpx: false, hwpxOpen: false,
  };

  try {
    const buf = readFileSync(filePath);
    const u8 = new Uint8Array(buf);

    // readHwp
    let hwpDoc;
    try {
      hwpDoc = readHwp(u8);
      r.read = true;
      r.version = `${hwpDoc.fileHeader.version.major}.${hwpDoc.fileHeader.version.minor}.${hwpDoc.fileHeader.version.build}.${hwpDoc.fileHeader.version.revision}`;
      r.encrypted = hwpDoc.fileHeader.encrypted;
    } catch (e: any) {
      r.error = `readHwp: ${e.message}`;
      // Check if it's encrypted
      if (e.message?.includes('encrypt') || e.message?.includes('password')) {
        r.encrypted = true;
        r.error = 'encrypted';
      }
      return r;
    }

    if (r.encrypted) {
      r.error = 'encrypted (skipped)';
      return r;
    }

    // extractText
    try {
      const txt = extractTextFromHwp(u8);
      r.text = true;
      r.textLines = txt.split('\n').filter(l => l.trim()).length;
    } catch (e: any) {
      r.error = `extractText: ${e.message}`;
    }

    // convertHwpToHwpx
    try {
      const hwpxBuf = await withTimeout(() => Promise.resolve(convertHwpToHwpx(u8)), TIMEOUT_MS);
      r.convertToHwpx = hwpxBuf.length > 0;

      // open converted
      try {
        const doc = await HanDoc.open(hwpxBuf);
        r.hwpxOpen = true;
      } catch (e: any) {
        r.error = (r.error ? r.error + '; ' : '') + `hwpxOpen: ${e.message}`;
      }
    } catch (e: any) {
      r.error = (r.error ? r.error + '; ' : '') + `convert: ${e.message}`;
    }

  } catch (e: any) {
    r.error = e.message;
  }

  return r;
}

// ── Main ──

async function main() {
  console.log('🔍 HanDoc Full Corpus Test');
  console.log('='.repeat(60));

  // HWPX
  const hwpxFiles = findFiles(REAL_WORLD, '.hwpx');
  console.log(`\n📄 HWPX files: ${hwpxFiles.length}`);
  const hwpxResults: HwpxResult[] = [];
  for (let i = 0; i < hwpxFiles.length; i++) {
    if ((i + 1) % 50 === 0 || i === 0) process.stdout.write(`  [${i + 1}/${hwpxFiles.length}] ${basename(hwpxFiles[i]).slice(0, 40)}...\n`);
    hwpxResults.push(await testHwpx(hwpxFiles[i]));
  }

  // HWP
  const hwpFiles = findFiles(HWP_DIR, '.hwp');
  console.log(`\n📄 HWP files: ${hwpFiles.length}`);
  const hwpResults: HwpResult[] = [];
  for (let i = 0; i < hwpFiles.length; i++) {
    if ((i + 1) % 50 === 0 || i === 0) process.stdout.write(`  [${i + 1}/${hwpFiles.length}] ${basename(hwpFiles[i]).slice(0, 40)}...\n`);
    hwpResults.push(await testHwp(hwpFiles[i]));
  }

  // ── Generate Report ──
  const lines: string[] = [];
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  lines.push(`# HanDoc Full Corpus Test Results`);
  lines.push(`\nGenerated: ${ts}\n`);

  // HWPX Summary
  const hxTotal = hwpxResults.length;
  const hxOpen = hwpxResults.filter(r => r.open).length;
  const hxText = hwpxResults.filter(r => r.text).length;
  const hxZeroText = hwpxResults.filter(r => r.text && r.textLines === 0).length;
  const hxRoundtrip = hwpxResults.filter(r => r.roundtrip).length;
  const hxRtMatch = hwpxResults.filter(r => r.roundtripTextMatch).length;
  const hxTotalImages = hwpxResults.reduce((s, r) => s + r.images, 0);
  const hxTotalTables = hwpxResults.reduce((s, r) => s + r.tables, 0);
  const hxTotalHeaders = hwpxResults.reduce((s, r) => s + r.headers, 0);
  const hxTotalFooters = hwpxResults.reduce((s, r) => s + r.footers, 0);

  lines.push(`## HWPX (${hxTotal} files)\n`);
  lines.push(`| Metric | Count | Rate |`);
  lines.push(`|--------|-------|------|`);
  lines.push(`| HanDoc.open() | ${hxOpen} | ${pct(hxOpen, hxTotal)} |`);
  lines.push(`| extractText() | ${hxText} | ${pct(hxText, hxTotal)} |`);
  lines.push(`| Zero-text files | ${hxZeroText} | ${pct(hxZeroText, hxTotal)} |`);
  lines.push(`| writeHwpx() roundtrip | ${hxRoundtrip} | ${pct(hxRoundtrip, hxTotal)} |`);
  lines.push(`| Roundtrip text match | ${hxRtMatch} | ${pct(hxRtMatch, hxTotal)} |`);
  lines.push(`| Total images | ${hxTotalImages} | — |`);
  lines.push(`| Total tables | ${hxTotalTables} | — |`);
  lines.push(`| Total headers | ${hxTotalHeaders} | — |`);
  lines.push(`| Total footers | ${hxTotalFooters} | — |`);

  // HWPX Failures
  const hxFails = hwpxResults.filter(r => !r.open || r.error);
  if (hxFails.length > 0) {
    lines.push(`\n### HWPX Failures (${hxFails.length})\n`);
    lines.push(`| File | Open | Error |`);
    lines.push(`|------|------|-------|`);
    for (const f of hxFails) {
      lines.push(`| ${f.file} | ${f.open ? '✅' : '❌'} | ${f.error?.slice(0, 100) || ''} |`);
    }
  }

  // HWPX zero-text detail
  const hxZeros = hwpxResults.filter(r => r.text && r.textLines === 0);
  if (hxZeros.length > 0) {
    lines.push(`\n### HWPX Zero-Text Files (${hxZeros.length})\n`);
    for (const f of hxZeros) lines.push(`- ${f.file}`);
  }

  // Roundtrip mismatches
  const hxRtMismatch = hwpxResults.filter(r => r.roundtrip && !r.roundtripTextMatch);
  if (hxRtMismatch.length > 0) {
    lines.push(`\n### HWPX Roundtrip Text Mismatches (${hxRtMismatch.length})\n`);
    for (const f of hxRtMismatch) lines.push(`- ${f.file}`);
  }

  // HWP Summary
  const hwTotal = hwpResults.length;
  const hwRead = hwpResults.filter(r => r.read).length;
  const hwEncrypted = hwpResults.filter(r => r.encrypted).length;
  const hwText = hwpResults.filter(r => r.text).length;
  const hwZeroText = hwpResults.filter(r => r.text && r.textLines === 0).length;
  const hwConvert = hwpResults.filter(r => r.convertToHwpx).length;
  const hwHwpxOpen = hwpResults.filter(r => r.hwpxOpen).length;
  const hwNonEncrypted = hwTotal - hwEncrypted;

  lines.push(`\n## HWP (${hwTotal} files, ${hwEncrypted} encrypted)\n`);
  lines.push(`| Metric | Count | Rate (non-encrypted) |`);
  lines.push(`|--------|-------|---------------------|`);
  lines.push(`| readHwp() | ${hwRead} | ${pct(hwRead, hwNonEncrypted)} |`);
  lines.push(`| Encrypted | ${hwEncrypted} | ${pct(hwEncrypted, hwTotal)} of total |`);
  lines.push(`| extractText() | ${hwText} | ${pct(hwText, hwNonEncrypted)} |`);
  lines.push(`| Zero-text files | ${hwZeroText} | — |`);
  lines.push(`| convertHwpToHwpx() | ${hwConvert} | ${pct(hwConvert, hwNonEncrypted)} |`);
  lines.push(`| Converted → HanDoc.open() | ${hwHwpxOpen} | ${pct(hwHwpxOpen, hwNonEncrypted)} |`);

  // HWP version distribution
  const versions = new Map<string, number>();
  for (const r of hwpResults) {
    if (r.version) versions.set(r.version, (versions.get(r.version) || 0) + 1);
  }
  if (versions.size > 0) {
    lines.push(`\n### HWP Version Distribution\n`);
    lines.push(`| Version | Count |`);
    lines.push(`|---------|-------|`);
    for (const [v, c] of [...versions.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${v} | ${c} |`);
    }
  }

  // HWP Failures
  const hwFails = hwpResults.filter(r => !r.read && !r.encrypted);
  if (hwFails.length > 0) {
    lines.push(`\n### HWP Failures (non-encrypted) (${hwFails.length})\n`);
    lines.push(`| File | Error |`);
    lines.push(`|------|-------|`);
    for (const f of hwFails) {
      lines.push(`| ${f.file} | ${f.error?.slice(0, 100) || ''} |`);
    }
  }

  // HWP conversion failures (read OK but convert failed)
  const hwConvFails = hwpResults.filter(r => r.read && !r.encrypted && !r.convertToHwpx);
  if (hwConvFails.length > 0) {
    lines.push(`\n### HWP Conversion Failures (${hwConvFails.length})\n`);
    lines.push(`| File | Version | Error |`);
    lines.push(`|------|---------|-------|`);
    for (const f of hwConvFails) {
      lines.push(`| ${f.file} | ${f.version} | ${f.error?.slice(0, 100) || ''} |`);
    }
  }

  // Overall
  lines.push(`\n## Overall Summary\n`);
  lines.push(`- **Total files:** ${hxTotal + hwTotal} (${hxTotal} HWPX + ${hwTotal} HWP)`);
  lines.push(`- **HWPX success rate:** ${pct(hxOpen, hxTotal)}`);
  lines.push(`- **HWP read rate:** ${pct(hwRead, hwNonEncrypted)} (excluding ${hwEncrypted} encrypted)`);
  lines.push(`- **HWP→HWPX conversion rate:** ${pct(hwConvert, hwNonEncrypted)}`);
  lines.push(`- **Roundtrip text match (HWPX):** ${pct(hxRtMatch, hxRoundtrip)} of roundtripped files`);

  // Write report
  mkdirSync(join(process.cwd(), 'docs'), { recursive: true });
  const reportPath = join(process.cwd(), 'docs', 'full-corpus-results.md');
  writeFileSync(reportPath, lines.join('\n') + '\n');
  console.log(`\n✅ Report written to ${reportPath}`);

  // Console summary
  console.log('\n' + '='.repeat(60));
  console.log(`HWPX: ${hxOpen}/${hxTotal} open (${pct(hxOpen, hxTotal)}), roundtrip: ${hxRoundtrip}, text-match: ${hxRtMatch}`);
  console.log(`HWP:  ${hwRead}/${hwTotal} read (${hwEncrypted} encrypted), convert: ${hwConvert}, hwpx-open: ${hwHwpxOpen}`);
}

function pct(n: number, total: number): string {
  if (total === 0) return 'N/A';
  return `${((n / total) * 100).toFixed(1)}%`;
}

main().catch(e => { console.error(e); process.exit(1); });
