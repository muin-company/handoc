/**
 * Re-export all types from @handoc/document-model.
 * Parser code imports from this file for convenience;
 * the canonical definitions live in document-model.
 */
export type {
  Section,
  Paragraph,
  Run,
  RunChild,
  LineSeg,
  SectionProperties,
} from '@handoc/document-model';
export type { GenericElement } from '@handoc/document-model';
