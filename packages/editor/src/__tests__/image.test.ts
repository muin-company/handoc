import { describe, it, expect } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { hwpxToEditorState, editorStateToHwpx } from '../converter';
import { insertImage, updateImage, fileToDataURL } from '../commands';
import { HwpxBuilder } from '@handoc/hwpx-writer';
import { hanDocSchema } from '../schema';

// Test image: 1x1 red PNG pixel as base64
const RED_PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const RED_PIXEL_DATA_URL = `data:image/png;base64,${RED_PIXEL_PNG}`;

// Test image: 1x1 blue PNG pixel
const BLUE_PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
const BLUE_PIXEL_DATA_URL = `data:image/png;base64,${BLUE_PIXEL_PNG}`;

describe('image commands', () => {
  it('should insert an image at cursor position', () => {
    const state = EditorState.create({ schema: hanDocSchema });
    const command = insertImage({
      src: RED_PIXEL_DATA_URL,
      alt: 'Test image',
      width: 100,
      height: 100,
    });

    let newState: EditorState | null = null;
    command(state, (tr) => {
      newState = state.apply(tr);
    });

    expect(newState).not.toBeNull();
    expect(newState!.doc.nodeSize).toBeGreaterThan(state.doc.nodeSize);

    // Find the image node
    let foundImage = false;
    newState!.doc.descendants((node) => {
      if (node.type.name === 'image') {
        foundImage = true;
        expect(node.attrs.src).toBe(RED_PIXEL_DATA_URL);
        expect(node.attrs.alt).toBe('Test image');
        expect(node.attrs.width).toBe('100');
        expect(node.attrs.height).toBe('100');
      }
    });
    expect(foundImage).toBe(true);
  });

  it('should update image attributes', () => {
    // Create a document with an image
    const imageNode = hanDocSchema.nodes.image.create({
      src: RED_PIXEL_DATA_URL,
      alt: 'Original',
      width: '100',
      height: '100',
    });
    const paragraph = hanDocSchema.nodes.paragraph.create();
    const section = hanDocSchema.nodes.section.create(null, [imageNode, paragraph]);
    const doc = hanDocSchema.nodes.doc.create(null, [section]);
    const state = EditorState.create({ schema: hanDocSchema, doc });

    // Update the image (image is at position 1)
    const command = updateImage(1, {
      alt: 'Updated',
      width: 200,
      height: 200,
    });

    let newState: EditorState | null = null;
    command(state, (tr) => {
      newState = state.apply(tr);
    });

    expect(newState).not.toBeNull();

    // Check updated attributes
    const updatedImage = newState!.doc.nodeAt(1);
    expect(updatedImage).not.toBeNull();
    expect(updatedImage!.type.name).toBe('image');
    expect(updatedImage!.attrs.alt).toBe('Updated');
    expect(updatedImage!.attrs.width).toBe('200');
    expect(updatedImage!.attrs.height).toBe('200');
    expect(updatedImage!.attrs.src).toBe(RED_PIXEL_DATA_URL); // src unchanged
  });

  it.skip('should convert File to data URL', async () => {
    // Skipped: FileReader is not available in Node.js test environment
    // This test is for browser environment only
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const file = new File([blob], 'test.png', { type: 'image/png' });

    const dataURL = await fileToDataURL(file);

    expect(dataURL).toMatch(/^data:image\/png;base64,/);
  });
});

