/**
 * Convert DOCX buffer → HWPX buffer.
 * Parses DOCX via docx-parser, then uses HwpxBuilder to produce HWPX.
 */

import { parseDocx, type DocxDocument, type DocxParagraph, type DocxRunStyle } from './docx-parser';
import { HwpxBuilder } from '@handoc/hwpx-writer';

interface ParagraphStyle {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  align?: string;
}

/**
 * Convert a DOCX file (as Uint8Array) to an HWPX file (as Uint8Array).
 */
export async function docxToHwpx(docxBuffer: Uint8Array): Promise<Uint8Array> {
  const doc = await parseDocx(docxBuffer);
  const builder = HwpxBuilder.create();

  for (const elem of doc.body) {
    if (elem.type === 'paragraph') {
      addParagraphToBuilder(builder, elem.item);
    } else if (elem.type === 'table') {
      const rows = elem.item.rows.map(row =>
        row.cells.map(cell =>
          cell.paragraphs.map(p => extractParagraphText(p)).join('\n')
        )
      );
      if (rows.length > 0) {
        builder.addTable(rows);
      }
    }
  }

  return builder.build();
}

function addParagraphToBuilder(builder: HwpxBuilder, para: DocxParagraph): void {
  const text = extractParagraphText(para);
  const style = mergeParagraphStyle(para);
  builder.addParagraph(text, style);
}

function extractParagraphText(para: DocxParagraph): string {
  return para.runs.map(r => r.text).join('');
}

function mergeParagraphStyle(para: DocxParagraph): ParagraphStyle {
  const style: ParagraphStyle = {};

  // Use alignment from paragraph
  if (para.align) {
    style.align = para.align === 'both' ? 'justify' : para.align;
  }

  // Use formatting from first run (simplified — full impl would create multiple runs)
  const firstRun = para.runs[0];
  if (firstRun?.style) {
    if (firstRun.style.bold) style.bold = true;
    if (firstRun.style.italic) style.italic = true;
    if (firstRun.style.fontSize) {
      // DOCX fontSize is in half-points, HwpxBuilder expects pt
      style.fontSize = firstRun.style.fontSize / 2;
    }
  }

  return style;
}
