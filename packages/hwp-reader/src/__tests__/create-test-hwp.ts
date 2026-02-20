/**
 * Create a minimal synthetic HWP 5.x file for testing.
 * HWP 5.x is OLE2/CFB with specific streams.
 */
import CFB from 'cfb';
import { deflateSync } from 'node:zlib';

/**
 * Build an HWP 5.x record header DWORD.
 * TagID(10bit) | Level(10bit) | Size(12bit)
 */
function makeRecordHeader(tagId: number, level: number, size: number): Uint8Array {
  const buf = new Uint8Array(size >= 0xfff ? 8 : 4);
  const view = new DataView(buf.buffer);
  const sizeField = size >= 0xfff ? 0xfff : size;
  const header = (tagId & 0x3ff) | ((level & 0x3ff) << 10) | ((sizeField & 0xfff) << 20);
  view.setUint32(0, header, true);
  if (size >= 0xfff) {
    view.setUint32(4, size, true);
  }
  return buf;
}

/** Encode a string as UTF-16LE bytes */
function encodeUtf16LE(text: string): Uint8Array {
  const buf = new Uint8Array(text.length * 2);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(i * 2, text.charCodeAt(i), true);
  }
  return buf;
}

/** Build a BodyText section stream with HWP records containing given paragraphs */
function buildBodyTextStream(paragraphs: string[]): Uint8Array {
  const HWPTAG_PARA_HEADER = 66;
  const HWPTAG_PARA_TEXT = 67;
  const chunks: Uint8Array[] = [];

  for (const para of paragraphs) {
    // Para header record (minimal: 22 bytes of zeros)
    const paraHeaderData = new Uint8Array(22);
    chunks.push(makeRecordHeader(HWPTAG_PARA_HEADER, 0, paraHeaderData.length));
    chunks.push(paraHeaderData);

    // Para text record
    const textData = encodeUtf16LE(para);
    chunks.push(makeRecordHeader(HWPTAG_PARA_TEXT, 1, textData.length));
    chunks.push(textData);
  }

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function createTestHwp(options: {
  compressed?: boolean;
  version?: { major: number; minor: number; build: number; revision: number };
  /** Paragraphs for Section0. Defaults to Korean test text. */
  paragraphs?: string[];
  /** Additional sections (array of paragraph arrays) */
  extraSections?: string[][];
} = {}): Uint8Array {
  const {
    compressed = true,
    version = { major: 5, minor: 1, build: 0, revision: 0 },
    paragraphs = ['안녕하세요 한글 문서입니다.', '두 번째 문단입니다.'],
    extraSections = [],
  } = options;

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

  // Create DocInfo with a minimal record
  const docInfoRaw = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00,
    ...Array(16).fill(0x42)]);
  const docInfo = compressed ? new Uint8Array(deflateSync(docInfoRaw)) : docInfoRaw;

  // Build BodyText sections with real HWP records
  const section0Raw = buildBodyTextStream(paragraphs);
  const section0 = compressed ? new Uint8Array(deflateSync(section0Raw)) : section0Raw;

  // Build CFB
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, '/FileHeader', fileHeader as any);
  CFB.utils.cfb_add(cfb, '/DocInfo', docInfo as any);
  CFB.utils.cfb_add(cfb, '/BodyText/Section0', section0 as any);

  for (let i = 0; i < extraSections.length; i++) {
    const secRaw = buildBodyTextStream(extraSections[i]);
    const secData = compressed ? new Uint8Array(deflateSync(secRaw)) : secRaw;
    CFB.utils.cfb_add(cfb, `/BodyText/Section${i + 1}`, secData as any);
  }

  const out = CFB.write(cfb, { type: 'array' });
  return new Uint8Array(out as ArrayBuffer);
}
