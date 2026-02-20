#!/usr/bin/env tsx
/**
 * Integration test for numbering/bullet rendering
 */

import { writeHwpx } from './packages/hwpx-writer/src/index.js';
import { parseHeader, parseSection } from './packages/hwpx-parser/src/index.js';
import { documentToHtml } from './packages/viewer/src/render.js';
import { OpcPackage } from './packages/hwpx-core/src/index.js';
import type { DocumentHeader, Section } from './packages/document-model/src/index.js';

async function testNumbering() {
  console.log('🧪 Testing numbering/bullet rendering...\n');

  // Create a document with numbering
  const header: DocumentHeader = {
    version: '1.5',
    secCnt: 1,
    beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
    refList: {
      fontFaces: [],
      borderFills: [],
      charProperties: [
        { id: 0, height: 1000, attrs: {}, children: [] },
      ],
      tabProperties: [],
      numberings: [
        {
          id: 0,
          start: 1,
          levels: [
            { level: 0, text: '^1.', numFormat: 'DIGIT' },
            { level: 1, text: '^2)', numFormat: 'DIGIT' },
          ],
        },
      ],
      bullets: [
        {
          id: 1,
          char: '●',
          levels: [
            { level: 0, text: '●' },
            { level: 1, text: '○' },
          ],
        },
      ],
      paraProperties: [
        { id: 0, attrs: { id: '0' }, children: [] },
        {
          id: 1,
          heading: { type: 'OUTLINE', idRef: 0, level: 0 },
          attrs: { id: '1' },
          children: [],
        },
        {
          id: 2,
          heading: { type: 'OUTLINE', idRef: 1, level: 0 },
          attrs: { id: '2' },
          children: [],
        },
      ],
      styles: [],
      others: [],
    },
  };

  const section: Section = {
    paragraphs: [
      {
        id: '1',
        paraPrIDRef: 0,
        styleIDRef: 0,
        pageBreak: false,
        columnBreak: false,
        merged: false,
        runs: [{
          charPrIDRef: 0,
          children: [{ type: 'text', content: 'Normal paragraph' }],
        }],
        lineSegArray: [],
      },
      {
        id: '2',
        paraPrIDRef: 1,
        styleIDRef: 0,
        pageBreak: false,
        columnBreak: false,
        merged: false,
        runs: [{
          charPrIDRef: 0,
          children: [{ type: 'text', content: 'First numbered item' }],
        }],
        lineSegArray: [],
      },
      {
        id: '3',
        paraPrIDRef: 1,
        styleIDRef: 0,
        pageBreak: false,
        columnBreak: false,
        merged: false,
        runs: [{
          charPrIDRef: 0,
          children: [{ type: 'text', content: 'Second numbered item' }],
        }],
        lineSegArray: [],
      },
      {
        id: '4',
        paraPrIDRef: 2,
        styleIDRef: 0,
        pageBreak: false,
        columnBreak: false,
        merged: false,
        runs: [{
          charPrIDRef: 0,
          children: [{ type: 'text', content: 'First bullet item' }],
        }],
        lineSegArray: [],
      },
      {
        id: '5',
        paraPrIDRef: 2,
        styleIDRef: 0,
        pageBreak: false,
        columnBreak: false,
        merged: false,
        runs: [{
          charPrIDRef: 0,
          children: [{ type: 'text', content: 'Second bullet item' }],
        }],
        lineSegArray: [],
      },
    ],
  };

  // Test 1: Write HWPX with numbering
  console.log('✅ Test 1: Writing HWPX with numbering...');
  const hwpxBytes = writeHwpx({ header, sections: [section] });
  console.log(`   Created ${hwpxBytes.length} bytes HWPX file\n`);

  // Test 2: Round-trip and verify
  console.log('✅ Test 2: Round-trip parsing...');
  const pkg = await OpcPackage.open(hwpxBytes);
  const headerPaths = pkg.getHeaderPaths();
  const sectionPaths = pkg.getSectionPaths();
  
  const parsedHeader = parseHeader(pkg.getPartAsText(headerPaths[0]));
  const parsedSections = sectionPaths.map(path => parseSection(pkg.getPartAsText(path)));

  console.log(`   Numberings: ${parsedHeader.refList.numberings?.length ?? 0}`);
  console.log(`   Bullets: ${parsedHeader.refList.bullets?.length ?? 0}`);
  console.log(`   Paragraphs: ${parsedSections[0].paragraphs.length}`);
  
  // Debug numbering details
  if (parsedHeader.refList.numberings && parsedHeader.refList.numberings.length > 0) {
    const num = parsedHeader.refList.numberings[0];
    console.log(`   Numbering[0]: id=${num.id}, levels=${num.levels.length}`);
    num.levels.forEach(l => console.log(`     Level ${l.level}: text="${l.text}"`));
  }
  
  if (parsedHeader.refList.bullets && parsedHeader.refList.bullets.length > 0) {
    const bul = parsedHeader.refList.bullets[0];
    console.log(`   Bullet[0]: id=${bul.id}, char="${bul.char}", levels=${bul.levels.length}`);
    bul.levels.forEach(l => console.log(`     Level ${l.level}: text="${l.text}"`));
  }
  
  // Debug para properties
  parsedHeader.refList.paraProperties.forEach(pp => {
    if (pp.heading) {
      console.log(`   ParaProp[${pp.id}]: heading type=${pp.heading.type}, idRef=${pp.heading.idRef}, level=${pp.heading.level}`);
    }
  });
  console.log();

  // Test 3: Render HTML with numbering
  console.log('✅ Test 3: Rendering HTML with numbering...');
  
  // Debug paragraph rendering
  console.log('   Debug: Checking paragraph properties...');
  parsedSections[0].paragraphs.forEach((p, i) => {
    const ppId = p.paraPrIDRef;
    const pp = parsedHeader.refList.paraProperties.find(prop => prop.id === ppId);
    console.log(`     Para ${i}: paraPrIDRef=${ppId}, has heading=${pp?.heading !== undefined}`);
    if (pp?.heading) {
      console.log(`       Heading: type=${pp.heading.type}, idRef=${pp.heading.idRef}, level=${pp.heading.level}`);
    }
  });
  
  const html = documentToHtml(parsedSections, { header: parsedHeader });
  
  const hasNumberingClass = html.includes('handoc-numbering');
  const hasNumbering = html.includes('1.');
  const hasBullet = html.includes('●');

  console.log(`   Contains .handoc-numbering: ${hasNumberingClass}`);
  console.log(`   Contains "1.": ${hasNumbering}`);
  console.log(`   Contains "●": ${hasBullet}\n`);

  // Show sample HTML
  console.log('📄 Sample HTML output:');
  console.log(html.substring(0, 800) + '...\n');

  if (hasNumberingClass && hasNumbering && hasBullet) {
    console.log('✨ All tests passed! Numbering feature is working correctly.\n');
    return true;
  } else {
    console.error('❌ Some tests failed!\n');
    return false;
  }
}

testNumbering().then(success => {
  process.exit(success ? 0 : 1);
});
