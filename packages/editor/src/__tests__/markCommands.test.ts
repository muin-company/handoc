/**
 * Tests for mark toggle commands
 */
import { describe, it, expect } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { hanDocSchema } from '../schema';
import {
  toggleBold,
  toggleItalic,
  toggleUnderline,
  isMarkActive,
  setAlignment,
  setHeading,
  setParagraph,
} from '../markCommands';

describe('markCommands', () => {
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
    });
  };

  describe('toggleBold', () => {
    it('should apply bold mark to selected text', () => {
      const state = createState();
      const tr = state.tr;
      
      // Select "Hello"
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

    it('should remove bold mark from already bold text', () => {
      const state = createState();
      const tr = state.tr;
      
      // Select "Hello" and make it bold
      const sel = TextSelection.create(state.doc, 1, 6);
      let newState = state.apply(tr.setSelection(sel).addMark(1, 6, hanDocSchema.marks.bold.create()));
      
      expect(isMarkActive(newState, hanDocSchema.marks.bold)).toBe(true);
      
      // Toggle bold off
      let result: EditorState | null = null;
      toggleBold(newState, (tr) => {
        result = newState.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        expect(isMarkActive(result, hanDocSchema.marks.bold)).toBe(false);
      }
    });
  });

  describe('toggleItalic', () => {
    it('should apply italic mark to selected text', () => {
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
  });

  describe('toggleUnderline', () => {
    it('should apply underline mark to selected text', () => {
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

  describe('setAlignment', () => {
    it('should set paragraph alignment to center', () => {
      const state = createState();
      
      let result: EditorState | null = null;
      setAlignment('center')(state, (tr) => {
        result = state.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        const para = result.doc.firstChild?.firstChild;
        expect(para?.attrs.align).toBe('center');
      }
    });

    it('should set paragraph alignment to right', () => {
      const state = createState();
      
      let result: EditorState | null = null;
      setAlignment('right')(state, (tr) => {
        result = state.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        const para = result.doc.firstChild?.firstChild;
        expect(para?.attrs.align).toBe('right');
      }
    });
  });

  describe('setHeading', () => {
    it('should convert paragraph to heading level 1', () => {
      const state = createState();
      
      let result: EditorState | null = null;
      setHeading(1)(state, (tr) => {
        result = state.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        const node = result.doc.firstChild?.firstChild;
        expect(node?.type.name).toBe('heading');
        expect(node?.attrs.level).toBe(1);
      }
    });

    it('should convert paragraph to heading level 2', () => {
      const state = createState();
      
      let result: EditorState | null = null;
      setHeading(2)(state, (tr) => {
        result = state.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        const node = result.doc.firstChild?.firstChild;
        expect(node?.type.name).toBe('heading');
        expect(node?.attrs.level).toBe(2);
      }
    });
  });

  describe('setParagraph', () => {
    it('should convert heading to paragraph', () => {
      const state = EditorState.create({
        schema: hanDocSchema,
        doc: hanDocSchema.nodes.doc.create(null, [
          hanDocSchema.nodes.section.create(null, [
            hanDocSchema.nodes.heading.create({ level: 1 }, [
              hanDocSchema.text('Heading'),
            ]),
          ]),
        ]),
      });
      
      let result: EditorState | null = null;
      setParagraph()(state, (tr) => {
        result = state.apply(tr);
      });
      
      expect(result).toBeTruthy();
      if (result) {
        const node = result.doc.firstChild?.firstChild;
        expect(node?.type.name).toBe('paragraph');
      }
    });
  });

  describe('isMarkActive', () => {
    it('should detect active bold mark', () => {
      const state = createState();
      const tr = state.tr;
      
      const sel = TextSelection.create(state.doc, 1, 6);
      const newState = state.apply(tr.setSelection(sel).addMark(1, 6, hanDocSchema.marks.bold.create()));
      
      expect(isMarkActive(newState, hanDocSchema.marks.bold)).toBe(true);
      expect(isMarkActive(newState, hanDocSchema.marks.italic)).toBe(false);
    });
  });
});
