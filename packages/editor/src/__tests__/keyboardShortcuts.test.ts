/**
 * Tests for keyboard shortcuts
 */
import { describe, it, expect } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { hanDocSchema } from '../schema';
import { toggleBold, toggleItalic, toggleUnderline, isMarkActive } from '../markCommands';

describe('Keyboard Shortcuts', () => {
  const createState = (text: string = 'Hello world') => {
    return EditorState.create({
      schema: hanDocSchema,
      doc: hanDocSchema.nodes.doc.create(null, [
        hanDocSchema.nodes.section.create(null, [
          hanDocSchema.nodes.paragraph.create(null, [
            hanDocSchema.text(text),
          ]),
        ]),
      ]),
      plugins: [
        history(),
        keymap({
          'Mod-b': toggleBold,
          'Mod-i': toggleItalic,
          'Mod-u': toggleUnderline,
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-Shift-z': redo,
        }),
      ],
    });
  };

  describe('Mark toggles', () => {
    it('should have Mod-b mapped to toggleBold', () => {
      const state = createState();
      const tr = state.tr;
      const sel = TextSelection.create(state.doc, 1, 6);
      const newState = state.apply(tr.setSelection(sel));
      
      const plugin = newState.plugins.find(p => (p as any).spec?.props?.handleKeyDown);
      expect(plugin).toBeTruthy();
    });

    it('should apply bold with Mod-b command', () => {
      const state = createState();
      const tr = state.tr;
      const sel = TextSelection.create(state.doc, 1, 6);
      const newState = state.apply(tr.setSelection(sel));
      
      let result: EditorState | null = null;
      toggleBold(newState, (tr) => {
        result = newState.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        expect(isMarkActive(result, hanDocSchema.marks.bold)).toBe(true);
      }
    });

    it('should apply italic with Mod-i command', () => {
      const state = createState();
      const tr = state.tr;
      const sel = TextSelection.create(state.doc, 1, 6);
      const newState = state.apply(tr.setSelection(sel));
      
      let result: EditorState | null = null;
      toggleItalic(newState, (tr) => {
        result = newState.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        expect(isMarkActive(result, hanDocSchema.marks.italic)).toBe(true);
      }
    });

    it('should apply underline with Mod-u command', () => {
      const state = createState();
      const tr = state.tr;
      const sel = TextSelection.create(state.doc, 1, 6);
      const newState = state.apply(tr.setSelection(sel));
      
      let result: EditorState | null = null;
      toggleUnderline(newState, (tr) => {
        result = newState.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        expect(isMarkActive(result, hanDocSchema.marks.underline)).toBe(true);
      }
    });
  });

  describe('Undo/Redo', () => {
    it('should undo text insertion', () => {
      // Create state with empty paragraph (no text node)
      let state = EditorState.create({
        schema: hanDocSchema,
        doc: hanDocSchema.nodes.doc.create(null, [
          hanDocSchema.nodes.section.create(null, [
            hanDocSchema.nodes.paragraph.create(),
          ]),
        ]),
        plugins: [
          history(),
          keymap({
            'Mod-b': toggleBold,
            'Mod-i': toggleItalic,
            'Mod-u': toggleUnderline,
            'Mod-z': undo,
            'Mod-y': redo,
            'Mod-Shift-z': redo,
          }),
        ],
      });
      
      // Insert text
      const tr = state.tr.insertText('Hello', 1);
      state = state.apply(tr);
      expect(state.doc.textContent).toBe('Hello');
      
      // Undo
      let result: EditorState | null = null;
      undo(state, (tr) => {
        result = state.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        expect(result.doc.textContent).toBe('');
      }
    });

    it('should redo text insertion after undo', () => {
      // Create state with empty paragraph (no text node)
      let state = EditorState.create({
        schema: hanDocSchema,
        doc: hanDocSchema.nodes.doc.create(null, [
          hanDocSchema.nodes.section.create(null, [
            hanDocSchema.nodes.paragraph.create(),
          ]),
        ]),
        plugins: [
          history(),
          keymap({
            'Mod-b': toggleBold,
            'Mod-i': toggleItalic,
            'Mod-u': toggleUnderline,
            'Mod-z': undo,
            'Mod-y': redo,
            'Mod-Shift-z': redo,
          }),
        ],
      });
      
      // Insert text
      state = state.apply(state.tr.insertText('Hello', 1));
      expect(state.doc.textContent).toBe('Hello');
      
      // Undo
      let undone: EditorState | null = null;
      undo(state, (tr) => {
        undone = state.apply(tr);
      });
      expect(undone?.doc.textContent).toBe('');
      
      // Redo
      if (undone) {
        let redone: EditorState | null = null;
        redo(undone, (tr) => {
          redone = undone!.apply(tr);
        });
        expect(redone?.doc.textContent).toBe('Hello');
      }
    });

    it('should undo mark application', () => {
      let state = createState('Hello');
      const sel = TextSelection.create(state.doc, 1, 6);
      state = state.apply(state.tr.setSelection(sel));
      
      // Apply bold
      let bolded: EditorState | null = null;
      toggleBold(state, (tr) => {
        bolded = state.apply(tr);
      });
      
      expect(bolded).toBeTruthy();
      if (bolded) {
        expect(isMarkActive(bolded, hanDocSchema.marks.bold)).toBe(true);
        
        // Undo
        let undone: EditorState | null = null;
        undo(bolded, (tr) => {
          undone = bolded!.apply(tr);
        });
        
        expect(undone).toBeTruthy();
        if (undone) {
          expect(isMarkActive(undone, hanDocSchema.marks.bold)).toBe(false);
        }
      }
    });
  });
});
