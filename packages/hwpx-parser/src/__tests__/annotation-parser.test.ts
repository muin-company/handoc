import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HanDoc } from '../handoc';
import { parseHeaderFooter, parseFootnote, extractAnnotationText } from '../annotation-parser';
import type { GenericElement } from '../types';

const FIXTURES = '/Users/mj/handoc-fixtures/real-world';

describe('annotation-parser', () => {
  describe('parseHeaderFooter', () => {
    it('returns null for unrelated ctrl element', () => {
      const el: GenericElement = {
        tag: 'ctrl',
        attrs: {},
        children: [{ tag: 'colPr', attrs: {}, children: [], text: null }],
        text: null,
      };
      expect(parseHeaderFooter(el)).toBeNull();
    });

    it('parses a header GenericElement directly', () => {
      const el: GenericElement = {
        tag: 'header',
        attrs: { applyPageType: 'BOTH' },
        children: [{
          tag: 'subList',
          attrs: {},
          children: [{
            tag: 'p',
            attrs: { id: '0', paraPrIDRef: '0', styleIDRef: '0', pageBreak: '0', columnBreak: '0', merged: '0' },
            children: [{
              tag: 'run',
              attrs: { charPrIDRef: '2' },
              children: [{ tag: 't', attrs: {}, children: [], text: 'Hello Header' }],
              text: null,
            }],
            text: null,
          }],
          text: null,
        }],
        text: null,
      };
      const result = parseHeaderFooter(el);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('header');
      expect(result!.applyPageType).toBe('BOTH');
      expect(result!.paragraphs).toHaveLength(1);
      expect(extractAnnotationText(result!)).toBe('Hello Header');
    });
  });

  describe('parseFootnote', () => {
    it('returns null for non-footnote element', () => {
      const el: GenericElement = {
        tag: 'ctrl',
        attrs: {},
        children: [{ tag: 'header', attrs: {}, children: [], text: null }],
        text: null,
      };
      expect(parseFootnote(el)).toBeNull();
    });
  });

  describe('HanDoc.headers/footers (HeaderFooter.hwpx)', () => {
    let doc: HanDoc;

    it('loads the fixture', async () => {
      const buf = readFileSync(join(FIXTURES, 'opensource/HeaderFooter.hwpx'));
      doc = await HanDoc.open(new Uint8Array(buf));
    });

    it('finds headers', () => {
      expect(doc.headers.length).toBeGreaterThan(0);
      expect(doc.headers[0].type).toBe('header');
      const text = extractAnnotationText(doc.headers[0]);
      expect(text).toContain('머리말');
    });

    it('finds footers', () => {
      expect(doc.footers.length).toBeGreaterThan(0);
      expect(doc.footers[0].type).toBe('footer');
      const text = extractAnnotationText(doc.footers[0]);
      expect(text).toContain('꼬리말');
    });
  });

  describe('HanDoc with no headers/footers', () => {
    it('returns empty arrays for a simple document', async () => {
      const buf = readFileSync(join(FIXTURES, '20260220/종묘제레악.hwpx'));
      const doc = await HanDoc.open(new Uint8Array(buf));
      expect(doc.headers).toEqual([]);
      expect(doc.footers).toEqual([]);
    });
  });

  describe('HanDoc.footnotes', () => {
    it('returns empty array when no footnotes', async () => {
      const buf = readFileSync(join(FIXTURES, 'opensource/HeaderFooter.hwpx'));
      const doc = await HanDoc.open(new Uint8Array(buf));
      expect(doc.footnotes).toEqual([]);
    });
  });
});
