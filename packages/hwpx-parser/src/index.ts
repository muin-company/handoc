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

export const VERSION = '0.1.0';
