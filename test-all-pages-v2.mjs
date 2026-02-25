import { createRequire } from 'module';
const require = createRequire(import.meta.url + '/../packages/pdf-export/');
const { PDFDocument } = require('pdf-lib');
import fs from 'fs';
import path from 'path';

const { generatePdf } = await import('./packages/pdf-export/dist/index.js');

const fixtureBase = '/Users/mj/handoc-fixtures';
const pdfBase = fixtureBase + '/pdf-001';

function findHwpx(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...findHwpx(full));
      else if (entry.name.endsWith('.hwpx')) results.push(full);
    }
  } catch {}
  return results;
}

function findRefPdf(hwpxPath) {
  const rel = path.relative(fixtureBase, hwpxPath);
  const dir = path.dirname(rel);
  const base = path.basename(rel, '.hwpx');
  for (const pBase of [pdfBase, ...fs.readdirSync(fixtureBase).filter(d => d.startsWith('pdf-')).map(d => path.join(fixtureBase, d))]) {
    const pdfPath = path.join(pBase, dir, base + '.pdf');
    if (fs.existsSync(pdfPath)) return pdfPath;
  }
  const sameDirPdf = path.join(path.dirname(hwpxPath), base + '.pdf');
  if (fs.existsSync(sameDirPdf)) return sameDirPdf;
  return null;
}

async function getPageCount(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  return pdf.getPageCount();
}

const hwpxFiles = findHwpx(path.join(fixtureBase, 'real-world'));
let results = [];

for (const hwpx of hwpxFiles) {
  const refPdf = findRefPdf(hwpx);
  if (!refPdf) continue;
  
  const name = path.basename(hwpx, '.hwpx');
  try {
    const refPages = await getPageCount(refPdf);
    const buf = fs.readFileSync(hwpx);
    const pdfBytes = await generatePdf(buf);
    const pdf = await PDFDocument.load(pdfBytes);
    const testPages = pdf.getPageCount();
    const ratio = testPages / refPages;
    results.push({ name, testPages, refPages, ratio });
  } catch (e) {
    results.push({ name, testPages: -1, refPages: -1, ratio: -1, error: e.message?.substring(0, 60) });
  }
}

function grade(r) {
  if (r.error) return 'ERR';
  const diff = Math.abs(r.testPages - r.refPages);
  if (r.testPages === r.refPages) return 'A';
  if (diff <= 1 && r.ratio >= 0.8 && r.ratio <= 1.2) return 'B';
  if (r.ratio >= 0.8 && r.ratio <= 1.2) return 'C';
  if (r.ratio >= 0.6 && r.ratio <= 1.5) return 'D';
  return 'F';
}

results.sort((a, b) => (b.ratio - a.ratio));
const grades = {};
const details = { F: [], D: [], C: [], B_under: [] };
for (const r of results) {
  const g = grade(r);
  grades[g] = (grades[g] || 0) + 1;
  if (g === 'F') details.F.push(r);
  if (g === 'D') details.D.push(r);
  if (g === 'C') details.C.push(r);
  if (g === 'B' && r.testPages < r.refPages) details.B_under.push(r);
}

console.log('=== F grades ===');
for (const r of details.F) console.log(`  ${r.testPages}/${r.refPages} (${r.ratio.toFixed(2)}x) ${r.name.substring(0, 60)}`);
console.log('=== D grades ===');
for (const r of details.D) console.log(`  ${r.testPages}/${r.refPages} (${r.ratio.toFixed(2)}x) ${r.name.substring(0, 60)}`);
console.log('=== Underflow B ===');
for (const r of details.B_under) console.log(`  ${r.testPages}/${r.refPages} (${r.ratio.toFixed(2)}x) ${r.name.substring(0, 60)}`);
console.log('\nGrades:', JSON.stringify(grades));
console.log('Total:', results.length);
