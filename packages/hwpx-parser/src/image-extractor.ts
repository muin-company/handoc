import type { OpcPackage } from '@handoc/hwpx-core';

export interface ImageInfo {
  /** Path within the HWPX ZIP (e.g. "BinData/image1.png") */
  path: string;
  /** MIME type inferred from extension */
  mimeType: string;
  /** Raw image bytes */
  data: Uint8Array;
}

const EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.emf': 'image/x-emf',
  '.wmf': 'image/x-wmf',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.svg': 'image/svg+xml',
};

function guessMimeType(path: string): string {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return 'application/octet-stream';
  const ext = path.slice(dot).toLowerCase();
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

/**
 * Extract all images/binary data from BinData/ directory in the HWPX package.
 * Finds entries both via manifest media-type and by scanning part names for BinData/.
 */
export function extractImages(pkg: OpcPackage): ImageInfo[] {
  const results: ImageInfo[] = [];
  const seen = new Set<string>();

  for (const name of pkg.partNames()) {
    // Match BinData/ entries (with or without Contents/ prefix)
    if (/(?:^|\/)?BinData\//i.test(name)) {
      if (seen.has(name)) continue;
      seen.add(name);
      results.push({
        path: name,
        mimeType: guessMimeType(name),
        data: pkg.getPart(name),
      });
    }
  }

  return results;
}
