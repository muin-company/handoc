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

/** Resolve font name from fontRef ID using header fontFaces */
function resolveFontName(doc: HanDoc, fontRefId: number, lang: string = 'HANGUL'): string | undefined {
  const faces = doc.header.refList.fontFaces;
  if (!faces) return undefined;
  const langFaces = faces.find(f => f.lang === lang);
  if (!langFaces) return undefined;
  const font = langFaces.fonts.find(f => f.id === fontRefId);
  return font?.face;
}

/** Map Korean font names to CSS font-family with fallbacks */
function fontFamilyCss(fontName: string): string {
  // Map 한/글 fonts to available system fonts
  const map: Record<string, string> = {
    '함초롬바탕': "'HCR Batang', 'Batang', '바탕', 'AppleMyungjo', serif",
    '함초롬돋움': "'HCR Dotum', 'Dotum', '돋움', 'Apple SD Gothic Neo', sans-serif",
    '바탕': "'Batang', '바탕', 'AppleMyungjo', serif",
    '돋움': "'Dotum', '돋움', 'Apple SD Gothic Neo', sans-serif",
    '돋움체': "'DotumChe', '돋움체', monospace",
    '맑은 고딕': "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif",
    '굴림': "'Gulim', '굴림', sans-serif",
    '궁서': "'Gungsuh', '궁서', serif",
    '휴먼명조': "'HumanMyeongjo', 'AppleMyungjo', serif",
    '휴먼고딕': "'HumanGothic', 'Apple SD Gothic Neo', sans-serif",
    '한양신명조': "'HYSinMyeongJo', 'AppleMyungjo', serif",
    '한양중고딕': "'HYJungGothic', 'Apple SD Gothic Neo', sans-serif",
  };
  return map[fontName] ?? `'${fontName}', sans-serif`;
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
      const c = charProp.textColor.replace('#', '').padStart(6, '0');
      styles.push(`color:#${c}`);
    }
    if (charProp.height) {
      const pt = charProp.height / 100;
      if (pt > 0) styles.push(`font-size:${pt}pt`);
    }
    // Font face resolution
    const fontRef = (charProp as any).fontRef;
    if (fontRef) {
      const hangulId = fontRef.hangul ?? fontRef.HANGUL;
      if (hangulId != null) {
        const fontName = resolveFontName(doc, hangulId, 'HANGUL');
        if (fontName) styles.push(`font-family:${fontFamilyCss(fontName)}`);
      }
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
      case 'shape':
        html += renderShape(doc, child.element);
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
  
  // Get table total width from sz element
  const szEl = element.children.find(c => c.tag === 'sz');
  const tableWidth = szEl ? Number(szEl.attrs['width']) : 0;
  const tableWidthMm = tableWidth > 0 ? (tableWidth / 7200 * 25.4).toFixed(1) : '';
  const tableStyle = tableWidthMm
    ? `border-collapse:collapse;table-layout:fixed;width:${tableWidthMm}mm;max-width:100%`
    : 'border-collapse:collapse;table-layout:fixed;width:100%';
  
  let html = `<table style="${tableStyle}">`;

  for (const row of table.rows) {
    html += '<tr>';
    for (const cell of row.cells) {
      const colspan = cell.cellSpan.colSpan > 1 ? ` colspan="${cell.cellSpan.colSpan}"` : '';
      const rowspan = cell.cellSpan.rowSpan > 1 ? ` rowspan="${cell.cellSpan.rowSpan}"` : '';
      const tag = cell.header ? 'th' : 'td';
      
      // Cell width
      const cellStyles: string[] = ['border:0.5px solid #000', 'padding:2px 4px', 'word-break:break-all', 'overflow:hidden'];
      if (cell.cellSz.width > 0) {
        cellStyles.push(`width:${(cell.cellSz.width / 7200 * 25.4).toFixed(1)}mm`);
      }
      // Don't set fixed height — let content determine height
      // Fixed height causes page overflow when content is smaller than cell height

      html += `<${tag}${colspan}${rowspan} style="${cellStyles.join(';')}">`;
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
      const t = type.toLowerCase();
      if (t === 'percent') styles.push(`line-height:${(value / 100).toFixed(2)}`);
      else if (t === 'fixed' && value > 0) styles.push(`line-height:${(value / 7200).toFixed(3)}in`);
    }
    if (paraProp.margin) {
      const m = paraProp.margin;
      if (m.left) styles.push(`margin-left:${m.left / 7200}in`);
      if (m.right) styles.push(`margin-right:${m.right / 7200}in`);
      if (m.indent) styles.push(`text-indent:${m.indent / 7200}in`);
      if (m.prev) styles.push(`margin-top:${m.prev / 7200}in`);
      if (m.next) styles.push(`margin-bottom:${m.next / 7200}in`);
    }
    // Handle page break before paragraph
    if (paraProp.breakSetting?.pageBreakBefore) {
      styles.push('page-break-before:always');
    }
  }

  const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
  const inner = para.runs.map(r => renderRun(doc, r)).join('');

  return `<p${styleAttr}>${inner || '&nbsp;'}</p>`;
}

