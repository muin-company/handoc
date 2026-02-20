import { useState, useEffect } from 'react';
import { HanDoc } from '@handoc/hwpx-parser';
import { documentToHtml } from './render';
import type { RenderContext } from './render';

export type ViewMode = 'page' | 'continuous';

export interface HanDocViewerProps {
  buffer: Uint8Array;
  className?: string;
  /** View mode: 'page' (default) or 'continuous' */
  viewMode?: ViewMode;
  /** Zoom level: 50-200 (percent). Default 100 */
  zoom?: number;
  /** Show zoom controls */
  showZoomControls?: boolean;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
}

/**
 * React component that renders an HWPX document in the browser.
 * 100% client-side — no server dependency.
 */
export function HanDocViewer({
  buffer,
  className,
  viewMode = 'page',
  zoom: externalZoom,
  showZoomControls = false,
  onZoomChange,
}: HanDocViewerProps): JSX.Element {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [internalZoom, setInternalZoom] = useState(100);

  const zoom = externalZoom ?? internalZoom;
  const clampedZoom = Math.max(50, Math.min(200, zoom));

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(50, Math.min(200, newZoom));
    if (externalZoom === undefined) {
      setInternalZoom(clamped);
    }
    onZoomChange?.(clamped);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    HanDoc.open(buffer)
      .then((doc) => {
        if (cancelled) return;
        const ctx: RenderContext = {
          header: doc.header,
          images: doc.images,
        };
        const result = documentToHtml(doc.sections, ctx);
        setHtml(result);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [buffer]);

  if (loading) {
    return <div className="handoc-viewer handoc-loading">Loading...</div>;
  }

  if (error) {
    return <div className="handoc-viewer handoc-error">Error: {error}</div>;
  }

  const viewerClass = `handoc-viewer handoc-${viewMode} ${className ?? ''}`.trim();
  const containerStyle = {
    '--handoc-zoom': clampedZoom / 100,
  } as React.CSSProperties;

  return (
    <div className={viewerClass} style={containerStyle}>
      {showZoomControls && (
        <div className="handoc-controls">
          <button
            className="handoc-zoom-btn"
            onClick={() => handleZoomChange(clampedZoom - 10)}
            disabled={clampedZoom <= 50}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="handoc-zoom-label">{clampedZoom}%</span>
          <button
            className="handoc-zoom-btn"
            onClick={() => handleZoomChange(clampedZoom + 10)}
            disabled={clampedZoom >= 200}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            className="handoc-zoom-btn"
            onClick={() => handleZoomChange(100)}
            disabled={clampedZoom === 100}
            aria-label="Reset zoom"
          >
            100%
          </button>
        </div>
      )}
      <div
        className="handoc-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
