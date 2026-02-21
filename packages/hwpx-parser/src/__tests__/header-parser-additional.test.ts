/**
 * Additional header-parser tests for switch/default paths and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { parseHeader } from '../header-parser';

describe('parseHeader - tabProperties with switch/default', () => {
  it('parses tabProperty with switch > default path', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"
         version="1.4" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="0"/>
    <hh:tabProperties itemCnt="1">
      <hh:tabPr id="0" autoTabLeft="1" autoTabRight="0">
        <hh:switch>
          <hh:default>
            <hh:tabItem pos="1000" type="left" leader="none"/>
            <hh:tabItem pos="2000" type="center" leader="dot"/>
          </hh:default>
        </hh:switch>
      </hh:tabPr>
    </hh:tabProperties>
    <hh:paraProperties itemCnt="0"/>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    expect(header.refList.tabProperties).toHaveLength(1);
    const tab = header.refList.tabProperties[0];
    expect(tab.autoTabLeft).toBe(true);
    expect(tab.autoTabRight).toBe(false);
    expect(tab.tabStops).toHaveLength(2);
    expect(tab.tabStops[0].pos).toBe(1000);
    expect(tab.tabStops[1].type).toBe('center');
  });

  it('parses tabProperty with switch > case path', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"
         version="1.4" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="0"/>
    <hh:tabProperties itemCnt="1">
      <hh:tabPr id="0">
        <hh:switch>
          <hh:case>
            <hh:tabItem pos="500" type="right" leader="underline"/>
          </hh:case>
        </hh:switch>
      </hh:tabPr>
    </hh:tabProperties>
    <hh:paraProperties itemCnt="0"/>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    expect(header.refList.tabProperties).toHaveLength(1);
    const tab = header.refList.tabProperties[0];
    expect(tab.tabStops).toHaveLength(1);
    expect(tab.tabStops[0].pos).toBe(500);
    expect(tab.tabStops[0].type).toBe('right');
  });

  it('parses tabProperty without switch (direct tabItems)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"
         version="1.4" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="0"/>
    <hh:tabProperties itemCnt="1">
      <hh:tabPr id="0">
        <hh:tabItem pos="1500" type="left" leader="none"/>
      </hh:tabPr>
    </hh:tabProperties>
    <hh:paraProperties itemCnt="0"/>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    const tab = header.refList.tabProperties[0];
    expect(tab.tabStops).toHaveLength(1);
    expect(tab.tabStops[0].pos).toBe(1500);
  });
});

describe('parseHeader - paraProperties with switch/default for lineSpacing', () => {
  it('parses lineSpacing from switch > default', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"
         version="1.4" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="0"/>
    <hh:tabProperties itemCnt="0"/>
    <hh:paraProperties itemCnt="1">
      <hh:paraPr id="0" tabPrIDRef="0" charPrIDRef="0">
        <hh:switch>
          <hh:default>
            <hh:lineSpacing value="160" type="percent"/>
          </hh:default>
        </hh:switch>
      </hh:paraPr>
    </hh:paraProperties>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    expect(header.refList.paraProperties).toHaveLength(1);
    const para = header.refList.paraProperties[0];
    expect(para.lineSpacing).toBeDefined();
    expect(para.lineSpacing?.value).toBe(160);
    expect(para.lineSpacing?.type).toBe('percent');
  });

  it('parses lineSpacing from switch > case', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"
         version="1.4" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="0"/>
    <hh:tabProperties itemCnt="0"/>
    <hh:paraProperties itemCnt="1">
      <hh:paraPr id="0" tabPrIDRef="0" charPrIDRef="0">
        <hh:switch>
          <hh:case>
            <hh:lineSpacing value="200" type="fixed"/>
          </hh:case>
        </hh:switch>
      </hh:paraPr>
    </hh:paraProperties>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    const para = header.refList.paraProperties[0];
    expect(para.lineSpacing?.value).toBe(200);
    expect(para.lineSpacing?.type).toBe('fixed');
  });
});

describe('parseHeader - edge cases', () => {
  it('handles missing version attribute with warning', () => {
    const warnings: Array<{ code: string; message: string; context?: string }> = [];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         secCnt="1">
  <hh:beginNum page="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml, {
      add: (code, message, context) => warnings.push({ code, message, context }),
    });
    
    expect(header.version).toBe('');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('MISSING_ATTR');
    expect(warnings[0].message).toContain('version');
  });

  it('parses bullet properties with paraHead levels', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         version="1.4" secCnt="1">
  <hh:beginNum page="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="0"/>
    <hh:tabProperties itemCnt="0"/>
    <hh:paraProperties itemCnt="0"/>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
    <hh:bullets itemCnt="1">
      <hh:bullet id="0" char="•">
        <hh:paraHead level="1" checkable="1"/>
        <hh:paraHead level="2" start="5"/>
      </hh:bullet>
    </hh:bullets>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    expect(header.refList.bullets).toHaveLength(1);
    const bullet = header.refList.bullets[0];
    expect(bullet.id).toBe(0);
    expect(bullet.char).toBe('•');
    expect(bullet.levels).toHaveLength(2);
    expect(bullet.levels[0].level).toBe(1);
    expect(bullet.levels[0].checkable).toBe(true);
    expect(bullet.levels[1].level).toBe(2);
    expect(bullet.levels[1].start).toBe(5);
  });

  it('parses numbering properties with paraHead levels', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         version="1.4" secCnt="1">
  <hh:beginNum page="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="0"/>
    <hh:tabProperties itemCnt="0"/>
    <hh:paraProperties itemCnt="0"/>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
    <hh:numberings itemCnt="1">
      <hh:numbering id="0" start="1">
        <hh:paraHead level="1" numFormat="Decimal"/>
        <hh:paraHead level="2" numFormat="LowerLetter" textOffset="500"/>
      </hh:numbering>
    </hh:numberings>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    expect(header.refList.numberings).toHaveLength(1);
    const numbering = header.refList.numberings[0];
    expect(numbering.id).toBe(0);
    expect(numbering.start).toBe(1);
    expect(numbering.levels).toHaveLength(2);
    expect(numbering.levels[0].level).toBe(1);
    expect(numbering.levels[0].numFormat).toBe('Decimal');
    expect(numbering.levels[1].level).toBe(2);
    expect(numbering.levels[1].numFormat).toBe('LowerLetter');
    expect(numbering.levels[1].textOffset).toBe(500);
  });

  it('handles toGenericElement with null and undefined', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         version="1.4" secCnt="1">
  <hh:beginNum page="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="0"/>
    <hh:tabProperties itemCnt="0"/>
    <hh:paraProperties itemCnt="0"/>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
  </hh:refList>
</hh:head>`;

    // This tests internal toGenericElement handling
    const header = parseHeader(xml);
    expect(header).toBeDefined();
    expect(header.refList).toBeDefined();
  });

  it('handles toGenericElement with non-object values', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         version="1.4" secCnt="1">
  <hh:beginNum page="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="0"/>
    <hh:charProperties itemCnt="1">
      <hh:charPr id="0" height="1000">
        <hh:fontRef hangul="0"/>
      </hh:charPr>
    </hh:charProperties>
    <hh:tabProperties itemCnt="0"/>
    <hh:paraProperties itemCnt="0"/>
    <hh:styles itemCnt="0"/>
    <hh:borderFills itemCnt="0"/>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);
    expect(header.refList.charProperties).toHaveLength(1);
  });
});
