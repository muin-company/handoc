/**
 * Convert DOCX buffer → HWPX buffer.
 * Parses DOCX via docx-parser, then uses HwpxBuilder to produce HWPX.
 */

import { parseDocx, type DocxDocument, type DocxParagraph, type DocxRunStyle, type DocxImage } from './docx-parser';
import { HwpxBuilder } from '@handoc/hwpx-writer';

interface ParagraphStyle {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  align?: string;
}

/** Map DOCX style IDs to heading levels */
const HEADING_STYLE_MAP: Record<string, number> = {
  'Heading1': 1, 'heading1': 1, 'Heading 1': 1,
  'Heading2': 2, 'heading2': 2, 'Heading 2': 2,
  'Heading3': 3, 'heading3': 3, 'Heading 3': 3,
  'Heading4': 4, 'heading4': 4, 'Heading 4': 4,
  'Heading5': 5, 'heading5': 5, 'Heading 5': 5,
  'Heading6': 6, 'heading6': 6, 'Heading 6': 6,
};

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

  // Add images found in runs
  for (const elem of doc.body) {
    if (elem.type === 'paragraph') {
      for (const run of elem.item.runs) {
        if (run.image) {
          addImageToBuilder(builder, run.image);
        }
      }
    }
  }

  return builder.build();
}

function addParagraphToBuilder(builder: HwpxBuilder, para: DocxParagraph): void {
  // Check for images in runs
  for (const run of para.runs) {
    if (run.image) {
      // Image will be added separately; add text part if any
      const text = extractParagraphText(para);
      if (text.trim()) {
        const style = mergeParagraphStyle(para);
        builder.addParagraph(text, style);
      }
      return;
    }
  }

  const text = extractParagraphText(para);
  const style = mergeParagraphStyle(para);

  // Handle lists by prepending bullet/number markers
  if (para.numPr) {
    const prefix = para.numPr.numId > 0 ? '• ' : '';
    builder.addParagraph(prefix + text, style);
    return;
  }

  builder.addParagraph(text, style);
}

function addImageToBuilder(builder: HwpxBuilder, image: DocxImage): void {
  const ext = image.path.split('.').pop()?.toLowerCase() ?? 'png';
  const EMU_PER_INCH = 914400;
  const HWP_PER_INCH = 7200;

  // Convert EMU to HWP units
  const width = image.width ? Math.round((image.width / EMU_PER_INCH) * HWP_PER_INCH) : undefined;
  const height = image.height ? Math.round((image.height / EMU_PER_INCH) * HWP_PER_INCH) : undefined;

  builder.addImage(image.data, ext, width, height);
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

  // Map heading styles to larger font sizes
  if (para.styleId) {
    const headingLevel = HEADING_STYLE_MAP[para.styleId];
    if (headingLevel) {
      // Heading sizes: h1=28pt, h2=24pt, h3=20pt, h4=16pt, h5=14pt, h6=12pt
      const sizes = [28, 24, 20, 16, 14, 12];
      style.fontSize = sizes[headingLevel - 1] ?? 12;
      style.bold = true;
    }
  }

  // Use formatting from first run (simplified — full impl would create multiple runs)
  const firstRun = para.runs[0];
  if (firstRun?.style) {
    if (firstRun.style.bold) style.bold = true;
    if (firstRun.style.italic) style.italic = true;
    if (firstRun.style.fontSize && !style.fontSize) {
      // DOCX fontSize is in half-points, HwpxBuilder expects pt
      style.fontSize = firstRun.style.fontSize / 2;
    }
  }

  return style;
}
