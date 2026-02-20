import { HanDoc } from '@handoc/hwpx-parser';
import { renderToHtml } from './html-renderer';

/**
 * Convert an HWPX buffer to PDF using Playwright.
 * Requires `playwright` to be installed.
 */
export async function hwpxToPdf(hwpxBuffer: Uint8Array): Promise<Uint8Array> {
  const doc = await HanDoc.open(hwpxBuffer);
  const html = renderToHtml(doc);

  const pageSize = doc.pageSize;
  const margins = doc.margins;

  // Dynamic import so Playwright is only needed at runtime
  let chromium: typeof import('playwright').chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    throw new Error(
      'Playwright is required for PDF export. Install it with: npm install playwright',
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      width: `${pageSize.width}mm`,
      height: `${pageSize.height}mm`,
      margin: {
        top: `${margins.top}mm`,
        bottom: `${margins.bottom}mm`,
        left: `${margins.left}mm`,
        right: `${margins.right}mm`,
      },
      printBackground: true,
    });

    return new Uint8Array(pdfBuffer);
  } finally {
    await browser.close();
  }
}
