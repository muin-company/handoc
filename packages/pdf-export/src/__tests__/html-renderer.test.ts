import { describe, it, expect, vi } from 'vitest';
import { renderToHtml, renderToStandaloneHtml } from '../html-renderer';
import type { HanDoc } from '@handoc/hwpx-parser';
import type { Section, Paragraph, Run, RunChild } from '@handoc/document-model';
import type { CharProperty, ParaProperty, RefList, DocumentHeader } from '@handoc/document-model';

/** Create a minimal mock HanDoc */
function mockDoc(opts: {
  sections?: Section[];
  charProperties?: CharProperty[];
  paraProperties?: ParaProperty[];
} = {}): HanDoc {
  const charProperties = opts.charProperties ?? [];
  const paraProperties = opts.paraProperties ?? [];

  return {
    pageSize: { width: 210, height: 297 },
    margins: { left: 30, right: 30, top: 25, bottom: 25, header: 10, footer: 10, gutter: 0 },
    sections: opts.sections ?? [],
    images: [],
    header: {
      version: '5.1.0.0',
      secCnt: 1,
      beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
      refList: {
        fontFaces: [],
        borderFills: [],
        charProperties,
        paraProperties,
        styles: [],
        others: [],
      },
    },
  } as unknown as HanDoc;
}

function textRun(text: string, charPrIDRef: number | null = null): Run {
  return {
    charPrIDRef,
    children: [{ type: 'text', content: text }],
  };
}

function makePara(runs: Run[], paraPrIDRef: number | null = null): Paragraph {
  return {
    id: null,
    paraPrIDRef,
    styleIDRef: null,
    pageBreak: false,
    columnBreak: false,
    merged: false,
    runs,
    lineSegArray: [],
  };
}

function makeSection(paragraphs: Paragraph[]): Section {
  return { paragraphs };
}

describe('renderToHtml', () => {
  it('should produce valid HTML with text content', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun('안녕하세요')])])],
    });

    const html = renderToHtml(doc);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('안녕하세요');
    expect(html).toContain('<section class="page"');
    expect(html).toContain('<p');
  });

  it('should render bold/italic text with styles', () => {
    const doc = mockDoc({
      charProperties: [{ id: 1, height: 1200, bold: true, italic: true, attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('굵은 글씨', 1)])])],
    });

    const html = renderToHtml(doc);
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('font-style:italic');
    expect(html).toContain('font-size:12pt');
  });

  it('should render paragraph alignment', () => {
    const doc = mockDoc({
      paraProperties: [{ id: 1, align: 'center', attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('가운데')], 1)])],
    });

    const html = renderToHtml(doc);
    expect(html).toContain('text-align:center');
  });

  it('should render table as HTML table', () => {
    const tableElement = {
      tag: 'tbl',
      attrs: { id: 't1', rowCnt: '2', colCnt: '2', cellSpacing: '0', borderFillIDRef: '0' },
      children: [
        {
          tag: 'tr',
          attrs: {},
          children: [
            {
              tag: 'tc',
              attrs: {
                name: 'A1', header: '0', borderFillIDRef: '0',
                colAddr: '0', rowAddr: '0', colSpan: '1', rowSpan: '1',
                width: '5000', height: '2000',
              },
              children: [{
                tag: 'subList',
                attrs: {},
                children: [{
                  tag: 'p',
                  attrs: {},
                  children: [{
                    tag: 'run',
                    attrs: {},
                    children: [{ tag: 't', attrs: {}, children: [], text: '셀1' }],
                    text: null,
                  }],
                  text: null,
                }],
                text: null,
              }],
              text: null,
            },
            {
              tag: 'tc',
              attrs: {
                name: 'B1', header: '0', borderFillIDRef: '0',
                colAddr: '1', rowAddr: '0', colSpan: '1', rowSpan: '1',
                width: '5000', height: '2000',
              },
              children: [{
                tag: 'subList',
                attrs: {},
                children: [{
                  tag: 'p',
                  attrs: {},
                  children: [{
                    tag: 'run',
                    attrs: {},
                    children: [{ tag: 't', attrs: {}, children: [], text: '셀2' }],
                    text: null,
                  }],
                  text: null,
                }],
                text: null,
              }],
              text: null,
            },
          ],
          text: null,
        },
      ],
      text: null,
    };

    const tableRun: Run = {
      charPrIDRef: null,
      children: [{ type: 'table', element: tableElement }],
    };

    const doc = mockDoc({
      sections: [makeSection([makePara([tableRun])])],
    });

    const html = renderToHtml(doc);
    expect(html).toContain('<table');
    expect(html).toContain('<td');
    expect(html).toContain('</table>');
  });

  it('should render empty paragraph as &nbsp;', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([])])],
    });

    const html = renderToHtml(doc);
    expect(html).toContain('&nbsp;');
  });

  it('should escape HTML entities in text', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun('<script>alert("xss")</script>')])])],
    });

    const html = renderToHtml(doc);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should include lang="ko" and semantic tags', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun('테스트')])])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('lang="ko"');
    expect(html).toContain('<section class="page"');
    expect(html).toContain('<article>');
  });

  it('should include print CSS media query', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun('인쇄')])])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('@media print');
  });

  it('should include Korean font family', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun('폰트')])])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain("'Malgun Gothic'");
    expect(html).toContain('맑은 고딕');
  });

  it('should render page dividers between sections', () => {
    const doc = mockDoc({
      sections: [
        makeSection([makePara([textRun('페이지1')])]),
        makeSection([makePara([textRun('페이지2')])]),
      ],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('page-divider');
  });
});

