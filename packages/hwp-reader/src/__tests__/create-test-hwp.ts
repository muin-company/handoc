/**
 * Create a minimal synthetic HWP 5.x file for testing.
 * HWP 5.x is OLE2/CFB with specific streams.
 */
import CFB from 'cfb';
import { deflateSync } from 'node:zlib';

export function createTestHwp(options: {
  compressed?: boolean;
  version?: { major: number; minor: number; build: number; revision: number };
} = {}): Uint8Array {
  const { compressed = true, version = { major: 5, minor: 1, build: 0, revision: 0 } } = options;

  // Build FileHeader (256 bytes per spec)
  const fileHeader = new Uint8Array(256);
  const encoder = new TextEncoder();
  const sig = encoder.encode('HWP Document File');
  fileHeader.set(sig, 0);

  // Version at offset 32: MM.mm.bb.rr as LE uint32
  const versionDword = (version.major << 24) | (version.minor << 16) | (version.build << 8) | version.revision;
  const view = new DataView(fileHeader.buffer);
  view.setUint32(32, versionDword, true);

  // Properties at offset 36
  let properties = 0;
  if (compressed) properties |= 1;
  view.setUint32(36, properties, true);

  // Create some fake DocInfo data
  const docInfoRaw = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00,
    ...Array(16).fill(0x42)]);
  const docInfo = compressed ? new Uint8Array(deflateSync(docInfoRaw)) : docInfoRaw;

  // Create fake BodyText/Section0 data
  const section0Raw = new Uint8Array([0x02, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00,
    ...Array(8).fill(0x43)]);
  const section0 = compressed ? new Uint8Array(deflateSync(section0Raw)) : section0Raw;

  // Build CFB
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
  CFB.utils.cfb_add(cfb, '/DocInfo', docInfo as any);
  CFB.utils.cfb_add(cfb, '/BodyText/Section0', section0 as any);
  CFB.utils.cfb_add(cfb, '/BodyText/Section1', section0 as any);

  const out = CFB.write(cfb, { type: 'array' });
  return new Uint8Array(out as ArrayBuffer);
}