describe('image roundtrip', () => {
  it('should roundtrip image through HWPX', async () => {
    // Create HWPX with an image
    const imageData = Uint8Array.from(atob(RED_PIXEL_PNG), c => c.charCodeAt(0));
    const original = HwpxBuilder.create()
      .addParagraph('Before image')
      .addImage(imageData, 'png', 7200, 7200)
      .addParagraph('After image')
      .build();

    // HWPX → EditorState
    const state = await hwpxToEditorState(original);

    // Check that image was parsed
    let hasImage = false;
    let imageNode: any = null;
    state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        hasImage = true;
        imageNode = node;
      }
    });
    expect(hasImage).toBe(true);
    expect(imageNode).not.toBeNull();
    expect(imageNode.attrs.src).toMatch(/^data:image\//);

    // EditorState → HWPX
    const rewritten = await editorStateToHwpx(state);
    expect(rewritten).toBeInstanceOf(Uint8Array);
    expect(rewritten.length).toBeGreaterThan(0);

    // HWPX → EditorState again
    const state2 = await hwpxToEditorState(rewritten);

    // Check that image is still there
    let hasImage2 = false;
    state2.doc.descendants((node) => {
      if (node.type.name === 'image') {
        hasImage2 = true;
      }
    });
    expect(hasImage2).toBe(true);
  });

  it('should preserve image dimensions in roundtrip', async () => {
    const imageData = Uint8Array.from(atob(RED_PIXEL_PNG), c => c.charCodeAt(0));
    const original = HwpxBuilder.create()
      .addImage(imageData, 'png', 14400, 7200) // 2:1 ratio
      .build();

    const state = await hwpxToEditorState(original);

    let imageNode: any = null;
    state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        imageNode = node;
      }
    });

    expect(imageNode).not.toBeNull();
    expect(imageNode.attrs.width).toBe('14400');
    expect(imageNode.attrs.height).toBe('7200');

    // Roundtrip
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    let imageNode2: any = null;
    state2.doc.descendants((node) => {
      if (node.type.name === 'image') {
        imageNode2 = node;
      }
    });

    expect(imageNode2).not.toBeNull();
    expect(imageNode2.attrs.width).toBe('14400');
    expect(imageNode2.attrs.height).toBe('7200');
  });

  it('should handle multiple images', async () => {
    const redPixel = Uint8Array.from(atob(RED_PIXEL_PNG), c => c.charCodeAt(0));
    const bluePixel = Uint8Array.from(atob(BLUE_PIXEL_PNG), c => c.charCodeAt(0));

    const original = HwpxBuilder.create()
      .addParagraph('Image 1:')
      .addImage(redPixel, 'png', 7200, 7200)
      .addParagraph('Image 2:')
      .addImage(bluePixel, 'png', 7200, 7200)
      .addParagraph('End')
      .build();

    const state = await hwpxToEditorState(original);

    // Count images
    let imageCount = 0;
    state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        imageCount++;
      }
    });
    expect(imageCount).toBe(2);

    // Roundtrip
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    // Count images again
    let imageCount2 = 0;
    state2.doc.descendants((node) => {
      if (node.type.name === 'image') {
        imageCount2++;
      }
    });
    expect(imageCount2).toBe(2);
  });

  it('should handle image with text before and after', async () => {
    const imageData = Uint8Array.from(atob(RED_PIXEL_PNG), c => c.charCodeAt(0));

    const original = HwpxBuilder.create()
      .addParagraph('Text before')
      .addImage(imageData, 'png', 7200, 7200)
      .addParagraph('Text after')
      .build();

    const state = await hwpxToEditorState(original);

    expect(state.doc.textContent).toContain('Text before');
    expect(state.doc.textContent).toContain('Text after');

    let hasImage = false;
    state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        hasImage = true;
      }
    });
    expect(hasImage).toBe(true);

    // Roundtrip
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    expect(state2.doc.textContent).toContain('Text before');
    expect(state2.doc.textContent).toContain('Text after');

    let hasImage2 = false;
    state2.doc.descendants((node) => {
      if (node.type.name === 'image') {
        hasImage2 = true;
      }
    });
    expect(hasImage2).toBe(true);
  });

  it('should handle JPEG images', async () => {
    // Minimal JPEG header (not a valid image, but enough for testing)
    const jpegData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);

    const original = HwpxBuilder.create()
      .addImage(jpegData, 'jpg', 7200, 7200)
      .build();

    const state = await hwpxToEditorState(original);

    let imageNode: any = null;
    state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        imageNode = node;
      }
    });

    expect(imageNode).not.toBeNull();
    expect(imageNode.attrs.src).toMatch(/^data:image\/jpeg;base64,/);

    // Roundtrip
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    let imageNode2: any = null;
    state2.doc.descendants((node) => {
      if (node.type.name === 'image') {
        imageNode2 = node;
      }
    });

    expect(imageNode2).not.toBeNull();
    expect(imageNode2.attrs.src).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('should encode and decode base64 correctly', async () => {
    // Use the red pixel as test data
    const imageData = Uint8Array.from(atob(RED_PIXEL_PNG), c => c.charCodeAt(0));

    const original = HwpxBuilder.create()
      .addImage(imageData, 'png', 7200, 7200)
      .build();

    const state = await hwpxToEditorState(original);

    let srcBase64: string | null = null;
    state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        const src = node.attrs.src as string;
        const match = src.match(/^data:image\/png;base64,(.+)$/);
        if (match) {
          srcBase64 = match[1];
        }
      }
    });

    expect(srcBase64).not.toBeNull();
    expect(srcBase64).toBe(RED_PIXEL_PNG);
  });

  it('should handle images in multiple sections', async () => {
    const imageData = Uint8Array.from(atob(RED_PIXEL_PNG), c => c.charCodeAt(0));

    const original = HwpxBuilder.create()
      .addParagraph('Section 1')
      .addImage(imageData, 'png', 7200, 7200)
      .addSectionBreak()
      .addParagraph('Section 2')
      .addImage(imageData, 'png', 7200, 7200)
      .build();

    const state = await hwpxToEditorState(original);

    // Count sections and images
    let sectionCount = 0;
    let imageCount = 0;
    state.doc.forEach((node) => {
      if (node.type.name === 'section') {
        sectionCount++;
        node.forEach((child) => {
          if (child.type.name === 'image') {
            imageCount++;
          }
        });
      }
    });

    expect(sectionCount).toBe(2);
    expect(imageCount).toBe(2);

    // Roundtrip
    const rewritten = await editorStateToHwpx(state);
    const state2 = await hwpxToEditorState(rewritten);

    let sectionCount2 = 0;
    let imageCount2 = 0;
    state2.doc.forEach((node) => {
      if (node.type.name === 'section') {
        sectionCount2++;
        node.forEach((child) => {
          if (child.type.name === 'image') {
            imageCount2++;
          }
        });
      }
    });

    expect(sectionCount2).toBe(2);
    expect(imageCount2).toBe(2);
  });
});
