import { useState, useRef } from 'react';
import { HanDocEditor } from '@handoc/editor';
import { FileUpload } from './FileUpload';
import { convertHwpToHwpx } from '@handoc/hwp-reader';
import { docxToHwpx } from '@handoc/docx-reader';

export function EditorDemo() {
  const [buffer, setBuffer] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [currentBuffer, setCurrentBuffer] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      let uint8Array = new Uint8Array(arrayBuffer);

      // Convert HWP/DOCX to HWPX if needed
      if (file.name.toLowerCase().endsWith('.hwp')) {
        uint8Array = await convertHwpToHwpx(uint8Array);
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        uint8Array = await docxToHwpx(uint8Array);
      }

      setBuffer(uint8Array);
      setCurrentBuffer(uint8Array);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 읽을 수 없습니다');
      setBuffer(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEditorChange = (updatedBuffer: Uint8Array) => {
    setCurrentBuffer(updatedBuffer);
  };

  const handleDownload = () => {
    if (!currentBuffer) return;

    const blob = new Blob([currentBuffer], { 
      type: 'application/vnd.hancom.hwpx' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.(hwp|docx)$/i, '.hwpx') || 'document.hwpx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleNewDocument = () => {
    setBuffer(undefined as any); // Reset to create empty document
    setFileName('새 문서.hwpx');
    setCurrentBuffer(null);
  };

  const hasContent = buffer !== null || buffer === undefined;

  return (
    <div className="demo-section">
      {!hasContent && <FileUpload onFileSelect={handleFileSelect} />}

      {error && (
        <div className="error">
          <strong>오류:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          파일을 읽는 중...
        </div>
      )}

      {hasContent && !loading && (
        <>
          <div className="controls">
            <div className="control-group">
              <button onClick={handleNewDocument}>새 문서</button>
              <button onClick={() => {
                setBuffer(null);
                setFileName('');
                setCurrentBuffer(null);
              }}>
                다른 파일 열기
              </button>
              <button 
                className="primary" 
                onClick={handleDownload}
                disabled={!currentBuffer}
              >
                다운로드 (HWPX)
              </button>
            </div>

            {fileName && (
              <div className="control-group" style={{ marginLeft: 'auto' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  📝 {fileName}
                </span>
              </div>
            )}
          </div>

          <div className="editor-container">
            <div className="editor-toolbar">
              <button title="굵게 (Ctrl+B)">
                <strong>B</strong>
              </button>
              <button title="기울임 (Ctrl+I)">
                <em>I</em>
              </button>
              <button title="밑줄 (Ctrl+U)">
                <u>U</u>
              </button>
              <span style={{ borderLeft: '1px solid #cbd5e1', margin: '0 0.25rem' }}></span>
              <button title="실행 취소 (Ctrl+Z)">↶</button>
              <button title="다시 실행 (Ctrl+Y)">↷</button>
              <span style={{ borderLeft: '1px solid #cbd5e1', margin: '0 0.25rem' }}></span>
              <button title="표 삽입">표</button>
              <button title="이미지 삽입">🖼️</button>
            </div>
            <div className="editor-content" ref={editorRef}>
              <HanDocEditor
                buffer={buffer as any}
                onChange={handleEditorChange}
              />
            </div>
          </div>

          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: '#f8fafc', 
            borderRadius: '6px',
            fontSize: '0.9rem',
            color: '#64748b'
          }}>
            <strong>편집 도움말:</strong>
            <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
              <li>텍스트 입력 및 편집이 가능합니다</li>
              <li>Ctrl+B (굵게), Ctrl+I (기울임), Ctrl+U (밑줄)</li>
              <li>Ctrl+Z (실행 취소), Ctrl+Y (다시 실행)</li>
              <li>편집 후 "다운로드" 버튼으로 HWPX 파일 저장</li>
            </ul>
          </div>
        </>
      )}

      {!hasContent && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">✏️</div>
          <div className="empty-state-text">
            HWPX 파일을 열거나 새 문서를 만들어 편집을 시작하세요
          </div>
        </div>
      )}
    </div>
  );
}
