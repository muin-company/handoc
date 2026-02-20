import {
  Document,
  Packer,
  Paragraph as DocxParagraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageBreak,
  SectionType,
} from 'docx';
import { HanDoc } from '@handoc/hwpx-parser';
import type {
  Section,
  Paragraph,
  Run,
  RunChild,
  CharProperty,
  ParaProperty,
  GenericElement,
  SectionProperties,
} from '@handoc/document-model';
import type { DocumentHeader } from '@handoc/document-model';

const MM_TO_TWIP = 56.692; // 1mm ≈ 56.692 twips (1 twip = 1/1440 inch)
const HWPUNIT_PER_INCH = 7200;
const TWIPS_PER_INCH = 1440;

function hwpUnitToTwip(hu: number): number {
  return Math.round((hu / HWPUNIT_PER_INCH) * TWIPS_PER_INCH);
}

function hwpUnitToHalfPt(hu: number): number {
  // docx uses half-points for font size
  return Math.round((hu / 100) * 2);
}

const ALIGN_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
  distribute: AlignmentType.DISTRIBUTE,
};

/**
 * Convert an HWPX buffer to DOCX buffer.
 */
export async function hwpxToDocx(hwpxBuffer: Uint8Array): Promise<Uint8Array> {
  const doc = await HanDoc.open(hwpxBuffer);
  const header = doc.header;
  const sections = doc.sections;

  const docxSections = sections.map((section, idx) => {
    const children = convertSection(section, header);
    const sectionProps = section.sectionProps;

    return {
      properties: sectionProps ? convertSectionProperties(sectionProps) : {},
      children,
    };
  });

  const docxDoc = new Document({
    creator: doc.metadata.creator ?? 'HanDoc',
    title: doc.metadata.title,
    sections: docxSections,
  });

  const buffer = await Packer.toBuffer(docxDoc);
  return new Uint8Array(buffer);
}

function convertSectionProperties(props: SectionProperties) {
  return {
    page: {
      size: {
        width: hwpUnitToTwip(props.pageWidth),
        height: hwpUnitToTwip(props.pageHeight),
        orientation: props.landscape ? 'landscape' as const : undefined,
      },
      margin: {
        top: hwpUnitToTwip(props.margins.top),
        bottom: hwpUnitToTwip(props.margins.bottom),
        left: hwpUnitToTwip(props.margins.left),
        right: hwpUnitToTwip(props.margins.right),
        header: hwpUnitToTwip(props.margins.header),
        footer: hwpUnitToTwip(props.margins.footer),
        gutter: hwpUnitToTwip(props.margins.gutter),
      },
    },
  };
}

function convertSection(
  section: Section,
  header: DocumentHeader,
): (DocxParagraph | Table)[] {
  const result: (DocxParagraph | Table)[] = [];

  for (const para of section.paragraphs) {
    const converted = convertParagraph(para, header);
    result.push(...converted);
  }

  return result;
}

function convertParagraph(
  para: Paragraph,
  header: DocumentHeader,
): (DocxParagraph | Table)[] {
  const result: (DocxParagraph | Table)[] = [];
  const textRuns: TextRun[] = [];
  const paraProp = para.paraPrIDRef != null
    ? header.refList.paraProperties.find(p => p.id === para.paraPrIDRef)
    : undefined;

  // Check for page break
  if (para.pageBreak) {
    textRuns.push(new TextRun({ children: [new PageBreak()] }));
  }

  for (const run of para.runs) {
    const charProp = run.charPrIDRef != null
      ? header.refList.charProperties.find(c => c.id === run.charPrIDRef)
      : undefined;

    for (const child of run.children) {
      if (child.type === 'text') {
        textRuns.push(createTextRun(child.content, charProp));
      } else if (child.type === 'table') {
        // Flush accumulated text runs as a paragraph first
        if (textRuns.length > 0) {
          result.push(createDocxParagraph(textRuns.splice(0), paraProp));
        }
        const table = convertTable(child.element, header);
        if (table) result.push(table);
      }
      // Other types (ctrl, secPr, inlineObject, trackChange) are skipped for now
    }
  }

  // Flush remaining text runs
  if (textRuns.length > 0 || result.length === 0) {
    result.push(createDocxParagraph(textRuns, paraProp));
  }

  return result;
}

function createDocxParagraph(
  children: TextRun[],
  paraProp?: ParaProperty,
): DocxParagraph {
  return new DocxParagraph({
    children,
    alignment: paraProp?.align ? ALIGN_MAP[paraProp.align] : undefined,
  });
}

function createTextRun(text: string, charProp?: CharProperty): TextRun {
  return new TextRun({
    text,
    bold: charProp?.bold || undefined,
    italics: charProp?.italic || undefined,
    underline: charProp?.underline && charProp.underline !== 'none' ? {} : undefined,
    strike: charProp?.strikeout && charProp.strikeout !== 'none' ? true : undefined,
    size: charProp?.height ? hwpUnitToHalfPt(charProp.height) : undefined,
    color: charProp?.textColor && charProp.textColor !== '000000' ? charProp.textColor : undefined,
  });
}

/**
 * Extract text from a GenericElement tree (used for tables).
 */
function extractTextFromGeneric(el: GenericElement): string {
  let text = el.text ?? '';
  for (const child of el.children) {
    text += extractTextFromGeneric(child);
  }
  return text;
}

/**
 * Convert a table GenericElement to a docx Table.
 */
function convertTable(
  tableEl: GenericElement,
  header: DocumentHeader,
): Table | null {
  // Find rows (tr elements)
  const rows = tableEl.children.filter(c => c.tag === 'tr' || c.tag.endsWith(':tr'));
  if (rows.length === 0) return null;

  const tableRows = rows.map(row => {
    const cells = row.children.filter(c => c.tag === 'tc' || c.tag.endsWith(':tc'));
    const tableCells = cells.map(cell => {
      const cellText = extractTextFromGeneric(cell);
      return new TableCell({
        children: [new DocxParagraph({ children: [new TextRun(cellText)] })],
      });
    });

    // Ensure at least one cell per row
    if (tableCells.length === 0) {
      return new TableRow({
        children: [new TableCell({
          children: [new DocxParagraph({})],
        })],
      });
    }

    return new TableRow({ children: tableCells });
  });

  return new Table({ rows: tableRows });
}
