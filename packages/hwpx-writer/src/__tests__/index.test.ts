import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VERSION, writeHwpx, writeHeader, writeSection } from '../index';
import { parseHeader, parseSection } from '@handoc/hwpx-parser';
import { OpcPackage } from '@handoc/hwpx-core';

const FIXTURES = resolve(__dirname, '../../../../fixtures');
const XML_DUMPS = resolve(FIXTURES, 'xml-dumps');
const HWPX_DIR = resolve(FIXTURES, 'hwpx');

describe('VERSION', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.1.0');
  });
});

describe('header round-trip', () => {
  const headerFiles = ['simple-text', 'empty', 'styled-text', 'table-basic', 'multi-section'];

  for (const name of headerFiles) {
    it(`round-trips ${name}-header.xml`, () => {
      const originalXml = readFileSync(resolve(XML_DUMPS, `${name}-header.xml`), 'utf-8');
      const parsed1 = parseHeader(originalXml);
      const writtenXml = writeHeader(parsed1);
      const parsed2 = parseHeader(writtenXml);

      // Compare parsed structures (not XML strings, since formatting/order may differ)
      expect(parsed2.version).toEqual(parsed1.version);
      expect(parsed2.secCnt).toEqual(parsed1.secCnt);
      expect(parsed2.beginNum).toEqual(parsed1.beginNum);
      expect(parsed2.refList.fontFaces).toEqual(parsed1.refList.fontFaces);
      expect(parsed2.refList.charProperties).toEqual(parsed1.refList.charProperties);
      expect(parsed2.refList.tabProperties).toEqual(parsed1.refList.tabProperties);
      expect(parsed2.refList.numberings).toEqual(parsed1.refList.numberings);
      expect(parsed2.refList.bullets).toEqual(parsed1.refList.bullets);
      expect(parsed2.refList.paraProperties).toEqual(parsed1.refList.paraProperties);
      expect(parsed2.refList.styles).toEqual(parsed1.refList.styles);
      expect(parsed2.refList.borderFills).toEqual(parsed1.refList.borderFills);
      expect(parsed2.refList.others).toEqual(parsed1.refList.others);
    });
  }
});

describe('section round-trip', () => {
  const sectionFiles = ['simple-text', 'empty', 'styled-text', 'table-basic', 'multi-section'];

  for (const name of sectionFiles) {
    it(`round-trips ${name}-section0.xml`, () => {
      const originalXml = readFileSync(resolve(XML_DUMPS, `${name}-section0.xml`), 'utf-8');
      const parsed1 = parseSection(originalXml);
      const writtenXml = writeSection(parsed1);
      const parsed2 = parseSection(writtenXml);

      expect(parsed2.paragraphs.length).toEqual(parsed1.paragraphs.length);
      
      for (let i = 0; i < parsed1.paragraphs.length; i++) {
        const p1 = parsed1.paragraphs[i];
        const p2 = parsed2.paragraphs[i];

        expect(p2.paraPrIDRef).toEqual(p1.paraPrIDRef);
        expect(p2.styleIDRef).toEqual(p1.styleIDRef);
        expect(p2.pageBreak).toEqual(p1.pageBreak);
        expect(p2.columnBreak).toEqual(p1.columnBreak);
        expect(p2.merged).toEqual(p1.merged);
        expect(p2.runs.length).toEqual(p1.runs.length);

        for (let j = 0; j < p1.runs.length; j++) {
          expect(p2.runs[j].charPrIDRef).toEqual(p1.runs[j].charPrIDRef);
          expect(p2.runs[j].children.length).toEqual(p1.runs[j].children.length);

          for (let k = 0; k < p1.runs[j].children.length; k++) {
            const c1 = p1.runs[j].children[k];
            const c2 = p2.runs[j].children[k];
            expect(c2.type).toEqual(c1.type);

            if (c1.type === 'text' && c2.type === 'text') {
              expect(c2.content).toEqual(c1.content);
            }
            if (c1.type === 'table' && c2.type === 'table') {
              expect(c2.element).toEqual(c1.element);
            }
            if (c1.type === 'secPr' && c2.type === 'secPr') {
              expect(c2.element).toEqual(c1.element);
            }
            if (c1.type === 'ctrl' && c2.type === 'ctrl') {
              expect(c2.element).toEqual(c1.element);
            }
            if (c1.type === 'inlineObject' && c2.type === 'inlineObject') {
              expect(c2.element).toEqual(c1.element);
            }
          }
        }

        expect(p2.lineSegArray).toEqual(p1.lineSegArray);
      }
    });
  }
});

