/**
 * ProseMirror commands for image manipulation and table editing
 */
import { Command } from 'prosemirror-state';
import { hanDocSchema } from './schema';

// Re-export table commands from prosemirror-tables
export {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  mergeCells,
  splitCell,
  toggleHeaderCell,
  toggleHeaderColumn,
  toggleHeaderRow,
  setCellAttr,
  goToNextCell,
} from 'prosemirror-tables';

// Export a helper to get table keymap
export { tableKeymap } from './tableKeymap';

/**
 * Check if cursor is inside a table
 */
export function isInTable(state: any): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.spec.tableRole === 'table') {
      return true;
    }
  }
  return false;
}

// Export a helper to insert tables
export function insertTable(rows: number = 2, cols: number = 2): Command {
  return (state, dispatch) => {
    const { schema, tr } = state;
    
    // Create table cells
    const cells: any[] = [];
    for (let i = 0; i < cols; i++) {
      cells.push(
        schema.nodes.table_cell.create(null, [
          schema.nodes.paragraph.create()
        ])
      );
    }
    
    // Create rows
    const rowNodes: any[] = [];
    for (let i = 0; i < rows; i++) {
      rowNodes.push(schema.nodes.table_row.create(null, cells));
    }
    
    // Create table
    const table = schema.nodes.table.create(null, rowNodes);
    
    if (dispatch) {
      const pos = state.selection.from;
      dispatch(tr.insert(pos, table));
    }
    
    return true;
  };
}

export interface InsertImageOptions {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Insert an image at the current selection position.
 * The image will be inserted as a block-level node.
 */
export function insertImage(options: InsertImageOptions): Command {
  return (state, dispatch) => {
    const { src, alt, width, height } = options;
    const { schema, tr } = state;
    
    const imageNode = schema.nodes.image.create({
      src,
      alt: alt || null,
      width: width?.toString() || null,
      height: height?.toString() || null,
    });
    
    if (dispatch) {
      // Insert at current position
      const pos = state.selection.from;
      dispatch(tr.insert(pos, imageNode));
    }
    
    return true;
  };
}

/**
 * Update an image's attributes (size, alt text, etc.)
 */
export function updateImage(pos: number, attrs: Partial<InsertImageOptions>): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    
    if (!node || node.type.name !== 'image') {
      return false;
    }
    
    if (dispatch) {
      const newAttrs = {
        ...node.attrs,
        ...attrs,
        width: attrs.width?.toString() || node.attrs.width,
        height: attrs.height?.toString() || node.attrs.height,
      };
      
      dispatch(state.tr.setNodeMarkup(pos, undefined, newAttrs));
    }
    
    return true;
  };
}

/**
 * Convert a File object to a base64 data URL
 * Note: This requires a browser environment with FileReader API
 */
export async function fileToDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if we're in a browser environment
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader is not available in this environment'));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Insert an image from a File object (handles file upload)
 */
export async function insertImageFromFile(file: File): Promise<Command> {
  const dataURL = await fileToDataURL(file);
  
  return insertImage({
    src: dataURL,
    alt: file.name,
  });
}

/**
 * Set image alignment by wrapping in a paragraph with alignment
 * Note: In the current schema, images are block-level, so we use paragraph alignment
 */
export function setImageAlignment(pos: number, align: 'left' | 'center' | 'right'): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    
    if (!node || node.type.name !== 'image') {
      return false;
    }
    
    // For now, we'll need to implement this differently since images are block-level
    // This is a placeholder for future enhancement
    console.warn('Image alignment not yet implemented for block-level images');
    
    return false;
  };
}
