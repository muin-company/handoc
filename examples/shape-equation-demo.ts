/**
 * Demo: Using the new addShape and addEquation builder methods
 * 
 * To run:
 * cd /Users/mj/handoc/examples
 * npx tsx shape-equation-demo.ts
 */

import { HwpxBuilder } from '@handoc/hwpx-writer';
import { HanDoc } from '@handoc/hwpx-parser';
import { writeFileSync } from 'fs';

async function demo() {
  console.log('🎨 Creating HWPX document with shapes and equations...\n');

  // Create a document with shapes and equations
  const bytes = HwpxBuilder.create()
    .addParagraph('Shape and Equation Demo', { bold: true, fontSize: 18, align: 'center' })
    .addParagraph('')
    
    .addParagraph('1. Rectangle Shape:', { bold: true })
    .addShape({
      shapeType: 'rect',
      width: 8000,
      height: 3000,
      x: 1000,
      y: 1000,
      text: 'This is a rectangle with text inside',
    })
    .addParagraph('')
    
    .addParagraph('2. Ellipse Shape:', { bold: true })
    .addShape({
      shapeType: 'ellipse',
      width: 6000,
      height: 4000,
      x: 1000,
      y: 1000,
    })
    .addParagraph('')
    
    .addParagraph('3. Quadratic Formula:', { bold: true })
    .addEquation({
      script: 'x = {-b +- sqrt{b^2 - 4ac}} over {2a}',
      width: 10000,
      height: 2000,
    })
    .addParagraph('')
    
    .addParagraph('4. Pythagorean Theorem:', { bold: true })
    .addEquation({
      script: 'a^2 + b^2 = c^2',
      width: 6000,
      height: 1500,
    })
    
    .build();

  // Save to file
  const outPath = '/tmp/shape-equation-demo.hwpx';
  writeFileSync(outPath, bytes);
  console.log(`✅ Saved to: ${outPath}`);
  console.log(`   Size: ${bytes.length} bytes\n`);

  // Verify by parsing it back
  console.log('🔍 Parsing the document back...\n');
  const doc = await HanDoc.open(bytes);
  
  console.log(`Document info:`);
  console.log(`  Version: ${doc.header.version}`);
  console.log(`  Sections: ${doc.sections.length}`);
  console.log(`  Paragraphs: ${doc.sections[0].paragraphs.length}\n`);

  // Count shapes and equations
  let shapeCount = 0;
  let equationCount = 0;
  
  for (const section of doc.sections) {
    for (const para of section.paragraphs) {
      for (const run of para.runs) {
        for (const child of run.children) {
          if (child.type === 'shape') {
            shapeCount++;
            console.log(`  ✓ Found shape: ${child.name}`);
          }
          if (child.type === 'equation') {
            equationCount++;
            const scriptChild = child.element.children.find(c => c.tag === 'script');
            console.log(`  ✓ Found equation: ${scriptChild?.text?.substring(0, 40)}...`);
          }
        }
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Shapes: ${shapeCount}`);
  console.log(`  Equations: ${equationCount}`);
  console.log('\n✨ Demo complete!');
}

demo().catch(console.error);
