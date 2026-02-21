import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseManifest } from '../manifest';
import { OpcPackage } from '../opc-package';

const fixture = readFileSync(join(__dirname, '../../../../fixtures/hwpx/simple-text.hwpx'));

describe('parseManifest', () => {
  it('parses content.hpf from simple-text.hwpx', async () => {
    const pkg = await OpcPackage.open(new Uint8Array(fixture));
    const xml = pkg.getPartAsText('Contents/content.hpf');
    const m = parseManifest(xml);

    expect(m.metadata.language).toBe('ko');
    expect(m.metadata.creator).toBe('kokyu');
    expect(m.items.length).toBeGreaterThanOrEqual(2);
    expect(m.spine).toContain('header');
    expect(m.spine).toContain('section0');
  });

  it('parses manifest with missing metadata fields', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0">
  <opf:metadata>
    <opf:language>en</opf:language>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`;

    const m = parseManifest(xml);
    expect(m.metadata.language).toBe('en');
    expect(m.metadata.title).toBeUndefined();
    expect(m.metadata.creator).toBeUndefined();
    expect(m.items).toHaveLength(1);
    expect(m.spine).toEqual(['section0']);
  });

  it('parses manifest with empty title', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0">
  <opf:metadata>
    <opf:language>ko</opf:language>
    <opf:title></opf:title>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`;

    const m = parseManifest(xml);
    expect(m.metadata.title).toBeUndefined();
  });

  it('parses manifest with all metadata fields', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0">
  <opf:metadata>
    <opf:language>ja</opf:language>
    <opf:title>タイトル</opf:title>
    <opf:meta name="creator">Author Name</opf:meta>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="s1" href="section.xml" media-type="text/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="s1"/>
  </opf:spine>
</opf:package>`;

    const m = parseManifest(xml);
    expect(m.metadata.language).toBe('ja');
    expect(m.metadata.title).toBe('タイトル');
    expect(m.metadata.creator).toBe('Author Name');
  });

  it('parses manifest with no items or spine', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0">
  <opf:metadata>
    <opf:language>en</opf:language>
  </opf:metadata>
  <opf:manifest>
  </opf:manifest>
  <opf:spine>
  </opf:spine>
</opf:package>`;

    const m = parseManifest(xml);
    expect(m.items).toEqual([]);
    expect(m.spine).toEqual([]);
  });

  it('handles items with missing attributes', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0">
  <opf:metadata></opf:metadata>
  <opf:manifest>
    <opf:item id="test"/>
    <opf:item href="path.xml"/>
    <opf:item media-type="text/xml"/>
  </opf:manifest>
  <opf:spine></opf:spine>
</opf:package>`;

    const m = parseManifest(xml);
    expect(m.items).toHaveLength(3);
    expect(m.items[0]).toEqual({ id: 'test', href: '', mediaType: '' });
    expect(m.items[1]).toEqual({ id: '', href: 'path.xml', mediaType: '' });
    expect(m.items[2]).toEqual({ id: '', href: '', mediaType: 'text/xml' });
  });
});
