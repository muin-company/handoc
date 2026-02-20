import { OpcPackage } from '@handoc/hwpx-core';
import { hwpUnitToMm, WarningCollector } from '@handoc/document-model';
import type { ParseWarning } from '@handoc/document-model';
import { parseHeader } from './header-parser';
import { parseSection, extractText } from './section-parser';
import { extractImages, type ImageInfo } from './image-extractor';
import { collectHeadersFooters, collectFootnotes, type HeaderFooter, type Footnote } from './annotation-parser';
import { parseShape, type Shape } from './shape-parser';
import { parseEquation, type Equation } from './equation-parser';
import type { Section, RunChild, Paragraph } from './types';
import type { DocumentHeader } from './header-parser';
import type { SectionProperties } from './section-props-parser';
// Track change types (mirrored from document-model to avoid cross-package type resolution issues)
interface TCEntry { id: number; type: string; date: string; authorID: number; hide: boolean; }
interface TCAuthor { id: number; name: string; mark: number; }

export interface TrackChange {
  id: number;
  type: string;
  date: string;
  author: string;
  hide: boolean;
}

export interface HiddenComment {
  text: string;
  paragraphs: Paragraph[];
}

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
  private _headers: HeaderFooter[] | null = null;
  private _footers: HeaderFooter[] | null = null;
  private _footnotes: Footnote[] | null = null;
  private _shapes: Shape[] | null = null;
  private _equations: Equation[] | null = null;
  private _warnings = new WarningCollector();

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
      this._header = parseHeader(xml, this._warnings);
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
        return parseSection(xml, this._warnings);
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
   * Section properties of the first section (or undefined if not available).
   */
  get sectionProps(): SectionProperties | undefined {
    return this.sections[0]?.sectionProps;
  }

  /**
   * Whether the first section is in landscape orientation.
   */
  get landscape(): boolean {
    return this.sectionProps?.landscape ?? false;
  }

  /**
   * Page size in mm (from the first section).
   * Returns { width: 210, height: 297 } for A4.
   */
  get pageSize(): { width: number; height: number } {
    const props = this.sectionProps;
    if (!props) return { width: 210, height: 297 }; // A4 default
    return {
      width: Math.round(hwpUnitToMm(props.pageWidth)),
      height: Math.round(hwpUnitToMm(props.pageHeight)),
    };
  }

  /**
   * Page margins in mm (from the first section).
   */
  get margins(): {
    left: number; right: number; top: number; bottom: number;
    header: number; footer: number; gutter: number;
  } {
    const props = this.sectionProps;
    if (!props) {
      return { left: 0, right: 0, top: 0, bottom: 0, header: 0, footer: 0, gutter: 0 };
    }
    const m = props.margins;
    return {
      left: Math.round(hwpUnitToMm(m.left) * 10) / 10,
      right: Math.round(hwpUnitToMm(m.right) * 10) / 10,
      top: Math.round(hwpUnitToMm(m.top) * 10) / 10,
      bottom: Math.round(hwpUnitToMm(m.bottom) * 10) / 10,
      header: Math.round(hwpUnitToMm(m.header) * 10) / 10,
      footer: Math.round(hwpUnitToMm(m.footer) * 10) / 10,
      gutter: Math.round(hwpUnitToMm(m.gutter) * 10) / 10,
    };
  }

  /**
   * All headers found in the document (from ctrl elements in section paragraphs).
   */
  get headers(): HeaderFooter[] {
    if (!this._headers) {
      const all = collectHeadersFooters(this.sections);
      this._headers = all.filter(h => h.type === 'header');
      this._footers = all.filter(h => h.type === 'footer');
    }
    return this._headers;
  }

  /**
   * All footers found in the document.
   */
  get footers(): HeaderFooter[] {
    if (!this._footers) {
      // Force computation via headers getter
      void this.headers;
    }
    return this._footers!;
  }

  /**
   * All footnotes and endnotes found in the document.
   */
  get footnotes(): Footnote[] {
    if (!this._footnotes) {
      this._footnotes = collectFootnotes(this.sections);
    }
    return this._footnotes;
  }

  /**
   * All shapes (rect, ellipse, line, etc.) found in document paragraphs.
   */
  get shapes(): Shape[] {
    if (!this._shapes) {
      this._shapes = [];
      for (const section of this.sections) {
        for (const para of section.paragraphs) {
          for (const run of para.runs) {
            for (const child of run.children) {
              if (child.type === 'shape') {
                this._shapes.push(parseShape(child.element));
              }
            }
          }
        }
      }
    }
    return this._shapes;
  }

  /**
   * All equations found in document paragraphs.
   */
  get equations(): Equation[] {
    if (!this._equations) {
      this._equations = [];
      for (const section of this.sections) {
        for (const para of section.paragraphs) {
          for (const run of para.runs) {
            for (const child of run.children) {
              if (child.type === 'equation') {
                this._equations.push(parseEquation(child.element));
              }
            }
          }
        }
      }
    }
    return this._equations;
  }

  /**
   * Track changes found in the document header.
   * Each entry includes the resolved author name.
   */
  get trackChanges(): TrackChange[] {
    const h = this.header;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hdr = h as any;
    const entries: TCEntry[] = hdr.trackChanges ?? [];
    const authors: TCAuthor[] = hdr.trackChangeAuthors ?? [];
    const authorById = new Map<number, string>();
    const authorByMark = new Map<number, string>();
    for (const a of authors) {
      authorById.set(a.id, a.name);
      authorByMark.set(a.mark, a.name);
    }
    return entries.map((e) => ({
      id: e.id,
      type: e.type,
      date: e.date,
      author: authorById.get(e.authorID) ?? authorByMark.get(e.authorID) ?? `Author#${e.authorID}`,
      hide: e.hide,
    }));
  }

  /**
   * Hidden comments (메모/주석) found inline in the document.
   */
  get hiddenComments(): HiddenComment[] {
    const results: HiddenComment[] = [];
    for (const section of this.sections) {
      for (const para of section.paragraphs) {
        for (const run of para.runs) {
          for (const child of run.children) {
            if (child.type === 'hiddenComment') {
              const text = child.paragraphs
                .flatMap((p) => p.runs.flatMap((r) => r.children
                  .filter((c): c is { type: 'text'; content: string } => c.type === 'text')
                  .map((c) => c.content)))
                .join('');
              results.push({ text, paragraphs: child.paragraphs });
            }
          }
        }
      }
    }
    return results;
  }

  /**
   * Warnings collected during parsing.
   */
  get warnings(): ParseWarning[] {
    return this._warnings.toJSON();
  }

  /** The underlying warning collector (for internal use by parsers). */
  get warningCollector(): WarningCollector {
    return this._warnings;
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
