#!/usr/bin/env npx tsx
/**
 * HanDoc Integration Test - Tests all implemented features against all HWPX files.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HanDoc, parseTable, tableToTextGrid } from '../packages/hwpx-parser/src/index';

// ── Helpers ──

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...findFiles(full, ext));
    else if (entry.endsWith(ext)) results.push(full);
  }
  return results;
}

interface Counter {
  success: number;
  fail: number;
  errors: string[];
}

function counter(): Counter {
  return { success: 0, fail: 0, errors: [] };
}

function record(c: Counter, ok: boolean, errMsg?: string) {
  if (ok) c.success++;
  else {
    c.fail++;
    if (errMsg) c.errors.push(errMsg);
  }
}

// ── Main ──

async function main() {
  const fixturesDir = '/Users/mj/handoc-fixtures';
  const localFixtures = '/Users/mj/handoc/fixtures';

  // Collect all HWPX files
  const hwpxFiles = [
    ...findFiles(fixturesDir, '.hwpx'),
    ...findFiles(localFixtures, '.hwpx'),
  ];

  console.log(`Found ${hwpxFiles.length} HWPX files\n`);

  const stats = {
    open: counter(),
    extractText: counter(),
    sections: counter(),
    header: counter(),
    metadata: counter(),
    pageSize: counter(),
    margins: counter(),
    images: counter(),
    parseTable: counter(),
    headersFooters: counter(),
  };

  let totalTables = 0;
  let totalImages = 0;
  let totalHeaders = 0;
  let totalFooters = 0;

  for (const file of hwpxFiles) {
    const shortName = relative(fixturesDir, file).startsWith('..')
      ? relative(localFixtures, file)
      : relative(fixturesDir, file);

    // a. open
    let doc: HanDoc;
    try {
      const buf = readFileSync(file);
      doc = await HanDoc.open(buf);
      record(stats.open, true);
    } catch (e: any) {
      record(stats.open, false, `${shortName}: ${e.message}`);
      continue; // can't test further
    }

    // b. extractText
    try {
      const text = doc.extractText();
      record(stats.extractText, true);
    } catch (e: any) {
      record(stats.extractText, false, `${shortName}: ${e.message}`);
    }

    // c. sections
    try {
      const secs = doc.sections;
      record(stats.sections, secs.length > 0);
      if (secs.length === 0) stats.sections.errors.push(`${shortName}: 0 sections`);
    } catch (e: any) {
      record(stats.sections, false, `${shortName}: ${e.message}`);
    }

    // c. header
    try {
      const h = doc.header;
      record(stats.header, !!h);
    } catch (e: any) {
      record(stats.header, false, `${shortName}: ${e.message}`);
    }

    // c. metadata
    try {
      const m = doc.metadata;
      record(stats.metadata, true);
    } catch (e: any) {
      record(stats.metadata, false, `${shortName}: ${e.message}`);
    }

    // d. pageSize
    try {
      const ps = doc.pageSize;
      record(stats.pageSize, ps.width > 0 && ps.height > 0);
    } catch (e: any) {
      record(stats.pageSize, false, `${shortName}: ${e.message}`);
    }

    // d. margins
    try {
      const m = doc.margins;
      record(stats.margins, true);
    } catch (e: any) {
      record(stats.margins, false, `${shortName}: ${e.message}`);
    }

    // e. images
    try {
      const imgs = doc.images;
      totalImages += imgs.length;
      record(stats.images, true);
    } catch (e: any) {
      record(stats.images, false, `${shortName}: ${e.message}`);
    }

    // f. tables - find table elements in sections and parse them
    try {
      let fileHasTables = false;
      for (const sec of doc.sections) {
        for (const para of sec.paragraphs) {
          const runs = (para as any).runs ?? [];
          for (const run of runs) {
            const children = run.children ?? [];
            for (const child of children) {
              if (child.type === 'table') {
                fileHasTables = true;
                totalTables++;
                const parsed = parseTable(child.element);
                tableToTextGrid(parsed);
              }
            }
          }
        }
      }
      record(stats.parseTable, true);
    } catch (e: any) {
      record(stats.parseTable, false, `${shortName}: ${e.message}`);
    }

    // g. headers/footers
    try {
      const hdrs = doc.headers;
      const ftrs = doc.footers;
      totalHeaders += hdrs.length;
      totalFooters += ftrs.length;
      record(stats.headersFooters, true);
    } catch (e: any) {
      record(stats.headersFooters, false, `${shortName}: ${e.message}`);
    }
  }

  // ── HWP test ──
  let hwpResults = '';
  try {
    const { readHwp } = await import('../packages/hwp-reader/src/index');
    const hwpFiles = findFiles(join(fixturesDir, 'real-world/education'), '.hwp')
      .filter(f => !f.endsWith('.hwpx'));

    if (hwpFiles.length > 0) {
      hwpResults = `\n## HWP Files (hwp-reader)\n\n`;
      hwpResults += `Found ${hwpFiles.length} HWP files\n\n`;
      let hwpOk = 0, hwpFail = 0;
      for (const f of hwpFiles) {
        try {
          const buf = readFileSync(f);
          const doc = readHwp(buf);
          hwpOk++;
          hwpResults += `- ✅ ${relative(fixturesDir, f)}: v${doc.fileHeader.version.major}.${doc.fileHeader.version.minor}, compressed=${doc.fileHeader.compressed}, sections=${doc.sections.length}\n`;
        } catch (e: any) {
          hwpFail++;
          hwpResults += `- ❌ ${relative(fixturesDir, f)}: ${e.message}\n`;
        }
      }
      hwpResults += `\n**HWP: ${hwpOk} success, ${hwpFail} fail**\n`;
    } else {
      hwpResults = '\n## HWP Files\n\nNo .hwp files found in education folder.\n';
    }
  } catch (e: any) {
    hwpResults = `\n## HWP Files\n\nhwp-reader not available: ${e.message}\n`;
  }

  // ── Report ──
  const total = hwpxFiles.length;
  const lines = [
    `# HanDoc Integration Test Results`,
    ``,
    `**Date:** ${new Date().toISOString()}`,
    `**HWPX files tested:** ${total}`,
    ``,
    `## Summary`,
    ``,
    `| Feature | ✅ Success | ❌ Fail | Rate |`,
    `|---------|-----------|---------|------|`,
  ];

  for (const [name, c] of Object.entries(stats)) {
    const rate = c.success + c.fail > 0
      ? ((c.success / (c.success + c.fail)) * 100).toFixed(1) + '%'
      : 'N/A';
    lines.push(`| ${name} | ${c.success} | ${c.fail} | ${rate} |`);
  }

  lines.push('');
  lines.push(`## Totals`);
  lines.push(`- Tables found: ${totalTables}`);
  lines.push(`- Images found: ${totalImages}`);
  lines.push(`- Headers found: ${totalHeaders}`);
  lines.push(`- Footers found: ${totalFooters}`);

  // Error details
  const allErrors = Object.entries(stats)
    .filter(([, c]) => c.errors.length > 0);

  if (allErrors.length > 0) {
    lines.push('');
    lines.push('## Error Details');
    for (const [name, c] of allErrors) {
      lines.push(`\n### ${name} (${c.errors.length} errors)`);
      for (const err of c.errors.slice(0, 20)) {
        lines.push(`- ${err}`);
      }
      if (c.errors.length > 20) {
        lines.push(`- ... and ${c.errors.length - 20} more`);
      }
    }
  }

  lines.push(hwpResults);

  const report = lines.join('\n');
  console.log(report);

  const outPath = '/Users/mj/handoc/docs/integration-test-results.md';
  writeFileSync(outPath, report);
  console.log(`\nResults saved to ${outPath}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
