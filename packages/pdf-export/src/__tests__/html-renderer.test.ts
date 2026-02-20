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
});
