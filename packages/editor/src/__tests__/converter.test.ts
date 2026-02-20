import { describe, it, expect } from 'vitest';
import { hwpxToEditorState, editorStateToHwpx } from '../converter';
import { HwpxBuilder } from '@handoc/hwpx-writer';

describe('converter', () => {
  it('should convert HWPX buffer to EditorState with text', async () => {
    const hwpxBytes = HwpxBuilder.create()
      .addParagraph('테스트 문서입니다')
      .addParagraph('두 번째 문단')
      .build();

    const state = await hwpxToEditorState(hwpxBytes);
    const text = state.doc.textContent;

    expect(text).toContain('테스트 문서입니다');
    expect(text).toContain('두 번째 문단');
  });

  it('should roundtrip EditorState → HWPX → EditorState', async () => {
    // Create initial HWPX
    const original = HwpxBuilder.create()
      .addParagraph('라운드트립 테스트')
      .build();

    // HWPX → EditorState
    const state = await hwpxToEditorState(original);
    expect(state.doc.textContent).toContain('라운드트립 테스트');

    // EditorState → HWPX
    const rewritten = await editorStateToHwpx(state);
    expect(rewritten).toBeInstanceOf(Uint8Array);
    expect(rewritten.length).toBeGreaterThan(0);

    // HWPX → EditorState again
    const state2 = await hwpxToEditorState(rewritten);
    expect(state2.doc.textContent).toContain('라운드트립 테스트');
  });
});
