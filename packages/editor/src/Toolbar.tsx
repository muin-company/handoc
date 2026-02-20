/**
 * Toolbar component for HanDoc editor
 */
import React from 'react';
import { EditorView } from 'prosemirror-view';
import { hanDocSchema } from './schema';
import {
  toggleBold,
  toggleItalic,
  toggleUnderline,
  isMarkActive,
  setAlignment,
  setHeading,
  setParagraph,
} from './markCommands';
import { editorStateToHwpx } from './converter';

export interface ToolbarProps {
  /** ProseMirror EditorView instance */
  view: EditorView | null;
  /** Callback when export is requested */
  onExport?: (hwpx: Uint8Array) => void;
}

export function Toolbar({ view, onExport }: ToolbarProps) {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // Re-render when selection changes
  React.useEffect(() => {
    if (!view) return;

    const handleUpdate = () => forceUpdate();
    view.dom.addEventListener('mouseup', handleUpdate);
    view.dom.addEventListener('keyup', handleUpdate);

    return () => {
      view.dom.removeEventListener('mouseup', handleUpdate);
      view.dom.removeEventListener('keyup', handleUpdate);
    };
  }, [view]);

  if (!view) return null;

  const state = view.state;

  const isBold = isMarkActive(state, hanDocSchema.marks.bold);
  const isItalic = isMarkActive(state, hanDocSchema.marks.italic);
  const isUnderline = isMarkActive(state, hanDocSchema.marks.underline);

  const handleCommand = (cmd: any) => {
    cmd(state, view.dispatch, view);
    view.focus();
  };

  const handleExport = async () => {
    try {
      const hwpx = await editorStateToHwpx(state);
      
      if (onExport) {
        onExport(hwpx);
      } else {
        // Default: download as file
        const blob = new Blob([new Uint8Array(hwpx)], { type: 'application/vnd.hancom.hwpx' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `document-${Date.now()}.hwpx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export HWPX:', error);
      alert('내보내기에 실패했습니다.');
    }
  };

  return (
    <div className="handoc-toolbar" style={toolbarStyle}>
      <div style={buttonGroupStyle}>
        <button
          onClick={() => handleCommand(toggleBold)}
          style={isBold ? activeButtonStyle : buttonStyle}
          title="굵게 (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => handleCommand(toggleItalic)}
          style={isItalic ? activeButtonStyle : buttonStyle}
          title="기울임 (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => handleCommand(toggleUnderline)}
          style={isUnderline ? activeButtonStyle : buttonStyle}
          title="밑줄 (Ctrl+U)"
        >
          <u>U</u>
        </button>
      </div>

      <div style={separatorStyle} />

      <div style={buttonGroupStyle}>
        <button
          onClick={() => handleCommand(setParagraph())}
          style={buttonStyle}
          title="본문"
        >
          본문
        </button>
        <button
          onClick={() => handleCommand(setHeading(1))}
          style={buttonStyle}
          title="제목 1"
        >
          H1
        </button>
        <button
          onClick={() => handleCommand(setHeading(2))}
          style={buttonStyle}
          title="제목 2"
        >
          H2
        </button>
        <button
          onClick={() => handleCommand(setHeading(3))}
          style={buttonStyle}
          title="제목 3"
        >
          H3
        </button>
      </div>

      <div style={separatorStyle} />

      <div style={buttonGroupStyle}>
        <button
          onClick={() => handleCommand(setAlignment('left'))}
          style={buttonStyle}
          title="왼쪽 정렬"
        >
          ⇐
        </button>
        <button
          onClick={() => handleCommand(setAlignment('center'))}
          style={buttonStyle}
          title="가운데 정렬"
        >
          ⇔
        </button>
        <button
          onClick={() => handleCommand(setAlignment('right'))}
          style={buttonStyle}
          title="오른쪽 정렬"
        >
          ⇒
        </button>
        <button
          onClick={() => handleCommand(setAlignment('justify'))}
          style={buttonStyle}
          title="양쪽 정렬"
        >
          ⇕
        </button>
      </div>

      <div style={separatorStyle} />

      <div style={buttonGroupStyle}>
        <button
          onClick={handleExport}
          style={exportButtonStyle}
          title="HWPX로 저장"
        >
          💾 HWPX로 저장
        </button>
      </div>
    </div>
  );
}

// Styles
const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px',
  borderBottom: '1px solid #ddd',
  backgroundColor: '#f5f5f5',
  gap: '4px',
  flexWrap: 'wrap',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
};

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
  fontFamily: 'inherit',
};

const activeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#007bff',
  color: '#fff',
  borderColor: '#0056b3',
};

const exportButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#28a745',
  color: '#fff',
  borderColor: '#1e7e34',
  fontWeight: 'bold',
};

const separatorStyle: React.CSSProperties = {
  width: '1px',
  height: '24px',
  backgroundColor: '#ccc',
  margin: '0 4px',
};
