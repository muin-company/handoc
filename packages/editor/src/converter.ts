/**
 * Convert between HWPX binary and ProseMirror EditorState.
 */
import { EditorState } from 'prosemirror-state';
import { Node as PMNode, Mark } from 'prosemirror-model';
import { HanDoc } from '@handoc/hwpx-parser';
import { HwpxBuilder } from '@handoc/hwpx-writer';
import type { Section, Paragraph, Run, RunChild, CharProperty, ParaProperty, GenericElement } from '@handoc/document-model';
import { hanDocSchema } from './schema';

/**
 * Convert a parsed Section array into ProseMirror doc node.
 */
function sectionsToDoc(
  sections: Section[],
  charProperties: CharProperty[],
  paraProperties: ParaProperty[],
): PMNode {
  const schema = hanDocSchema;

  const sectionNodes = sections.map(section => {
    const blockNodes: PMNode[] = [];

    for (const para of section.paragraphs) {
      const converted = paragraphToBlocks(para, charProperties, paraProperties);
      blockNodes.push(...converted);
    }

    // Ensure at least one paragraph in the section
    if (blockNodes.length === 0) {
      blockNodes.push(schema.nodes.paragraph.create());
    }

    return schema.nodes.section.create(
      {
        pageWidth: section.sectionProps?.pageWidth ?? null,
        pageHeight: section.sectionProps?.pageHeight ?? null,
        landscape: section.sectionProps?.landscape ?? false,
      },
      blockNodes,
    );
  });

  return schema.nodes.doc.create(null, sectionNodes);
}

/**
 * Convert a paragraph to one or more block nodes (paragraph, table, image, etc.)
 */
function paragraphToBlocks(
  para: Paragraph,
  charProperties: CharProperty[],
  paraProperties: ParaProperty[],
): PMNode[] {
  const schema = hanDocSchema;
  const result: PMNode[] = [];

  // Check if this paragraph contains special elements (table, image, etc.)
  let hasTable = false;
  let hasImage = false;
  
  for (const run of para.runs) {
    for (const child of run.children) {
      if (child.type === 'table') {
        hasTable = true;
      } else if (child.type === 'inlineObject' || child.type === 'shape') {
        hasImage = true;
      }
    }
  }

  // If paragraph contains a table, convert it
  if (hasTable) {
    for (const run of para.runs) {
      for (const child of run.children) {
        if (child.type === 'table') {
          const tableNode = tableElementToNode(child.element, charProperties, paraProperties);
          if (tableNode) {
            result.push(tableNode);
          }
        }
      }
    }
  }
  
  // If paragraph contains an image, convert it
  if (hasImage) {
    for (const run of para.runs) {
      for (const child of run.children) {
        if (child.type === 'inlineObject' || child.type === 'shape') {
          const imageNode = imageElementToNode(child.element);
          if (imageNode) {
            result.push(imageNode);
          }
        }
      }
    }
  }

  // If no special elements, convert to regular paragraph
  if (!hasTable && !hasImage) {
    const inlineNodes = paragraphToInline(para, charProperties);
    const paraAttrs = getParagraphAttrs(para, paraProperties);
    result.push(schema.nodes.paragraph.create(paraAttrs, inlineNodes));
  }

  return result;
}

function tableElementToNode(
  element: GenericElement,
  charProperties: CharProperty[],
  paraProperties: ParaProperty[],
): PMNode | null {
  const schema = hanDocSchema;
  
  // Extract table rows from the generic element
  // HWPX table structure: <tbl> contains <tr> elements
  const rows: PMNode[] = [];
  
  for (const child of element.children || []) {
    if (child.tag === 'tr') {
      const cells: PMNode[] = [];
      
      for (const cellChild of child.children || []) {
        if (cellChild.tag === 'tc') {
          // Extract cell paragraphs
          const cellParas: PMNode[] = [];
          
          // Get cell attributes
          const colspan = parseInt(cellChild.attrs?.colspan || '1', 10);
          const rowspan = parseInt(cellChild.attrs?.rowspan || '1', 10);
          
          // Extract paragraphs from cell
          for (const cellElement of cellChild.children || []) {
            if (cellElement.tag === 'p') {
              // Convert HWPX paragraph structure to our Paragraph type
              const para = extractParagraphFromElement(cellElement);
              if (para) {
                const inlineNodes = paragraphToInline(para, charProperties);
                const paraAttrs = getParagraphAttrs(para, paraProperties);
                cellParas.push(schema.nodes.paragraph.create(paraAttrs, inlineNodes));
              }
            }
          }
          
          // Ensure at least one paragraph
          if (cellParas.length === 0) {
            cellParas.push(schema.nodes.paragraph.create());
          }
          
          cells.push(schema.nodes.table_cell.create({ colspan, rowspan }, cellParas));
        }
      }
      
      if (cells.length > 0) {
        rows.push(schema.nodes.table_row.create(null, cells));
      }
    }
  }
  
  if (rows.length === 0) return null;
  
  return schema.nodes.table.create(null, rows);
}

