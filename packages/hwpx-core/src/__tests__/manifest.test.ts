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
});
