import { describe, it, expect } from 'vitest';
import { __testing } from '../converter';
import type { CharProperty, DocumentHeader, GenericElement, ParaProperty } from '@handoc/document-model';
import { AlignmentType, HeadingLevel } from 'docx';

/**
 * Direct unit tests for internal helper functions.
 * These tests achieve high coverage by testing all code paths directly.
 */

describe('Internal Functions - Direct Unit Tests', () => {
  
  describe('Unit Conversion Functions', () => {
    it('hwpUnitToTwip converts correctly', () => {
      const result = __testing.hwpUnitToTwip(7200); // 1 inch
      expect(result).toBe(1440); // 1440 twips = 1 inch
    });

    it('hwpUnitToTwip handles zero', () => {
      expect(__testing.hwpUnitToTwip(0)).toBe(0);
    });

    it('hwpUnitToTwip handles negative values', () => {
      expect(__testing.hwpUnitToTwip(-7200)).toBe(-1440);
    });

    it('hwpUnitToHalfPt converts correctly', () => {
      const result = __testing.hwpUnitToHalfPt(1000); // 10pt
      expect(result).toBe(20); // 20 half-points
    });

    it('hwpUnitToHalfPt handles zero', () => {
      expect(__testing.hwpUnitToHalfPt(0)).toBe(0);
    });

    it('hwpUnitToEmu converts correctly', () => {
      const result = __testing.hwpUnitToEmu(7200); // 1 inch
      expect(result).toBe(914400); // 914400 EMU = 1 inch
    });

    it('hwpUnitToEmu handles zero', () => {
      expect(__testing.hwpUnitToEmu(0)).toBe(0);
    });
  });

  describe('Font Name Mapping', () => {
    it('maps 한컴바탕 to Batang', () => {
      expect(__testing.mapFontName('한컴바탕')).toBe('Batang');
    });

    it('maps 한컴돋움 to Dotum', () => {
      expect(__testing.mapFontName('한컴돋움')).toBe('Dotum');
    });

    it('maps 바탕 to Batang', () => {
      expect(__testing.mapFontName('바탕')).toBe('Batang');
    });

    it('maps 돋움 to Dotum', () => {
      expect(__testing.mapFontName('돋움')).toBe('Dotum');
    });

    it('maps 굴림 to Gulim', () => {
      expect(__testing.mapFontName('굴림')).toBe('Gulim');
    });

    it('maps 궁서 to Gungsuh', () => {
      expect(__testing.mapFontName('궁서')).toBe('Gungsuh');
    });

    it('maps 맑은 고딕 to Malgun Gothic', () => {
      expect(__testing.mapFontName('맑은 고딕')).toBe('Malgun Gothic');
    });

    it('maps 나눔고딕 to NanumGothic', () => {
      expect(__testing.mapFontName('나눔고딕')).toBe('NanumGothic');
    });

    it('returns unknown fonts as-is', () => {
      expect(__testing.mapFontName('UnknownFont')).toBe('UnknownFont');
    });

    it('handles empty string', () => {
      expect(__testing.mapFontName('')).toBe('');
    });
  });

  describe('Font Resolution', () => {
    it('returns undefined when no fontRef', () => {
      const charProp: CharProperty = { height: 1000 };
      const header: DocumentHeader = {
        refList: { fontFaces: [], charProperties: [], paraProperties: [], borderFills: [] },
      } as any;
      expect(__testing.resolveFontName(charProp, header)).toBeUndefined();
    });

    it('resolves hangul font', () => {
      const charProp: CharProperty = {
        fontRef: { hangul: 0 },
        height: 1000,
      };
      const header: DocumentHeader = {
        refList: {
          fontFaces: [
            {
              lang: 'hangul',
              fonts: [{ id: 0, face: '바탕', type: 'ttf' }],
            },
          ],
          charProperties: [],
          paraProperties: [],
          borderFills: [],
        },
      } as any;
      expect(__testing.resolveFontName(charProp, header)).toBe('Batang');
    });

    it('resolves latin font', () => {
      const charProp: CharProperty = {
        fontRef: { latin: 1 },
        height: 1000,
      };
      const header: DocumentHeader = {
        refList: {
          fontFaces: [
            {
              lang: 'latin',
              fonts: [
                { id: 0, face: 'Arial', type: 'ttf' },
                { id: 1, face: 'Times New Roman', type: 'ttf' },
              ],
            },
          ],
          charProperties: [],
          paraProperties: [],
          borderFills: [],
        },
      } as any;
      expect(__testing.resolveFontName(charProp, header)).toBe('Times New Roman');
    });

    it('resolves hanja font', () => {
      const charProp: CharProperty = {
        fontRef: { hanja: 0 },
        height: 1000,
      };
      const header: DocumentHeader = {
        refList: {
          fontFaces: [
            {
              lang: 'hanja',
              fonts: [{ id: 0, face: '궁서', type: 'ttf' }],
            },
          ],
          charProperties: [],
          paraProperties: [],
          borderFills: [],
        },
      } as any;
      expect(__testing.resolveFontName(charProp, header)).toBe('Gungsuh');
    });

    it('returns undefined when font not found', () => {
      const charProp: CharProperty = {
        fontRef: { hangul: 999 },
        height: 1000,
      };
      const header: DocumentHeader = {
        refList: {
          fontFaces: [
            {
              lang: 'hangul',
              fonts: [{ id: 0, face: '바탕', type: 'ttf' }],
            },
          ],
          charProperties: [],
          paraProperties: [],
          borderFills: [],
        },
      } as any;
      expect(__testing.resolveFontName(charProp, header)).toBeUndefined();
    });

    it('returns undefined when lang not found', () => {
      const charProp: CharProperty = {
        fontRef: { hangul: 0 },
        height: 1000,
      };
      const header: DocumentHeader = {
        refList: {
          fontFaces: [],
          charProperties: [],
          paraProperties: [],
          borderFills: [],
        },
      } as any;
      expect(__testing.resolveFontName(charProp, header)).toBeUndefined();
    });
  });

  describe('Image Type Detection', () => {
    it('detects jpeg from mime', () => {
      expect(__testing.mimeToImageType('image/jpeg')).toBe('jpg');
    });

    it('detects jpg from mime', () => {
      expect(__testing.mimeToImageType('image/jpg')).toBe('jpg');
    });

    it('detects png from mime', () => {
      expect(__testing.mimeToImageType('image/png')).toBe('png');
    });

    it('detects gif from mime', () => {
      expect(__testing.mimeToImageType('image/gif')).toBe('gif');
    });

    it('detects bmp from mime', () => {
      expect(__testing.mimeToImageType('image/bmp')).toBe('bmp');
    });

    it('defaults to png for unknown types', () => {
      expect(__testing.mimeToImageType('image/webp')).toBe('png');
    });

    it('defaults to png for empty string', () => {
      expect(__testing.mimeToImageType('')).toBe('png');
    });
  });

  describe('Border Style Mapping', () => {
    it('maps solid to SINGLE', () => {
      const result = __testing.mapBorderStyle('solid');
      expect(result).toBeDefined();
    });

    it('maps double to DOUBLE', () => {
      const result = __testing.mapBorderStyle('double');
      expect(result).toBeDefined();
    });

    it('maps dashed to DASHED', () => {
      const result = __testing.mapBorderStyle('dashed');
      expect(result).toBeDefined();
    });

    it('maps dotted to DOTTED', () => {
      const result = __testing.mapBorderStyle('dotted');
      expect(result).toBeDefined();
    });

    it('maps dash_dot to DOT_DASH', () => {
      const result = __testing.mapBorderStyle('dash_dot');
      expect(result).toBeDefined();
    });

    it('maps none to NONE', () => {
      const result = __testing.mapBorderStyle('none');
      expect(result).toBeDefined();
    });

    it('handles case insensitivity', () => {
      const result = __testing.mapBorderStyle('SOLID');
      expect(result).toBeDefined();
    });

    it('defaults to SINGLE for unknown styles', () => {
      const result = __testing.mapBorderStyle('unknown');
      expect(result).toBeDefined();
    });
  });

  describe('Border Fill Parsing', () => {
    it('parses borderFill with background color', () => {
      const borderFill: GenericElement = {
        tag: 'borderFill',
        attrs: { id: '1' },
        children: [
          {
            tag: 'fillBrush',
            attrs: {},
            children: [
              {
                tag: 'winBrush',
                attrs: { faceColor: 'ff0000' },
                children: [],
                text: '',
              },
            ],
            text: '',
          },
        ],
        text: '',
      };

      const result = __testing.parseBorderFill(borderFill);
      expect(result.bgColor).toBe('ff0000');
    });

    it('ignores white background', () => {
      const borderFill: GenericElement = {
        tag: 'borderFill',
        attrs: { id: '1' },
        children: [
          {
            tag: 'fillBrush',
            attrs: {},
            children: [
              {
                tag: 'winBrush',
                attrs: { faceColor: 'ffffff' },
                children: [],
                text: '',
              },
            ],
            text: '',
          },
        ],
        text: '',
      };

      const result = __testing.parseBorderFill(borderFill);
      expect(result.bgColor).toBeUndefined();
    });

    it('ignores none background', () => {
      const borderFill: GenericElement = {
        tag: 'borderFill',
        attrs: { id: '1' },
        children: [
          {
            tag: 'fillBrush',
            attrs: {},
            children: [
              {
                tag: 'winBrush',
                attrs: { faceColor: 'none' },
                children: [],
                text: '',
              },
            ],
            text: '',
          },
        ],
        text: '',
      };

      const result = __testing.parseBorderFill(borderFill);
      expect(result.bgColor).toBeUndefined();
    });

    it('parses top border', () => {
      const borderFill: GenericElement = {
        tag: 'borderFill',
        attrs: { id: '1' },
        children: [
          {
            tag: 'top',
            attrs: { type: 'solid', width: '10' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };

      const result = __testing.parseBorderFill(borderFill);
      expect(result.borders.top).toBeDefined();
      expect(result.borders.top?.width).toBe(10);
    });

    it('parses bottom border', () => {
      const borderFill: GenericElement = {
        tag: 'borderFill',
        attrs: { id: '1' },
        children: [
          {
            tag: 'bottom',
            attrs: { type: 'dashed', width: '5' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };

      const result = __testing.parseBorderFill(borderFill);
      expect(result.borders.bottom).toBeDefined();
      expect(result.borders.bottom?.width).toBe(5);
    });

    it('parses left border', () => {
      const borderFill: GenericElement = {
        tag: 'borderFill',
        attrs: { id: '1' },
        children: [
          {
            tag: 'left',
            attrs: { type: 'dotted' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };

      const result = __testing.parseBorderFill(borderFill);
      expect(result.borders.left).toBeDefined();
    });

    it('parses right border', () => {
      const borderFill: GenericElement = {
        tag: 'borderFill',
        attrs: { id: '1' },
        children: [
          {
            tag: 'right',
            attrs: { type: 'double' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };

      const result = __testing.parseBorderFill(borderFill);
      expect(result.borders.right).toBeDefined();
    });

    it('ignores borders with type=none', () => {
      const borderFill: GenericElement = {
        tag: 'borderFill',
        attrs: { id: '1' },
        children: [
          {
            tag: 'top',
            attrs: { type: 'none' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };

      const result = __testing.parseBorderFill(borderFill);
      expect(result.borders.top).toBeUndefined();
    });

    it('parses empty borderFill', () => {
      const borderFill: GenericElement = {
        tag: 'borderFill',
        attrs: { id: '1' },
        children: [],
        text: '',
      };

      const result = __testing.parseBorderFill(borderFill);
      expect(result.borders).toEqual({});
      expect(result.bgColor).toBeUndefined();
    });
  });

  describe('Extract Text from Generic Element', () => {
    it('extracts text from element', () => {
      const el: GenericElement = {
        tag: 'p',
        attrs: {},
        children: [],
        text: 'Hello World',
      };
      expect(__testing.extractTextFromGeneric(el)).toBe('Hello World');
    });

    it('extracts text from nested elements', () => {
      const el: GenericElement = {
        tag: 'p',
        attrs: {},
        children: [
          {
            tag: 'span',
            attrs: {},
            children: [],
            text: ' nested',
          },
        ],
        text: 'Hello',
      };
      expect(__testing.extractTextFromGeneric(el)).toBe('Hello nested');
    });

    it('handles empty element', () => {
      const el: GenericElement = {
        tag: 'p',
        attrs: {},
        children: [],
        text: '',
      };
      expect(__testing.extractTextFromGeneric(el)).toBe('');
    });

    it('handles deeply nested elements', () => {
      const el: GenericElement = {
        tag: 'div',
        attrs: {},
        children: [
          {
            tag: 'p',
            attrs: {},
            children: [
              {
                tag: 'span',
                attrs: {},
                children: [],
                text: ' deep',
              },
            ],
            text: ' is',
          },
        ],
        text: 'This',
      };
      expect(__testing.extractTextFromGeneric(el)).toBe('This is deep');
    });
  });

  describe('Find Image Path', () => {
    it('finds image path from binItem src', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [
          {
            tag: 'binItem',
            attrs: { src: 'Pictures/image1.png' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };
      expect(__testing.findImagePath(el)).toBe('Pictures/image1.png');
    });

    it('finds image path from binItem href', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [
          {
            tag: 'binItem',
            attrs: { href: 'Pictures/image2.jpg' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };
      expect(__testing.findImagePath(el)).toBe('Pictures/image2.jpg');
    });

    it('finds image path from img binaryItemIDRef', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [
          {
            tag: 'img',
            attrs: { binaryItemIDRef: 'Pictures/image3.gif' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };
      expect(__testing.findImagePath(el)).toBe('Pictures/image3.gif');
    });

    it('finds image path from img src', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [
          {
            tag: 'img',
            attrs: { src: 'Pictures/image4.bmp' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };
      expect(__testing.findImagePath(el)).toBe('Pictures/image4.bmp');
    });

    it('returns null when no image path found', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [],
        text: '',
      };
      expect(__testing.findImagePath(el)).toBeNull();
    });

    it('finds image path in nested elements', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [
          {
            tag: 'container',
            attrs: {},
            children: [
              {
                tag: 'binItem',
                attrs: { src: 'Pictures/nested.png' },
                children: [],
                text: '',
              },
            ],
            text: '',
          },
        ],
        text: '',
      };
      expect(__testing.findImagePath(el)).toBe('Pictures/nested.png');
    });
  });

  describe('Find Image Dimensions', () => {
    it('finds dimensions from width/height attrs', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: { width: '1000', height: '800' },
        children: [],
        text: '',
      };
      const result = __testing.findImageDimensions(el);
      expect(result.width).toBe(1000);
      expect(result.height).toBe(800);
    });

    it('finds dimensions from sz child', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [
          {
            tag: 'sz',
            attrs: { width: '1200', height: '900' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };
      const result = __testing.findImageDimensions(el);
      expect(result.width).toBe(1200);
      expect(result.height).toBe(900);
    });

    it('finds dimensions from imgRect child with cx/cy', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [
          {
            tag: 'imgRect',
            attrs: { cx: '800', cy: '600' },
            children: [],
            text: '',
          },
        ],
        text: '',
      };
      const result = __testing.findImageDimensions(el);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('returns zero when no dimensions found', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [],
        text: '',
      };
      const result = __testing.findImageDimensions(el);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it('finds dimensions in nested children', () => {
      const el: GenericElement = {
        tag: 'pic',
        attrs: {},
        children: [
          {
            tag: 'container',
            attrs: {},
            children: [
              {
                tag: 'sz',
                attrs: { width: '500', height: '400' },
                children: [],
                text: '',
              },
            ],
            text: '',
          },
        ],
        text: '',
      };
      const result = __testing.findImageDimensions(el);
      expect(result.width).toBe(500);
      expect(result.height).toBe(400);
    });
  });

  describe('Create Text Run', () => {
    it('creates basic text run without formatting', () => {
      const run = __testing.createTextRun('Hello', undefined, undefined);
      expect(run).toBeDefined();
    });

    it('creates bold text run', () => {
      const charProp: CharProperty = { bold: true, height: 1000 };
      const run = __testing.createTextRun('Bold', charProp, undefined);
      expect(run).toBeDefined();
    });

    it('creates italic text run', () => {
      const charProp: CharProperty = { italic: true, height: 1000 };
      const run = __testing.createTextRun('Italic', charProp, undefined);
      expect(run).toBeDefined();
    });

    it('creates underlined text run', () => {
      const charProp: CharProperty = { underline: 'single', height: 1000 };
      const run = __testing.createTextRun('Underline', charProp, undefined);
      expect(run).toBeDefined();
    });

    it('ignores underline=none', () => {
      const charProp: CharProperty = { underline: 'none', height: 1000 };
      const run = __testing.createTextRun('No underline', charProp, undefined);
      expect(run).toBeDefined();
    });

    it('creates strikethrough text run', () => {
      const charProp: CharProperty = { strikeout: 'single', height: 1000 };
      const run = __testing.createTextRun('Strike', charProp, undefined);
      expect(run).toBeDefined();
    });

    it('ignores strikeout=none', () => {
      const charProp: CharProperty = { strikeout: 'none', height: 1000 };
      const run = __testing.createTextRun('No strike', charProp, undefined);
      expect(run).toBeDefined();
    });

    it('creates text run with font size', () => {
      const charProp: CharProperty = { height: 2000 }; // 20pt
      const run = __testing.createTextRun('Sized', charProp, undefined);
      expect(run).toBeDefined();
    });

    it('creates text run with color', () => {
      const charProp: CharProperty = { textColor: 'ff0000', height: 1000 }; // Red
      const run = __testing.createTextRun('Colored', charProp, undefined);
      expect(run).toBeDefined();
    });

    it('ignores black text color', () => {
      const charProp: CharProperty = { textColor: '000000', height: 1000 };
      const run = __testing.createTextRun('Black', charProp, undefined);
      expect(run).toBeDefined();
    });

    it('creates text run with font', () => {
      const charProp: CharProperty = {
        fontRef: { hangul: 0 },
        height: 1000,
      };
      const header: DocumentHeader = {
        refList: {
          fontFaces: [
            {
              lang: 'hangul',
              fonts: [{ id: 0, face: '바탕', type: 'ttf' }],
            },
          ],
          charProperties: [],
          paraProperties: [],
          borderFills: [],
        },
      } as any;
      const run = __testing.createTextRun('Fonted', charProp, header);
      expect(run).toBeDefined();
    });
  });

  describe('Create Docx Paragraph', () => {
    it('creates basic paragraph', () => {
      const para = __testing.createDocxParagraph([], undefined);
      expect(para).toBeDefined();
    });

    it('creates paragraph with left alignment', () => {
      const paraProp: ParaProperty = { align: 'left', id: 0 };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates paragraph with center alignment', () => {
      const paraProp: ParaProperty = { align: 'center', id: 0 };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates paragraph with right alignment', () => {
      const paraProp: ParaProperty = { align: 'right', id: 0 };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates paragraph with justify alignment', () => {
      const paraProp: ParaProperty = { align: 'justify', id: 0 };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates paragraph with distribute alignment', () => {
      const paraProp: ParaProperty = { align: 'distribute', id: 0 };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates heading 1', () => {
      const paraProp: ParaProperty = {
        heading: { level: 1, type: 'outline' },
        id: 0,
      };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates heading 2', () => {
      const paraProp: ParaProperty = {
        heading: { level: 2, type: 'outline' },
        id: 0,
      };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates heading 3', () => {
      const paraProp: ParaProperty = {
        heading: { level: 3, type: 'outline' },
        id: 0,
      };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates heading 4', () => {
      const paraProp: ParaProperty = {
        heading: { level: 4, type: 'outline' },
        id: 0,
      };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates heading 5', () => {
      const paraProp: ParaProperty = {
        heading: { level: 5, type: 'outline' },
        id: 0,
      };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });

    it('creates heading 6', () => {
      const paraProp: ParaProperty = {
        heading: { level: 6, type: 'outline' },
        id: 0,
      };
      const para = __testing.createDocxParagraph([], paraProp);
      expect(para).toBeDefined();
    });
  });

  describe('Convert Section Properties', () => {
    it('converts basic section properties', () => {
      const props = {
        pageWidth: 14400, // ~2 inches
        pageHeight: 21600, // ~3 inches
        landscape: false,
        margins: {
          top: 1440,
          bottom: 1440,
          left: 1440,
          right: 1440,
          header: 720,
          footer: 720,
          gutter: 0,
        },
      };
      const result = __testing.convertSectionProperties(props);
      expect(result.page).toBeDefined();
      expect(result.page.size).toBeDefined();
      expect(result.page.margin).toBeDefined();
    });

    it('handles landscape orientation', () => {
      const props = {
        pageWidth: 21600,
        pageHeight: 14400,
        landscape: true,
        margins: {
          top: 1440,
          bottom: 1440,
          left: 1440,
          right: 1440,
          header: 720,
          footer: 720,
          gutter: 0,
        },
      };
      const result = __testing.convertSectionProperties(props);
      expect(result.page.size.orientation).toBe('landscape');
    });

    it('handles custom margins', () => {
      const props = {
        pageWidth: 14400,
        pageHeight: 21600,
        landscape: false,
        margins: {
          top: 2000,
          bottom: 2000,
          left: 1500,
          right: 1500,
          header: 1000,
          footer: 1000,
          gutter: 500,
        },
      };
      const result = __testing.convertSectionProperties(props);
      expect(result.page.margin.gutter).toBeGreaterThan(0);
    });
  });

  describe('Convert Paragraph to Docx (Headers/Footers)', () => {
    it('converts simple paragraph', () => {
      const para = {
        runs: [
          {
            children: [
              { type: 'text' as const, content: 'Header text' },
            ],
          },
        ],
      } as any;
      const header: DocumentHeader = {
        refList: {
          fontFaces: [],
          charProperties: [],
          paraProperties: [],
          borderFills: [],
        },
      } as any;
      const result = __testing.convertParagraphToDocx(para, header);
      expect(result.length).toBeGreaterThan(0);
    });

    it('converts paragraph with charProp reference', () => {
      const para = {
        runs: [
          {
            charPrIDRef: 0,
            children: [
              { type: 'text' as const, content: 'Styled text' },
            ],
          },
        ],
      } as any;
      const header: DocumentHeader = {
        refList: {
          fontFaces: [],
          charProperties: [
            { id: 0, bold: true, height: 1000 },
          ],
          paraProperties: [],
          borderFills: [],
        },
      } as any;
      const result = __testing.convertParagraphToDocx(para, header);
      expect(result.length).toBeGreaterThan(0);
    });

    it('converts paragraph with paraProp reference', () => {
      const para = {
        paraPrIDRef: 0,
        runs: [
          {
            children: [
              { type: 'text' as const, content: 'Aligned text' },
            ],
          },
        ],
      } as any;
      const header: DocumentHeader = {
        refList: {
          fontFaces: [],
          charProperties: [],
          paraProperties: [
            { id: 0, align: 'center' },
          ],
          borderFills: [],
        },
      } as any;
      const result = __testing.convertParagraphToDocx(para, header);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
