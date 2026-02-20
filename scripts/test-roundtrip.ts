/**
 * Roundtrip test: open HWPX → parse → writeHwpx → re-parse → compare
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { HanDoc } from '../packages/hwpx-parser/src/handoc';
import { extractText } from '../packages/hwpx-parser/src/section-parser';
import { writeHwpx } from '../packages/hwpx-writer/src/index';

const FIXTURES_DIR = process.env.HANDOC_FIXTURES_DIR
  ? join(process.env.HANDOC_FIXTURES_DIR, 'real-world')
  : join(__dirname, '..', 'fixtures');
const OUTPUT_PATH = join(__dirname, '..', 'docs', 'roundtrip-test-results.md');

interface TestResult {
  file: string;
  success: boolean;
  error?: string;
  diff?: string;
}

function findHwpxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...findHwpxFiles(full));
    } else if (entry.toLowerCase().endsWith('.hwpx')) {
      results.push(full);
    }
  }
  return results;
}

async function testFile(filePath: string): Promise<TestResult> {
  const rel = relative(FIXTURES_DIR, filePath);
  try {
    // 1. Open & parse original
    const buf = readFileSync(filePath);
    const doc1 = await HanDoc.open(new Uint8Array(buf));
    const text1 = doc1.extractText();
    const sectionCount1 = doc1.sections.length;
    const paraCount1 = doc1.sections.reduce((sum, s) => sum + s.paragraphs.length, 0);

    // 2. Write back to HWPX (pass original package to preserve custom parts)
    const hwpxBytes = writeHwpx({
      header: doc1.header,
      sections: doc1.sections,
    }, doc1.opcPackage);

    // 3. Re-open & re-parse
    const doc2 = await HanDoc.open(hwpxBytes);
    const text2 = doc2.extractText();
    const sectionCount2 = doc2.sections.length;
    const paraCount2 = doc2.sections.reduce((sum, s) => sum + s.paragraphs.length, 0);

    // 4. Compare
    const diffs: string[] = [];
    if (sectionCount1 !== sectionCount2) {
      diffs.push(`sections: ${sectionCount1} → ${sectionCount2}`);
    }
    if (paraCount1 !== paraCount2) {
      diffs.push(`paragraphs: ${paraCount1} → ${paraCount2}`);
    }
    if (text1 !== text2) {
      // Show first difference location
      const maxShow = 200;
      let diffIdx = -1;
      for (let i = 0; i < Math.max(text1.length, text2.length); i++) {
        if (text1[i] !== text2[i]) { diffIdx = i; break; }
      }
      const ctx1 = text1.substring(Math.max(0, diffIdx - 30), diffIdx + 50);
      const ctx2 = text2.substring(Math.max(0, diffIdx - 30), diffIdx + 50);
      diffs.push(`text differs at char ${diffIdx}: orig="${ctx1.slice(0, maxShow)}" vs round="${ctx2.slice(0, maxShow)}"`);
    }

    if (diffs.length === 0) {
      return { file: rel, success: true };
    } else {
      return { file: rel, success: false, diff: diffs.join('; ') };
    }
  } catch (e: any) {
    return { file: rel, success: false, error: e.message?.slice(0, 300) };
  }
}

async function main() {
  const files = findHwpxFiles(FIXTURES_DIR).sort();
  console.log(`Found ${files.length} HWPX files`);

  const results: TestResult[] = [];
  for (let i = 0; i < files.length; i++) {
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${files.length}...`);
    results.push(await testFile(files[i]));
  }

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  const errorFailures = failures.filter(r => r.error);
  const diffFailures = failures.filter(r => r.diff);

  // Categorize error patterns
  const errorPatterns: Record<string, string[]> = {};
  for (const f of errorFailures) {
    const key = f.error!.slice(0, 80);
    (errorPatterns[key] ??= []).push(f.file);
  }

  const diffPatterns: Record<string, string[]> = {};
  for (const f of diffFailures) {
    // Extract pattern type
    const parts = f.diff!.split(';').map(s => s.trim().replace(/:.*/, ''));
    const key = parts.join(' + ');
    (diffPatterns[key] ??= []).push(f.file);
  }

  // Generate report
  const rate = ((successes.length / files.length) * 100).toFixed(1);
  let md = `# Roundtrip Test Results\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total files | ${files.length} |\n`;
  md += `| ✅ Success | ${successes.length} |\n`;
  md += `| ❌ Failure | ${failures.length} |\n`;
  md += `| Success rate | ${rate}% |\n`;
  md += `| - Parse/write errors | ${errorFailures.length} |\n`;
  md += `| - Data mismatches | ${diffFailures.length} |\n\n`;

  if (Object.keys(errorPatterns).length > 0) {
    md += `## Error Patterns\n\n`;
    for (const [pattern, files] of Object.entries(errorPatterns).sort((a, b) => b[1].length - a[1].length)) {
      md += `### \`${pattern}\` (${files.length} files)\n\n`;
      md += files.slice(0, 10).map(f => `- ${f}`).join('\n') + '\n';
      if (files.length > 10) md += `- ... and ${files.length - 10} more\n`;
      md += '\n';
    }
  }

  if (Object.keys(diffPatterns).length > 0) {
    md += `## Data Mismatch Patterns\n\n`;
    for (const [pattern, files] of Object.entries(diffPatterns).sort((a, b) => b[1].length - a[1].length)) {
      md += `### ${pattern} (${files.length} files)\n\n`;
      md += files.slice(0, 5).map(f => `- ${f}`).join('\n') + '\n';
      if (files.length > 5) md += `- ... and ${files.length - 5} more\n`;
      md += '\n';
    }
  }

  if (diffFailures.length > 0) {
    md += `## Detailed Diff Failures (first 20)\n\n`;
    for (const f of diffFailures.slice(0, 20)) {
      md += `### ${f.file}\n\n\`${f.diff}\`\n\n`;
    }
  }

  writeFileSync(OUTPUT_PATH, md);
  console.log(`\n✅ ${successes.length}/${files.length} passed (${rate}%)`);
  console.log(`❌ ${failures.length} failed (${errorFailures.length} errors, ${diffFailures.length} mismatches)`);
  console.log(`Report: ${OUTPUT_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
