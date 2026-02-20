import CFB from 'cfb';

export interface CfbFile {
  /** List all stream/storage paths in the compound file */
  listStreams(): string[];
  /** Get the raw bytes of a named stream */
  getStream(name: string): Uint8Array;
}

/**
 * Open an OLE2 Compound File Binary (CFB) from a buffer.
 */
export function openCfb(buffer: Uint8Array): CfbFile {
  const cfb = CFB.read(buffer, { type: 'array' });

  return {
    listStreams(): string[] {
      return cfb.FullPaths.filter((_, i) => {
        const entry = cfb.FileIndex[i];
        // type 2 = stream (not storage/root)
        return entry && entry.type === 2;
      });
    },

    getStream(name: string): Uint8Array {
      // Try exact match first, then with leading slash
      const entry = CFB.find(cfb, name) ?? CFB.find(cfb, '/' + name);
      if (!entry || !entry.content) {
        throw new Error(`Stream not found: ${name}`);
      }
      return new Uint8Array(entry.content);
    },
  };
}
