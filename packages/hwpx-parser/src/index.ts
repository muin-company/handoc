export { HanDoc, type HanDocMetadata } from './handoc';
export { parseHeader } from './header-parser';
export type { DocumentHeader } from './header-parser';
export { parseSection, extractText } from './section-parser';
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

export const VERSION = '0.1.0';
