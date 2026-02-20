/**
 * Convert between HWPX binary and ProseMirror EditorState.
 */
import { EditorState } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';
import { HanDoc } from '@handoc/hwpx-parser';
import { HwpxBuilder } from '@handoc/hwpx-writer';
import type { Section, Paragraph, Run, RunChild } from '@handoc/document-model';
import { hanDocSchema } from './schema';

/**
 * Convert a parsed Section array into ProseMirror doc node.
 */
function sectionsToDoc(sections: Section[]): PMNode {
  const schema = hanDocSchema;

  const sectionNodes = sections.map(section => {
    const blockNodes: PMNode[] = [];

    for (const para of section.paragraphs) {
      const inlineNodes = paragraphToInline(para);
      blockNodes.push(schema.nodes.paragraph.create(
        {
          styleIDRef: para.styleIDRef,
          paraPrIDRef: para.paraPrIDRef,
        },
        inlineNodes,
      ));
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

function paragraphToInline(para: Paragraph): PMNode[] {
  const schema = hanDocSchema;
  const result: PMNode[] = [];

  for (const run of para.runs) {
    for (const child of run.children) {
      if (child.type === 'text' && child.content) {
        result.push(schema.text(child.content));
      }
      // Other child types (table, image, etc.) skipped for now — scaffold only
    }
  }

  return result;
}

/**
 * Parse HWPX binary → ProseMirror EditorState.
 */
export async function hwpxToEditorState(buffer: Uint8Array): Promise<EditorState> {
  const doc = await HanDoc.fromBuffer(buffer);
  const sections = doc.sections;
  const pmDoc = sectionsToDoc(sections);

  return EditorState.create({
    doc: pmDoc,
    schema: hanDocSchema,
  });
}

/**
 * Convert ProseMirror EditorState → HWPX binary.
 */
export async function editorStateToHwpx(state: EditorState): Promise<Uint8Array> {
  const doc = state.doc;
  const sections: Section[] = [];

  doc.forEach(sectionNode => {
    const paragraphs: Paragraph[] = [];

    sectionNode.forEach(blockNode => {
      if (blockNode.type.name === 'paragraph' || blockNode.type.name === 'heading') {
        const runs: Run[] = [];
        const textContent = blockNode.textContent;

        if (textContent) {
          const children: RunChild[] = [{ type: 'text', content: textContent }];
          runs.push({ charPrIDRef: null, children });
        }

        paragraphs.push({
          id: null,
          paraPrIDRef: blockNode.attrs.paraPrIDRef ?? null,
          styleIDRef: blockNode.attrs.styleIDRef ?? null,
          pageBreak: false,
          columnBreak: false,
          merged: false,
          runs,
          lineSegArray: [],
        });
      }
    });

    sections.push({
      paragraphs,
      sectionProps: sectionNode.attrs.pageWidth ? {
        pageWidth: sectionNode.attrs.pageWidth,
        pageHeight: sectionNode.attrs.pageHeight,
        margins: { left: 0, right: 0, top: 0, bottom: 0, header: 0, footer: 0, gutter: 0 },
        landscape: sectionNode.attrs.landscape,
      } : undefined,
    });
  });

  const builder = HwpxBuilder.create();
  for (let i = 0; i < sections.length; i++) {
    if (i > 0) builder.addSectionBreak();
    const section = sections[i];
    for (const para of section.paragraphs) {
      const text = para.runs.map(r =>
        r.children.filter(c => c.type === 'text').map(c => (c as { type: 'text'; content: string }).content).join('')
      ).join('');
      builder.addParagraph(text);
    }
  }
  return builder.build();
}
