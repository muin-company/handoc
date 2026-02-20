import type { GenericElement } from './types';
import { parseParagraph } from './paragraph-parser';
import { getAttrs, getChildren } from './xml-utils';

// ── Table types (hwpx-parser local, mirrors document-model) ──

export interface CellAddress {
  colAddr: number;
  rowAddr: number;
}

export interface CellSpan {
  colSpan: number;
  rowSpan: number;
}

export interface CellSize {
  width: number;
  height: number;
}

export interface ParsedTableCell {
  name: string;
  header: boolean;
  borderFillIDRef: number;
  cellAddr: CellAddress;
  cellSpan: CellSpan;
  cellSz: CellSize;
  paragraphs: ReturnType<typeof parseParagraph>[];
}

export interface ParsedTableRow {
  cells: ParsedTableCell[];
}

export interface ParsedTable {
  id: string;
  rowCnt: number;
  colCnt: number;
  cellSpacing: number;
  borderFillIDRef: number;
  repeatHeader: boolean;
  noAdjust: boolean;
  rows: ParsedTableRow[];
}

// ── Helpers ──

function int(v: string | undefined, fallback = 0): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: string | undefined): boolean {
  return v === '1' || v === 'true';
}

// ── Parse from GenericElement ──

function findChild(el: GenericElement, tag: string): GenericElement | undefined {
  return el.children.find(c => c.tag === tag);
}

function findAllChildren(el: GenericElement, tag: string): GenericElement[] {
  return el.children.filter(c => c.tag === tag);
}

function parseCellFromGeneric(tc: GenericElement): ParsedTableCell {
  const addr = findChild(tc, 'cellAddr');
  const span = findChild(tc, 'cellSpan');
  const sz = findChild(tc, 'cellSz');

  // Parse paragraphs from subList > p
  const paragraphs: ReturnType<typeof parseParagraph>[] = [];
  const subList = findChild(tc, 'subList');
  if (subList) {
    for (const pEl of findAllChildren(subList, 'p')) {
      paragraphs.push(parseParagraphFromGeneric(pEl));
    }
  }

  return {
    name: tc.attrs['name'] ?? '',
    header: bool(tc.attrs['header']),
    borderFillIDRef: int(tc.attrs['borderFillIDRef']),
    cellAddr: {
      colAddr: int(addr?.attrs['colAddr']),
      rowAddr: int(addr?.attrs['rowAddr']),
    },
    cellSpan: {
      colSpan: int(span?.attrs['colSpan'], 1),
      rowSpan: int(span?.attrs['rowSpan'], 1),
    },
    cellSz: {
      width: int(sz?.attrs['width']),
      height: int(sz?.attrs['height']),
    },
    paragraphs,
  };
}

/**
 * Reconstruct a raw XML-like node object from GenericElement
 * so we can reuse parseParagraph.
 */
function genericToRawNode(el: GenericElement): Record<string, unknown> {
  const node: Record<string, unknown> = {};

  // Restore attributes
  for (const [k, v] of Object.entries(el.attrs)) {
    node['@_' + k] = v;
  }

  // Restore text
  if (el.text != null) {
    node['#text'] = el.text;
  }

  // Group children by tag (multiple same-tag → array)
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const child of el.children) {
    const arr = grouped.get(child.tag) ?? [];
    arr.push(genericToRawNode(child));
    grouped.set(child.tag, arr);
  }
  for (const [tag, items] of grouped) {
    node[tag] = items.length === 1 ? items[0] : items;
  }

  return node;
}

function parseParagraphFromGeneric(pEl: GenericElement): ReturnType<typeof parseParagraph> {
  return parseParagraph(genericToRawNode(pEl));
}

/**
 * Parse a table GenericElement (tag: 'tbl') into a structured ParsedTable.
 * The original GenericElement is preserved in RunChild — this is opt-in.
 */
export function parseTable(element: GenericElement): ParsedTable {
  const a = element.attrs;
  const rows: ParsedTableRow[] = [];

  for (const trEl of findAllChildren(element, 'tr')) {
    const cells: ParsedTableCell[] = [];
    for (const tcEl of findAllChildren(trEl, 'tc')) {
      cells.push(parseCellFromGeneric(tcEl));
    }
    rows.push({ cells });
  }

  return {
    id: a['id'] ?? '',
    rowCnt: int(a['rowCnt']),
    colCnt: int(a['colCnt']),
    cellSpacing: int(a['cellSpacing']),
    borderFillIDRef: int(a['borderFillIDRef']),
    repeatHeader: bool(a['repeatHeader']),
    noAdjust: bool(a['noAdjust']),
    rows,
  };
}

/**
 * Convenience: extract all cell texts as a 2D string array.
 */
export function tableToTextGrid(table: ParsedTable): string[][] {
  return table.rows.map(row =>
    row.cells.map(cell =>
      cell.paragraphs
        .flatMap(p => p.runs.flatMap(r =>
          r.children
            .filter((c): c is { type: 'text'; content: string } => c.type === 'text')
            .map(c => c.content),
        ))
        .join(''),
    ),
  );
}
