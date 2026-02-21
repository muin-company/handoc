/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { hanDocSchema } from '../schema';
import {
  insertTable,
  isInTable,
  fileToDataURL,
  insertImageFromFile,
  setImageAlignment,
} from '../commands';

// Mock FileReader for browser APIs
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

(global as any).FileReader = MockFileReader;

function createMockFile(name: string, type: string): File {
  const blob = new Blob(['fake content'], { type });
  return new File([blob], name, { type });
}

describe('insertTable', () => {
  it('should insert a table with default size', () => {
    const state = EditorState.create({ schema: hanDocSchema });
    const command = insertTable();

    let newState: EditorState | null = null;
    command(state, (tr) => {
      newState = state.apply(tr);
    });

    expect(newState).not.toBeNull();
    
    let foundTable = false;
    newState!.doc.descendants((node) => {
      if (node.type.name === 'table') {
        foundTable = true;
        expect(node.childCount).toBe(2); // 2 rows
        node.forEach((row) => {
          expect(row.childCount).toBe(2); // 2 cols
        });
      }
    });
    expect(foundTable).toBe(true);
  });

  it('should insert a table with custom size', () => {
    const state = EditorState.create({ schema: hanDocSchema });
    const command = insertTable(3, 4);

    let newState: EditorState | null = null;
    command(state, (tr) => {
      newState = state.apply(tr);
    });

    expect(newState).not.toBeNull();
    
    let foundTable = false;
    newState!.doc.descendants((node) => {
      if (node.type.name === 'table') {
        foundTable = true;
        expect(node.childCount).toBe(3); // 3 rows
        node.forEach((row) => {
          expect(row.childCount).toBe(4); // 4 cols
        });
      }
    });
    expect(foundTable).toBe(true);
  });

  it('should return true without dispatch', () => {
    const state = EditorState.create({ schema: hanDocSchema });
    const command = insertTable(2, 2);

    const result = command(state);
    expect(result).toBe(true);
  });
});

describe('isInTable', () => {
  it('should return false when not in table', () => {
    const paragraph = hanDocSchema.nodes.paragraph.create(null, [
      hanDocSchema.text('Normal text')
    ]);
    const section = hanDocSchema.nodes.section.create(null, [paragraph]);
    const doc = hanDocSchema.nodes.doc.create(null, [section]);
    const state = EditorState.create({ schema: hanDocSchema, doc });

    const result = isInTable(state);
    expect(result).toBe(false);
  });

  it('should return true when in table', () => {
    const cellPara = hanDocSchema.nodes.paragraph.create(null, [
      hanDocSchema.text('Cell text')
    ]);
    const cell = hanDocSchema.nodes.table_cell.create(null, [cellPara]);
    const row = hanDocSchema.nodes.table_row.create(null, [cell]);
    const table = hanDocSchema.nodes.table.create(null, [row]);
    const section = hanDocSchema.nodes.section.create(null, [table]);
    const doc = hanDocSchema.nodes.doc.create(null, [section]);
    
    // Selection inside the cell (position 4 is inside the cell paragraph)
    const state = EditorState.create({
      schema: hanDocSchema,
      doc,
    });
    
    // Move selection inside table
    const tr = state.tr.setSelection(
      state.selection.constructor.near(state.doc.resolve(4))
    );
    const newState = state.apply(tr);

    const result = isInTable(newState);
    expect(result).toBe(true);
  });
});

