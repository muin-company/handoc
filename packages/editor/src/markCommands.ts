/**
 * Commands for toggling text marks (bold, italic, underline, etc.)
 */
import { Command } from 'prosemirror-state';
import { toggleMark } from 'prosemirror-commands';
import { hanDocSchema } from './schema';

/**
 * Toggle bold mark
 */
export const toggleBold: Command = toggleMark(hanDocSchema.marks.bold);

/**
 * Toggle italic mark
 */
export const toggleItalic: Command = toggleMark(hanDocSchema.marks.italic);

/**
 * Toggle underline mark
 */
export const toggleUnderline: Command = toggleMark(hanDocSchema.marks.underline);

/**
 * Toggle strikeout mark
 */
export const toggleStrikeout: Command = toggleMark(hanDocSchema.marks.strikeout);

/**
 * Check if a mark is active in the current selection
 */
export function isMarkActive(state: any, markType: any): boolean {
  const { from, $from, to, empty } = state.selection;
  
  if (empty) {
    return !!markType.isInSet(state.storedMarks || $from.marks());
  }
  
  return state.doc.rangeHasMark(from, to, markType);
}

/**
 * Set paragraph alignment
 */
export function setAlignment(align: 'left' | 'center' | 'right' | 'justify' | 'distribute'): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    
    // Find the paragraph node
    let paraPos = -1;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (node.type === hanDocSchema.nodes.paragraph) {
        paraPos = $from.before(d);
        break;
      }
    }
    
    if (paraPos === -1) return false;
    
    if (dispatch) {
      const node = state.doc.nodeAt(paraPos);
      if (!node) return false;
      
      dispatch(
        state.tr.setNodeMarkup(paraPos, undefined, {
          ...node.attrs,
          align,
        })
      );
    }
    
    return true;
  };
}

/**
 * Set heading level
 */
export function setHeading(level: 1 | 2 | 3 | 4 | 5 | 6): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;
    
    if (dispatch) {
      const tr = state.tr;
      
      state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
        if (node.type === hanDocSchema.nodes.paragraph || node.type === hanDocSchema.nodes.heading) {
          tr.setNodeMarkup(pos, hanDocSchema.nodes.heading, {
            ...node.attrs,
            level,
          });
        }
      });
      
      dispatch(tr);
    }
    
    return true;
  };
}

/**
 * Convert heading to paragraph
 */
export function setParagraph(): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;
    
    if (dispatch) {
      const tr = state.tr;
      
      state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
        if (node.type === hanDocSchema.nodes.heading) {
          tr.setNodeMarkup(pos, hanDocSchema.nodes.paragraph, {
            styleIDRef: null,
            paraPrIDRef: null,
            align: node.attrs.align || null,
          });
        }
      });
      
      dispatch(tr);
    }
    
    return true;
  };
}
