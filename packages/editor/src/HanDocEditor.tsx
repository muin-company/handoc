/**
 * React wrapper around ProseMirror for editing HWPX documents.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { columnResizing, tableEditing } from 'prosemirror-tables';
import { hanDocSchema } from './schema';
import { hwpxToEditorState, editorStateToHwpx } from './converter';
import { tableKeymap } from './commands';
import { imagePlugin } from './imagePlugin';
import { toggleBold, toggleItalic, toggleUnderline } from './markCommands';
import { Toolbar } from './Toolbar';

export interface HanDocEditorProps {
  /** HWPX file as binary buffer. If provided, initializes the editor with this document. */
  buffer?: Uint8Array;
  /** Called when the document changes, with the updated HWPX binary. */
  onChange?: (hwpx: Uint8Array) => void;
  /** Show toolbar. Default: true */
  showToolbar?: boolean;
  /** Callback when export button is clicked */
  onExport?: (hwpx: Uint8Array) => void;
}

export function HanDocEditor({ buffer, onChange, showToolbar = true, onExport }: HanDocEditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
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
        columnResizing(),
        tableEditing(),
        imagePlugin(hanDocSchema),
        history(),
        keymap({
          'Mod-b': toggleBold,
          'Mod-i': toggleItalic,
          'Mod-u': toggleUnderline,
        }),
        keymap(tableKeymap()),
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
              columnResizing(),
              tableEditing(),
              imagePlugin(hanDocSchema),
              history(),
              keymap({
                'Mod-b': toggleBold,
                'Mod-i': toggleItalic,
                'Mod-u': toggleUnderline,
              }),
              keymap(tableKeymap()),
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

      const newView = new EditorView(mountRef.current!, {
        state,
        dispatchTransaction(tr) {
          const newState = newView.state.apply(tr);
          newView.updateState(newState);

          if (tr.docChanged && onChangeRef.current) {
            editorStateToHwpx(newState).then(hwpx => {
              onChangeRef.current?.(hwpx);
            }).catch(() => {/* ignore serialization errors */});
          }
        },
      });

      viewRef.current = newView;
      setView(newView);
    };

    init();

    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
      setView(null);
    };
  }, [buffer, createDefaultState]);

  return (
    <div className="handoc-editor-container">
      {showToolbar && <Toolbar view={view} onExport={onExport} />}
      <div ref={mountRef} className="handoc-editor" />
    </div>
  );
}
