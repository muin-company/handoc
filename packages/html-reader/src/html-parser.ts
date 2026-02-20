import * as cheerio from 'cheerio';
import type { Element, AnyNode } from 'domhandler';
import type {
  Section,
  Paragraph,
  Run,
  RunChild,
  GenericElement,
} from '@handoc/document-model';

/**
 * Parse HTML string and return document-model sections
 */
export function parseHTML(html: string): Section[] {
  const $ = cheerio.load(html, {
    xmlMode: false,
  });

  const paragraphs: Paragraph[] = [];

  // Process all children of body or root
  const elements = $('body').length > 0 ? $('body').children().toArray() : $.root().children().toArray();
  
  for (const elem of elements) {
    if (elem.type === 'tag') {
      const $elem = $(elem as Element);
      const parsed = parseElement($, $elem);
      paragraphs.push(...parsed);
    }
  }

  // If no paragraphs found, create an empty one
  if (paragraphs.length === 0) {
    paragraphs.push(createEmptyParagraph());
  }

  return [{ paragraphs }];
}

/**
 * Parse a single HTML element into paragraph(s)
 */
function parseElement(
  $: cheerio.CheerioAPI,
  $elem: cheerio.Cheerio<Element>,
): Paragraph[] {
  const tagName = $elem.prop('tagName')?.toLowerCase();

  switch (tagName) {
    case 'p':
      return [parseParagraph($, $elem)];
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return [parseHeading($, $elem, tagName)];
    case 'div':
      return parseDiv($, $elem);
    case 'table':
      return [parseTable($, $elem)];
    case 'ul':
    case 'ol':
      return parseList($, $elem);
    case 'br':
      return [createEmptyParagraph()];
    case 'hr':
      return [createHorizontalRule()];
    default:
      // Try to extract text content as a paragraph
      const text = $elem.text().trim();
      if (text) {
        return [createTextParagraph(text)];
      }
      return [];
  }
}

/**
 * Parse paragraph element
 */
function parseParagraph(
  $: cheerio.CheerioAPI,
  $elem: cheerio.Cheerio<Element>,
): Paragraph {
  const runs = parseInlineContent($, $elem);

  return {
    id: null,
    paraPrIDRef: null,
    styleIDRef: null,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs,
    lineSegArray: [],
  };
}

/**
 * Parse heading element
 */
function parseHeading(
  $: cheerio.CheerioAPI,
  $elem: cheerio.Cheerio<Element>,
  tag: string,
): Paragraph {
  const runs = parseInlineContent($, $elem);
  const level = parseInt(tag[1], 10); // h1 -> 1, h2 -> 2, etc.

  // Mark as heading using styleIDRef (we'll need to create styles later)
  return {
    id: null,
    paraPrIDRef: null,
    styleIDRef: level, // Use heading level as style ref for now
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs,
    lineSegArray: [],
  };
}

/**
 * Parse div element (recursively process children)
 */
function parseDiv(
  $: cheerio.CheerioAPI,
  $elem: cheerio.Cheerio<Element>,
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  $elem.children().each((_, child) => {
    const $child = $(child);
    paragraphs.push(...parseElement($, $child));
  });

  // If div has only text nodes, treat as paragraph
  if (paragraphs.length === 0) {
    const text = $elem.text().trim();
    if (text) {
      paragraphs.push(createTextParagraph(text));
    }
  }

  return paragraphs;
}

/**
 * Parse list element (ul/ol)
 */
function parseList(
  $: cheerio.CheerioAPI,
  $elem: cheerio.Cheerio<Element>,
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const isOrdered = $elem.prop('tagName')?.toLowerCase() === 'ol';

  $elem.children('li').each((index, li) => {
    const $li = $(li);
    const prefix = isOrdered ? `${index + 1}. ` : '• ';
    const runs = parseInlineContent($, $li);

    // Add prefix as first run
    runs.unshift({
      charPrIDRef: null,
      children: [{ type: 'text', content: prefix }],
    });

    paragraphs.push({
      id: null,
      paraPrIDRef: null,
      styleIDRef: null,
      pageBreak: false,
      columnBreak: false,
      merged: false,
      runs,
      lineSegArray: [],
    });
  });

  return paragraphs;
}

/**
 * Parse table element
 */
function parseTable(
  $: cheerio.CheerioAPI,
  $elem: cheerio.Cheerio<Element>,
): Paragraph {
  const rows: GenericElement[] = [];

  $elem.find('tr').each((_, tr) => {
    const $tr = $(tr);
    const cells: GenericElement[] = [];

    $tr.find('td, th').each((_, cell) => {
      const $cell = $(cell);
      const text = $cell.text().trim();
      const colspan = parseInt($cell.attr('colspan') ?? '1', 10);
      const rowspan = parseInt($cell.attr('rowspan') ?? '1', 10);

      cells.push({
        tag: 'cell',
        attrs: {
          colspan: colspan.toString(),
          rowspan: rowspan.toString(),
        },
        children: [
          {
            tag: 'p',
            attrs: {},
            children: [
              {
                tag: 't',
                attrs: {},
                children: [],
                text,
              },
            ],
            text: null,
          },
        ],
        text: null,
      });
    });

    rows.push({
      tag: 'tr',
      attrs: {},
      children: cells,
      text: null,
    });
  });

  const tableElement: GenericElement = {
    tag: 'table',
    attrs: {
      rows: rows.length.toString(),
      cols: (rows[0]?.children.length ?? 0).toString(),
    },
    children: rows,
    text: null,
  };

  return {
    id: null,
    paraPrIDRef: null,
    styleIDRef: null,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs: [
      {
        charPrIDRef: null,
        children: [{ type: 'table', element: tableElement }],
      },
    ],
    lineSegArray: [],
  };
}

