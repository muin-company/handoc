import type {
  Section, Paragraph, Run, RunChild, GenericElement,
} from '@handoc/document-model';
import type {
  CharProperty, ParaProperty, DocumentHeader, NumberingProperty, BulletProperty,
} from '@handoc/document-model';
import type { ImageInfo, HeaderFooter, Footnote } from '@handoc/hwpx-parser';
import { parseFootnote, parseHeaderFooter, extractAnnotationText } from '@handoc/hwpx-parser';
import { hwpUnitToMm, hwpUnitToPt, fontHeightToPt } from '@handoc/document-model';

export interface RenderContext {
  header?: DocumentHeader;
  images?: ImageInfo[];
  headers?: HeaderFooter[];
  footers?: HeaderFooter[];
  footnotes?: Footnote[];
  footnoteCounter?: { value: number }; // Mutable counter for footnote numbering
  footnoteRefs?: Map<number, Footnote>; // Map footnote number to content
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Style helpers ──

function paraStyle(para: Paragraph, ctx: RenderContext): string {
  const pp = resolveParaProp(para, ctx);
  if (!pp) return '';
  const parts: string[] = [];
  if (pp.align) {
    const alignMap: Record<string, string> = {
      left: 'left', center: 'center', right: 'right',
      justify: 'justify', distribute: 'justify',
    };
    parts.push(`text-align:${alignMap[pp.align] ?? 'left'}`);
  }
  if (pp.lineSpacing) {
    if (pp.lineSpacing.type === 'percent') {
      parts.push(`line-height:${pp.lineSpacing.value}%`);
    } else if (pp.lineSpacing.type === 'fixed') {
      parts.push(`line-height:${hwpUnitToPt(pp.lineSpacing.value)}pt`);
    }
  }
  if (pp.margin) {
    if (pp.margin.left) parts.push(`margin-left:${hwpUnitToPt(pp.margin.left)}pt`);
    if (pp.margin.right) parts.push(`margin-right:${hwpUnitToPt(pp.margin.right)}pt`);
    if (pp.margin.indent) parts.push(`text-indent:${hwpUnitToPt(pp.margin.indent)}pt`);
    if (pp.margin.prev) parts.push(`margin-top:${hwpUnitToPt(pp.margin.prev)}pt`);
    if (pp.margin.next) parts.push(`margin-bottom:${hwpUnitToPt(pp.margin.next)}pt`);
  }
  return parts.length ? ` style="${parts.join(';')}"` : '';
}

function runStyle(run: Run, ctx: RenderContext): string {
  const cp = resolveCharProp(run, ctx);
  if (!cp) return '';
  const parts: string[] = [];
  if (cp.bold) parts.push('font-weight:bold');
  if (cp.italic) parts.push('font-style:italic');
  if (cp.underline && cp.underline !== 'none') parts.push('text-decoration:underline');
  if (cp.strikeout && cp.strikeout !== 'none') parts.push('text-decoration:line-through');
  if (cp.textColor && cp.textColor !== '0' && cp.textColor !== '000000') {
    parts.push(`color:#${cp.textColor.padStart(6, '0')}`);
  }
  if (cp.height) parts.push(`font-size:${fontHeightToPt(cp.height)}pt`);
  if (cp.highlightColor && cp.highlightColor !== 'none') {
    parts.push(`background-color:${cp.highlightColor}`);
  }
  return parts.length ? ` style="${parts.join(';')}"` : '';
}

function resolveParaProp(para: Paragraph, ctx: RenderContext): ParaProperty | undefined {
  if (!ctx.header?.refList?.paraProperties) return undefined;
  const id = para.paraPrIDRef;
  if (id == null) return undefined;
  return ctx.header.refList.paraProperties.find(p => p.id === id);
}

function resolveCharProp(run: Run, ctx: RenderContext): CharProperty | undefined {
  if (!ctx.header?.refList?.charProperties) return undefined;
  const id = run.charPrIDRef;
  if (id == null) return undefined;
  return ctx.header.refList.charProperties.find(c => c.id === id);
}

// ── Numbering helpers ──

function getNumberingPrefix(para: Paragraph, ctx: RenderContext): string {
  const pp = resolveParaProp(para, ctx);
  if (!pp?.heading) return '';
  
  const { type, idRef, level } = pp.heading;
  if (type !== 'OUTLINE' && type !== 'NUMBER') return '';
  
  const refList = ctx.header?.refList;
  if (!refList) return '';
  
  // Check numberings first
  const numbering = refList.numberings?.find(n => n.id === idRef);
  if (numbering) {
    const paraHead = numbering.levels.find(l => l.level === level);
    if (paraHead?.text) {
      // Parse the text pattern (e.g., "^1.", "^2)", "가.")
      // Replace ^N with actual number placeholder
      const prefix = paraHead.text.replace(/\^[0-9]+/, '1');
      return prefix.endsWith(' ') ? prefix : prefix + ' ';
    }
  }
  
  // Check bullets
  const bullet = refList.bullets?.find(b => b.id === idRef);
  if (bullet) {
    const paraHead = bullet.levels.find(l => l.level === level);
    if (paraHead?.text) {
      const prefix = paraHead.text;
      return prefix.endsWith(' ') ? prefix : prefix + ' ';
    }
    // Fallback to bullet char
    if (bullet.char) {
      return bullet.char + ' ';
    }
  }
  
  return '';
}

// ── Table rendering ──

function extractTextFromGeneric(el: GenericElement): string {
  let text = el.text ?? '';
  for (const child of el.children) {
    text += extractTextFromGeneric(child);
  }
  return text;
}

function findChildren(el: GenericElement, tag: string): GenericElement[] {
  return el.children.filter(c => c.tag.toLowerCase().endsWith(tag.toLowerCase()));
}

function tableToHtml(el: GenericElement): string {
  const rows = findChildren(el, 'tr');
  if (rows.length === 0) {
    // Try deeper: look for row elements
    const allRows = flatFind(el, 'tr');
    if (allRows.length === 0) return `<div class="handoc-table-fallback">${escapeHtml(extractTextFromGeneric(el))}</div>`;
    return tableRowsToHtml(allRows);
  }
  return tableRowsToHtml(rows);
}

function flatFind(el: GenericElement, tag: string): GenericElement[] {
  const result: GenericElement[] = [];
  for (const child of el.children) {
    if (child.tag.toLowerCase().endsWith(tag.toLowerCase())) {
      result.push(child);
    } else {
      result.push(...flatFind(child, tag));
    }
  }
  return result;
}

function tableRowsToHtml(rows: GenericElement[]): string {
  let html = '<table class="handoc-table"><tbody>';
  for (const row of rows) {
    html += '<tr>';
    const cells = findChildren(row, 'tc');
    for (const cell of cells) {
      const colSpan = cell.attrs['colSpan'] || cell.attrs['colspan'];
      const rowSpan = cell.attrs['rowSpan'] || cell.attrs['rowspan'];
      let attrs = '';
      if (colSpan && colSpan !== '1') attrs += ` colspan="${colSpan}"`;
      if (rowSpan && rowSpan !== '1') attrs += ` rowspan="${rowSpan}"`;
      const text = extractTextFromGeneric(cell);
      html += `<td${attrs}>${escapeHtml(text)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

// ── Image rendering ──

function imageToHtml(el: GenericElement, ctx: RenderContext): string {
  // Look for img/imgRect/binItem with binDataID or href
  const binItem = flatFind(el, 'binItem')[0] ?? flatFind(el, 'imgRect')[0];
  const href = binItem?.attrs['binaryItemIDRef'] ?? binItem?.attrs['href'] ?? el.attrs['binaryItemIDRef'];
  
  if (href && ctx.images) {
    const img = ctx.images.find(i => {
      const name = i.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
      return i.path.includes(href) || name === href || i.path.endsWith(href);
    });
    if (img) {
      const ext = img.path.split('.').pop()?.toLowerCase() ?? 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'gif' ? 'image/gif'
        : `image/${ext}`;
      const b64 = uint8ToBase64(img.data);
      return `<img class="handoc-image" src="data:${mime};base64,${b64}" alt="" />`;
    }
  }
  return '<span class="handoc-image-missing">[image]</span>';
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ── Shape rendering (SVG) ──

function shapeToSvg(child: { type: 'shape'; name: string; element: GenericElement }): string {
  const el = child.element;
  const shapeType = child.name.toLowerCase();
  
  // Extract common attributes
  const width = parseFloat(el.attrs['width'] || el.attrs['w'] || '100');
  const height = parseFloat(el.attrs['height'] || el.attrs['h'] || '100');
  const x = parseFloat(el.attrs['x'] || '0');
  const y = parseFloat(el.attrs['y'] || '0');
  
  // Look for drawing properties
  const strokeColor = el.attrs['stroke'] || el.attrs['lineColor'] || '#000000';
  const fillColor = el.attrs['fill'] || el.attrs['fillColor'] || 'none';
  const strokeWidth = el.attrs['strokeWidth'] || '1';
  
  let svgContent = '';
  
  // Basic shape types
  if (shapeType.includes('line')) {
    const x2 = parseFloat(el.attrs['x2'] || String(x + width));
    const y2 = parseFloat(el.attrs['y2'] || String(y + height));
    svgContent = `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
  } else if (shapeType.includes('rect')) {
    svgContent = `<rect x="${x}" y="${y}" width="${width}" height="${height}" stroke="${strokeColor}" fill="${fillColor}" stroke-width="${strokeWidth}" />`;
  } else if (shapeType.includes('ellipse') || shapeType.includes('circle')) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rx = width / 2;
    const ry = height / 2;
    svgContent = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${strokeColor}" fill="${fillColor}" stroke-width="${strokeWidth}" />`;
  } else {
    // Unknown shape - render as a placeholder
    return `<span class="handoc-shape-unknown">[${shapeType}]</span>`;
  }
  
  const svgWidth = Math.max(width, 100);
  const svgHeight = Math.max(height, 100);
  
  return `<svg class="handoc-shape" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">${svgContent}</svg>`;
}

// ── Equation rendering ──

function equationToHtml(child: { type: 'equation'; element: GenericElement }): string {
  // Try to extract equation text
  const eqText = extractTextFromGeneric(child.element);
  if (eqText) {
    // Basic LaTeX-like rendering (without KaTeX for now)
    return `<span class="handoc-equation" title="${escapeHtml(eqText)}">${escapeHtml(eqText)}</span>`;
  }
  return '<span class="handoc-equation">[equation]</span>';
}

// ── Public API ──

export function runChildToHtml(child: RunChild, ctx: RenderContext): string {
  switch (child.type) {
    case 'text':
      return escapeHtml(child.content);
    case 'table':
      return tableToHtml(child.element);
    case 'inlineObject':
      return imageToHtml(child.element, ctx);
    case 'shape':
      return shapeToSvg(child);
    case 'equation':
      return equationToHtml(child);
    case 'ctrl':
      // Check if it's a table or image inside ctrl
      if (child.element.tag.toLowerCase().includes('tbl')) return tableToHtml(child.element);
      
      // Check for footnote/endnote
      const footnote = parseFootnote(child.element);
      if (footnote && ctx.footnoteCounter && ctx.footnoteRefs) {
        const num = ++ctx.footnoteCounter.value;
        ctx.footnoteRefs.set(num, footnote);
        return `<sup class="handoc-footnote-ref" data-footnote="${num}">${num}</sup>`;
      }
      
      return ''; // ignore other ctrl
    case 'secPr':
    case 'trackChange':
      return '';
    default:
      return '';
  }
}

export function paragraphToHtml(para: Paragraph, ctx: RenderContext): string {
  let inner = '';
  
  // Add numbering/bullet prefix
  const prefix = getNumberingPrefix(para, ctx);
  if (prefix) {
    inner += `<span class="handoc-numbering">${escapeHtml(prefix)}</span>`;
  }
  
  for (const run of para.runs) {
    const style = runStyle(run, ctx);
    let runHtml = '';
    for (const child of run.children) {
      runHtml += runChildToHtml(child, ctx);
    }
    if (!runHtml) continue;
    // If only text children and has style, wrap in span
    const hasNonText = run.children.some(c => c.type !== 'text');
    if (style && !hasNonText) {
      inner += `<span${style}>${runHtml}</span>`;
    } else {
      inner += runHtml;
    }
  }
  if (!inner) inner = '&nbsp;'; // empty paragraph
  return `<p class="handoc-para"${paraStyle(para, ctx)}>${inner}</p>`;
}

export function sectionToHtml(section: Section, ctx: RenderContext, sectionIndex: number): string {
  let style = '';
  const sp = section.sectionProps;
  if (sp) {
    const w = hwpUnitToMm(sp.pageWidth);
    const m = sp.margins;
    style = ` style="width:${w.toFixed(1)}mm;padding:${hwpUnitToMm(m.top).toFixed(1)}mm ${hwpUnitToMm(m.right).toFixed(1)}mm ${hwpUnitToMm(m.bottom).toFixed(1)}mm ${hwpUnitToMm(m.left).toFixed(1)}mm"`;
  }
  
  // Initialize footnote tracking for this section
  if (!ctx.footnoteCounter) ctx.footnoteCounter = { value: 0 };
  if (!ctx.footnoteRefs) ctx.footnoteRefs = new Map();
  const footnotesBefore = ctx.footnoteCounter.value;
  
  // Render header if available
  let headerHtml = '';
  if (ctx.headers && ctx.headers.length > 0) {
    const header = ctx.headers[0]; // Use first header for now (can be enhanced for BOTH/EVEN/ODD)
    const headerParas = header.paragraphs.map(p => paragraphToHtml(p, ctx)).join('\n');
    headerHtml = `<div class="handoc-header">\n${headerParas}\n</div>\n`;
  }
  
  // Render main content
  const paragraphs = section.paragraphs.map(p => paragraphToHtml(p, ctx)).join('\n');
  
  // Render footer if available
  let footerHtml = '';
  if (ctx.footers && ctx.footers.length > 0) {
    const footer = ctx.footers[0]; // Use first footer for now
    const footerParas = footer.paragraphs.map(p => paragraphToHtml(p, ctx)).join('\n');
    footerHtml = `<div class="handoc-footer">\n${footerParas}\n</div>\n`;
  }
  
  // Render footnotes collected in this section
  let footnotesHtml = '';
  const footnotesAfter = ctx.footnoteCounter.value;
  if (footnotesAfter > footnotesBefore) {
    const items: string[] = [];
    for (let i = footnotesBefore + 1; i <= footnotesAfter; i++) {
      const fn = ctx.footnoteRefs!.get(i);
      if (fn) {
        const fnParas = fn.paragraphs.map(p => paragraphToHtml(p, ctx)).join('\n');
        items.push(`<div class="handoc-footnote-item" data-footnote="${i}"><sup>${i}</sup> ${fnParas}</div>`);
      }
    }
    if (items.length > 0) {
      footnotesHtml = `<div class="handoc-footnotes">\n${items.join('\n')}\n</div>\n`;
    }
  }
  
  return `<div class="handoc-page"${style}>\n${headerHtml}${paragraphs}\n${footnotesHtml}${footerHtml}</div>`;
}

export function documentToHtml(sections: Section[], ctx: RenderContext): string {
  return sections.map((s, i) => sectionToHtml(s, ctx, i)).join('\n');
}
