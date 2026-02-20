import { useState } from 'react';
import { HanDocViewer, ViewMode } from '@handoc/viewer';
import '@handoc/viewer/styles.css';
import { FileUpload } from './FileUpload';
import { parseHwp } from '@handoc/hwp-reader';
import { parseDocx } from '@handoc/docx-reader';

export function ViewerDemo() {
  const [buffer, setBuffer] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('page');
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      let uint8Array = new Uint8Array(arrayBuffer);

      // Convert HWP/DOCX to HWPX if needed
      if (file.name.toLowerCase().endsWith('.hwp')) {
        const hwpxBuffer = await parseHwp(uint8Array);
        uint8Array = hwpxBuffer;
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        const hwpxBuffer = await parseDocx(uint8Array);
        uint8Array = hwpxBuffer;
      }

      setBuffer(uint8Array);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 읽을 수 없습니다');
      setBuffer(null);
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => {
    setZoom(Math.min(200, zoom + 10));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(50, zoom - 10));
  };

  const handleReset = () => {
    setZoom(100);
    setViewMode('page');
  };

  return (
    <div className="demo-section">
      <FileUpload onFileSelect={handleFileSelect} />

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

      {buffer && !loading && (
        <>
          <div className="controls">
            <div className="control-group">
              <label>보기 모드:</label>
              <button
                className={viewMode === 'page' ? 'primary' : ''}
                onClick={() => setViewMode('page')}
              >
                페이지
              </button>
              <button
                className={viewMode === 'continuous' ? 'primary' : ''}
                onClick={() => setViewMode('continuous')}
              >
                연속
              </button>
            </div>

            <div className="control-group">
              <label>확대/축소:</label>
              <button onClick={handleZoomOut}>-</button>
              <span style={{ minWidth: '60px', textAlign: 'center' }}>
                {zoom}%
              </span>
              <button onClick={handleZoomIn}>+</button>
              <button onClick={handleReset}>초기화</button>
            </div>

            {fileName && (
              <div className="control-group" style={{ marginLeft: 'auto' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  📄 {fileName}
                </span>
              </div>
            )}
          </div>

          <div className="viewer-container">
            <HanDocViewer
              buffer={buffer}
              viewMode={viewMode}
              zoom={zoom}
              showZoomControls={false}
            />
          </div>
        </>
      )}

      {!buffer && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <div className="empty-state-text">
            HWPX, HWP 또는 DOCX 파일을 업로드하여 미리보기를 시작하세요
          </div>
        </div>
      )}
    </div>
  );
}
