export { HanDoc, type HanDocMetadata, type TrackChange, type HiddenComment } from './handoc';
export { extractImages, type ImageInfo } from './image-extractor';
export { parseHeader } from './header-parser';
export type { DocumentHeader } from './header-parser';
export { parseSection, extractText } from './section-parser';
export { parseSectionProps, type SectionProperties } from './section-props-parser';
export { parseParagraph, parseRun, parseRunChild, parseGenericElement } from './paragraph-parser';
export type {
  Section,
  Paragraph,
  Run,
  RunChild,
  LineSeg,
  GenericElement,
} from './types';
export { parseXml, getAttr, getAttrs, getChildren } from './xml-utils';

export { parseTable, tableToTextGrid } from './table-parser';
export type { ParsedTable, ParsedTableRow, ParsedTableCell, CellAddress, CellSpan, CellSize } from './table-parser';

export { parseShape } from './shape-parser';
export type { Shape } from './shape-parser';

export { parseEquation } from './equation-parser';
export type { Equation } from './equation-parser';

export { parseField, parseFieldEnd } from './field-parser';
export type { Field } from './field-parser';

export {
  parseHeaderFooter, parseFootnote,
  collectHeadersFooters, collectFootnotes,
  extractAnnotationText,
} from './annotation-parser';
export type { HeaderFooter, Footnote } from './annotation-parser';

export const VERSION = '0.1.0';
