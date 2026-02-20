import { useState, useEffect } from 'react';
import { HanDoc } from '@handoc/hwpx-parser';
import { documentToHtml } from './render';
import type { RenderContext } from './render';

export interface HanDocViewerProps {
  buffer: Uint8Array;
  className?: string;
}

/**
 * React component that renders an HWPX document in the browser.
 * 100% client-side — no server dependency.
 */
export function HanDocViewer({ buffer, className }: HanDocViewerProps): JSX.Element {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div
      className={`handoc-viewer ${className ?? ''}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