describe('renderToHtml - character properties', () => {
  it('should render underline text', () => {
    const doc = mockDoc({
      charProperties: [{ id: 1, underline: 'single', attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('밑줄', 1)])])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('text-decoration:underline');
  });

  it('should skip underline when set to none', () => {
    const doc = mockDoc({
      charProperties: [{ id: 1, underline: 'none', attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('없음', 1)])])],
    });
    const html = renderToHtml(doc);
    expect(html).not.toContain('text-decoration:underline');
  });

  it('should render strikeout text', () => {
    const doc = mockDoc({
      charProperties: [{ id: 1, strikeout: 'single', attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('취소선', 1)])])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('text-decoration:line-through');
  });

  it('should skip strikeout when set to none', () => {
    const doc = mockDoc({
      charProperties: [{ id: 1, strikeout: 'none', attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('없음', 1)])])],
    });
    const html = renderToHtml(doc);
    expect(html).not.toContain('text-decoration:line-through');
  });

  it('should render text color', () => {
    const doc = mockDoc({
      charProperties: [{ id: 1, textColor: 'ff0000', attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('빨강', 1)])])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('color:#ff0000');
  });

  it('should skip default text colors (0 and 000000)', () => {
    const doc = mockDoc({
      charProperties: [{ id: 1, textColor: '0', attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('검정', 1)])])],
    });
    const html = renderToHtml(doc);
    expect(html).not.toContain('color:#');
  });

  it('should pad short color codes', () => {
    const doc = mockDoc({
      charProperties: [{ id: 1, textColor: 'ff', attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('색상', 1)])])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('color:#0000ff');
  });
});

