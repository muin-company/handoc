/**
 * @handoc/hwpx-writer — Generate HWPX files from parsed data
 */

export { writeHeader } from './header-writer';
export { writeSection } from './section-writer';
export { writeGenericElement, escapeXml } from './xml-helpers';
export type * from './parser-types';

import type { DocumentHeader, Section } from './parser-types';
import { writeHeader } from './header-writer';
import { writeSection } from './section-writer';
import { zipSync } from 'fflate';

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
function buildManifest(sectionCount: number): string {
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
  xml += '<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="" unique-identifier="" id="">';
  xml += '<opf:metadata><opf:language>ko</opf:language></opf:metadata>';
  xml += '<opf:manifest>';
  xml += '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>';
  for (let i = 0; i < sectionCount; i++) {
    xml += `<opf:item id="section${i}" href="Contents/section${i}.xml" media-type="application/xml"/>`;
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
 * Returns raw ZIP bytes.
 */
export function writeHwpx(doc: HwpxDocument): Uint8Array {
  const parts: Record<string, Uint8Array> = {};

  // mimetype
  parts['mimetype'] = encode('application/hwp+zip');

  // version.xml
  parts['version.xml'] = encode(
    '<?xml version="1.0" encoding="UTF-8" ?><HWPVersion Major="1" Minor="5" Micro="0" BuildNumber="0"/>'
  );

  // content.hpf
  parts['Contents/content.hpf'] = encode(buildManifest(doc.sections.length));

  // header.xml
  parts['Contents/header.xml'] = encode(writeHeader(doc.header));

  // section*.xml
  for (let i = 0; i < doc.sections.length; i++) {
    parts[`Contents/section${i}.xml`] = encode(writeSection(doc.sections[i]));
  }

  // Extra parts
  if (doc.extraParts) {
    for (const [name, data] of doc.extraParts) {
      parts[name] = typeof data === 'string' ? encode(data) : data;
    }
  }

  return zipSync(parts);
}
