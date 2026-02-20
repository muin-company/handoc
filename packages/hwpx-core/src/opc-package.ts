import { unzipSync, zipSync, type Unzipped } from 'fflate';
import { parseManifest, type OPFManifest } from './manifest';

const CONTENT_HPF = 'Contents/content.hpf';
const decoder = new TextDecoder();
const encoder = new TextEncoder();

export class OpcPackage {
  private parts: Map<string, Uint8Array>;
  private manifest: OPFManifest | null = null;

  private constructor(parts: Map<string, Uint8Array>) {
    this.parts = parts;
  }

  static async open(input: Uint8Array): Promise<OpcPackage> {
    let unzipped: Unzipped;
    try {
      unzipped = unzipSync(input);
    } catch {
      throw new Error('Invalid ZIP data');
    }
    const parts = new Map<string, Uint8Array>();
    for (const [name, data] of Object.entries(unzipped)) {
      parts.set(name, data);
    }
    const pkg = new OpcPackage(parts);
    if (pkg.hasPart(CONTENT_HPF)) {
      pkg.manifest = parseManifest(pkg.getPartAsText(CONTENT_HPF));
    }
    return pkg;
  }

  partNames(): string[] {
    return [...this.parts.keys()].sort();
  }

  hasPart(name: string): boolean {
    return this.parts.has(name);
  }

  getPart(name: string): Uint8Array {
    const part = this.parts.get(name);
    if (!part) throw new Error(`Part not found: ${name}`);
    return part;
  }

  getPartAsText(name: string): string {
    return decoder.decode(this.getPart(name));
  }

  setPart(name: string, data: Uint8Array | string): void {
    this.parts.set(name, typeof data === 'string' ? encoder.encode(data) : data);
    if (name === CONTENT_HPF) {
      this.manifest = parseManifest(this.getPartAsText(CONTENT_HPF));
    }
  }

  deletePart(name: string): void {
    this.parts.delete(name);
  }

  async save(): Promise<Uint8Array> {
    const data: Record<string, Uint8Array> = {};
    for (const [name, bytes] of this.parts) {
      data[name] = bytes;
    }
    return zipSync(data);
  }

  private ensureManifest(): OPFManifest {
    if (!this.manifest) throw new Error('No content.hpf manifest found');
    return this.manifest;
  }

  getSectionPaths(): string[] {
    const m = this.ensureManifest();
    const headerIds = new Set<string>();
    for (const item of m.items) {
      if (item.href.toLowerCase().includes('header')) {
        headerIds.add(item.id);
      }
    }
    return m.spine
      .filter((idref) => !headerIds.has(idref))
      .map((idref) => {
        const item = m.items.find((i) => i.id === idref);
        return item?.href ?? '';
      })
      .filter(Boolean);
  }

  getHeaderPaths(): string[] {
    const m = this.ensureManifest();
    return m.items
      .filter((item) => item.href.toLowerCase().includes('header'))
      .map((item) => item.href);
  }

  getMetadata(): { title?: string; creator?: string; language?: string } {
    return this.ensureManifest().metadata;
  }
}