describe('renderToHtml - image rendering', () => {
  it('should skip image when no fileRef element', () => {
    const imgElement = {
      tag: 'pic', attrs: {}, children: [], text: null,
    };
    const imgRun: Run = {
      charPrIDRef: null,
      children: [{ type: 'inlineObject' as const, name: 'picture', element: imgElement }],
    };
    const doc = mockDoc({
      sections: [makeSection([makePara([imgRun])])],
    });
    const html = renderToHtml(doc);
    expect(html).not.toContain('<img');
  });

  it('should skip image when binItemIDRef is empty', () => {
    const imgElement = {
      tag: 'pic', attrs: {},
      children: [{
        tag: 'fileRef', attrs: { binItemIDRef: '' }, children: [], text: null,
      }],
      text: null,
    };
    const imgRun: Run = {
      charPrIDRef: null,
      children: [{ type: 'inlineObject' as const, name: 'picture', element: imgElement }],
    };
    const doc = mockDoc({
      sections: [makeSection([makePara([imgRun])])],
    });
    const html = renderToHtml(doc);
    expect(html).not.toContain('<img');
  });

  it('should skip image when no matching image in doc.images', () => {
    const imgElement = {
      tag: 'pic', attrs: {},
      children: [{
        tag: 'fileRef', attrs: { binItemIDRef: 'notfound.png' }, children: [], text: null,
      }],
      text: null,
    };
    const imgRun: Run = {
      charPrIDRef: null,
      children: [{ type: 'inlineObject' as const, name: 'picture', element: imgElement }],
    };
    const doc = mockDoc({
      sections: [makeSection([makePara([imgRun])])],
    });
    (doc as any).images = [{ path: 'other.png', data: new Uint8Array([]) }];
    const html = renderToHtml(doc);
    expect(html).not.toContain('<img');
  });

  it('should render image with dimensions from imgRect', () => {
    const imgElement = {
      tag: 'pic', attrs: {},
      children: [
        { tag: 'fileRef', attrs: { binItemIDRef: 'test.jpg' }, children: [], text: null },
        { tag: 'imgRect', attrs: { width: '36000', height: '28800' }, children: [], text: null },
      ],
      text: null,
    };
    const imgRun: Run = {
      charPrIDRef: null,
      children: [{ type: 'inlineObject' as const, name: 'picture', element: imgElement }],
    };
    const doc = mockDoc({
      sections: [makeSection([makePara([imgRun])])],
    });
    (doc as any).images = [{ path: 'test.jpg', data: new Uint8Array([0xff, 0xd8]) }];
    const html = renderToHtml(doc);
    expect(html).toContain('data:image/jpeg;base64,');
    expect(html).toContain('width:');
    expect(html).toContain('height:');
  });

  it('should handle unknown image extensions with png fallback', () => {
    const imgElement = {
      tag: 'pic', attrs: {},
      children: [
        { tag: 'fileRef', attrs: { binItemIDRef: 'test.xyz' }, children: [], text: null },
      ],
      text: null,
    };
    const imgRun: Run = {
      charPrIDRef: null,
      children: [{ type: 'inlineObject' as const, name: 'picture', element: imgElement }],
    };
    const doc = mockDoc({
      sections: [makeSection([makePara([imgRun])])],
    });
    (doc as any).images = [{ path: 'test.xyz', data: new Uint8Array([0x00]) }];
    const html = renderToHtml(doc);
    expect(html).toContain('data:image/png;base64,');
  });

  it('should skip non-picture inline objects', () => {
    const el = { tag: 'equation', attrs: {}, children: [], text: null };
    const run: Run = {
      charPrIDRef: null,
      children: [{ type: 'inlineObject' as const, name: 'equation', element: el }],
    };
    const doc = mockDoc({
      sections: [makeSection([makePara([run])])],
    });
    const html = renderToHtml(doc);
    expect(html).not.toContain('<img');
  });
});

