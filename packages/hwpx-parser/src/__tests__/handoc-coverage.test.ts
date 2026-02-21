/**
 * Additional HanDoc tests to cover uncovered getters and edge cases.
 */
import { describe, it, expect } from 'vitest';
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
