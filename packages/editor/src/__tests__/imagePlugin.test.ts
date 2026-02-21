/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { hanDocSchema } from '../schema';
import { imagePlugin } from '../imagePlugin';

// Mock FileReader
class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsDataURL(blob: Blob) {
    setTimeout(() => {
      this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      if (this.onload) {
        this.onload.call(this as any, {} as any);
      }
    }, 0);
  }
}

// Replace global FileReader
(global as any).FileReader = MockFileReader;

function createMockFile(name: string, type: string): File {
  const blob = new Blob(['fake image content'], { type });
  return new File([blob], name, { type });
}

function createMockDataTransfer(files: File[]): DataTransfer {
  const items: DataTransferItem[] = files.map(file => ({
    kind: 'file' as const,
    type: file.type,
    getAsFile: () => file,
    getAsString: (callback: any) => callback(''),
    webkitGetAsEntry: () => null,
  }));

  return {
    dropEffect: 'none',
    effectAllowed: 'all',
    files: files as any,
    items: items as any,
    types: ['Files'],
    clearData: () => {},
    getData: () => '',
    setData: () => {},
    setDragImage: () => {},
  } as DataTransfer;
}

describe('imagePlugin', () => {
  it('should create plugin instance', () => {
    const plugin = imagePlugin(hanDocSchema);
    expect(plugin).toBeDefined();
    expect(plugin.spec).toBeDefined();
    expect(plugin.spec.props).toBeDefined();
  });

  it('should have handleDrop prop', () => {
    const plugin = imagePlugin(hanDocSchema);
    expect(plugin.spec.props?.handleDrop).toBeDefined();
    expect(typeof plugin.spec.props?.handleDrop).toBe('function');
  });

  it('should have handlePaste prop', () => {
    const plugin = imagePlugin(hanDocSchema);
    expect(plugin.spec.props?.handlePaste).toBeDefined();
    expect(typeof plugin.spec.props?.handlePaste).toBe('function');
  });

  it('should be registered in editor state', () => {
    const state = EditorState.create({
      schema: hanDocSchema,
      doc: hanDocSchema.nodes.doc.create(null, [
        hanDocSchema.nodes.section.create(null, [
          hanDocSchema.nodes.paragraph.create(),
        ]),
      ]),
      plugins: [imagePlugin(hanDocSchema)],
    });

    expect(state.plugins).toBeDefined();
    expect(state.plugins.length).toBeGreaterThan(0);
    
    // Find imagePlugin in the plugins
    const hasImagePlugin = state.plugins.some(p => 
      p.spec?.props?.handleDrop && p.spec?.props?.handlePaste
    );
    expect(hasImagePlugin).toBe(true);
  });

  it('should not interfere with other plugins', () => {
    const state = EditorState.create({
      schema: hanDocSchema,
      plugins: [imagePlugin(hanDocSchema)],
    });

    // Plugin should not throw when state is created
    expect(state).toBeDefined();
    expect(state.doc).toBeDefined();
  });

  describe('handleDrop', () => {
    it('should return false when no files in drop event', () => {
      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handleDrop = plugin.spec.props?.handleDrop;
      
      const event = {
        dataTransfer: createMockDataTransfer([]),
      };

      const result = handleDrop?.(view, event as any, null as any, false);
      expect(result).toBe(false);

      view.destroy();
    });

    it('should return false when no image files in drop event', () => {
      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handleDrop = plugin.spec.props?.handleDrop;
      
      const textFile = createMockFile('document.txt', 'text/plain');
      const event = {
        dataTransfer: createMockDataTransfer([textFile]),
      };

      const result = handleDrop?.(view, event as any, null as any, false);
      expect(result).toBe(false);

      view.destroy();
    });

    it('should handle image file drop', async () => {
      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handleDrop = plugin.spec.props?.handleDrop;
      
      const imageFile = createMockFile('image.png', 'image/png');
      const dataTransfer = createMockDataTransfer([imageFile]);
      
      const event = {
        dataTransfer,
        clientX: 10,
        clientY: 10,
        preventDefault: vi.fn(),
      };

      // Mock posAtCoords
      view.posAtCoords = vi.fn().mockReturnValue({ pos: 1, inside: 1 });

      const result = handleDrop?.(view, event as any, null as any, false);
      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      // Wait for async file processing
      await new Promise(resolve => setTimeout(resolve, 10));

      view.destroy();
    });

    it('should handle multiple image files drop', async () => {
      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handleDrop = plugin.spec.props?.handleDrop;
      
      const imageFile1 = createMockFile('image1.png', 'image/png');
      const imageFile2 = createMockFile('image2.jpg', 'image/jpeg');
      const dataTransfer = createMockDataTransfer([imageFile1, imageFile2]);
      
      const event = {
        dataTransfer,
        clientX: 10,
        clientY: 10,
        preventDefault: vi.fn(),
      };

      view.posAtCoords = vi.fn().mockReturnValue({ pos: 1, inside: 1 });

      const result = handleDrop?.(view, event as any, null as any, false);
      expect(result).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 10));

      view.destroy();
    });

    it('should return true when posAtCoords returns null', () => {
      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handleDrop = plugin.spec.props?.handleDrop;
      
      const imageFile = createMockFile('image.png', 'image/png');
      const dataTransfer = createMockDataTransfer([imageFile]);
      
      const event = {
        dataTransfer,
        clientX: 10,
        clientY: 10,
        preventDefault: vi.fn(),
      };

      view.posAtCoords = vi.fn().mockReturnValue(null);

      const result = handleDrop?.(view, event as any, null as any, false);
      expect(result).toBe(true);

      view.destroy();
    });

    it('should handle file read error', async () => {
      // Mock FileReader with error
      const OriginalFileReader = (global as any).FileReader;
      
      class ErrorFileReader {
        result: string | ArrayBuffer | null = null;
        onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
        onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

        readAsDataURL(blob: Blob) {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror.call(this as any, {} as any);
            }
          }, 0);
        }
      }

      (global as any).FileReader = ErrorFileReader;

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handleDrop = plugin.spec.props?.handleDrop;
      
      const imageFile = createMockFile('image.png', 'image/png');
      const event = {
        dataTransfer: createMockDataTransfer([imageFile]),
        clientX: 10,
        clientY: 10,
        preventDefault: vi.fn(),
      };

      view.posAtCoords = vi.fn().mockReturnValue({ pos: 1, inside: 1 });

      const result = handleDrop?.(view, event as any, null as any, false);
      expect(result).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
      (global as any).FileReader = OriginalFileReader;
      view.destroy();
    });
  });

  describe('handlePaste', () => {
    it('should return false when no files in clipboard', () => {
      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handlePaste = plugin.spec.props?.handlePaste;
      
      const event = {
        clipboardData: createMockDataTransfer([]),
      };

      const result = handlePaste?.(view, event as any, null as any);
      expect(result).toBe(false);

      view.destroy();
    });

    it('should return false when no image files in clipboard', () => {
      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handlePaste = plugin.spec.props?.handlePaste;
      
      const textFile = createMockFile('document.txt', 'text/plain');
      const event = {
        clipboardData: createMockDataTransfer([textFile]),
      };

      const result = handlePaste?.(view, event as any, null as any);
      expect(result).toBe(false);

      view.destroy();
    });

    it('should handle image paste', async () => {
      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handlePaste = plugin.spec.props?.handlePaste;
      
      const imageFile = createMockFile('screenshot.png', 'image/png');
      const event = {
        clipboardData: createMockDataTransfer([imageFile]),
        preventDefault: vi.fn(),
      };

      const result = handlePaste?.(view, event as any, null as any);
      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      await new Promise(resolve => setTimeout(resolve, 10));

      view.destroy();
    });

    it('should handle multiple image paste', async () => {
      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handlePaste = plugin.spec.props?.handlePaste;
      
      const imageFile1 = createMockFile('img1.png', 'image/png');
      const imageFile2 = createMockFile('img2.gif', 'image/gif');
      const event = {
        clipboardData: createMockDataTransfer([imageFile1, imageFile2]),
        preventDefault: vi.fn(),
      };

      const result = handlePaste?.(view, event as any, null as any);
      expect(result).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 10));

      view.destroy();
    });

    it('should handle paste error', async () => {
      const OriginalFileReader = (global as any).FileReader;
      
      class ErrorFileReader {
        result: string | ArrayBuffer | null = null;
        onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
        onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

        readAsDataURL(blob: Blob) {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror.call(this as any, {} as any);
            }
          }, 0);
        }
      }

      (global as any).FileReader = ErrorFileReader;

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const plugin = imagePlugin(hanDocSchema);
      const state = EditorState.create({
        schema: hanDocSchema,
        plugins: [plugin],
      });

      const div = document.createElement('div');
      const view = new EditorView(div, { state });

      const handlePaste = plugin.spec.props?.handlePaste;
      
      const imageFile = createMockFile('image.png', 'image/png');
      const event = {
        clipboardData: createMockDataTransfer([imageFile]),
        preventDefault: vi.fn(),
      };

      const result = handlePaste?.(view, event as any, null as any);
      expect(result).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
      (global as any).FileReader = OriginalFileReader;
      view.destroy();
    });
  });
});
