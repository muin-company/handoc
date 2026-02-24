const { convertHwpToHwpx } = require('./packages/hwp-reader/dist/index.cjs');
const { generatePdf } = require('./packages/pdf-export/dist/index.cjs');
const fs = require('fs');
const path = require('path');

const SRC = '/Users/mj/handoc-fixtures/real-world';
const OUT = '/Users/mj/handoc-fixtures/pdf-023-hwp';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // Recursively find all .hwp files
  function findHwp(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...findHwp(full));
      else if (entry.name.endsWith('.hwp') && !entry.name.endsWith('.hwpx')) results.push(full);
    }
    return results;
  }

  const files = findHwp(SRC);
  console.log(`Found ${files.length} HWP files`);

  let success = 0, fail = 0;
  const failures = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const baseName = path.basename(filePath);
    const pdfName = baseName.replace(/\.hwp$/i, '.pdf');
    const outPath = path.join(OUT, pdfName);

    // Skip if already converted
    if (fs.existsSync(outPath)) {
      success++;
      if ((i + 1) % 50 === 0) console.log(`Progress: ${i + 1}/${files.length} (${success} ok, ${fail} fail)`);
      continue;
    }

    try {
      const hwpBuf = fs.readFileSync(filePath);
      const hwpxBuf = convertHwpToHwpx(hwpBuf);
      const pdfBuf = await generatePdf(hwpxBuf);
      fs.writeFileSync(outPath, pdfBuf);
      success++;
    } catch (e) {
      fail++;
      failures.push({ file, error: e.message?.slice(0, 100) });
    }

    if ((i + 1) % 50 === 0) console.log(`Progress: ${i + 1}/${files.length} (${success} ok, ${fail} fail)`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total: ${files.length}, Success: ${success}, Fail: ${fail}`);
  if (failures.length > 0) {
    console.log(`\nFailures:`);
    failures.forEach(f => console.log(`  ${f.file}: ${f.error}`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
