/**
 * Additional HanDoc tests to cover uncovered getters and edge cases.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HanDoc } from '../handoc';

const FIXTURES = resolve(__dirname, '../../../../fixtures/hwpx');

function readFixture(name: string): Uint8Array {
  return readFileSync(resolve(FIXTURES, name));
}

describe('HanDoc property getters', () => {
  it('opcPackage returns the underlying package', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(doc.opcPackage).toBeDefined();
    expect(doc.opcPackage.partNames).toBeDefined();
  });

  it('sectionProps returns first section properties', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const props = doc.sectionProps;
    // May or may not exist depending on fixture
    if (props) {
      expect(props.pageWidth).toBeGreaterThan(0);
    }
  });

  it('landscape returns boolean', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(typeof doc.landscape).toBe('boolean');
  });

  it('pageSize returns width and height in mm', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const size = doc.pageSize;
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  it('margins returns margin values', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const m = doc.margins;
    expect(m).toHaveProperty('left');
    expect(m).toHaveProperty('right');
    expect(m).toHaveProperty('top');
    expect(m).toHaveProperty('bottom');
    expect(m).toHaveProperty('header');
    expect(m).toHaveProperty('footer');
    expect(m).toHaveProperty('gutter');
  });

  it('headers returns array (possibly empty)', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(Array.isArray(doc.headers)).toBe(true);
  });

  it('footers returns array (possibly empty)', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(Array.isArray(doc.footers)).toBe(true);
  });

  it('footers getter triggers headers computation', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    // Access footers first (without accessing headers first)
    const footers = doc.footers;
    expect(Array.isArray(footers)).toBe(true);
  });

  it('footnotes returns array (possibly empty)', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(Array.isArray(doc.footnotes)).toBe(true);
  });

  it('shapes returns array (possibly empty)', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(Array.isArray(doc.shapes)).toBe(true);
  });

  it('equations returns array (possibly empty)', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(Array.isArray(doc.equations)).toBe(true);
  });

  it('trackChanges returns array', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(Array.isArray(doc.trackChanges)).toBe(true);
  });

  it('hiddenComments returns array (possibly empty)', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(Array.isArray(doc.hiddenComments)).toBe(true);
  });

  it('warnings returns array', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(Array.isArray(doc.warnings)).toBe(true);
  });

  it('warningCollector returns collector instance', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(doc.warningCollector).toBeDefined();
    expect(doc.warningCollector.toJSON).toBeDefined();
  });

  it('images getter returns empty for simple text', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(doc.images).toHaveLength(0);
  });

  it('getImage returns null for non-existent path', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    expect(doc.getImage('nonexistent.png')).toBeNull();
  });

  it('extractTextBySection returns one entry per section', async () => {
    const doc = await HanDoc.open(readFixture('multi-section.hwpx'));
    const texts = doc.extractTextBySection();
    expect(texts.length).toBe(doc.sections.length);
  });
});

describe('HanDoc trackChanges with mock header', () => {
  it('resolves authors by id and mark', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    // Inject mock track change data into the header
    const header = doc.header as any;
    header.trackChanges = [
      { id: 1, type: 'Insert', date: '2024-01-01', authorID: 1, hide: false },
      { id: 2, type: 'Delete', date: '2024-01-02', authorID: 99, hide: true },
    ];
    header.trackChangeAuthors = [
      { id: 1, name: 'Alice', mark: 10 },
    ];
    const tc = doc.trackChanges;
    expect(tc).toHaveLength(2);
    expect(tc[0].author).toBe('Alice');
    expect(tc[0].type).toBe('Insert');
    // authorID 99 not found by id, try mark — also not found, fallback
    expect(tc[1].author).toBe('Author#99');
  });

  it('resolves author by mark when id lookup fails', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const header = doc.header as any;
    header.trackChanges = [
      { id: 1, type: 'Insert', date: '2024-01-01', authorID: 5, hide: false },
    ];
    header.trackChangeAuthors = [
      { id: 99, name: 'Bob', mark: 5 },
    ];
    const tc = doc.trackChanges;
    expect(tc[0].author).toBe('Bob');
  });
});

describe('HanDoc hiddenComments via section injection', () => {
  it('collects hidden comments from sections', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    // Inject a hidden comment into the sections
    const sections = doc.sections;
    if (sections.length > 0 && sections[0].paragraphs.length > 0) {
      sections[0].paragraphs[0].runs.push({
        charPrIDRef: null,
        children: [{
          type: 'hiddenComment' as const,
          paragraphs: [{
            id: null, paraPrIDRef: null, styleIDRef: null,
            pageBreak: false, columnBreak: false, merged: false,
            runs: [{
              charPrIDRef: null,
              children: [{ type: 'text' as const, content: 'This is a comment' }],
            }],
            lineSegArray: [],
          }],
        }],
      });
    }
    const comments = doc.hiddenComments;
    expect(comments.length).toBeGreaterThan(0);
    expect(comments[0].text).toBe('This is a comment');
  });
});

describe('HanDoc shapes/equations via section injection', () => {
  it('collects shapes from sections', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const sections = doc.sections;
    if (sections.length > 0 && sections[0].paragraphs.length > 0) {
      sections[0].paragraphs[0].runs.push({
        charPrIDRef: null,
        children: [{
          type: 'shape' as const,
          name: 'rect',
          element: {
            tag: 'rect',
            attrs: { id: '1' },
            children: [{
              tag: 'offset',
              attrs: { x: '100', y: '200' },
              children: [],
              text: null,
            }, {
              tag: 'orgSz',
              attrs: { width: '300', height: '400' },
              children: [],
              text: null,
            }],
            text: null,
          },
        }],
      });
    }
    // Clear cache to force recomputation
    (doc as any)._shapes = null;
    const shapes = doc.shapes;
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('collects equations from sections', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const sections = doc.sections;
    if (sections.length > 0 && sections[0].paragraphs.length > 0) {
      sections[0].paragraphs[0].runs.push({
        charPrIDRef: null,
        children: [{
          type: 'equation' as const,
          element: {
            tag: 'equation',
            attrs: {},
            children: [{
              tag: 'script',
              attrs: {},
              children: [],
              text: 'x^2 + y^2 = z^2',
            }],
            text: null,
          },
        }],
      });
    }
    (doc as any)._equations = null;
    const equations = doc.equations;
    expect(equations.length).toBeGreaterThan(0);
  });
});

describe('HanDoc defaults when no sectionProps', () => {
  it('pageSize returns A4 default when no sectionProps', async () => {
    const doc = await HanDoc.open(readFixture('empty.hwpx'));
    // Force sections to have no sectionProps
    const sections = doc.sections;
    for (const s of sections) {
      (s as any).sectionProps = undefined;
    }
    (doc as any)._sections = sections;
    const size = doc.pageSize;
    expect(size).toEqual({ width: 210, height: 297 });
  });

  it('margins returns zeros when no sectionProps', async () => {
    const doc = await HanDoc.open(readFixture('empty.hwpx'));
    const sections = doc.sections;
    for (const s of sections) {
      (s as any).sectionProps = undefined;
    }
    (doc as any)._sections = sections;
    const m = doc.margins;
    expect(m).toEqual({ left: 0, right: 0, top: 0, bottom: 0, header: 0, footer: 0, gutter: 0 });
  });

  it('landscape returns false when no sectionProps', async () => {
    const doc = await HanDoc.open(readFixture('empty.hwpx'));
    const sections = doc.sections;
    for (const s of sections) {
      (s as any).sectionProps = undefined;
    }
    (doc as any)._sections = sections;
    expect(doc.landscape).toBe(false);
  });
});

describe('HanDoc caching', () => {
  it('sections are cached on second access', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const s1 = doc.sections;
    const s2 = doc.sections;
    expect(s1).toBe(s2);
  });

  it('header is cached on second access', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const h1 = doc.header;
    const h2 = doc.header;
    expect(h1).toBe(h2);
  });

  it('shapes are cached on second access', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const s1 = doc.shapes;
    const s2 = doc.shapes;
    expect(s1).toBe(s2);
  });

  it('equations are cached on second access', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const e1 = doc.equations;
    const e2 = doc.equations;
    expect(e1).toBe(e2);
  });

  it('footnotes are cached on second access', async () => {
    const doc = await HanDoc.open(readFixture('simple-text.hwpx'));
    const f1 = doc.footnotes;
    const f2 = doc.footnotes;
    expect(f1).toBe(f2);
  });
});