function renderSectionBody(doc: HanDoc, section: Section): { html: string; pw: number; ph: number; ml: number; mr: number; mt: number; mb: number } {
  const pageSize = doc.pageSize;
  const margins = doc.margins;
  const sProps = section.sectionProps;
  const pw = sProps ? Math.round((sProps.pageWidth / 7200) * 25.4) : pageSize.width;
  const ph = sProps ? Math.round((sProps.pageHeight / 7200) * 25.4) : pageSize.height;
  const ml = sProps ? Math.round((sProps.margins.left / 7200) * 25.4 * 10) / 10 : margins.left;
  const mr = sProps ? Math.round((sProps.margins.right / 7200) * 25.4 * 10) / 10 : margins.right;
  const mt = sProps ? Math.round((sProps.margins.top / 7200) * 25.4 * 10) / 10 : margins.top;
  const mb = sProps ? Math.round((sProps.margins.bottom / 7200) * 25.4 * 10) / 10 : margins.bottom;

  let html = '';
  for (const para of section.paragraphs) {
    html += renderParagraph(doc, para);
  }
  return { html, pw, ph, ml, mr, mt, mb };
}

function renderHeaderFooter(doc: HanDoc, section: Section): { headerHtml: string; footerHtml: string } {
  let headerHtml = '';
  let footerHtml = '';
  const sProps = section.sectionProps as (Section['sectionProps'] & {
    headerParagraphs?: Paragraph[];
    footerParagraphs?: Paragraph[];
  }) | undefined;
  if (sProps) {
    if (sProps.headerParagraphs && sProps.headerParagraphs.length > 0) {
      headerHtml = '<header class="page-header">';
      for (const para of sProps.headerParagraphs) {
        headerHtml += renderParagraph(doc, para);
      }
      headerHtml += '</header>';
    }
    if (sProps.footerParagraphs && sProps.footerParagraphs.length > 0) {
      footerHtml = '<footer class="page-footer">';
      for (const para of sProps.footerParagraphs) {
        footerHtml += renderParagraph(doc, para);
      }
      footerHtml += '</footer>';
    }
  }
  return { headerHtml, footerHtml };
}

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'HCR Batang', 'Batang', '바탕', 'AppleMyungjo', 'Noto Serif KR', serif; color: #000; font-size: 10pt; line-height: 1.3; }
  p { margin: 0; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 0.5px solid #000; padding: 2px 4px; vertical-align: top; font-size: inherit; }
  th { background-color: #f0f0f0; font-weight: bold; }
  img { display: inline-block; max-width: 100%; }
  .page-header { padding-bottom: 4px; margin-bottom: 8px; font-size: 9pt; color: #666; }
  .page-footer { padding-top: 4px; margin-top: 8px; font-size: 9pt; color: #666; }
`;

/**
 * Render a HanDoc to a full HTML document string.
 */
export function renderToHtml(doc: HanDoc): string {
  let body = '';

  for (let i = 0; i < doc.sections.length; i++) {
    const section = doc.sections[i];
    const { html, pw, ph, ml, mr, mt, mb } = renderSectionBody(doc, section);
    const { headerHtml, footerHtml } = renderHeaderFooter(doc, section);

    body += headerHtml;
    body += html;
    body += footerHtml;
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>${BASE_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Render a HanDoc to a standalone HTML file.
 * All CSS is inlined and images are embedded as base64 data URIs.
 * The resulting file can be opened directly in a browser with no external dependencies.
 */
export function renderToStandaloneHtml(doc: HanDoc): string {
  let body = '';

  for (let i = 0; i < doc.sections.length; i++) {
    const section = doc.sections[i];
    const { html, pw, ph, ml, mr, mt, mb } = renderSectionBody(doc, section);
    const { headerHtml, footerHtml } = renderHeaderFooter(doc, section);

    body += `<section class="page" style="width:${pw}mm;min-height:${ph}mm;padding:${mt}mm ${mr}mm ${mb}mm ${ml}mm">`;
    body += headerHtml;
    body += html;
    body += footerHtml;
    body += '</section>';
  }

  // Extract title from first non-empty paragraph if available
  let title = 'HanDoc Document';
  for (const section of doc.sections) {
    for (const para of section.paragraphs) {
      for (const run of para.runs) {
        for (const child of run.children) {
          if (child.type === 'text' && child.content.trim()) {
            title = child.content.trim().substring(0, 100);
            break;
          }
        }
        if (title !== 'HanDoc Document') break;
      }
      if (title !== 'HanDoc Document') break;
    }
    if (title !== 'HanDoc Document') break;
  }

  const standaloneCss = BASE_CSS + `
  @media screen {
    body { background: #e8e8e8; padding: 20px; }
    .page { box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin-bottom: 20px; border: 1px solid #ccc; }
  }
`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${standaloneCss}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function renderShape(doc: HanDoc, element: GenericElement): string {
  let content = '';
  
  const visit = (el: GenericElement) => {
    const isPara = el.tag.endsWith('p');
    if (isPara) content += '<div>';
    
    if (el.text) content += esc(el.text);
    
    for (const child of el.children) visit(child);
    
    if (isPara) content += '</div>';
  };
  
  visit(element);
  
  if (!content.replace(/<[^>]*>/g, '').trim()) return '';
  
  return `<div class="shape-wrapper" style="border:1px dashed #ccc; padding:4px; margin:4px; overflow:hidden;">${content}</div>`;
}
