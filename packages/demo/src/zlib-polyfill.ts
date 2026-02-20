/**
 * Browser polyfill for Node.js zlib using pako
 */
import * as pako from 'pako';

export function inflateSync(buffer: Uint8Array): Uint8Array {
  return pako.inflate(buffer);
}

export function inflateRawSync(buffer: Uint8Array): Uint8Array {
  return pako.inflateRaw(buffer);
}

export function deflateSync(buffer: Uint8Array): Uint8Array {
  return pako.deflate(buffer);
}

export function deflateRawSync(buffer: Uint8Array): Uint8Array {
  return pako.deflateRaw(buffer);
}
