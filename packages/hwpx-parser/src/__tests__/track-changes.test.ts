import { describe, it, expect } from 'vitest';
import { parseHeader } from '../header-parser';
import { parseRun } from '../paragraph-parser';

describe('Track Changes parsing', () => {
  it('parses trackChanges and trackChangeAuthors from header XML', () => {
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
    <hh:trackChanges itemCnt="2">
      <hh:trackChange type="Insert" date="2023-02-07T10:21:00Z" authorID="1" hide="0" id="1"/>
      <hh:trackChange type="Delete" date="2023-02-07T10:21:00Z" authorID="1" hide="0" id="2"/>
    </hh:trackChanges>
    <hh:trackChangeAuthors itemCnt="1">
      <hh:trackChangeAuthor name="testuser" mark="1" id="0"/>
    </hh:trackChangeAuthors>
  </hh:refList>
</hh:head>`;

    const header = parseHeader(xml);

    expect(header.trackChanges).toBeDefined();
    expect(header.trackChanges!.length).toBe(2);
    expect(header.trackChanges![0]).toEqual({
      id: 1,
      type: 'Insert',
      date: '2023-02-07T10:21:00Z',
      authorID: 1,
      hide: false,
    });
    expect(header.trackChanges![1].type).toBe('Delete');

    expect(header.trackChangeAuthors).toBeDefined();
    expect(header.trackChangeAuthors!.length).toBe(1);
    expect(header.trackChangeAuthors![0]).toEqual({
      id: 0,
      name: 'testuser',
      mark: 1,
    });
  });

  it('parses insertBegin/deleteBegin marks with Id/TcId', () => {
    const run = parseRun({
      '@_charPrIDRef': '0',
      'hp:t': {
        '#text': '변경',
        'hp:deleteBegin': { '@_Id': '2', '@_TcId': '2' },
        'hp:insertEnd': { '@_Id': '1', '@_TcId': '1', '@_paraend': '0' },
      },
    });

    // Find trackChange children
    const tcChildren = run.children.filter(c => c.type === 'trackChange');
    expect(tcChildren.length).toBeGreaterThanOrEqual(1);

    const deleteMark = tcChildren.find(c => c.type === 'trackChange' && c.mark === 'deleteBegin');
    expect(deleteMark).toBeDefined();
    if (deleteMark && deleteMark.type === 'trackChange') {
      expect(deleteMark.id).toBe(2);
      expect(deleteMark.tcId).toBe(2);
    }
  });
});
