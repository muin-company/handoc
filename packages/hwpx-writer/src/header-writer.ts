/**
 * header-writer.ts — Serializes parsed header data back to header.xml
 */

import type {
  DocumentHeader,
  RefList,
  FontFaceDecl,
  CharProperty,
  ParaProperty,
  StyleDecl,
  GenericElement,
} from './parser-types';
import { escapeXml, writeGenericElement } from './xml-helpers';

function attrs(obj: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    parts.push(` ${k}="${escapeXml(String(v))}"`);
  }
  return parts.join('');
}

function selfClose(tag: string, a: Record<string, string>): string {
  return `<${tag}${attrs(a)}/>`;
}

function open(tag: string, a: Record<string, string> = {}): string {
  return `<${tag}${attrs(a)}>`;
}

function close(tag: string): string {
  return `</${tag}>`;
}

const HEADER_NS: Record<string, string> = {
  'xmlns:ha': 'http://www.hancom.co.kr/hwpml/2011/app',
  'xmlns:hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
  'xmlns:hp10': 'http://www.hancom.co.kr/hwpml/2016/paragraph',
  'xmlns:hs': 'http://www.hancom.co.kr/hwpml/2011/section',
  'xmlns:hc': 'http://www.hancom.co.kr/hwpml/2011/core',
  'xmlns:hh': 'http://www.hancom.co.kr/hwpml/2011/head',
  'xmlns:hhs': 'http://www.hancom.co.kr/hwpml/2011/history',
  'xmlns:hm': 'http://www.hancom.co.kr/hwpml/2011/master-page',
  'xmlns:hpf': 'http://www.hancom.co.kr/schema/2011/hpf',
  'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
  'xmlns:opf': 'http://www.idpf.org/2007/opf/',
  'xmlns:ooxmlchart': 'http://www.hancom.co.kr/hwpml/2016/ooxmlchart',
  'xmlns:hwpunitchar': 'http://www.hancom.co.kr/hwpml/2016/HwpUnitChar',
  'xmlns:epub': 'http://www.idpf.org/2007/ops',
  'xmlns:config': 'urn:oasis:names:tc:opendocument:xmlns:config:1.0',
};

export function writeHeader(header: DocumentHeader): string {
  const headAttrs: Record<string, string> = {
    ...HEADER_NS,
    version: header.version,
    secCnt: String(header.secCnt),
  };

  let xml = '<?xml version="1.0" encoding="UTF-8" ?>\n';
  xml += open('hh:head', headAttrs);

  // beginNum
  xml += selfClose('hh:beginNum', {
    page: String(header.beginNum.page),
    footnote: String(header.beginNum.footnote),
    endnote: String(header.beginNum.endnote),
    pic: String(header.beginNum.pic),
    tbl: String(header.beginNum.tbl),
    equation: String(header.beginNum.equation),
  });

  // refList
  xml += writeRefList(header.refList);

  // extra elements (compatibleDocument, docOption, metaTag, trackchageConfig, etc.)
  if (header.extra) {
    for (const el of header.extra) {
      xml += writeGenericElement(el, 'hh');
    }
  }

  xml += close('hh:head');
  return xml;
}

function writeRefList(ref: RefList): string {
  let xml = open('hh:refList');

  // fontfaces
  xml += writeFontFaces(ref.fontFaces);

  // borderFills
  if (ref.borderFills.length > 0) {
    xml += open('hh:borderFills', { itemCnt: String(ref.borderFills.length) });
    for (const bf of ref.borderFills) {
      xml += writeGenericElement(bf, 'hh');
    }
    xml += close('hh:borderFills');
  }

  // charProperties
  xml += writeCharProperties(ref.charProperties);

  // paraProperties
  xml += writeParaProperties(ref.paraProperties);

  // styles
  xml += writeStyles(ref.styles);

  // others (tabProperties, numberings, bullets, etc.)
  for (const el of ref.others) {
    xml += writeGenericElement(el, 'hh');
  }

  xml += close('hh:refList');
  return xml;
}

function writeFontFaces(fontFaces: FontFaceDecl[]): string {
  if (fontFaces.length === 0) return '';
  const totalFonts = fontFaces.reduce((sum, ff) => sum + ff.fonts.length, 0);
  let xml = open('hh:fontfaces', { itemCnt: String(totalFonts) });

  for (const ff of fontFaces) {
    xml += open('hh:fontface', { lang: ff.lang, fontCnt: String(ff.fonts.length) });
    for (const f of ff.fonts) {
      xml += selfClose('hh:font', {
        id: String(f.id),
        face: f.face,
        type: f.type,
        isEmbedded: f.isEmbedded ? '1' : '0',
      });
    }
    xml += close('hh:fontface');
  }

  xml += close('hh:fontfaces');
  return xml;
}

function writeCharProperties(charProps: CharProperty[]): string {
  if (charProps.length === 0) return '';
  let xml = open('hh:charProperties', { itemCnt: String(charProps.length) });

  for (const cp of charProps) {
    if (cp.children.length === 0) {
      xml += selfClose('hh:charPr', cp.attrs);
    } else {
      xml += open('hh:charPr', cp.attrs);
      for (const child of cp.children) {
        xml += writeGenericElement(child, 'hh');
      }
      xml += close('hh:charPr');
    }
  }

  xml += close('hh:charProperties');
  return xml;
}

function writeParaProperties(paraProps: ParaProperty[]): string {
  if (paraProps.length === 0) return '';
  let xml = open('hh:paraProperties', { itemCnt: String(paraProps.length) });

  for (const pp of paraProps) {
    if (pp.children.length === 0) {
      xml += selfClose('hh:paraPr', pp.attrs);
    } else {
      xml += open('hh:paraPr', pp.attrs);
      for (const child of pp.children) {
        xml += writeGenericElement(child, 'hh');
      }
      xml += close('hh:paraPr');
    }
  }

  xml += close('hh:paraProperties');
  return xml;
}

function writeStyles(styles: StyleDecl[]): string {
  if (styles.length === 0) return '';
  let xml = open('hh:styles', { itemCnt: String(styles.length) });

  for (const s of styles) {
    xml += selfClose('hh:style', s.attrs);
  }

  xml += close('hh:styles');
  return xml;
}