describe('renderToHtml - paragraph properties', () => {
  it('should render distribute alignment as justify', () => {
    const doc = mockDoc({
      paraProperties: [{ id: 1, align: 'distribute', attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('분산')], 1)])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('text-align:justify');
  });

  it('should render percent line spacing', () => {
    const doc = mockDoc({
      paraProperties: [{ id: 1, lineSpacing: { type: 'percent', value: 160 }, attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('줄간격')], 1)])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('line-height:1.6');
  });

  it('should render fixed line spacing', () => {
    const doc = mockDoc({
      paraProperties: [{ id: 1, lineSpacing: { type: 'fixed', value: 7200 }, attrs: {}, children: [] }],
      sections: [makeSection([makePara([textRun('고정')], 1)])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('line-height:1in');
  });

  it('should render paragraph margins', () => {
    const doc = mockDoc({
      paraProperties: [{
        id: 1,
        margin: { left: 7200, right: 3600, indent: 1800, prev: 7200, next: 3600 },
        attrs: {}, children: [],
      }],
      sections: [makeSection([makePara([textRun('마진')], 1)])],
    });
    const html = renderToHtml(doc);
    expect(html).toContain('margin-left:1in');
    expect(html).toContain('margin-right:0.5in');
    expect(html).toContain('text-indent:0.25in');
    expect(html).toContain('margin-top:1in');
    expect(html).toContain('margin-bottom:0.5in');
  });
});

describe('renderToHtml - section properties', () => {
  it('should use sectionProps for page dimensions when available', () => {
    const section: Section = {
      paragraphs: [makePara([textRun('섹션')])],
      sectionProps: {
        pageWidth: 60480, // 210mm in hwp units (7200 per inch)
        pageHeight: 85680, // 297mm
        margins: { left: 8504, right: 8504, top: 5669, bottom: 4252 },
      },
    } as any;
    const doc = mockDoc({ sections: [section] });
    const html = renderToHtml(doc);
    expect(html).toContain('width:');
    expect(html).toContain('min-height:');
  });

  it('should render header and footer paragraphs', () => {
    const section: Section = {
      paragraphs: [makePara([textRun('본문')])],
      sectionProps: {
        pageWidth: 60480,
        pageHeight: 85680,
        margins: { left: 8504, right: 8504, top: 5669, bottom: 4252 },
        headerParagraphs: [makePara([textRun('머리글')])],
        footerParagraphs: [makePara([textRun('꼬리글')])],
      },
    } as any;
    const doc = mockDoc({ sections: [section] });
    const html = renderToHtml(doc);
    expect(html).toContain('page-header');
    expect(html).toContain('머리글');
    expect(html).toContain('page-footer');
    expect(html).toContain('꼬리글');
  });

  it('should skip empty header/footer arrays', () => {
    const section: Section = {
      paragraphs: [makePara([textRun('본문')])],
      sectionProps: {
        pageWidth: 60480,
        pageHeight: 85680,
        margins: { left: 8504, right: 8504, top: 5669, bottom: 4252 },
        headerParagraphs: [],
        footerParagraphs: [],
      },
    } as any;
    const doc = mockDoc({ sections: [section] });
    const html = renderToHtml(doc);
    // CSS contains .page-header class but no actual <header> element should be rendered
    expect(html).not.toContain('<header');
    expect(html).not.toContain('<footer');
  });
});

describe('renderToStandaloneHtml', () => {
  it('should produce a complete standalone HTML document', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun('독립 HTML')])])],
    });
    const html = renderToStandaloneHtml(doc);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="ko">');
    expect(html).toContain('</html>');
    expect(html).toContain('<title>');
    expect(html).toContain('독립 HTML');
  });

  it('should include all CSS inline with no external dependencies', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun('CSS 테스트')])])],
    });
    const html = renderToStandaloneHtml(doc);
    expect(html).toContain('<style>');
    expect(html).not.toContain('<link');
    expect(html).toContain('border-collapse');
    expect(html).toContain('@media print');
    expect(html).toContain('@media screen');
  });

  it('should contain Korean text correctly', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun('한글 텍스트 테스트입니다')])])],
    });
    const html = renderToStandaloneHtml(doc);
    expect(html).toContain('한글 텍스트 테스트입니다');
  });

  it('should embed images as base64 data URIs', () => {
    const imgData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
    const imgElement = {
      tag: 'pic',
      attrs: {},
      children: [
        {
          tag: 'fileRef',
          attrs: { binItemIDRef: 'image1.png' },
          children: [],
          text: null,
        },
        {
          tag: 'imgRect',
          attrs: { width: '36000', height: '28800' },
          children: [],
          text: null,
        },
      ],
      text: null,
    };

    const imgRun: Run = {
      charPrIDRef: null,
      children: [{ type: 'inlineObject', name: 'picture', element: imgElement }],
    };

    const doc = mockDoc({
      sections: [makeSection([makePara([imgRun])])],
    });
    (doc as any).images = [{ path: 'image1.png', data: imgData }];

    const html = renderToStandaloneHtml(doc);
    expect(html).toContain('data:image/png;base64,');
  });

  it('should use first paragraph text as title', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun('문서 제목')]), makePara([textRun('본문')])])],
    });
    const html = renderToStandaloneHtml(doc);
    expect(html).toContain('<title>문서 제목</title>');
  });

  it('should use default title when no text content', () => {
    const doc = mockDoc({
      sections: [makeSection([makePara([])])],
    });
    const html = renderToStandaloneHtml(doc);
    expect(html).toContain('<title>HanDoc Document</title>');
  });

  it('should skip empty text runs when finding title', () => {
    const emptyRun: Run = {
      charPrIDRef: null,
      children: [{ type: 'text', content: '   ' }],
    };
    const doc = mockDoc({
      sections: [makeSection([makePara([emptyRun]), makePara([textRun('실제 제목')])])],
    });
    const html = renderToStandaloneHtml(doc);
    expect(html).toContain('<title>실제 제목</title>');
  });

  it('should truncate long titles to 100 characters', () => {
    const longText = '가'.repeat(200);
    const doc = mockDoc({
      sections: [makeSection([makePara([textRun(longText)])])],
    });
    const html = renderToStandaloneHtml(doc);
    // Title should be truncated
    expect(html).toContain('<title>');
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    expect(titleMatch![1].length).toBeLessThanOrEqual(100);
  });
});
