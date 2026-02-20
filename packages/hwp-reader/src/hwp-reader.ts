import { inflateSync, inflateRawSync } from 'node:zlib';
import { openCfb, type CfbFile } from './cfb-reader.js';

/** Parsed HWP FileHeader information */
export interface HwpFileHeader {
  /** Raw signature string (should be "HWP Document File") */
  signature: string;
  /** HWP format version: { major, minor, build, revision } */
  version: { major: number; minor: number; build: number; revision: number };
  /** Property flags (raw 32-bit value) */
  properties: number;
  /** Whether body streams are compressed (zlib deflate) */
  compressed: boolean;
  /** Whether the document is encrypted */
  encrypted: boolean;
  /** Whether the document is a distribution document */
  distribution: boolean;
  /** Whether script is stored */
  hasScript: boolean;
  /** Whether DRM-secured */
  drm: boolean;
  /** Whether XML template storage exists */
  hasXmlTemplate: boolean;
  /** Whether document history exists */
  hasHistory: boolean;
  /** Whether digital signature exists */
  hasCertSign: boolean;
  /** Whether certificate encryption is used */
  certEncrypted: boolean;
  /** Whether certificate DRM is used */
  certDrm: boolean;
  /** Whether CCL exists */
  hasCcl: boolean;
}

export interface HwpDocument {
  fileHeader: HwpFileHeader;
  /** Raw (decompressed) DocInfo stream */
  docInfo: Uint8Array;
  /** Raw (decompressed) body text section streams */
  bodyText: Uint8Array[];
  /** The underlying CFB for advanced access */
  cfb: CfbFile;
}

const HWP_SIGNATURE = 'HWP Document File';

function parseFileHeader(data: Uint8Array): HwpFileHeader {
  const decoder = new TextDecoder('euc-kr');
  const sigBytes = data.slice(0, 32);
  // Signature is null-terminated within 32 bytes
  const nullIdx = sigBytes.indexOf(0);
  const signature = decoder.decode(sigBytes.slice(0, nullIdx > 0 ? nullIdx : 32)).trim();

  if (signature !== HWP_SIGNATURE) {
    throw new Error(`Invalid HWP signature: "${signature}"`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Version at offset 32, 4 bytes LE: MM.mm.bb.rr
  const versionDword = view.getUint32(32, true);
  const major = (versionDword >> 24) & 0xff;
  const minor = (versionDword >> 16) & 0xff;
  const build = (versionDword >> 8) & 0xff;
  const revision = versionDword & 0xff;

  // Properties at offset 36, 4 bytes LE
  const properties = view.getUint32(36, true);

  return {
    signature,
    version: { major, minor, build, revision },
    properties,
    compressed: !!(properties & (1 << 0)),
    encrypted: !!(properties & (1 << 1)),
    distribution: !!(properties & (1 << 2)),
    hasScript: !!(properties & (1 << 3)),
    drm: !!(properties & (1 << 4)),
    hasXmlTemplate: !!(properties & (1 << 5)),
    hasHistory: !!(properties & (1 << 6)),
    hasCertSign: !!(properties & (1 << 7)),
    certEncrypted: !!(properties & (1 << 8)),
    certDrm: !!(properties & (1 << 9)),
    hasCcl: !!(properties & (1 << 10)),
  };
}

function decompressIfNeeded(data: Uint8Array, compressed: boolean): Uint8Array {
  if (!compressed) return data;
  // HWP 5.x uses raw deflate (no zlib/gzip header). Try raw first, then zlib-wrapped.
  try {
    return new Uint8Array(inflateRawSync(data));
  } catch {
    try {
      return new Uint8Array(inflateSync(data));
    } catch {
      // Some streams may not actually be compressed even if flag is set
      return data;
    }
  }
}

/**
 * Read an HWP 5.x binary file from a buffer.
 * Parses FileHeader, extracts DocInfo and BodyText section streams.
 */
export function readHwp(buffer: Uint8Array): HwpDocument {
  const cfb = openCfb(buffer);
  const streams = cfb.listStreams();

  // FileHeader stream
  const fileHeaderName = streams.find(s => s.endsWith('FileHeader'));
  if (!fileHeaderName) {
    throw new Error('FileHeader stream not found. Streams: ' + streams.join(', '));
  }
  const fileHeaderData = cfb.getStream(fileHeaderName);
  const fileHeader = parseFileHeader(fileHeaderData);

  if (fileHeader.encrypted) {
    throw new Error('Encrypted HWP documents are not supported');
  }

  // DocInfo stream
  const docInfoName = streams.find(s => s.endsWith('DocInfo'));
  if (!docInfoName) {
    throw new Error('DocInfo stream not found');
  }
  const docInfo = decompressIfNeeded(cfb.getStream(docInfoName), fileHeader.compressed);

  // BodyText sections: Section0, Section1, ...
  const bodyTextStreams = streams
    .filter(s => /BodyText\/Section\d+$/.test(s))
    .sort((a, b) => {
      const numA = parseInt(a.match(/Section(\d+)$/)?.[1] ?? '0');
      const numB = parseInt(b.match(/Section(\d+)$/)?.[1] ?? '0');
      return numA - numB;
    });

  const bodyText = bodyTextStreams.map(name =>
    decompressIfNeeded(cfb.getStream(name), fileHeader.compressed),
  );

  return { fileHeader, docInfo, bodyText, cfb };
}
