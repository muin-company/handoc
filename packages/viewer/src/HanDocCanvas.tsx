/**
 * Canvas-based HanDoc viewer — inspired by PDF.js viewer
 *
 * Each page is rendered on its own canvas element, providing:
 * - Pixel-perfect positioning (no CSS layout drift)
 * - Accurate page breaks
 * - Smooth zoom via canvas scaling
 * - Print-quality rendering
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { HanDoc } from '@handoc/hwpx-parser';
import { layoutDocument } from './canvas/layout-engine';
import { renderPage, createViewport } from './canvas/canvas-renderer';
import type { PageRenderList } from './canvas/types';

export interface HanDocCanvasProps {
  buffer: Uint8Array;
  className?: string;
  /** Zoom level: 50-200 (percent). Default 100 */
  zoom?: number;
  /** Show zoom controls */
  showZoomControls?: boolean;
  /** Show page controls */
  showPageControls?: boolean;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** DPI for rendering. Default 96 */
  dpi?: number;
}

export function HanDocCanvas({
  buffer,
  className,
  zoom: externalZoom,
  showZoomControls = false,
  showPageControls = false,
  onZoomChange,
  dpi = 96,
}: HanDocCanvasProps): JSX.Element {
  const [pages, setPages] = useState<PageRenderList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [internalZoom, setInternalZoom] = useState(100);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const zoom = externalZoom ?? internalZoom;
  const scale = Math.max(0.5, Math.min(2.0, zoom / 100));

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(50, Math.min(200, newZoom));
    if (externalZoom === undefined) setInternalZoom(clamped);
    onZoomChange?.(clamped);
  };

  // Parse and layout document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    HanDoc.open(buffer)
      .then((doc) => {
        if (cancelled) return;
        const pageList = layoutDocument(doc, { dpi });
        setPages(pageList);
        setCurrentPage(0);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [buffer, dpi]);

  // Render pages to canvas
  const renderCanvas = useCallback((pageIndex: number, canvas: HTMLCanvasElement | null) => {
    if (!canvas || !pages[pageIndex]) return;

    canvasRefs.current.set(pageIndex, canvas);
    const page = pages[pageIndex];
    const viewport = createViewport(page.layout, scale, dpi);

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      renderPage(ctx, page, viewport);
    }
  }, [pages, scale, dpi]);

  // Re-render on zoom change
  useEffect(() => {
    canvasRefs.current.forEach((canvas, idx) => {
      renderCanvas(idx, canvas);
    });
  }, [scale, renderCanvas]);

  if (loading) {
    return <div className={`handoc-canvas-viewer ${className ?? ''}`}>Loading...</div>;
  }

  if (error) {
    return <div className={`handoc-canvas-viewer ${className ?? ''}`}>Error: {error}</div>;
  }

  return (
    <div className={`handoc-canvas-viewer ${className ?? ''}`}>
      {(showZoomControls || showPageControls) && (
        <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#f5f5f5', borderBottom: '1px solid #ddd', alignItems: 'center' }}>
          {showPageControls && (
            <>
              <button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage <= 0}>←</button>
              <span>{currentPage + 1} / {pages.length}</span>
              <button onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} disabled={currentPage >= pages.length - 1}>→</button>
              <span style={{ margin: '0 8px' }}>|</span>
            </>
          )}
          {showZoomControls && (
            <>
              <button onClick={() => handleZoomChange(zoom - 10)} disabled={zoom <= 50}>−</button>
              <span>{zoom}%</span>
              <button onClick={() => handleZoomChange(zoom + 10)} disabled={zoom >= 200}>+</button>
              <button onClick={() => handleZoomChange(100)} disabled={zoom === 100}>100%</button>
            </>
          )}
        </div>
      )}

      <div style={{ overflow: 'auto', padding: '16px', background: '#e8e8e8' }}>
        {pages.map((page, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              display: 'inline-block',
            }}
          >
            <canvas
              ref={(el) => renderCanvas(idx, el)}
              style={{ display: 'block' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