/**
 * Parse inline content (text, formatting, images)
 */
function parseInlineContent(
  $: cheerio.CheerioAPI,
  $elem: cheerio.Cheerio<Element>,
): Run[] {
  const runs: Run[] = [];
  const formatting: Set<string> = new Set();

  function processNode(node: AnyNode) {
    if (node.type === 'text') {
      const text = node.data;
      if (text.trim()) {
        runs.push(createTextRun(text, formatting));
      }
      return;
    }

    if (node.type !== 'tag') return;

    const $node = $(node);
    const tag = $node.prop('tagName')?.toLowerCase();

    switch (tag) {
      case 'b':
      case 'strong':
        formatting.add('bold');
        $node.contents().each((_, child) => processNode(child));
        formatting.delete('bold');
        break;

      case 'i':
      case 'em':
        formatting.add('italic');
        $node.contents().each((_, child) => processNode(child));
        formatting.delete('italic');
        break;

      case 'u':
        formatting.add('underline');
        $node.contents().each((_, child) => processNode(child));
        formatting.delete('underline');
        break;

      case 's':
      case 'strike':
      case 'del':
        formatting.add('strikeout');
        $node.contents().each((_, child) => processNode(child));
        formatting.delete('strikeout');
        break;

      case 'span':
        // Process style attribute
        const style = $node.attr('style') ?? '';
        const prevFormatting = new Set(formatting);

        if (style.includes('font-weight:bold') || style.includes('font-weight: bold')) {
          formatting.add('bold');
        }
        if (style.includes('font-style:italic') || style.includes('font-style: italic')) {
          formatting.add('italic');
        }
        if (style.includes('text-decoration:underline') || style.includes('text-decoration: underline')) {
          formatting.add('underline');
        }
        if (
          style.includes('text-decoration:line-through') ||
          style.includes('text-decoration: line-through')
        ) {
          formatting.add('strikeout');
        }

        $node.contents().each((_, child) => processNode(child));

        // Restore formatting
        formatting.clear();
        prevFormatting.forEach(f => formatting.add(f));
        break;

      case 'img':
        runs.push(parseImage($, $node));
        break;

      case 'br':
        runs.push({
          charPrIDRef: null,
          children: [{ type: 'text', content: '\n' }],
        });
        break;

      default:
        // Process children for unknown tags
        $node.contents().each((_, child) => processNode(child));
        break;
    }
  }

  $elem.contents().each((_, child) => processNode(child));

  return runs.length > 0 ? runs : [createEmptyRun()];
}

/**
 * Create a text run with formatting
 */
function createTextRun(text: string, formatting: Set<string>): Run {
  // For now, we don't create actual CharProperty references
  // Just store text. Later we can extend this to create proper char properties
  return {
    charPrIDRef: formatting.size > 0 ? 1 : null, // Placeholder ref
    children: [{ type: 'text', content: text }],
  };
}

/**
 * Parse image element
 */
function parseImage(
  $: cheerio.CheerioAPI,
  $elem: cheerio.Cheerio<Element>,
): Run {
  const src = $elem.attr('src') ?? '';
  const alt = $elem.attr('alt') ?? '';
  const width = $elem.attr('width');
  const height = $elem.attr('height');

  const imgElement: GenericElement = {
    tag: 'inlineObject',
    attrs: {
      src,
      alt,
      ...(width && { width }),
      ...(height && { height }),
    },
    children: [],
    text: null,
  };

  return {
    charPrIDRef: null,
    children: [{ type: 'inlineObject', name: 'picture', element: imgElement }],
  };
}

/**
 * Helper functions to create basic structures
 */

function createEmptyParagraph(): Paragraph {
  return {
    id: null,
    paraPrIDRef: null,
    styleIDRef: null,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs: [createEmptyRun()],
    lineSegArray: [],
  };
}

function createTextParagraph(text: string): Paragraph {
  return {
    id: null,
    paraPrIDRef: null,
    styleIDRef: null,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs: [
      {
        charPrIDRef: null,
        children: [{ type: 'text', content: text }],
      },
    ],
    lineSegArray: [],
  };
}

function createEmptyRun(): Run {
  return {
    charPrIDRef: null,
    children: [{ type: 'text', content: '' }],
  };
}

function createHorizontalRule(): Paragraph {
  // Represent HR as a paragraph with a generic element
  const hrElement: GenericElement = {
    tag: 'hr',
    attrs: {},
    children: [],
    text: null,
  };

  return {
    id: null,
    paraPrIDRef: null,
    styleIDRef: null,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs: [
      {
        charPrIDRef: null,
        children: [{ type: 'ctrl', element: hrElement }],
      },
    ],
    lineSegArray: [],
  };
}
