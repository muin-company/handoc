export { hanDocSchema } from './schema';
export { hwpxToEditorState, editorStateToHwpx } from './converter';
export { HanDocEditor, type HanDocEditorProps } from './HanDocEditor';
export { imagePlugin } from './imagePlugin';
export { 
  // Image commands
  insertImage, 
  updateImage, 
  insertImageFromFile, 
  fileToDataURL,
  setImageAlignment,
  type InsertImageOptions,
  // Table commands
  insertTable,
  isInTable,
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
  tableKeymap,
} from './commands';
