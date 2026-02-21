/**
 * Canvas renderer — draws PageRenderList onto an HTML5 Canvas
 *
 * Inspired by PDF.js's CanvasGraphics: takes pre-computed positioned
 * render commands and paints them onto a canvas context.
 */

import type { PageRenderList, TextStyle, Viewport } from './types';
import { hwpToPoint } from './types';
import { canvasFont } from './font-map';

/**
 * Create a viewport for a page at the given scale
 */
export function createViewport(pageLayout: PageRenderList['layout'], scale: number = 1.0, dpi: number = 96): Viewport {
  const widthPt = hwpToPoint(pageLayout.width);
  const heightPt = hwpToPoint(pageLayout.height);
  return {
    width: Math.round((widthPt / 72) * dpi * scale),
    height: Math.round((heightPt / 72) * dpi * scale),
    scale,
    dpi,
  };
}

/**
 * Render a single page onto a canvas context.
 * The canvas should already be sized to viewport dimensions.
 */
export function renderPage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  page: PageRenderList,
  viewport: Viewport,
): void {
  const { scale, dpi } = viewport;

  // Clear with white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  // Apply scale transform
  ctx.save();
  ctx.scale(scale, scale);

  // 1. Draw rectangles (table borders, backgrounds)
  for (const rect of page.rects) {
    if (rect.fillColor) {
      ctx.fillStyle = rect.fillColor;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    if (rect.strokeColor) {
      ctx.strokeStyle = rect.strokeColor;
      ctx.lineWidth = rect.strokeWidth ?? 1;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  }

  // 2. Draw lines (underlines, strikeouts, borders)
  for (const line of page.lines) {
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
  }

  // 3. Draw images
  // Note: In browser, we need to load images async.
  // For now, skip — images will be handled by the React component.

  // 4. Draw text (last, so it's on top)
  for (const seg of page.texts) {
    ctx.fillStyle = seg.style.color;
    ctx.font = canvasFont(seg.style.fontFamily, seg.style.fontSize, seg.style.bold, seg.style.italic, dpi);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(seg.text, seg.x, seg.y);

    // Strikeout
    if (seg.style.strikeout) {
      const metrics = ctx.measureText(seg.text);
      const y = seg.y - seg.style.fontSize * (dpi / 72) * 0.35;
      ctx.beginPath();
      ctx.strokeStyle = seg.style.color;
      ctx.lineWidth = 1;
      ctx.moveTo(seg.x, y);
      ctx.lineTo(seg.x + metrics.width, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Render a page to a data URL (useful for PDF export or thumbnails)
 */
export function renderPageToDataUrl(
  page: PageRenderList,
  scale: number = 1.0,
  dpi: number = 96,
  format: 'image/png' | 'image/jpeg' = 'image/png',
): string {
  const viewport = createViewport(page.layout, scale, dpi);

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d')!;
    renderPage(ctx, page, viewport);
    // OffscreenCanvas doesn't have toDataURL, use transferToImageBitmap
    // Fallback to DOM canvas
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    renderPage(ctx, page, viewport);
    return canvas.toDataURL(format);
  }

  throw new Error('No canvas support available');
}
