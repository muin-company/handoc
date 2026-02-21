/**
 * Additional header-parser tests for uncovered paths.
 */
import { describe, it, expect } from 'vitest';
import { parseHeader } from '../header-parser';

describe('parseHeader - memo shapes', () => {
  it('parses memoShapeList from header', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"
         version="1.4" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="0"/>
    <hh:tabProperties itemCnt="0"/>
    <hh:paraProperties itemCnt="0"/>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
    <hh:memoShapeList>
      <hh:memo id="1" width="200" lineColor="#FF0000" fillColor="#FFFF00" MemoType="normal"/>
      <hh:memo id="2" width="300"/>
    </hh:memoShapeList>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    expect(header.memoShapes).toBeDefined();
    expect(header.memoShapes!.length).toBe(2);
    expect(header.memoShapes![0].id).toBe(1);
    expect(header.memoShapes![0].width).toBe(200);
    expect(header.memoShapes![0].lineColor).toBe('#FF0000');
    expect(header.memoShapes![0].fillColor).toBe('#FFFF00');
    expect(header.memoShapes![0].memoType).toBe('normal');
  });
});

describe('parseHeader - refList properties', () => {
  it('parses refList with charProperties', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"
         version="1.4" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="1">
      <hh:charPr id="0" height="1000" color="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
      </hh:charPr>
    </hh:charProperties>
    <hh:tabProperties itemCnt="0"/>
    <hh:paraProperties itemCnt="0"/>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    expect(header.refList).toBeDefined();
    expect(header.refList.charProperties.length).toBeGreaterThanOrEqual(1);
  });
});
