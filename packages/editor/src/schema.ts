/**
 * ProseMirror Schema for HWPX documents.
 */
import { Schema, type NodeSpec, type MarkSpec } from 'prosemirror-model';

const nodes: Record<string, NodeSpec> = {
  doc: {
    content: 'section+',
  },
  section: {
    content: '(paragraph | heading | table | image)+',
    group: 'block',
    attrs: {
      pageWidth: { default: null },
      pageHeight: { default: null },
      landscape: { default: false },
    },
    parseDOM: [{ tag: 'section' }],
    toDOM() { return ['section', 0]; },
  },
  paragraph: {
    content: 'inline*',
    group: 'block',
    attrs: {
      styleIDRef: { default: null },
      paraPrIDRef: { default: null },
    },
    parseDOM: [{ tag: 'p' }],
    toDOM() { return ['p', 0]; },
  },
  heading: {
    content: 'inline*',
    group: 'block',
    attrs: {
      level: { default: 1 },
    },
    parseDOM: [1, 2, 3, 4, 5, 6].map(level => ({
      tag: `h${level}`,
      attrs: { level },
    })),
    toDOM(node) { return [`h${node.attrs.level}`, 0]; },
  },
  text: {
    group: 'inline',
  },
  image: {
    inline: false,
    group: 'block',
    attrs: {
      src: { default: null },
      alt: { default: null },
      width: { default: null },
      height: { default: null },
    },
    parseDOM: [{ tag: 'img[src]', getAttrs(dom) {
      const el = dom as unknown as { getAttribute(n: string): string | null };
      return {
        src: el.getAttribute('src'),
        alt: el.getAttribute('alt'),
        width: el.getAttribute('width'),
        height: el.getAttribute('height'),
      };
    }}],
    toDOM(node) {
      return ['img', node.attrs];
    },
  },
  table: {
    content: 'table_row+',
    group: 'block',
    tableRole: 'table',
    parseDOM: [{ tag: 'table' }],
    toDOM() { return ['table', ['tbody', 0]]; },
  },
  table_row: {
    content: 'table_cell+',
    tableRole: 'row',
    parseDOM: [{ tag: 'tr' }],
    toDOM() { return ['tr', 0]; },
  },
  table_cell: {
    content: '(paragraph | heading)+',
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
    },
    tableRole: 'cell',
    parseDOM: [{ tag: 'td', getAttrs(dom) {
      const el = dom as unknown as { getAttribute(n: string): string | null };
      return {
        colspan: Number(el.getAttribute('colspan') || 1),
        rowspan: Number(el.getAttribute('rowspan') || 1),
      };
    }}],
    toDOM(node) {
      const attrs: Record<string, string> = {};
      if (node.attrs.colspan > 1) attrs.colspan = String(node.attrs.colspan);
      if (node.attrs.rowspan > 1) attrs.rowspan = String(node.attrs.rowspan);
      return ['td', attrs, 0];
    },
  },
};

const marks: Record<string, MarkSpec> = {
  bold: {
    parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }],
    toDOM() { return ['strong', 0]; },
  },
  italic: {
    parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
    toDOM() { return ['em', 0]; },
  },
  underline: {
    parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
    toDOM() { return ['u', 0]; },
  },
  strikeout: {
    parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
    toDOM() { return ['s', 0]; },
  },
  textColor: {
    attrs: { color: {} },
    parseDOM: [{ style: 'color', getAttrs(value: string) { return { color: value }; } }],
    toDOM(mark) { return ['span', { style: `color: ${mark.attrs.color}` }, 0]; },
  },
  fontSize: {
    attrs: { size: {} },
    parseDOM: [{ style: 'font-size', getAttrs(value: string) { return { size: value }; } }],
    toDOM(mark) { return ['span', { style: `font-size: ${mark.attrs.size}` }, 0]; },
  },
};

export const hanDocSchema = new Schema({ nodes, marks });
