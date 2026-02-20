/**
 * GenericElement — preserves unsupported/unknown XML elements for round-trip safety.
 */
export interface GenericElement {
  tag: string;
  attrs: Record<string, string>;
  children: GenericElement[];
  text?: string;
}
