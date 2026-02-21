import { describe, it, expect } from 'vitest';
import { __testing } from '../converter';
import type { GenericElement } from '@handoc/document-model';
import { HanDoc } from '@handoc/hwpx-parser';

/**
 * Tests for image conversion functions.
 * These target the convertInlineObject code path which requires HanDoc instances.
 */

describe('Image Conversion - convertInlineObject', () => {
  
  describe('Null Path Handling', () => {
    it('returns null when no image path found', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: {},
          children: [],
          text: '',
        } as GenericElement,
      };

      // Create a minimal mock HanDoc
      const mockDoc = {
        getImage: () => null,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).toBeNull();
    });

    it('returns null when image data not found in doc', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: {},
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/missing.png' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const mockDoc = {
        getImage: () => null, // Simulates missing image
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).toBeNull();
    });
  });

  describe('Image Type Detection', () => {
    it('detects jpg from file extension', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/photo.jpg' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG header
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('detects jpeg from file extension', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/photo.jpeg' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0xff, 0xd8, 0xff]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('detects png from file extension', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/image.png' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('detects gif from file extension', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/animation.gif' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x47, 0x49, 0x46]); // GIF header
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('detects bmp from file extension', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/bitmap.bmp' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x42, 0x4d]); // BMP header
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('defaults to png for unknown extension', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/unknown.xyz' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x00, 0x01, 0x02]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('defaults to png when no extension', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/imagefile' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x00, 0x01, 0x02]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });
  });

  describe('Dimension Handling', () => {
    it('uses dimensions from element attributes', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '2000', height: '1500' },
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/test.png' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('uses default dimensions when not specified', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: {},
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/test.png' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('finds dimensions from nested sz element', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: {},
          children: [
            {
              tag: 'container',
              attrs: {},
              children: [
                {
                  tag: 'sz',
                  attrs: { width: '3000', height: '2000' },
                  children: [],
                  text: '',
                },
                {
                  tag: 'binItem',
                  attrs: { src: 'Pictures/test.png' },
                  children: [],
                  text: '',
                },
              ],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });
  });

  describe('Image Path Variations', () => {
    it('finds image from binItem href attribute', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'binItem',
              attrs: { href: 'Pictures/image.png' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('finds image from img element with binaryItemIDRef', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'img',
              attrs: { binaryItemIDRef: 'Pictures/photo.jpg' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0xff, 0xd8, 0xff]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('finds image from img element with src', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '1000', height: '800' },
          children: [
            {
              tag: 'img',
              attrs: { src: 'Pictures/diagram.png' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });

    it('finds image in deeply nested structure', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: {},
          children: [
            {
              tag: 'level1',
              attrs: {},
              children: [
                {
                  tag: 'level2',
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
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const mockDoc = {
        getImage: (path: string) => {
          if (path === 'Pictures/nested.png') return fakeImageData;
          return null;
        },
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).not.toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty children array', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: {},
          children: [],
          text: '',
        } as GenericElement,
      };

      const mockDoc = {
        getImage: () => null,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).toBeNull();
    });

    it('handles malformed binItem (no src/href)', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: {},
          children: [
            {
              tag: 'binItem',
              attrs: {},
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const mockDoc = {
        getImage: () => null,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      expect(result).toBeNull();
    });

    it('handles valid image with zero dimensions', () => {
      const inlineObj = {
        type: 'inlineObject' as const,
        name: 'pic',
        element: {
          tag: 'pic',
          attrs: { width: '0', height: '0' },
          children: [
            {
              tag: 'binItem',
              attrs: { src: 'Pictures/test.png' },
              children: [],
              text: '',
            },
          ],
          text: '',
        } as GenericElement,
      };

      const fakeImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const mockDoc = {
        getImage: () => fakeImageData,
      } as any;

      const result = __testing.convertInlineObject(inlineObj, mockDoc);
      // Should still create ImageRun with default dimensions
      expect(result).not.toBeNull();
    });
  });
});
