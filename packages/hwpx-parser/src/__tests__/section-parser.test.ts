import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSection, extractText } from '../section-parser';

const fixtureDir = join(__dirname, '../../../../fixtures/xml-dumps');

function loadFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf-8');
}

describe('parseSection', () => {
  it('parses simple-text fixture', () => {
    const xml = loadFixture('simple-text-section0.xml');
    const section = parseSection(xml);
    expect(section.paragraphs.length).toBe(4);
    const texts = extractText(section).filter(t => t.length > 0);
    expect(texts).toEqual([
      '첫 번째 단락입니다.',
      '두 번째 단락입니다.',
      '세 번째 단락입니다.',
    ]);
  });

  it('parses empty fixture', () => {
    const xml = loadFixture('empty-section0.xml');
    const section = parseSection(xml);
    expect(section.paragraphs.length).toBeGreaterThanOrEqual(1);
    const texts = extractText(section).filter(t => t.length > 0);
    expect(texts).toEqual([]);
  });

  it('parses styled-text fixture', () => {
    const xml = loadFixture('styled-text-section0.xml');
    const section = parseSection(xml);
    const texts = extractText(section).filter(t => t.length > 0);
    expect(texts).toEqual([
      '일반 텍스트입니다.',
      '굵은 텍스트입니다.',
      '기울임 텍스트입니다.',
    ]);
  });

  it('parses table-basic fixture', () => {
    const xml = loadFixture('table-basic-section0.xml');
    const section = parseSection(xml);
    expect(section.paragraphs.length).toBe(3);
    const texts = extractText(section).filter(t => t.length > 0);
    expect(texts).toContain('표 예제:');
    // Third paragraph should have a table RunChild
    const tablePara = section.paragraphs[2];
    const tableChild = tablePara.runs[0]?.children.find(c => c.type === 'table');
    expect(tableChild).toBeDefined();
    expect(tableChild!.type).toBe('table');
  });

  it('parses multi-section fixture', () => {
    const xml = loadFixture('multi-section-section0.xml');
    const section = parseSection(xml);
    const texts = extractText(section).filter(t => t.length > 0);
    expect(texts).toEqual([
      '첫 번째 섹션의 내용입니다.',
      '이 섹션은 페이지 레이아웃을 포함합니다.',
    ]);
  });

  it('first paragraph has secPr and ctrl RunChildren', () => {
    const xml = loadFixture('simple-text-section0.xml');
    const section = parseSection(xml);
    const firstPara = section.paragraphs[0];
    const firstRun = firstPara.runs[0];
    expect(firstRun.children.some(c => c.type === 'secPr')).toBe(true);
    expect(firstRun.children.some(c => c.type === 'ctrl')).toBe(true);
  });

  it('parses lineSegArray', () => {
    const xml = loadFixture('simple-text-section0.xml');
    const section = parseSection(xml);
    const firstPara = section.paragraphs[0];
    expect(firstPara.lineSegArray.length).toBe(1);
    expect(firstPara.lineSegArray[0].vertsize).toBe(1000);
  });
});
