import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { OpcPackage } from '../packages/hwpx-core/src/index';
import { parseSection, extractText } from '../packages/hwpx-parser/src/index';
import { parseHeader } from '../packages/hwpx-parser/src/header-parser';

const FIXTURES_DIR = process.env.HANDOC_FIXTURES_DIR
  ? join(process.env.HANDOC_FIXTURES_DIR, 'real-world')
  : '';
if (!FIXTURES_DIR) { console.log('HANDOC_FIXTURES_DIR not set, skipping'); process.exit(0); }

interface TestResult {
  file: string;
  category: string;
  success: boolean;
  error?: string;
  sectionCount?: number;
  textLines?: number;
}

function findHwpxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...findHwpxFiles(full));
    } else if (entry.endsWith('.hwpx')) {
      results.push(full);
    }
  }
  return results;
}

async function testFile(filePath: string): Promise<TestResult> {
  const rel = relative(FIXTURES_DIR, filePath);
  const category = rel.split('/')[0];
  
  try {
    // 1. Open ZIP
    const buf = readFileSync(filePath);
    const pkg = await OpcPackage.open(new Uint8Array(buf));
    
    // 2. Check manifest
    const partNames = pkg.partNames();
    
    // 3. Parse header
    const headerParts = partNames.filter(p => p.toLowerCase().includes('header.xml'));
    if (headerParts.length > 0) {
      const headerXml = pkg.getPartAsText(headerParts[0]);
      parseHeader(headerXml);
    }
    
    // 4. Parse sections
    const sectionParts = partNames.filter(p => /section\d*\.xml$/i.test(p));
    let totalTextLines = 0;
    
    if (sectionParts.length === 0) {
      // Try to find any section-like files
      const contentParts = partNames.filter(p => p.startsWith('Contents/') && p.endsWith('.xml') && !p.includes('header'));
      if (contentParts.length === 0) {
        return { file: rel, category, success: false, error: 'No section XML files found' };
      }
    }
    
    for (const sp of sectionParts) {
      const xml = pkg.getPartAsText(sp);
      const section = parseSection(xml);
      const lines = extractText(section);
      totalTextLines += lines.filter(l => l.trim()).length;
    }
    
    return { 
      file: rel, category, success: true, 
      sectionCount: sectionParts.length, 
      textLines: totalTextLines 
    };
  } catch (e: any) {
    return { file: rel, category, success: false, error: e.message || String(e) };
  }
}

async function main() {
  const files = findHwpxFiles(FIXTURES_DIR).sort();
  console.log(`Found ${files.length} HWPX files`);
  
  const results: TestResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    if ((i + 1) % 50 === 0) console.log(`  Processing ${i + 1}/${files.length}...`);
    results.push(await testFile(files[i]));
  }
  
  // Stats
  const total = results.length;
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const rate = ((success / total) * 100).toFixed(1);
  
  // Category stats
  const categories = [...new Set(results.map(r => r.category))].sort();
  const catStats = categories.map(cat => {
    const catResults = results.filter(r => r.category === cat);
    const catSuccess = catResults.filter(r => r.success).length;
    return { cat, total: catResults.length, success: catSuccess, rate: ((catSuccess / catResults.length) * 100).toFixed(1) };
  });
  
  // Error patterns
  const errorMessages = results.filter(r => !r.success).map(r => r.error!);
  const errorCounts = new Map<string, number>();
  for (const msg of errorMessages) {
    // Normalize error messages
    const normalized = msg.replace(/Part not found: .+/, 'Part not found: <path>')
                          .replace(/at position \d+/, 'at position N')
                          .substring(0, 120);
    errorCounts.set(normalized, (errorCounts.get(normalized) || 0) + 1);
  }
  const topErrors = [...errorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  
  // Generate report
  let md = `# HanDoc Real Document Test Results\n\n`;
  md += `**Date:** ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total files | ${total} |\n`;
  md += `| Success | ${success} |\n`;
  md += `| Failed | ${failed} |\n`;
  md += `| **Success Rate** | **${rate}%** |\n\n`;
  
  md += `## Category Breakdown\n\n`;
  md += `| Category | Total | Success | Failed | Rate |\n|----------|-------|---------|--------|------|\n`;
  for (const cs of catStats) {
    md += `| ${cs.cat} | ${cs.total} | ${cs.success} | ${cs.total - cs.success} | ${cs.rate}% |\n`;
  }
  md += '\n';
  
  md += `## Top Error Patterns\n\n`;
  md += `| # | Error | Count |\n|---|-------|-------|\n`;
  for (let i = 0; i < topErrors.length; i++) {
    md += `| ${i + 1} | \`${topErrors[i][0]}\` | ${topErrors[i][1]} |\n`;
  }
  md += '\n';
  
  md += `## Failed Files\n\n`;
  const failedResults = results.filter(r => !r.success);
  if (failedResults.length === 0) {
    md += `None! 🎉\n`;
  } else {
    md += `<details><summary>${failedResults.length} failed files</summary>\n\n`;
    md += `| File | Error |\n|------|-------|\n`;
    for (const r of failedResults) {
      md += `| ${r.file} | \`${(r.error || '').substring(0, 100)}\` |\n`;
    }
    md += `\n</details>\n`;
  }
  
  md += `\n## Successful Files Stats\n\n`;
  const successResults = results.filter(r => r.success);
  const avgSections = successResults.length > 0 
    ? (successResults.reduce((s, r) => s + (r.sectionCount || 0), 0) / successResults.length).toFixed(1) 
    : 0;
  const avgTextLines = successResults.length > 0
    ? (successResults.reduce((s, r) => s + (r.textLines || 0), 0) / successResults.length).toFixed(1)
    : 0;
  const zeroText = successResults.filter(r => (r.textLines || 0) === 0).length;
  md += `- Average sections per file: ${avgSections}\n`;
  md += `- Average non-empty text lines: ${avgTextLines}\n`;
  md += `- Files with 0 extracted text lines: ${zeroText}\n`;
  
  md += `\n## Improvement Priorities\n\n`;
  md += `Based on error analysis:\n\n`;
  for (let i = 0; i < Math.min(5, topErrors.length); i++) {
    md += `${i + 1}. **${topErrors[i][0]}** (${topErrors[i][1]} files) - `;
    if (topErrors[i][0].includes('ZIP')) md += 'ZIP/package handling\n';
    else if (topErrors[i][0].includes('Part not found')) md += 'Missing part resolution\n';
    else if (topErrors[i][0].includes('head')) md += 'Header parsing\n';
    else if (topErrors[i][0].includes('sec')) md += 'Section parsing\n';
    else md += 'Investigation needed\n';
  }
  
  writeFileSync(join(__dirname, '..', 'docs', 'real-doc-test-results.md'), md);
  console.log(`\n=== Results ===`);
  console.log(`Total: ${total}, Success: ${success}, Failed: ${failed}, Rate: ${rate}%`);
  console.log(`Report saved to docs/real-doc-test-results.md`);
}

main().catch(console.error);