function imageElementToNode(element: GenericElement): PMNode | null {
  const schema = hanDocSchema;
  
  // Extract image properties from the element
  // This is simplified - real implementation would extract actual image data
  const src = element.attrs?.href || element.attrs?.src || null;
  const width = element.attrs?.width || null;
  const height = element.attrs?.height || null;
  
  if (!src) return null;
  
  return schema.nodes.image.create({ src, width, height, alt: null });
}

function extractParagraphFromElement(element: GenericElement): Paragraph | null {
  // Simplified extraction - convert GenericElement to Paragraph structure
  // In a real implementation, this would properly parse the HWPX paragraph structure
  const runs: Run[] = [];
  
  for (const child of element.children || []) {
    if (child.tag === 'run' || child.tag === 'r') {
      const runChildren: RunChild[] = [];
      
      for (const runChild of child.children || []) {
        if (runChild.tag === 't' && runChild.text) {
          runChildren.push({ type: 'text', content: runChild.text });
        }
      }
      
      if (runChildren.length > 0) {
        runs.push({
          charPrIDRef: parseInt(child.attrs?.charPrIDRef || 'null', 10) || null,
          children: runChildren,
        });
      }
    }
  }
  
  return {
    id: element.attrs?.id || null,
    paraPrIDRef: parseInt(element.attrs?.paraPrIDRef || 'null', 10) || null,
    styleIDRef: parseInt(element.attrs?.styleIDRef || 'null', 10) || null,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs,
    lineSegArray: [],
  };
}

function getParagraphAttrs(para: Paragraph, paraProperties: ParaProperty[]): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    styleIDRef: para.styleIDRef,
    paraPrIDRef: para.paraPrIDRef,
  };

  // Add alignment if available from paraProperty
  if (para.paraPrIDRef !== null) {
    const paraPr = paraProperties.find(pp => pp.id === para.paraPrIDRef);
    if (paraPr?.align) {
      attrs.align = paraPr.align;
    }
  }

  return attrs;
}

function paragraphToInline(para: Paragraph, charProperties: CharProperty[]): PMNode[] {
  const schema = hanDocSchema;
  const result: PMNode[] = [];

  for (const run of para.runs) {
    const marks = getMarksFromCharPr(run.charPrIDRef, charProperties);

    for (const child of run.children) {
      if (child.type === 'text' && child.content) {
        result.push(schema.text(child.content, marks));
      }
      // Other child types (table, image, etc.) skipped for now
    }
  }

  return result;
}

function getMarksFromCharPr(charPrIDRef: number | null, charProperties: CharProperty[]): Mark[] {
  if (charPrIDRef === null) return [];

  const charPr = charProperties.find(cp => cp.id === charPrIDRef);
  if (!charPr) return [];

  const schema = hanDocSchema;
  const marks: Mark[] = [];

  // Bold
  if (charPr.bold) {
    marks.push(schema.marks.bold.create());
  }

  // Italic
  if (charPr.italic) {
    marks.push(schema.marks.italic.create());
  }

  // Underline (any truthy value in HWPX means underline)
  if (charPr.underline && charPr.underline !== 'NONE') {
    marks.push(schema.marks.underline.create());
  }

  // Strikeout
  if (charPr.strikeout && charPr.strikeout !== 'NONE') {
    marks.push(schema.marks.strikeout.create());
  }

  // Text color
  if (charPr.textColor) {
    marks.push(schema.marks.textColor.create({ color: charPr.textColor }));
  }

  // Font size (height in HWPX is in 1/100 points)
  if (charPr.height) {
    const sizeInPt = charPr.height / 100;
    marks.push(schema.marks.fontSize.create({ size: `${sizeInPt}pt` }));
  }

  // Font family (if available from fontRef - simplified)
  // In a real implementation, this would look up the actual font face name
  if (charPr.fontRef) {
    // Extract font family if available
    const fontId = charPr.fontRef.hangul || charPr.fontRef.latin;
    if (fontId !== undefined) {
      // For now, use a generic family name
      // A full implementation would look this up in the FontFaceDecl list
      marks.push(schema.marks.fontFamily.create({ family: `font-${fontId}` }));
    }
  }

  return marks;
}

