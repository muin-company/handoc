import type { HanDoc } from '@handoc/hwpx-parser';
import { parseTable, tableToTextGrid } from '@handoc/hwpx-parser';
import type { Section, Paragraph, Run, RunChild, GenericElement } from '@handoc/document-model';
import type { CharProperty, ParaProperty } from '@handoc/document-model';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCharProp(doc: HanDoc, id: number | null): CharProperty | undefined {
  if (id == null) return undefined;
  return doc.header.refList.charProperties.find(c => c.id === id);
}

function getParaProp(doc: HanDoc, id: number | null): ParaProperty | undefined {
  if (id == null) return undefined;
  return doc.header.refList.paraProperties.find(p => p.id === id);
}

function renderRun(doc: HanDoc, run: Run): string {
  const charProp = getCharProp(doc, run.charPrIDRef);
  const styles: string[] = [];

  if (charProp) {
    if (charProp.bold) styles.push('font-weight:bold');
    if (charProp.italic) styles.push('font-style:italic');
    if (charProp.underline && charProp.underline !== 'none') styles.push('text-decoration:underline');
    if (charProp.strikeout && charProp.strikeout !== 'none') styles.push('text-decoration:line-through');
    if (charProp.textColor && charProp.textColor !== '0' && charProp.textColor !== '000000') {
      const c = charProp.textColor.padStart(6, '0');
      styles.push(`color:#${c}`);
    }
    if (charProp.height) {
      const pt = charProp.height / 100;
      if (pt > 0) styles.push(`font-size:${pt}pt`);
    }
  }

  const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
  let html = '';

  for (const child of run.children) {
    switch (child.type) {
      case 'text':
        html += `<span${styleAttr}>${esc(child.content)}</span>`;
        break;
      case 'table':
        html += renderTable(doc, child.element);
        break;
      case 'inlineObject':
        if (child.name === 'picture' || child.name === 'pic') {
          html += renderImage(doc, child.element);
        }
        break;
      // secPr, ctrl, trackChange — skip for rendering
    }
  }

  return html;
}

function renderImage(doc: HanDoc, element: GenericElement): string {
  // Try to find image path from element attributes
  const imgChild = findDescendant(element, 'img') ?? findDescendant(element, 'imgRect');
  const fileRef = findDescendant(element, 'fileRef');
  if (!fileRef) return '';

  const binItemRef = fileRef.attrs['binItemIDRef'] ?? '';
  if (!binItemRef) return '';

  // Find matching image in doc.images
  const image = doc.images.find(img =>
    img.path.includes(binItemRef) || img.path.endsWith(binItemRef),
  );

  if (!image) return '';

  // Determine MIME type from path
  const ext = image.path.split('.').pop()?.toLowerCase() ?? 'png';
  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
  };
  const mime = mimeMap[ext] ?? 'image/png';

  // Convert Uint8Array to base64
  let b64 = '';
  const bytes = image.data;
  for (let i = 0; i < bytes.length; i++) {
    b64 += String.fromCharCode(bytes[i]);
  }
  b64 = btoa(b64);

  // Try to get dimensions from img element
  let style = 'max-width:100%';
  if (imgChild) {
    const w = imgChild.attrs['width'];
    const h = imgChild.attrs['height'];
    if (w) style += `;width:${Number(w) / 7200}in`;
    if (h) style += `;height:${Number(h) / 7200}in`;
  }

  return `<img src="data:${mime};base64,${b64}" style="${style}" />`;
}

function findDescendant(el: GenericElement, tag: string): GenericElement | undefined {
  for (const child of el.children) {
    const localTag = child.tag.includes(':') ? child.tag.split(':').pop()! : child.tag;
    if (localTag === tag) return child;
    const found = findDescendant(child, tag);
    if (found) return found;
  }
  return undefined;
}

function renderTable(doc: HanDoc, element: GenericElement): string {
  const table = parseTable(element);
  let html = '<table style="border-collapse:collapse;width:100%">';

  for (const row of table.rows) {
    html += '<tr>';
    for (const cell of row.cells) {
      const colspan = cell.cellSpan.colSpan > 1 ? ` colspan="${cell.cellSpan.colSpan}"` : '';
      const rowspan = cell.cellSpan.rowSpan > 1 ? ` rowspan="${cell.cellSpan.rowSpan}"` : '';
      const tag = cell.header ? 'th' : 'td';

      html += `<${tag}${colspan}${rowspan} style="border:1px solid #000;padding:4px">`;
      for (const para of cell.paragraphs) {
        html += renderParagraph(doc, para);
      }
      html += `</${tag}>`;
    }
    html += '</tr>';
  }

  html += '</table>';
  return html;
}

function renderParagraph(doc: HanDoc, para: Paragraph): string {
  const paraProp = getParaProp(doc, para.paraPrIDRef);
  const styles: string[] = [];

  if (paraProp) {
    if (paraProp.align) {
      styles.push(`text-align:${paraProp.align === 'distribute' ? 'justify' : paraProp.align}`);
    }
    if (paraProp.lineSpacing) {
      const { type, value } = paraProp.lineSpacing;
      if (type === 'percent') styles.push(`line-height:${value / 100}`);
      else if (type === 'fixed' && value > 0) styles.push(`line-height:${value / 7200}in`);
    }
    if (paraProp.margin) {
      const m = paraProp.margin;
      if (m.left) styles.push(`margin-left:${m.left / 7200}in`);
      if (m.right) styles.push(`margin-right:${m.right / 7200}in`);
      if (m.indent) styles.push(`text-indent:${m.indent / 7200}in`);
      if (m.prev) styles.push(`margin-top:${m.prev / 7200}in`);
      if (m.next) styles.push(`margin-bottom:${m.next / 7200}in`);
    }
  }

  const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
  const inner = para.runs.map(r => renderRun(doc, r)).join('');

  return `<p${styleAttr}>${inner || '&nbsp;'}</p>`;
}

/**
 * Render a HanDoc to a full HTML document string.
 */
export function renderToHtml(doc: HanDoc): string {
  const pageSize = doc.pageSize;
  const margins = doc.margins;

  let body = '';

  for (const section of doc.sections) {
    const sProps = section.sectionProps;
    const pw = sProps ? Math.round((sProps.pageWidth / 7200) * 25.4) : pageSize.width;
    const ph = sProps ? Math.round((sProps.pageHeight / 7200) * 25.4) : pageSize.height;
    const ml = sProps ? Math.round((sProps.margins.left / 7200) * 25.4 * 10) / 10 : margins.left;
    const mr = sProps ? Math.round((sProps.margins.right / 7200) * 25.4 * 10) / 10 : margins.right;
    const mt = sProps ? Math.round((sProps.margins.top / 7200) * 25.4 * 10) / 10 : margins.top;
    const mb = sProps ? Math.round((sProps.margins.bottom / 7200) * 25.4 * 10) / 10 : margins.bottom;

    body += `<div class="page" style="width:${pw}mm;min-height:${ph}mm;padding:${mt}mm ${mr}mm ${mb}mm ${ml}mm;box-sizing:border-box">`;
    for (const para of section.paragraphs) {
      body += renderParagraph(doc, para);
    }
    body += '</div>';
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  p { margin: 2px 0; }
  table { margin: 4px 0; }
  img { display: inline-block; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}
