import { OpcPackage } from '@handoc/hwpx-core';
import { parseHeader } from './header-parser';
import { parseSection, extractText } from './section-parser';
import { extractImages, type ImageInfo } from './image-extractor';
import type { Section } from './types';
import type { DocumentHeader } from './header-parser';

export interface HanDocMetadata {
  title?: string;
  creator?: string;
  language?: string;
}

/**
 * High-level facade for reading HWPX documents.
 *
 * ```ts
 * const doc = await HanDoc.open(buffer);
 * console.log(doc.extractText());
 * ```
 */
export class HanDoc {
  private pkg: OpcPackage;
  private _header: DocumentHeader | null = null;
  private _sections: Section[] | null = null;
  private _images: ImageInfo[] | null = null;

  private constructor(pkg: OpcPackage) {
    this.pkg = pkg;
  }

  /**
   * Open an HWPX file from a buffer (ZIP bytes).
   * Alias for `open()` — note this is async despite the name,
   * because OpcPackage.open() is async.
   */
  static async fromBuffer(buf: Uint8Array): Promise<HanDoc> {
    return HanDoc.open(buf);
  }

  /**
   * Open an HWPX file from a buffer (ZIP bytes).
   */
  static async open(buf: Uint8Array): Promise<HanDoc> {
    const pkg = await OpcPackage.open(buf);
    return new HanDoc(pkg);
  }

  get header(): DocumentHeader {
    if (!this._header) {
      const paths = this.pkg.getHeaderPaths();
      if (paths.length === 0) {
        throw new Error('No header found in document');
      }
      // Header paths are relative to Contents/
      const headerPath = paths[0].startsWith('Contents/')
        ? paths[0]
        : `Contents/${paths[0]}`;
      const xml = this.pkg.getPartAsText(headerPath);
      this._header = parseHeader(xml);
    }
    return this._header;
  }

  get sections(): Section[] {
    if (!this._sections) {
      const paths = this.pkg.getSectionPaths()
        .filter((p) => p.toLowerCase().endsWith('.xml'));
      this._sections = paths.map((p) => {
        const fullPath = p.startsWith('Contents/') ? p : `Contents/${p}`;
        const xml = this.pkg.getPartAsText(fullPath);
        return parseSection(xml);
      });
    }
    return this._sections;
  }

  /** Access the underlying OPC package (for roundtrip preservation). */
  get opcPackage(): OpcPackage {
    return this.pkg;
  }

  get metadata(): HanDocMetadata {
    return this.pkg.getMetadata();
  }

  /**
   * All images/binary data found in BinData/ (lazy loaded).
   */
  get images(): ImageInfo[] {
    if (!this._images) {
      this._images = extractImages(this.pkg);
    }
    return this._images;
  }

  /**
   * Get a single image by its path within the ZIP.
   * Returns null if not found.
   */
  getImage(path: string): Uint8Array | null {
    const img = this.images.find((i) => i.path === path);
    return img?.data ?? null;
  }

  /**
   * Extract all text from the document (all sections joined by newlines).
   */
  extractText(): string {
    return this.sections
      .flatMap((sec) => extractText(sec))
      .join('\n');
  }

  /**
   * Extract text per section.
   */
  extractTextBySection(): string[] {
    return this.sections.map((sec) => extractText(sec).join('\n'));
  }
}
