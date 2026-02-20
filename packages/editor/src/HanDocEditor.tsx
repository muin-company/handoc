/**
 * React wrapper around ProseMirror for editing HWPX documents.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { hanDocSchema } from './schema';
import { hwpxToEditorState, editorStateToHwpx } from './converter';

export interface HanDocEditorProps {
  /** HWPX file as binary buffer. If provided, initializes the editor with this document. */
  buffer?: Uint8Array;
  /** Called when the document changes, with the updated HWPX binary. */
  onChange?: (hwpx: Uint8Array) => void;
}

export function HanDocEditor({ buffer, onChange }: HanDocEditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const createDefaultState = useCallback(() => {
    return EditorState.create({
      schema: hanDocSchema,
      doc: hanDocSchema.nodes.doc.create(null, [
        hanDocSchema.nodes.section.create(null, [
          hanDocSchema.nodes.paragraph.create(),
        ]),
      ]),
      plugins: [
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
        keymap(baseKeymap),
      ],
    });
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    let cancelled = false;

    const init = async () => {
      let state: EditorState;

      if (buffer && buffer.length > 0) {
        try {
          state = await hwpxToEditorState(buffer);
          // Re-create with plugins
          state = EditorState.create({
            doc: state.doc,
            schema: hanDocSchema,
            plugins: [
              history(),
              keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
              keymap(baseKeymap),
            ],
          });
        } catch {
          state = createDefaultState();
        }
      } else {
        state = createDefaultState();
      }

      if (cancelled) return;

      const view = new EditorView(mountRef.current!, {
        state,
        dispatchTransaction(tr) {
          const newState = view.state.apply(tr);
          view.updateState(newState);

          if (tr.docChanged && onChangeRef.current) {
            editorStateToHwpx(newState).then(hwpx => {
              onChangeRef.current?.(hwpx);
            }).catch(() => {/* ignore serialization errors */});
          }
        },
      });

      viewRef.current = view;
    };

    init();

    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [buffer, createDefaultState]);

  return <div ref={mountRef} className="handoc-editor" />;
}
