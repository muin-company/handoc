#!/usr/bin/env tsx
/**
 * HanDoc PDF 일괄 생성 스크립트
 * 
 * 사용법:
 *   tsx scripts/handoc-batch-pdf.ts <입력폴더> <출력폴더> [--limit N]
 */

import * as fs from 'fs';
import * as path from 'path';
import { generatePdf } from '../packages/pdf-export/src/pdf-direct.js';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('사용법: tsx scripts/handoc-batch-pdf.ts <입력폴더> <출력폴더> [--limit N]');
  process.exit(1);
}

const inputDir = args[0];
const outputDir = args[1];
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : undefined;

// HWPX 파일 찾기
function findHwpxFiles(dir: string): string[] {
  const results: string[] = [];
  
  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.hwpx') || entry.name.endsWith('.hwp')) {
        results.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return results.sort();
}

async function main() {
  console.log(`📂 입력: ${inputDir}`);
  console.log(`📁 출력: ${outputDir}`);
  
  const files = findHwpxFiles(inputDir);
  const toProcess = limit ? files.slice(0, limit) : files;
  
  console.log(`📄 파일: ${toProcess.length}개 ${limit ? `(총 ${files.length}개 중)` : ''}\n`);
  
  // 출력 폴더 생성
  fs.mkdirSync(outputDir, { recursive: true });
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < toProcess.length; i++) {
    const inputPath = toProcess[i];
    const relativePath = path.relative(inputDir, inputPath);
    const outputPath = path.join(
      outputDir,
      relativePath.replace(/\.(hwpx|hwp)$/, '.pdf')
    );
    
    // 출력 파일 폴더 생성
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    
    try {
      const hwpxBuffer = new Uint8Array(fs.readFileSync(inputPath));
      const pdfBytes = await generatePdf(hwpxBuffer);
      fs.writeFileSync(outputPath, pdfBytes);
      
      const sizeMB = (pdfBytes.length / 1024 / 1024).toFixed(2);
      console.log(`[${i + 1}/${toProcess.length}] ✅ ${relativePath} (${sizeMB} MB)`);
      success++;
    } catch (err: any) {
      console.log(`[${i + 1}/${toProcess.length}] ❌ ${relativePath} - ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ 성공: ${success}개`);
  console.log(`❌ 실패: ${failed}개`);
}

main().catch(console.error);