describe('fileToDataURL', () => {
  it('should convert File to data URL', async () => {
    const file = createMockFile('test.png', 'image/png');
    
    const dataURL = await fileToDataURL(file);
    
    expect(dataURL).toMatch(/^data:image\/png;base64,/);
  });

  it('should convert Blob to data URL', async () => {
    const blob = new Blob(['test data'], { type: 'image/jpeg' });
    
    const dataURL = await fileToDataURL(blob);
    
    expect(dataURL).toMatch(/^data:image\/png;base64,/); // Using mock
  });

  it('should reject if FileReader is not available', async () => {
    const OriginalFileReader = (global as any).FileReader;
    (global as any).FileReader = undefined;

    const file = createMockFile('test.png', 'image/png');

    await expect(fileToDataURL(file)).rejects.toThrow('FileReader is not available');

    (global as any).FileReader = OriginalFileReader;
  });

  it('should reject on FileReader error', async () => {
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

    const OriginalFileReader = (global as any).FileReader;
    (global as any).FileReader = ErrorFileReader;

    const file = createMockFile('test.png', 'image/png');

    await expect(fileToDataURL(file)).rejects.toThrow('Failed to read file');

    (global as any).FileReader = OriginalFileReader;
  });

  it('should reject if result is not a string', async () => {
    class NonStringFileReader {
      result: string | ArrayBuffer | null = new ArrayBuffer(8);
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

      readAsDataURL(blob: Blob) {
        setTimeout(() => {
          if (this.onload) {
            this.onload.call(this as any, {} as any);
          }
        }, 0);
      }
    }

    const OriginalFileReader = (global as any).FileReader;
    (global as any).FileReader = NonStringFileReader;

    const file = createMockFile('test.png', 'image/png');

    await expect(fileToDataURL(file)).rejects.toThrow('Failed to read file as data URL');

    (global as any).FileReader = OriginalFileReader;
  });
});

describe('insertImageFromFile', () => {
  it('should create insert command from file', async () => {
    const file = createMockFile('photo.png', 'image/png');
    
    const command = await insertImageFromFile(file);
    
    expect(command).toBeDefined();
    expect(typeof command).toBe('function');

    // Test the command
    const state = EditorState.create({ schema: hanDocSchema });
    let newState: EditorState | null = null;
    command(state, (tr) => {
      newState = state.apply(tr);
    });

    expect(newState).not.toBeNull();
    
    let foundImage = false;
    newState!.doc.descendants((node) => {
      if (node.type.name === 'image') {
        foundImage = true;
        expect(node.attrs.src).toMatch(/^data:image\/png;base64,/);
        expect(node.attrs.alt).toBe('photo.png');
      }
    });
    expect(foundImage).toBe(true);
  });

  it('should reject if fileToDataURL fails', async () => {
    const OriginalFileReader = (global as any).FileReader;
    (global as any).FileReader = undefined;

    const file = createMockFile('photo.png', 'image/png');

    await expect(insertImageFromFile(file)).rejects.toThrow();

    (global as any).FileReader = OriginalFileReader;
  });
});

describe('setImageAlignment', () => {
  it('should return false for block-level images', () => {
    const imageNode = hanDocSchema.nodes.image.create({
      src: 'data:image/png;base64,abc',
    });
    const paragraph = hanDocSchema.nodes.paragraph.create();
    const section = hanDocSchema.nodes.section.create(null, [imageNode, paragraph]);
    const doc = hanDocSchema.nodes.doc.create(null, [section]);
    const state = EditorState.create({ schema: hanDocSchema, doc });

    const command = setImageAlignment(1, 'center');
    
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const result = command(state);
    
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Image alignment not yet implemented')
    );
    
    consoleWarnSpy.mockRestore();
  });

  it('should return false when node is not an image', () => {
    const paragraph = hanDocSchema.nodes.paragraph.create(null, [
      hanDocSchema.text('Text')
    ]);
    const section = hanDocSchema.nodes.section.create(null, [paragraph]);
    const doc = hanDocSchema.nodes.doc.create(null, [section]);
    const state = EditorState.create({ schema: hanDocSchema, doc });

    const command = setImageAlignment(1, 'center');
    
    const result = command(state);
    
    expect(result).toBe(false);
  });

  it('should return false for doc position', () => {
    const paragraph = hanDocSchema.nodes.paragraph.create();
    const section = hanDocSchema.nodes.section.create(null, [paragraph]);
    const doc = hanDocSchema.nodes.doc.create(null, [section]);
    const state = EditorState.create({ schema: hanDocSchema, doc });

    // Position 0 is the doc node itself
    const command = setImageAlignment(0, 'left');
    
    const result = command(state);
    
    expect(result).toBe(false);
  });
});
