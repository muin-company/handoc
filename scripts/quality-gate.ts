/**
 * Quality Gate — runs all checks and outputs PASS/FAIL JSON.
 * Always exits 0; result is in the JSON output.
 */
import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { OpcPackage } from '../packages/hwpx-core/src/index';
import { parseSection, extractText } from '../packages/hwpx-parser/src/index';
import { HanDoc } from '../packages/hwpx-parser/src/handoc';
import { writeHwpx } from '../packages/hwpx-writer/src/index';

const ROOT = join(__dirname, '..');
const FIXTURES_DIR = process.env.HANDOC_FIXTURES_DIR
  ? join(process.env.HANDOC_FIXTURES_DIR, 'real-world')
  : '';

interface Check {
  name: string;
  passed: boolean;
  current: number | string;
  threshold: number | string;
  detail?: string;
}

interface GateResult {
  passed: boolean;
  checks: Check[];
}

function run(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, output };
  } catch (e: any) {
    return { ok: false, output: e.stderr || e.stdout || String(e) };
  }
}

function findHwpxFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) results.push(...findHwpxFiles(full));
      else if (entry.toLowerCase().endsWith('.hwpx')) results.push(full);
    }
  } catch { /* dir may not exist */ }
  return results;
}

async function checkBuild(): Promise<Check> {
  const { ok, output } = run('pnpm turbo build');
  return { name: 'build', passed: ok, current: ok ? 'success' : 'failed', threshold: 'success', detail: ok ? undefined : output.slice(-500) };
}

async function checkTest(): Promise<Check> {
  const { ok, output } = run('pnpm turbo test');
  return { name: 'test', passed: ok, current: ok ? 'all passed' : 'failed', threshold: 'all passed', detail: ok ? undefined : output.slice(-500) };
}

async function checkParseRate(): Promise<Check> {
  const files = findHwpxFiles(FIXTURES_DIR);
  if (files.length === 0) {
    return { name: 'parse-success-rate', passed: true, current: 'N/A (no fixtures)', threshold: '100%', detail: 'No real-world fixtures found at ' + FIXTURES_DIR };
  }
  let success = 0;
  const errors: string[] = [];
  for (const f of files) {
    try {
      const buf = readFileSync(f);
      const pkg = await OpcPackage.open(new Uint8Array(buf));
      const parts = pkg.partNames().filter(p => /section\d*\.xml$/i.test(p));
      for (const sp of parts) {
        parseSection(pkg.getPartAsText(sp));
      }
      success++;
    } catch (e: any) {
      if (errors.length < 5) errors.push(`${f.split('/').pop()}: ${e.message?.slice(0, 80)}`);
    }
  }
  const rate = (success / files.length) * 100;
  return {
    name: 'parse-success-rate',
    passed: rate >= 100,
    current: `${rate.toFixed(1)}% (${success}/${files.length})`,
    threshold: '100%',
    detail: errors.length > 0 ? errors.join('\n') : undefined,
  };
}

async function checkRoundtrip(): Promise<Check> {
  const files = findHwpxFiles(FIXTURES_DIR);
  if (files.length === 0) {
    return { name: 'roundtrip-rate', passed: true, current: 'N/A', threshold: '99%', detail: 'No fixtures' };
  }
  let success = 0;
  for (const f of files) {
    try {
      const buf = readFileSync(f);
      const doc1 = await HanDoc.open(new Uint8Array(buf));
      const text1 = doc1.extractText();
      const hwpxBytes = writeHwpx({ header: doc1.header, sections: doc1.sections }, doc1.opcPackage);
      const doc2 = await HanDoc.open(hwpxBytes);
      const text2 = doc2.extractText();
      if (text1 === text2) success++;
    } catch { /* count as failure */ }
  }
  const rate = (success / files.length) * 100;
  return {
    name: 'roundtrip-rate',
    passed: rate >= 99,
    current: `${rate.toFixed(1)}% (${success}/${files.length})`,
    threshold: '99%',
  };
}

async function checkZeroText(): Promise<Check> {
  const files = findHwpxFiles(FIXTURES_DIR);
  if (files.length === 0) {
    return { name: 'zero-text-files', passed: true, current: 0, threshold: '≤5', detail: 'No fixtures' };
  }
  let zeroCount = 0;
  for (const f of files) {
    try {
      const buf = readFileSync(f);
      const pkg = await OpcPackage.open(new Uint8Array(buf));
      const parts = pkg.partNames().filter(p => /section\d*\.xml$/i.test(p));
      let totalLines = 0;
      for (const sp of parts) {
        const sec = parseSection(pkg.getPartAsText(sp));
        totalLines += extractText(sec).filter(l => l.trim()).length;
      }
      if (totalLines === 0) zeroCount++;
    } catch { /* skip */ }
  }
  return {
    name: 'zero-text-files',
    passed: zeroCount <= 7,
    current: zeroCount,
    threshold: '≤7',
  };
}

async function main() {
  console.log('🔍 Running Quality Gate...\n');

  const checks: Check[] = [];

  // Build & test (sequential — they share the workspace)
  checks.push(await checkBuild());
  console.log(`  ${checks.at(-1)!.passed ? '✅' : '❌'} ${checks.at(-1)!.name}: ${checks.at(-1)!.current}`);

  checks.push(await checkTest());
  console.log(`  ${checks.at(-1)!.passed ? '✅' : '❌'} ${checks.at(-1)!.name}: ${checks.at(-1)!.current}`);

  // Document checks (can be slow with many files)
  checks.push(await checkParseRate());
  console.log(`  ${checks.at(-1)!.passed ? '✅' : '❌'} ${checks.at(-1)!.name}: ${checks.at(-1)!.current}`);

  checks.push(await checkRoundtrip());
  console.log(`  ${checks.at(-1)!.passed ? '✅' : '❌'} ${checks.at(-1)!.name}: ${checks.at(-1)!.current}`);

  checks.push(await checkZeroText());
  console.log(`  ${checks.at(-1)!.passed ? '✅' : '❌'} ${checks.at(-1)!.name}: ${checks.at(-1)!.current}`);

  const result: GateResult = {
    passed: checks.every(c => c.passed),
    checks,
  };

  console.log(`\n${result.passed ? '🎉 GATE PASSED' : '🚫 GATE FAILED'}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error(e);
  const result: GateResult = {
    passed: false,
    checks: [{ name: 'gate-execution', passed: false, current: 'error', threshold: 'success', detail: String(e) }],
  };
  console.log(JSON.stringify(result, null, 2));
});
