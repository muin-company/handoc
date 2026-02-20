/**
 * Format Audit: 349개 실제 HWPX 문서에서 서식 요소 파싱 현황 검증
 *
 * Usage:
 *   HANDOC_FIXTURES_DIR=/path/to/fixtures npx tsx scripts/format-audit.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, extname } from 'path';
import { HanDoc } from '../packages/hwpx-parser/src/handoc';
import { writeHwpx } from '../packages/hwpx-writer/src/index';
import { extractText } from '../packages/hwpx-parser/src/section-parser';
import type { Section, Paragraph, Run, RunChild, GenericElement } from '../packages/hwpx-parser/src/types';
import type { CharProperty, ParaProperty, DocumentHeader } from '@handoc/document-model';

// ─── Config ──────────────────────────────────────────────────────────

const FIXTURES_DIR = process.env.HANDOC_FIXTURES_DIR
  ? join(process.env.HANDOC_FIXTURES_DIR, 'real-world')
  : '';
if (!FIXTURES_DIR) {
  console.error('HANDOC_FIXTURES_DIR not set');
  process.exit(1);
}

const AUDIT_OUTPUT = join(__dirname, '..', 'docs', 'format-audit-results.md');
const ROUNDTRIP_OUTPUT = join(__dirname, '..', 'docs', 'roundtrip-format-audit.md');

// ─── Helpers ─────────────────────────────────────────────────────────

function findHwpxFiles(dir: string): string[] {
  const { readdirSync, statSync } = require('fs');
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) results.push(...findHwpxFiles(full));
    else if (entry.toLowerCase().endsWith('.hwpx')) results.push(full);
  }
  return results;
}

// ─── Per-file stats ──────────────────────────────────────────────────

interface FileStats {
  file: string;
  error?: string;
  // char properties
  boldCount: number;
  italicCount: number;
  underlineCount: number;
  strikeoutCount: number;
  textColors: Set<string>;
  fontSizes: Set<number>;
  // para properties
  alignTypes: Set<string>;
  hasLineSpacing: boolean;
  hasHeading: boolean;
  headingLevels: Set<number>;
  // tables
  tableCount: number;
  mergedTableCount: number;
  // images
  imageCount: number;
  imageTypes: Map<string, number>;
  // annotations
  hasHeader: boolean;
  hasFooter: boolean;
  hasFootnote: boolean;
  hasEndnote: boolean;
  // equation
  equationCount: number;
  // shapes
  shapeCount: number;
}

function newStats(file: string): FileStats {
  return {
    file, boldCount: 0, italicCount: 0, underlineCount: 0, strikeoutCount: 0,
    textColors: new Set(), fontSizes: new Set(),
    alignTypes: new Set(), hasLineSpacing: false, hasHeading: false, headingLevels: new Set(),
    tableCount: 0, mergedTableCount: 0,
    imageCount: 0, imageTypes: new Map(),
    hasHeader: false, hasFooter: false, hasFootnote: false, hasEndnote: false,
    equationCount: 0, shapeCount: 0,
  };
}

function countGenericTag(el: GenericElement, tag: string): number {
  let count = 0;
  const local = el.tag.includes(':') ? el.tag.split(':').pop()! : el.tag;
  if (local === tag) count++;
  for (const c of el.children) count += countGenericTag(c, tag);
  return count;
}

function hasColSpanOrRowSpan(el: GenericElement): boolean {
  // Look for cellAddr with colSpan>1 or rowSpan>1
  const local = el.tag.includes(':') ? el.tag.split(':').pop()! : el.tag;
  if (local === 'cellAddr' || local === 'cellSpan') {
    const cs = parseInt(el.attrs['colSpan'] ?? el.attrs['hp:colSpan'] ?? '1');
    const rs = parseInt(el.attrs['rowSpan'] ?? el.attrs['hp:rowSpan'] ?? '1');
    if (cs > 1 || rs > 1) return true;
  }
  for (const c of el.children) {
    if (hasColSpanOrRowSpan(c)) return true;
  }
  return false;
}

function countInGeneric(el: GenericElement, tagName: string): number {
  let count = 0;
  const local = el.tag.includes(':') ? el.tag.split(':').pop()! : el.tag;
  if (local === tagName) count++;
  for (const c of el.children) count += countInGeneric(c, tagName);
  return count;
}

function walkRunChildren(children: RunChild[], stats: FileStats) {
  for (const child of children) {
    if (child.type === 'table') {
      stats.tableCount++;
      if (hasColSpanOrRowSpan(child.element)) stats.mergedTableCount++;
    } else if (child.type === 'shape') {
      stats.shapeCount++;
    } else if (child.type === 'equation') {
      stats.equationCount++;
    } else if (child.type === 'inlineObject') {
      stats.imageCount++;
      const ext = (child.name || '').split('.').pop()?.toLowerCase() || 'unknown';
      stats.imageTypes.set(ext, (stats.imageTypes.get(ext) || 0) + 1);
    } else if (child.type === 'ctrl') {
      // Check for header/footer/footnote/endnote inside ctrl
      for (const gc of child.element.children) {
        const gcLocal = gc.tag.includes(':') ? gc.tag.split(':').pop()! : gc.tag;
        if (gcLocal === 'header') stats.hasHeader = true;
        if (gcLocal === 'footer') stats.hasFooter = true;
        if (gcLocal === 'footnote') stats.hasFootnote = true;
        if (gcLocal === 'endnote') stats.hasEndnote = true;
      }
    }
  }
}

async function auditFile(filePath: string, relPath: string): Promise<FileStats> {
  const stats = newStats(relPath);
  try {
    const buf = readFileSync(filePath);
    const doc = await HanDoc.open(new Uint8Array(buf));
    const header = doc.header;

    // Char properties from header
    for (const cp of header.refList.charProperties) {
      if (cp.bold) stats.boldCount++;
      if (cp.italic) stats.italicCount++;
      if (cp.underline && cp.underline !== 'none' && cp.underline !== 'NONE') stats.underlineCount++;
      if (cp.strikeout && cp.strikeout !== 'none' && cp.strikeout !== 'NONE') stats.strikeoutCount++;
      if (cp.textColor && cp.textColor !== '0' && cp.textColor !== '#000000') stats.textColors.add(cp.textColor);
      if (cp.height) stats.fontSizes.add(cp.height);
    }

    // Para properties from header
    for (const pp of header.refList.paraProperties) {
      if (pp.align) stats.alignTypes.add(pp.align);
      if (pp.lineSpacing) stats.hasLineSpacing = true;
      if (pp.heading) {
        stats.hasHeading = true;
        stats.headingLevels.add(pp.heading.level);
      }
    }

    // Walk sections for tables, images, annotations
    for (const section of doc.sections) {
      for (const para of section.paragraphs) {
        for (const run of para.runs) {
          walkRunChildren(run.children, stats);
        }
      }
    }

    // Also check images from HanDoc.images
    if (doc.images.length > 0) {
      stats.imageCount = Math.max(stats.imageCount, doc.images.length);
      for (const img of doc.images) {
        const ext = img.path.split('.').pop()?.toLowerCase() || 'unknown';
        stats.imageTypes.set(ext, (stats.imageTypes.get(ext) || 0) + 1);
      }
    }

    // Headers/footers/footnotes from HanDoc API
    if (doc.headers.length > 0) stats.hasHeader = true;
    if (doc.footers.length > 0) stats.hasFooter = true;
    for (const fn of doc.footnotes) {
      if (fn.type === 'footnote') stats.hasFootnote = true;
      if (fn.type === 'endnote') stats.hasEndnote = true;
    }

  } catch (e: any) {
    stats.error = e.message || String(e);
  }
  return stats;
}

// ─── Aggregate stats ─────────────────────────────────────────────────

interface AggregateStats {
  totalFiles: number;
  successFiles: number;
  errorFiles: number;
  errors: { file: string; error: string }[];

  // char
  filesWithBold: number;
  filesWithItalic: number;
  filesWithUnderline: number;
  filesWithStrikeout: number;
  filesWithMultiColor: number;
  filesWithMultiFontSize: number;
  allFontSizes: Set<number>;
  allTextColors: Set<string>;

  // para
  alignCounts: Map<string, number>;
  filesWithLineSpacing: number;
  filesWithHeading: number;
  allHeadingLevels: Set<number>;

  // table
  filesWithTable: number;
  totalTables: number;
  filesWithMergedTable: number;

  // image
  filesWithImage: number;
  totalImages: number;
  imageTypeCounts: Map<string, number>;

  // annotations
  filesWithHeader: number;
  filesWithFooter: number;
  filesWithFootnote: number;
  filesWithEndnote: number;

  // equation/shape
  filesWithEquation: number;
  totalEquations: number;
  filesWithShape: number;
  totalShapes: number;
}

function aggregate(allStats: FileStats[]): AggregateStats {
  const agg: AggregateStats = {
    totalFiles: allStats.length,
    successFiles: allStats.filter(s => !s.error).length,
    errorFiles: allStats.filter(s => s.error).length,
    errors: allStats.filter(s => s.error).map(s => ({ file: s.file, error: s.error! })),
    filesWithBold: 0, filesWithItalic: 0, filesWithUnderline: 0, filesWithStrikeout: 0,
    filesWithMultiColor: 0, filesWithMultiFontSize: 0,
    allFontSizes: new Set(), allTextColors: new Set(),
    alignCounts: new Map(), filesWithLineSpacing: 0, filesWithHeading: 0, allHeadingLevels: new Set(),
    filesWithTable: 0, totalTables: 0, filesWithMergedTable: 0,
    filesWithImage: 0, totalImages: 0, imageTypeCounts: new Map(),
    filesWithHeader: 0, filesWithFooter: 0, filesWithFootnote: 0, filesWithEndnote: 0,
    filesWithEquation: 0, totalEquations: 0, filesWithShape: 0, totalShapes: 0,
  };

  for (const s of allStats) {
    if (s.error) continue;
    if (s.boldCount > 0) agg.filesWithBold++;
    if (s.italicCount > 0) agg.filesWithItalic++;
    if (s.underlineCount > 0) agg.filesWithUnderline++;
    if (s.strikeoutCount > 0) agg.filesWithStrikeout++;
    if (s.textColors.size > 0) agg.filesWithMultiColor++;
    if (s.fontSizes.size > 1) agg.filesWithMultiFontSize++;
    for (const c of s.textColors) agg.allTextColors.add(c);
    for (const f of s.fontSizes) agg.allFontSizes.add(f);

    for (const a of s.alignTypes) agg.alignCounts.set(a, (agg.alignCounts.get(a) || 0) + 1);
    if (s.hasLineSpacing) agg.filesWithLineSpacing++;
    if (s.hasHeading) agg.filesWithHeading++;
    for (const h of s.headingLevels) agg.allHeadingLevels.add(h);

    if (s.tableCount > 0) agg.filesWithTable++;
    agg.totalTables += s.tableCount;
    if (s.mergedTableCount > 0) agg.filesWithMergedTable++;

    if (s.imageCount > 0) agg.filesWithImage++;
    agg.totalImages += s.imageCount;
    for (const [t, c] of s.imageTypes) agg.imageTypeCounts.set(t, (agg.imageTypeCounts.get(t) || 0) + c);

    if (s.hasHeader) agg.filesWithHeader++;
    if (s.hasFooter) agg.filesWithFooter++;
    if (s.hasFootnote) agg.filesWithFootnote++;
    if (s.hasEndnote) agg.filesWithEndnote++;

    if (s.equationCount > 0) agg.filesWithEquation++;
    agg.totalEquations += s.equationCount;
    if (s.shapeCount > 0) agg.filesWithShape++;
    agg.totalShapes += s.shapeCount;
  }
  return agg;
}

function generateReport(agg: AggregateStats): string {
  const pct = (n: number) => `${n} (${(n / agg.successFiles * 100).toFixed(1)}%)`;
  const sortedSizes = [...agg.allFontSizes].sort((a, b) => a - b);

  return `# HanDoc Format Audit Results

> Generated: ${new Date().toISOString()}
> Fixture directory: \`${FIXTURES_DIR}\`

## Summary

| Metric | Value |
|--------|-------|
| Total files | ${agg.totalFiles} |
| Successfully parsed | ${agg.successFiles} |
| Parse errors | ${agg.errorFiles} |
| **Parse success rate** | **${(agg.successFiles / agg.totalFiles * 100).toFixed(1)}%** |

## 글자모양 (Character Properties)

| Property | Files using it |
|----------|---------------|
| Bold | ${pct(agg.filesWithBold)} |
| Italic | ${pct(agg.filesWithItalic)} |
| Underline | ${pct(agg.filesWithUnderline)} |
| Strikeout | ${pct(agg.filesWithStrikeout)} |
| Non-black text color | ${pct(agg.filesWithMultiColor)} |
| Multiple font sizes | ${pct(agg.filesWithMultiFontSize)} |

- **Unique font sizes**: ${sortedSizes.length} (range: ${sortedSizes[0]} ~ ${sortedSizes[sortedSizes.length - 1]} HWP units)
- **Unique text colors**: ${agg.allTextColors.size}

## 문단모양 (Paragraph Properties)

| Alignment | Files |
|-----------|-------|
${[...agg.alignCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${pct(v)} |`).join('\n')}

| Property | Files |
|----------|-------|
| Line spacing set | ${pct(agg.filesWithLineSpacing)} |
| Heading used | ${pct(agg.filesWithHeading)} |

- **Heading levels found**: ${[...agg.allHeadingLevels].sort().join(', ') || 'none'}

## 표 (Tables)

| Metric | Value |
|--------|-------|
| Files with tables | ${pct(agg.filesWithTable)} |
| Total tables | ${agg.totalTables} |
| Files with merged cells | ${pct(agg.filesWithMergedTable)} |

## 이미지 (Images)

| Metric | Value |
|--------|-------|
| Files with images | ${pct(agg.filesWithImage)} |
| Total images | ${agg.totalImages} |

**Image types:**
${[...agg.imageTypeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t, c]) => `- ${t}: ${c}`).join('\n') || '- none'}

## 머리말/꼬리말 (Header/Footer)

| Type | Files |
|------|-------|
| Header | ${pct(agg.filesWithHeader)} |
| Footer | ${pct(agg.filesWithFooter)} |

## 각주/미주 (Footnotes/Endnotes)

| Type | Files |
|------|-------|
| Footnote | ${pct(agg.filesWithFootnote)} |
| Endnote | ${pct(agg.filesWithEndnote)} |

## 수식 (Equations)

| Metric | Value |
|--------|-------|
| Files with equations | ${pct(agg.filesWithEquation)} |
| Total equations | ${agg.totalEquations} |

## 도형 (Shapes/Drawing Objects)

| Metric | Value |
|--------|-------|
| Files with shapes | ${pct(agg.filesWithShape)} |
| Total shapes | ${agg.totalShapes} |

${agg.errorFiles > 0 ? `## Parse Errors (${agg.errorFiles} files)

| File | Error |
|------|-------|
${agg.errors.map(e => `| ${e.file} | ${e.error.slice(0, 100)} |`).join('\n')}
` : ''}`;
}

// ─── Roundtrip Audit ─────────────────────────────────────────────────

interface RoundtripResult {
  file: string;
  success: boolean;
  error?: string;
  textMatch: boolean;
  sectionCountMatch: boolean;
  paraCountMatch: boolean;
  charPropCountMatch: boolean;
  paraPropCountMatch: boolean;
  textDiffLines: number;
  details: string[];
}

async function roundtripTest(filePath: string, relPath: string): Promise<RoundtripResult> {
  const result: RoundtripResult = {
    file: relPath, success: false, textMatch: false,
    sectionCountMatch: false, paraCountMatch: false,
    charPropCountMatch: false, paraPropCountMatch: false,
    textDiffLines: 0, details: [],
  };

  try {
    // Parse original
    const buf = readFileSync(filePath);
    const doc1 = await HanDoc.open(new Uint8Array(buf));
    const text1 = doc1.extractText();
    const sections1 = doc1.sections.length;
    const paras1 = doc1.sections.reduce((s, sec) => s + sec.paragraphs.length, 0);
    const charProps1 = doc1.header.refList.charProperties.length;
    const paraProps1 = doc1.header.refList.paraProperties.length;

    // Write
    const hwpxBytes = writeHwpx({ header: doc1.header, sections: doc1.sections }, doc1.opcPackage);

    // Re-parse
    const doc2 = await HanDoc.open(hwpxBytes);
    const text2 = doc2.extractText();
    const sections2 = doc2.sections.length;
    const paras2 = doc2.sections.reduce((s, sec) => s + sec.paragraphs.length, 0);
    const charProps2 = doc2.header.refList.charProperties.length;
    const paraProps2 = doc2.header.refList.paraProperties.length;

    // Compare
    result.sectionCountMatch = sections1 === sections2;
    if (!result.sectionCountMatch) result.details.push(`Sections: ${sections1} → ${sections2}`);

    result.paraCountMatch = paras1 === paras2;
    if (!result.paraCountMatch) result.details.push(`Paragraphs: ${paras1} → ${paras2}`);

    result.charPropCountMatch = charProps1 === charProps2;
    if (!result.charPropCountMatch) result.details.push(`CharProperties: ${charProps1} → ${charProps2}`);

    result.paraPropCountMatch = paraProps1 === paraProps2;
    if (!result.paraPropCountMatch) result.details.push(`ParaProperties: ${paraProps1} → ${paraProps2}`);

    // Text comparison
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    let diffCount = 0;
    const maxLen = Math.max(lines1.length, lines2.length);
    const diffSamples: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      if ((lines1[i] || '') !== (lines2[i] || '')) {
        diffCount++;
        if (diffSamples.length < 5) {
          diffSamples.push(`  L${i + 1}: "${(lines1[i] || '').slice(0, 60)}" → "${(lines2[i] || '').slice(0, 60)}"`);
        }
      }
    }
    result.textDiffLines = diffCount;
    result.textMatch = diffCount === 0;
    if (!result.textMatch) {
      result.details.push(`Text diff: ${diffCount}/${maxLen} lines differ`);
      result.details.push(...diffSamples);
    }

    // Check char property details
    const cp1 = doc1.header.refList.charProperties;
    const cp2 = doc2.header.refList.charProperties;
    let cpDiffs = 0;
    for (let i = 0; i < Math.min(cp1.length, cp2.length); i++) {
      const a = cp1[i], b = cp2[i];
      if (a.bold !== b.bold || a.italic !== b.italic || a.height !== b.height
        || a.underline !== b.underline || a.strikeout !== b.strikeout
        || a.textColor !== b.textColor) {
        cpDiffs++;
        if (cpDiffs <= 3) {
          const changes: string[] = [];
          if (a.bold !== b.bold) changes.push(`bold:${a.bold}→${b.bold}`);
          if (a.italic !== b.italic) changes.push(`italic:${a.italic}→${b.italic}`);
          if (a.height !== b.height) changes.push(`height:${a.height}→${b.height}`);
          if (a.underline !== b.underline) changes.push(`underline:${a.underline}→${b.underline}`);
          if (a.textColor !== b.textColor) changes.push(`color:${a.textColor}→${b.textColor}`);
          result.details.push(`  CharProp[${i}]: ${changes.join(', ')}`);
        }
      }
    }
    if (cpDiffs > 0) result.details.push(`CharProperty value diffs: ${cpDiffs}`);

    result.success = true;
  } catch (e: any) {
    result.error = e.message || String(e);
  }
  return result;
}

function generateRoundtripReport(results: RoundtripResult[]): string {
  const lines = [`# HanDoc Roundtrip Format Audit

> Generated: ${new Date().toISOString()}
> Test: parse → write → parse, then compare

## Summary

| Metric | Value |
|--------|-------|
| Files tested | ${results.length} |
| Roundtrip success (no crash) | ${results.filter(r => r.success).length} |
| Perfect text match | ${results.filter(r => r.textMatch).length} |
| Section count match | ${results.filter(r => r.sectionCountMatch).length} |
| Paragraph count match | ${results.filter(r => r.paraCountMatch).length} |
| CharProperty count match | ${results.filter(r => r.charPropCountMatch).length} |
| ParaProperty count match | ${results.filter(r => r.paraPropCountMatch).length} |

## Per-File Results
`];

  for (const r of results) {
    const status = r.error ? '❌ ERROR' : (r.textMatch && r.paraCountMatch ? '✅ PASS' : '⚠️ DIFF');
    lines.push(`### ${status} \`${r.file}\``);
    if (r.error) {
      lines.push(`\n**Error:** ${r.error}\n`);
      continue;
    }
    lines.push('');
    lines.push(`| Check | Result |`);
    lines.push(`|-------|--------|`);
    lines.push(`| Text match | ${r.textMatch ? '✅' : `❌ (${r.textDiffLines} lines differ)`} |`);
    lines.push(`| Section count | ${r.sectionCountMatch ? '✅' : '❌'} |`);
    lines.push(`| Paragraph count | ${r.paraCountMatch ? '✅' : '❌'} |`);
    lines.push(`| CharProp count | ${r.charPropCountMatch ? '✅' : '❌'} |`);
    lines.push(`| ParaProp count | ${r.paraPropCountMatch ? '✅' : '❌'} |`);
    if (r.details.length > 0) {
      lines.push('');
      lines.push('**Details:**');
      lines.push('```');
      lines.push(r.details.join('\n'));
      lines.push('```');
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('Finding HWPX files...');
  const files = findHwpxFiles(FIXTURES_DIR);
  console.log(`Found ${files.length} files`);

  // Phase 1: Format audit
  console.log('\n=== Phase 1: Format Audit ===');
  const allStats: FileStats[] = [];
  for (let i = 0; i < files.length; i++) {
    const rel = relative(FIXTURES_DIR, files[i]);
    if ((i + 1) % 50 === 0 || i === files.length - 1) {
      console.log(`  [${i + 1}/${files.length}] ${rel}`);
    }
    allStats.push(await auditFile(files[i], rel));
  }

  const agg = aggregate(allStats);
  const report = generateReport(agg);
  mkdirSync(join(__dirname, '..', 'docs'), { recursive: true });
  writeFileSync(AUDIT_OUTPUT, report);
  console.log(`\nFormat audit saved to ${AUDIT_OUTPUT}`);

  // Phase 2: Select 10 complex files for roundtrip
  console.log('\n=== Phase 2: Roundtrip Format Audit ===');
  // Score files by complexity: tables + images + font diversity + char prop features
  const scored = allStats
    .filter(s => !s.error)
    .map(s => ({
      ...s,
      score: s.tableCount * 3 + s.imageCount * 2 + s.fontSizes.size
        + (s.boldCount > 0 ? 1 : 0) + (s.italicCount > 0 ? 1 : 0)
        + (s.underlineCount > 0 ? 1 : 0) + (s.hasHeader ? 1 : 0)
        + (s.hasFooter ? 1 : 0) + (s.hasFootnote ? 1 : 0)
        + s.equationCount + s.shapeCount + s.textColors.size,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  console.log('Selected files for roundtrip:');
  for (const s of scored) {
    console.log(`  [score=${s.score}] ${s.file}`);
  }

  const roundtripResults: RoundtripResult[] = [];
  for (const s of scored) {
    const fullPath = join(FIXTURES_DIR, s.file);
    console.log(`  Testing: ${s.file}`);
    roundtripResults.push(await roundtripTest(fullPath, s.file));
  }

  const rtReport = generateRoundtripReport(roundtripResults);
  writeFileSync(ROUNDTRIP_OUTPUT, rtReport);
  console.log(`\nRoundtrip audit saved to ${ROUNDTRIP_OUTPUT}`);

  // Print quick summary
  console.log('\n=== Quick Summary ===');
  console.log(`Parse success: ${agg.successFiles}/${agg.totalFiles}`);
  console.log(`Tables: ${agg.totalTables} in ${agg.filesWithTable} files`);
  console.log(`Images: ${agg.totalImages} in ${agg.filesWithImage} files`);
  console.log(`Headers: ${agg.filesWithHeader}, Footers: ${agg.filesWithFooter}`);
  console.log(`Footnotes: ${agg.filesWithFootnote}, Endnotes: ${agg.filesWithEndnote}`);
  console.log(`Equations: ${agg.totalEquations}, Shapes: ${agg.totalShapes}`);
  const rtPass = roundtripResults.filter(r => r.textMatch && r.paraCountMatch).length;
  console.log(`Roundtrip perfect: ${rtPass}/${roundtripResults.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
