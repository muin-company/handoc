/**
 * @handoc/docx-reader — Parse DOCX files and convert to HWPX
 */

export { parseDocx } from './docx-parser';
export type {
  DocxDocument,
  DocxParagraph,
  DocxRun,
  DocxRunStyle,
  DocxTable,
  DocxTableRow,
  DocxTableCell,
  DocxSection,
} from './docx-parser';

export { docxToHwpx } from './docx-to-hwpx';
