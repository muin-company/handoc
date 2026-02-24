import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { OpcPackage } from '@handoc/hwpx-core';
import { HanDoc } from '@handoc/hwpx-parser';
import { convertHwpToHwpx } from '@handoc/hwp-reader';
import { hwpxToDocx } from '@handoc/docx-writer';
import { docxToHwpx } from '@handoc/docx-reader';
import { hwpxToPdf, renderToHtml, generatePdf } from '@handoc/pdf-export';
import { parseHTML } from '@handoc/html-reader';
import { sectionsToHwpx } from '@handoc/hwpx-writer';
import type { Section } from '@handoc/document-model';

const program = new Command();

program
  .name('handoc')
  .description('CLI tool for HanDoc - inspect, extract, and convert HWP/HWPX documents')
  .version('0.1.0');

// ── info ──
program
  .command('info')
  .description('Show document info (sections, tables, images)')
  .argument('<file>', 'HWPX file path')
  .action(async (file: string) => {
    const buf = await readFile(file);
    const doc = await HanDoc.open(new Uint8Array(buf));

    const sections = doc.sections;
    const images = doc.images;

    // Count tables and paragraphs across all sections
    let tableCount = 0;
    let paragraphCount = 0;
    for (const sec of sections) {
      paragraphCount += sec.paragraphs.length;
      for (const p of sec.paragraphs) {
        for (const run of p.runs) {
          for (const child of run.children) {
            if (child.type === 'table') tableCount++;
          }
        }
      }
    }

    console.log(`File:       ${basename(file)}`);
    console.log(`Sections:   ${sections.length}`);
    console.log(`Paragraphs: ${paragraphCount}`);
    console.log(`Tables:     ${tableCount}`);
    console.log(`Images:     ${images.length}`);

    const meta = doc.metadata;
    if (meta.title) console.log(`Title:      ${meta.title}`);
    if (meta.creator) console.log(`Creator:    ${meta.creator}`);
    if (meta.language) console.log(`Language:   ${meta.language}`);
  });

// ── text ──
program
  .command('text')
  .description('Extract text from document')
  .argument('<file>', 'HWPX file path')
  .action(async (file: string) => {
    const buf = await readFile(file);
    const doc = await HanDoc.open(new Uint8Array(buf));
    console.log(doc.extractText());
  });

// ── convert ──
program
  .command('convert')
  .description('Convert HWP to HWPX')
  .argument('<file>', 'HWP file path')
  .option('-o, --output <path>', 'Output HWPX file path')
  .action(async (file: string, opts: { output?: string }) => {
    const buf = await readFile(file);
    const hwpxBytes = convertHwpToHwpx(new Uint8Array(buf));
    const outPath = opts.output || file.replace(/\.hwp$/i, '.hwpx');
    await writeFile(outPath, hwpxBytes);
    console.log(`Converted: ${basename(file)} → ${basename(outPath)}`);
  });

// ── inspect ──
program
  .command('inspect')
  .description('Inspect internal structure (ZIP parts, XML tree)')
  .argument('<file>', 'HWPX file path')
  .option('--part <name>', 'Show content of a specific part')
  .action(async (file: string, opts: { part?: string }) => {
    const buf = await readFile(file);
    const pkg = await OpcPackage.open(new Uint8Array(buf));
    const parts = pkg.partNames();

    if (opts.part) {
      if (!pkg.hasPart(opts.part)) {
        console.error(`Part not found: ${opts.part}`);
        console.error(`Available parts: ${parts.join(', ')}`);
        process.exit(1);
      }
      console.log(pkg.getPartAsText(opts.part));
    } else {
      console.log(`Parts (${parts.length}):`);
      for (const p of parts) {
        console.log(`  ${p}`);
      }
    }
  });

// ── to-docx ──
program
  .command('to-docx')
  .description('Convert HWPX to DOCX')
  .argument('<file>', 'HWPX file path')
  .option('-o, --output <path>', 'Output DOCX file path')
  .action(async (file: string, opts: { output?: string }) => {
    const buf = await readFile(file);
    const docx = await hwpxToDocx(new Uint8Array(buf));
    const outPath = opts.output || file.replace(/\.hwpx$/i, '.docx');
    await writeFile(outPath, docx);
    console.log(`Converted: ${basename(file)} → ${basename(outPath)}`);
  });

// ── to-hwpx ──
program
  .command('to-hwpx')
  .description('Convert DOCX to HWPX')
  .argument('<file>', 'DOCX file path')
  .option('-o, --output <path>', 'Output HWPX file path')
  .action(async (file: string, opts: { output?: string }) => {
    const buf = await readFile(file);
    const hwpx = await docxToHwpx(new Uint8Array(buf));
    const outPath = opts.output || file.replace(/\.docx$/i, '.hwpx');
    await writeFile(outPath, hwpx);
    console.log(`Converted: ${basename(file)} → ${basename(outPath)}`);
  });

// ── to-pdf ──
program
  .command('to-pdf')
  .description('Convert HWPX to PDF')
  .argument('<file>', 'HWPX file path')
  .option('-o, --output <path>', 'Output PDF file path')
  .option('--direct', 'Use direct pdf-lib export (no Playwright needed, faster but lower fidelity)')
  .action(async (file: string, opts: { output?: string; direct?: boolean }) => {
    const buf = await readFile(file);
    const pdf = opts.direct
      ? await generatePdf(new Uint8Array(buf))
      : await hwpxToPdf(new Uint8Array(buf));
    const outPath = opts.output || file.replace(/\.hwpx$/i, '.pdf');
    await writeFile(outPath, pdf);
    console.log(`Converted: ${basename(file)} → ${basename(outPath)}`);
  });

// ── to-html ──
program
  .command('to-html')
  .description('Convert HWPX to HTML')
  .argument('<file>', 'HWPX file path')
  .option('-o, --output <path>', 'Output HTML file path')
  .action(async (file: string, opts: { output?: string }) => {
    const buf = await readFile(file);
    const doc = await HanDoc.open(new Uint8Array(buf));
    const html = renderToHtml(doc);
    const outPath = opts.output || file.replace(/\.hwpx$/i, '.html');
    await writeFile(outPath, html);
    console.log(`Converted: ${basename(file)} → ${basename(outPath)}`);
  });

// ── from-html ──
program
  .command('from-html')
  .description('Convert HTML to HWPX')
  .argument('<file>', 'HTML file path')
  .option('-o, --output <path>', 'Output HWPX file path')
  .action(async (file: string, opts: { output?: string }) => {
    const html = await readFile(file, 'utf-8');
    const sections = parseHTML(html);
    const hwpx = sectionsToHwpx(sections);
    const outPath = opts.output || file.replace(/\.html$/i, '.hwpx');
    await writeFile(outPath, hwpx);
    console.log(`Converted: ${basename(file)} → ${basename(outPath)}`);
  });

program.parse();