describe('full HWPX round-trip', () => {
  const fixtures = ['simple-text', 'empty', 'styled-text', 'table-basic', 'multi-section'];

  for (const name of fixtures) {
    it(`round-trips ${name}.hwpx`, async () => {
      const hwpxBytes = readFileSync(resolve(HWPX_DIR, `${name}.hwpx`));
      const pkg = await OpcPackage.open(new Uint8Array(hwpxBytes));

      // Parse original
      const headerPaths = pkg.getHeaderPaths();
      const sectionPaths = pkg.getSectionPaths();
      
      const headerXml = pkg.getPartAsText(headerPaths[0]);
      const header = parseHeader(headerXml);
      
      const sections = sectionPaths.map(path => parseSection(pkg.getPartAsText(path)));

      // Write back
      const zipBytes = writeHwpx({ header, sections });

      // Re-parse
      const pkg2 = await OpcPackage.open(zipBytes);
      const headerPaths2 = pkg2.getHeaderPaths();
      const sectionPaths2 = pkg2.getSectionPaths();

      const header2 = parseHeader(pkg2.getPartAsText(headerPaths2[0]));
      const sections2 = sectionPaths2.map(path => parseSection(pkg2.getPartAsText(path)));

      // Compare headers
      expect(header2.version).toEqual(header.version);
      expect(header2.secCnt).toEqual(header.secCnt);
      expect(header2.beginNum).toEqual(header.beginNum);
      expect(header2.refList.fontFaces).toEqual(header.refList.fontFaces);
      expect(header2.refList.styles).toEqual(header.refList.styles);

      // Compare sections
      expect(sections2.length).toEqual(sections.length);
      for (let i = 0; i < sections.length; i++) {
        expect(sections2[i].paragraphs.length).toEqual(sections[i].paragraphs.length);
      }
    });
  }
});

describe('new document creation', () => {
  it('creates empty document', () => {
    const zipBytes = writeHwpx({
      header: {
        version: '1.5',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [],
          styles: [],
          others: [],
        },
      },
      sections: [{ paragraphs: [] }],
    });

    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(zipBytes.length).toBeGreaterThan(0);
  });

  it('creates document with text', () => {
    const zipBytes = writeHwpx({
      header: {
        version: '1.5',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [],
          styles: [],
          others: [],
        },
      },
      sections: [{
        paragraphs: [{
          id: '1',
          paraPrIDRef: 0,
          styleIDRef: 0,
          pageBreak: false,
          columnBreak: false,
          merged: false,
          runs: [{
            charPrIDRef: 0,
            children: [{ type: 'text', content: '안녕하세요' }],
          }],
          lineSegArray: [],
        }],
      }],
    });

    expect(zipBytes).toBeInstanceOf(Uint8Array);
  });

  it('preserves custom parts from originalPackage', async () => {
    const customContent = '<?xml version="1.0"?><bibliography/>';
    const scriptContent = 'console.log("hello");';

    // Build a fake original package with custom parts
    const originalParts: Record<string, Uint8Array> = {};
    const enc = new TextEncoder();
    originalParts['mimetype'] = enc.encode('application/hwp+zip');
    originalParts['version.xml'] = enc.encode('<?xml version="1.0"?><HWPVersion Major="1"/>');
    originalParts['Contents/content.hpf'] = enc.encode(
      '<?xml version="1.0"?><opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="" unique-identifier="" id="">' +
      '<opf:metadata><opf:language>ko</opf:language></opf:metadata>' +
      '<opf:manifest>' +
      '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>' +
      '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>' +
      '<opf:item id="bibliography" href="Custom/bibliography.xml" media-type="application/xml"/>' +
      '</opf:manifest>' +
      '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine>' +
      '</opf:package>'
    );
    originalParts['Contents/header.xml'] = enc.encode('<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList><hh:fontfaces/><hh:borderFills/><hh:charProperties/><hh:tabProperties/><hh:numberings/><hh:bullets/><hh:paraProperties/><hh:styles/><hh:memoProperties/></hh:refList><hh:compatibleDocument/><hh:docOption/></hh:head>');
    originalParts['Contents/section0.xml'] = enc.encode('<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"/>');
    originalParts['Custom/bibliography.xml'] = enc.encode(customContent);
    originalParts['Scripts/headerScripts.js'] = enc.encode(scriptContent);

    const { zipSync } = await import('fflate');
    const originalZip = zipSync(originalParts);
    const originalPkg = await OpcPackage.open(originalZip);

    // Use parseHeader to get a valid header from the original package
    const { parseHeader } = await import('@handoc/hwpx-parser');
    const headerXml = originalPkg.getPartAsText('Contents/header.xml');
    const header = parseHeader(headerXml);

    const doc = {
      header,
      sections: [{ paragraphs: [] }],
    };

    const result = writeHwpx(doc, originalPkg);
    const resultPkg = await OpcPackage.open(result);

    // Custom parts should be preserved
    expect(resultPkg.hasPart('Custom/bibliography.xml')).toBe(true);
    expect(resultPkg.getPartAsText('Custom/bibliography.xml')).toBe(customContent);
    expect(resultPkg.hasPart('Scripts/headerScripts.js')).toBe(true);
    expect(resultPkg.getPartAsText('Scripts/headerScripts.js')).toBe(scriptContent);

    // Original manifest should be preserved
    expect(resultPkg.hasPart('Contents/content.hpf')).toBe(true);
    const manifest = resultPkg.getPartAsText('Contents/content.hpf');
    expect(manifest).toContain('bibliography');
  });
});
