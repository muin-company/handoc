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

function getBorderFillBgColor(doc: HanDoc, id: number | null): string | undefined {
  if (id == null) return undefined;
  const borderFill = doc.header.refList.borderFills.find(bf => Number(bf.attrs['id']) === id);
  if (!borderFill) return undefined;
  
  // Look for fillBrush element (solid color fill)
  const fillBrush = borderFill.children.find(c => c.tag.endsWith('fillBrush') || c.tag.endsWith(':fillBrush'));
  if (!fillBrush) return undefined;
  
  // Get background color from attributes
  const bgColor = fillBrush.attrs['backgroundColor'] || fillBrush.attrs['backColor'] || fillBrush.attrs['color'];
  if (!bgColor || bgColor === 'ffffff' || bgColor === '#ffffff') return undefined;
  
  return bgColor.replace('#', '');
}

function getBorderStyles(doc: HanDoc, id: number | null): string {
  if (id == null) return 'border:0.5px solid #000';
  const borderFill = doc.header.refList.borderFills.find(bf => Number(bf.attrs['id']) === id);
  if (!borderFill) return 'border:0.5px solid #000';
  
  // Parse border elements (left, right, top, bottom)
  const borders: Record<string, string> = {};
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const borderEl = borderFill.children.find(c => c.tag.endsWith(side) || c.tag.endsWith(`:${side}`));
    if (borderEl) {
      const type = borderEl.attrs['type'] || 'Solid';
      const width = Number(borderEl.attrs['width'] || 12); // HWPUNIT (1/7200 inch)
      const color = borderEl.attrs['color'] || '000000';
      
      const widthPx = Math.max(0.5, width / 7200 * 96); // Convert to pixels
      const style = type === 'None' ? 'none' : 
                    type === 'Dash' ? 'dashed' :
                    type === 'Dot' ? 'dotted' : 'solid';
      
      borders[`border-${side}`] = `${widthPx.toFixed(2)}px ${style} #${color.replace('#', '')}`;
    }
  }
  
  if (Object.keys(borders).length === 0) return 'border:0.5px solid #000';
  
  // Check if all sides are the same
  const values = Object.values(borders);
  if (values.every(v => v === values[0])) {
    return `border:${values[0]}`;
  }
  
  return Object.entries(borders).map(([k, v]) => `${k}:${v}`).join(';');
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
    if (charProp.shadeColor && charProp.shadeColor !== '0' && charProp.shadeColor !== 'ffffff') {
      const bgc = charProp.shadeColor.replace('#', '').padStart(6, '0');
      styles.push(`background-color:#${bgc}`);
    }
    if (charProp.height) {
      const pt = charProp.height / 100;
      if (pt > 0) styles.push(`font-size:${pt}pt`);
    }
    // Character spacing (letter-spacing)
    if (charProp.spacing) {
      const spacingVal = charProp.spacing.hangul ?? charProp.spacing.HANGUL ?? charProp.spacing.latin ?? charProp.spacing.LATIN;
      if (spacingVal && spacingVal !== 0) {
        // HWP spacing is in percentage of em (e.g., -5 means -5% of font size)
        const em = spacingVal / 100;
        styles.push(`letter-spacing:${em.toFixed(3)}em`);
      }
    }
    // Character width ratio (장평)
    if (charProp.ratio) {
      const ratioVal = charProp.ratio.hangul ?? charProp.ratio.HANGUL ?? charProp.ratio.latin ?? charProp.ratio.LATIN;
      if (ratioVal && ratioVal !== 100) {
        // HWP ratio is percentage (100 = normal, 50 = half-width, 200 = double-width)
        const scaleX = ratioVal / 100;
        styles.push(`transform:scaleX(${scaleX.toFixed(2)})`);
        styles.push(`display:inline-block`);
      }
    }
    // Superscript/subscript (vertical offset)
    if (charProp.superscript) {
      styles.push('vertical-align:super');
      styles.push('font-size:0.75em');
    } else if (charProp.subscript) {
      styles.push('vertical-align:sub');
      styles.push('font-size:0.75em');
    } else if (charProp.offset) {
      const offsetVal = charProp.offset.hangul ?? charProp.offset.HANGUL ?? charProp.offset.latin ?? charProp.offset.LATIN;
      if (offsetVal && offsetVal !== 0) {
        // HWP offset is in percentage points
        const pct = offsetVal / 100;
        styles.push(`vertical-align:${pct.toFixed(1)}%`);
      }
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
  
  // Get table border from borderFillIDRef
  const tableBorderFill = table.borderFillIDRef;
  const tableBorder = tableBorderFill ? getBorderStyles(doc, tableBorderFill) : '';
  
  const tableStyle = tableWidthMm
    ? `border-collapse:collapse;table-layout:fixed;width:${tableWidthMm}mm;max-width:100%;${tableBorder}`
    : `border-collapse:collapse;table-layout:fixed;width:100%;${tableBorder}`;
  
  let html = `<table style="${tableStyle}">`;

  for (const row of table.rows) {
    html += '<tr>';
    for (const cell of row.cells) {
      const colspan = cell.cellSpan.colSpan > 1 ? ` colspan="${cell.cellSpan.colSpan}"` : '';
      const rowspan = cell.cellSpan.rowSpan > 1 ? ` rowspan="${cell.cellSpan.rowSpan}"` : '';
      const tag = cell.header ? 'th' : 'td';
      
      // Cell width and border
      const borderStyle = getBorderStyles(doc, cell.borderFillIDRef);
      const cellStyles: string[] = [borderStyle, 'word-break:keep-all', 'overflow-wrap:break-word'];
      if (cell.cellSz.width > 0) {
        cellStyles.push(`width:${(cell.cellSz.width / 7200 * 25.4).toFixed(1)}mm`);
      }
      // Cell padding from cellMargin
      if (cell.cellMargin) {
        const padTop = cell.cellMargin.top ? `${(cell.cellMargin.top / 7200).toFixed(3)}in` : '2px';
        const padRight = cell.cellMargin.right ? `${(cell.cellMargin.right / 7200).toFixed(3)}in` : '4px';
        const padBottom = cell.cellMargin.bottom ? `${(cell.cellMargin.bottom / 7200).toFixed(3)}in` : '2px';
        const padLeft = cell.cellMargin.left ? `${(cell.cellMargin.left / 7200).toFixed(3)}in` : '4px';
        cellStyles.push(`padding:${padTop} ${padRight} ${padBottom} ${padLeft}`);
      } else {
        cellStyles.push('padding:2px 4px');
      }
      // Cell background color from borderFill
      const bgColor = getBorderFillBgColor(doc, cell.borderFillIDRef);
      if (bgColor) {
        cellStyles.push(`background-color:#${bgColor}`);
      }
      // Cell vertical alignment
      if (cell.vertAlign) {
        const valignMap: Record<string, string> = { TOP: 'top', CENTER: 'middle', BOTTOM: 'bottom' };
        const cssAlign = valignMap[cell.vertAlign.toUpperCase()] || 'top';
        cellStyles.push(`vertical-align:${cssAlign}`);
      } else {
        cellStyles.push('vertical-align:top');
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
  let tag = 'p';
  let headingPrefix = '';

  if (paraProp) {
    if (paraProp.align) {
      styles.push(`text-align:${paraProp.align === 'distribute' ? 'justify' : paraProp.align}`);
    }
    // Heading level
    if (paraProp.heading) {
      const level = Math.min(paraProp.heading.level, 6);
      if (level > 0) {
        tag = `h${level}`;
        styles.push('font-weight:bold');
      }
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
    // Paragraph border
    if (paraProp.border && paraProp.border.borderFillIDRef) {
      const bgColor = getBorderFillBgColor(doc, paraProp.border.borderFillIDRef);
      if (bgColor) {
        styles.push(`background-color:#${bgColor}`);
      }
      const borderStyle = getBorderStyles(doc, paraProp.border.borderFillIDRef);
      styles.push(borderStyle);
      const b = paraProp.border;
      if (b.offsetLeft) styles.push(`padding-left:${b.offsetLeft / 7200}in`);
      if (b.offsetRight) styles.push(`padding-right:${b.offsetRight / 7200}in`);
      if (b.offsetTop) styles.push(`padding-top:${b.offsetTop / 7200}in`);
      if (b.offsetBottom) styles.push(`padding-bottom:${b.offsetBottom / 7200}in`);
    }
    // Handle page break before paragraph
    if (paraProp.breakSetting?.pageBreakBefore) {
      styles.push('page-break-before:always');
    }
    // Extract numbering/bullet prefix from paraProp children
    const paraHead = paraProp.children.find(c => c.tag.endsWith('paraHead') || c.tag.endsWith(':paraHead'));
    if (paraHead && paraHead.text) {
      headingPrefix = paraHead.text + ' ';
    }
  }

  const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
  const inner = para.runs.map(r => renderRun(doc, r)).join('');

  return `<${tag}${styleAttr}>${headingPrefix}${inner || '&nbsp;'}</${tag}>`;
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
  body { font-family: 'HCR Batang', 'Batang', '바탕', 'AppleMyungjo', 'Noto Serif KR', serif; color: #000; font-size: 10pt; line-height: 1.6; }
  p { margin: 0; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 0.5px solid #000; padding: 2px 4px; vertical-align: top; font-size: inherit; line-height: 1.4; }
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

    // Add page break before subsequent sections (not the first)
    const sectionBreak = i > 0 ? ' style="page-break-before:always"' : '';
    body += `<div class="section"${sectionBreak}>`;
    body += headerHtml;
    body += html;
    body += footerHtml;
    body += '</div>';
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

    const pageBreak = i > 0 ? 'page-break-before:always;' : '';
    body += `<section class="page" style="${pageBreak}width:${pw}mm;min-height:${ph}mm;padding:${mt}mm ${mr}mm ${mb}mm ${ml}mm">`;
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
  
  // Recursively render shape content including tables, images, and paragraphs
  const visit = (el: GenericElement) => {
    // Check for table
    if (el.tag.endsWith('tbl') || el.tag.endsWith(':tbl')) {
      content += renderTable(doc, el);
      return;
    }
    
    // Check for picture/image
    if (el.tag.endsWith('pic') || el.tag.endsWith(':pic') || el.tag.endsWith('picture')) {
      content += renderImage(doc, el);
      return;
    }
    
    // Check for paragraph
    if (el.tag.endsWith('p') || el.tag.endsWith(':p')) {
      // Find subList to get proper paragraph structure
      const subList = el.children.find(c => c.tag.endsWith('subList'));
      if (subList) {
        for (const child of subList.children.filter(c => c.tag.endsWith('p'))) {
          // Try to parse as proper paragraph if possible
          content += '<div>';
          if (child.text) content += esc(child.text);
          for (const subChild of child.children) visit(subChild);
          content += '</div>';
        }
      } else {
        content += '<div>';
        if (el.text) content += esc(el.text);
        for (const child of el.children) visit(child);
        content += '</div>';
      }
      return;
    }
    
    // Handle text content
    if (el.text) content += esc(el.text);
    
    // Recurse into children
    for (const child of el.children) visit(child);
  };
  
  visit(element);
  
  if (!content.replace(/<[^>]*>/g, '').trim()) return '';
  
  return `<div class="shape-wrapper" style="padding:4px; margin:4px; overflow:hidden;">${content}</div>`;
}
