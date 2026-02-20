/**
 * @handoc/hwpx-writer — Generate HWPX files from parsed data
 */

export { writeHeader } from './header-writer';
export { writeSection } from './section-writer';
export { writeGenericElement, escapeXml } from './xml-helpers';
export { HwpxBuilder } from './builder';
export type {
  DocumentHeader, Section, Paragraph, Run, RunChild, LineSeg,
  GenericElement, BeginNum, RefList, FontFaceDecl, CharProperty,
  ParaProperty, StyleDecl, SectionProperties,
} from '@handoc/document-model';

import type { DocumentHeader, Section } from '@handoc/document-model';
import { writeHeader } from './header-writer';
import { writeSection } from './section-writer';
import { zipSync } from 'fflate';

/** Minimal interface for the original OPC package (avoids hard dependency on hwpx-core). */
export interface OpcPackageLike {
  partNames(): string[];
  getPart(name: string): Uint8Array;
  getPartAsText(name: string): string;
}

export const VERSION = '0.1.0';

export interface HwpxDocument {
  header: DocumentHeader;
  sections: Section[];
  /** Extra parts to include in the ZIP (e.g., settings.xml, version.xml) */
  extraParts?: Map<string, string | Uint8Array>;
}

/**
 * Build a content.hpf manifest XML for the given sections.
 */
function buildManifest(sectionCount: number, extraPartNames?: string[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
  xml += '<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="" unique-identifier="" id="">';
  xml += '<opf:metadata><opf:language>ko</opf:language></opf:metadata>';
  xml += '<opf:manifest>';
  xml += '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>';
  for (let i = 0; i < sectionCount; i++) {
    xml += `<opf:item id="section${i}" href="Contents/section${i}.xml" media-type="application/xml"/>`;
  }
  if (extraPartNames) {
    for (const name of extraPartNames) {
      if (name.startsWith('BinData/')) {
        const ext = name.split('.').pop()?.toLowerCase() ?? 'bin';
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff',
        };
        const mime = mimeMap[ext] ?? 'application/octet-stream';
        const id = name.replace(/[^a-zA-Z0-9]/g, '_');
        xml += `<opf:item id="${id}" href="Contents/${name}" media-type="${mime}"/>`;
      }
    }
  }
  xml += '</opf:manifest>';
  xml += '<opf:spine>';
  xml += '<opf:itemref idref="header" linear="yes"/>';
  for (let i = 0; i < sectionCount; i++) {
    xml += `<opf:itemref idref="section${i}" linear="yes"/>`;
  }
  xml += '</opf:spine>';
  xml += '</opf:package>';
  return xml;
}

const encoder = /* @__PURE__ */ new TextEncoder();
function encode(s: string): Uint8Array {
  return encoder.encode(s);
}

/**
 * Create a minimal HWPX ZIP from header + sections.
 * If originalPackage is provided, non-header/section parts are preserved from it
 * (including the original content.hpf manifest).
 * Returns raw ZIP bytes.
 */
export function writeHwpx(doc: HwpxDocument, originalPackage?: OpcPackageLike): Uint8Array {
  const parts: Record<string, Uint8Array> = {};

  if (originalPackage) {
    // Copy ALL parts from original first
    for (const name of originalPackage.partNames()) {
      parts[name] = originalPackage.getPart(name);
    }
  } else {
    // mimetype
    parts['mimetype'] = encode('application/hwp+zip');

    // version.xml
    parts['version.xml'] = encode(
      '<?xml version="1.0" encoding="UTF-8" ?><HWPVersion Major="1" Minor="5" Micro="0" BuildNumber="0"/>'
    );

    // content.hpf — collect BinData paths for manifest
    const binDataPaths: string[] = [];
    if (doc.extraParts) {
      for (const name of doc.extraParts.keys()) {
        if (name.startsWith('BinData/')) {
          binDataPaths.push(name);
        }
      }
    }
    parts['Contents/content.hpf'] = encode(buildManifest(doc.sections.length, binDataPaths));
  }

  // Overwrite header.xml and section*.xml with our generated versions
  parts['Contents/header.xml'] = encode(writeHeader(doc.header));

  for (let i = 0; i < doc.sections.length; i++) {
    parts[`Contents/section${i}.xml`] = encode(writeSection(doc.sections[i]));
  }

  // Extra parts
  if (doc.extraParts) {
    for (const [name, data] of doc.extraParts) {
      // BinData files go under Contents/
      const path = name.startsWith('BinData/') ? `Contents/${name}` : name;
      parts[path] = typeof data === 'string' ? encode(data) : data;
    }
  }

  return zipSync(parts);
}