/**
 * Parse HWPX binary → ProseMirror EditorState.
 */
export async function hwpxToEditorState(buffer: Uint8Array): Promise<EditorState> {
  const doc = await HanDoc.fromBuffer(buffer);
  const sections = doc.sections;
  const header = doc.header;

  const charProperties = header.refList.charProperties;
  const paraProperties = header.refList.paraProperties;

  const pmDoc = sectionsToDoc(sections, charProperties, paraProperties);

  return EditorState.create({
    doc: pmDoc,
    schema: hanDocSchema,
  });
}

/**
 * Convert ProseMirror EditorState → HWPX binary.
 * 
 * NOTE: Current limitation - HwpxBuilder applies uniform formatting to entire paragraph.
 * If a paragraph has mixed formatting (e.g., "normal **bold** normal"), we can only
 * preserve the dominant formatting. Full run-level formatting requires extending HwpxBuilder.
 */
export async function editorStateToHwpx(state: EditorState): Promise<Uint8Array> {
  const doc = state.doc;
  const builder = HwpxBuilder.create();

  // Track if we need section breaks
  let isFirstSection = true;

  doc.forEach(sectionNode => {
    // Add section break between sections
    if (!isFirstSection) {
      builder.addSectionBreak();
    }
    isFirstSection = false;

    sectionNode.forEach(blockNode => {
      if (blockNode.type.name === 'paragraph') {
        // Extract text with formatting
        const segments = extractFormattedSegments(blockNode);
        
        // Combine segments into text
        const text = segments.map(s => s.text).join('');
        
        // Get paragraph-level attributes
        const align = blockNode.attrs.align as string | undefined;
        
        // Try to extract dominant formatting from first segment
        // This is a simplification - ideally we'd preserve per-run formatting
        const firstSegment = segments[0];
        const style: any = { align };
        
        if (firstSegment) {
          if (firstSegment.bold) style.bold = true;
          if (firstSegment.italic) style.italic = true;
          if (firstSegment.fontSize) {
            // Extract numeric value from "12pt" format
            const match = firstSegment.fontSize.match(/(\d+(\.\d+)?)/);
            if (match) style.fontSize = parseFloat(match[1]);
          }
          if (firstSegment.color) style.color = firstSegment.color;
          if (firstSegment.fontFamily) style.fontFamily = firstSegment.fontFamily;
        }
        
        builder.addParagraph(text, style);
      } else if (blockNode.type.name === 'heading') {
        const level = blockNode.attrs.level as number;
        const text = blockNode.textContent;
        builder.addHeading(level, text);
      } else if (blockNode.type.name === 'table') {
        // Convert table node to rows array
        const rows: string[][] = [];
        blockNode.forEach(rowNode => {
          const cellTexts: string[] = [];
          rowNode.forEach(cellNode => {
            cellTexts.push(cellNode.textContent);
          });
          rows.push(cellTexts);
        });
        builder.addTable(rows);
      }
    });
  });

  return builder.build();
}

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeout?: boolean;
  color?: string;
  fontSize?: string;
  fontFamily?: string;
}

function extractFormattedSegments(node: PMNode): TextSegment[] {
  const segments: TextSegment[] = [];

  node.forEach((child, _offset) => {
    if (child.isText && child.text) {
      const segment: TextSegment = { text: child.text };

      child.marks.forEach(mark => {
        switch (mark.type.name) {
          case 'bold':
            segment.bold = true;
            break;
          case 'italic':
            segment.italic = true;
            break;
          case 'underline':
            segment.underline = true;
            break;
          case 'strikeout':
            segment.strikeout = true;
            break;
          case 'textColor':
            segment.color = mark.attrs.color;
            break;
          case 'fontSize':
            segment.fontSize = mark.attrs.size;
            break;
          case 'fontFamily':
            segment.fontFamily = mark.attrs.family;
            break;
        }
      });

      segments.push(segment);
    }
  });

  return segments;
}
