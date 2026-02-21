import { HanDoc } from '@handoc/hwpx-parser';
import { renderToHtml } from './html-renderer';

/**
 * Convert an HWPX buffer to PDF using Playwright.
 * Requires `playwright` to be installed.
 */
export async function hwpxToPdf(hwpxBuffer: Uint8Array): Promise<Uint8Array> {
  const doc = await HanDoc.open(hwpxBuffer);
  const html = renderToHtml(doc);

  // Use first section's page properties (most common case)
  const firstSection = doc.sections[0];
  const sp = firstSection?.sectionProps;

  let pw: number, ph: number, ml: number, mr: number, mt: number, mb: number;
  if (sp) {
    // Convert HWP units to mm: hwpUnit / 7200 * 25.4
    const toMm = (v: number) => Math.round((v / 7200) * 25.4 * 10) / 10;
    pw = toMm(sp.pageWidth);
    ph = toMm(sp.pageHeight);
    ml = toMm(sp.margins.left);
    mr = toMm(sp.margins.right);
    mt = toMm(sp.margins.top);
    mb = toMm(sp.margins.bottom);
  } else {
    const pageSize = doc.pageSize;
    const margins = doc.margins;
    pw = pageSize.width;
    ph = pageSize.height;
    ml = margins.left;
    mr = margins.right;
    mt = margins.top;
    mb = margins.bottom;
  }

  const landscape = doc.landscape;
  const pdfWidth = landscape ? ph : pw;
  const pdfHeight = landscape ? pw : ph;

  // Dynamic import so Playwright is only needed at runtime
  let chromium: typeof import('playwright').chromium;
  try {
    const pw2 = await import('playwright');
    chromium = pw2.chromium;
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
      width: `${pdfWidth}mm`,
      height: `${pdfHeight}mm`,
      margin: {
        top: `${mt}mm`,
        bottom: `${mb}mm`,
        left: `${ml}mm`,
        right: `${mr}mm`,
      },
      printBackground: true,
    });

    return new Uint8Array(pdfBuffer);
  } finally {
    await browser.close();
  }
}
