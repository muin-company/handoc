/** Parses content.hpf (OPF manifest) */

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

export interface OPFManifest {
  metadata: { title?: string; creator?: string; language?: string };
  items: ManifestItem[];
  spine: string[];
}

export function parseManifest(xml: string): OPFManifest {
  const metadata: OPFManifest['metadata'] = {};

  const langMatch = xml.match(/<opf:language[^>]*>([^<]+)<\/opf:language>/);
  if (langMatch) metadata.language = langMatch[1];

  const titleMatch = xml.match(/<opf:title[^>]*>([^<]*)<\/opf:title>/);
  if (titleMatch && titleMatch[1]) metadata.title = titleMatch[1];

  const creatorMatch = xml.match(/<opf:meta[^>]*name="creator"[^>]*>([^<]+)<\/opf:meta>/);
  if (creatorMatch && creatorMatch[1]) metadata.creator = creatorMatch[1];

  const items: ManifestItem[] = [];
  const itemRe = /<opf:item\s+([^>]+?)\/?\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const attrs = m[1];
    const id = attrs.match(/id="([^"]+)"/)?.[1] ?? '';
    const href = attrs.match(/href="([^"]+)"/)?.[1] ?? '';
    const mediaType = attrs.match(/media-type="([^"]+)"/)?.[1] ?? '';
    items.push({ id, href, mediaType });
  }

  const spine: string[] = [];
  const spineRe = /<opf:itemref\s+([^>]+?)\/?\s*>/g;
  while ((m = spineRe.exec(xml)) !== null) {
    const idref = m[1].match(/idref="([^"]+)"/)?.[1];
    if (idref) spine.push(idref);
  }

  return { metadata, items, spine };
}
