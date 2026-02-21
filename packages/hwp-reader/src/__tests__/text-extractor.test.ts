/**
 * Additional tests for text-extractor.ts to improve coverage
 */

import { describe, it, expect } from 'vitest';
import { extractTextFromHwp, extractRichContent } from '../text-extractor.js';
import { createTestHwp } from './create-test-hwp.js';

describe('text-extractor - extractTextFromHwp', () => {
  it('should extract text from simple paragraph', () => {
    const hwpBuffer = createTestHwp({ paragraphs: ['안녕하세요'] });
    const text = extractTextFromHwp(hwpBuffer);
    expect(text).toContain('안녕하세요');
  });

  it('should handle empty paragraphs (skip zero-length text)', () => {
    const hwpBuffer = createTestHwp({ paragraphs: ['', 'Hello', ''] });
    const text = extractTextFromHwp(hwpBuffer);
    // Should only include non-empty paragraphs
    expect(text.trim()).toBe('Hello');
  });

  it('should extract text from multiple sections', () => {
    const hwpBuffer = createTestHwp({
      paragraphs: ['첫 번째'],
      extraSections: [['두 번째'], ['세 번째']],
    });
    const text = extractTextFromHwp(hwpBuffer);
    expect(text).toContain('첫 번째');
    expect(text).toContain('두 번째');
    expect(text).toContain('세 번째');
  });

  it('should handle control characters in text', () => {
    // createTestHwp should handle special characters if needed
    const hwpBuffer = createTestHwp({ paragraphs: ['Line1\nLine2'] });
    const text = extractTextFromHwp(hwpBuffer);
    expect(text).toContain('Line1');
    expect(text).toContain('Line2');
  });
});

describe('text-extractor - extractRichContent', () => {
  it('should extract rich content with docInfo and sections', () => {
    const hwpBuffer = createTestHwp({ paragraphs: ['테스트 문서'] });
    const result = extractRichContent(hwpBuffer);
    
    expect(result.text).toContain('테스트 문서');
    expect(result.docInfo).toBeDefined();
    expect(result.docInfo.fontNames).toBeDefined();
    expect(result.docInfo.charShapes).toBeDefined();
    expect(result.docInfo.paraShapes).toBeDefined();
    expect(result.sections).toBeDefined();
    expect(result.sections.length).toBeGreaterThanOrEqual(1);
  });

  it('should extract multiple sections with full structure', () => {
    const hwpBuffer = createTestHwp({
      paragraphs: ['첫 단락'],
      extraSections: [['두 번째 단락']],
    });
    const result = extractRichContent(hwpBuffer);
    
    expect(result.sections.length).toBe(2);
    expect(result.sections[0].paragraphs.length).toBeGreaterThan(0);
    expect(result.sections[1].paragraphs.length).toBeGreaterThan(0);
  });

  it('should extract paragraphs with char shapes', () => {
    const hwpBuffer = createTestHwp({ paragraphs: ['Formatted text'] });
    const result = extractRichContent(hwpBuffer);
    
    const firstSection = result.sections[0];
    expect(firstSection.paragraphs.length).toBeGreaterThan(0);
    const firstPara = firstSection.paragraphs[0];
    expect(firstPara).toHaveProperty('text');
    expect(firstPara).toHaveProperty('charShapes');
    expect(firstPara).toHaveProperty('paraShapeId');
    expect(firstPara).toHaveProperty('level');
  });

  it('should handle empty sections gracefully', () => {
    const hwpBuffer = createTestHwp({ paragraphs: [''] });
    const result = extractRichContent(hwpBuffer);
    
    expect(result.text).toBe('');
    expect(result.sections).toBeDefined();
  });

  it('should parse DocInfo fonts and styles', () => {
    const hwpBuffer = createTestHwp({ paragraphs: ['텍스트'] });
    const result = extractRichContent(hwpBuffer);
    
    // Should have font names from DocInfo
    expect(result.docInfo.fontNames).toBeInstanceOf(Array);
    expect(result.docInfo.charShapes).toBeInstanceOf(Array);
    expect(result.docInfo.paraShapes).toBeInstanceOf(Array);
  });

  it('should extract tables if present', () => {
    const hwpBuffer = createTestHwp({ paragraphs: ['문서'] });
    const result = extractRichContent(hwpBuffer);
    
    const firstSection = result.sections[0];
    expect(firstSection).toHaveProperty('tables');
    expect(firstSection).toHaveProperty('controls');
    expect(firstSection.tables).toBeInstanceOf(Array);
    expect(firstSection.controls).toBeInstanceOf(Array);
  });

  it('should handle compressed and uncompressed HWP', () => {
    const compressedBuffer = createTestHwp({ compressed: true, paragraphs: ['압축'] });
    const uncompressedBuffer = createTestHwp({ compressed: false, paragraphs: ['압축'] });
    
    const compressedResult = extractRichContent(compressedBuffer);
    const uncompressedResult = extractRichContent(uncompressedBuffer);
    
    expect(compressedResult.text).toContain('압축');
    expect(uncompressedResult.text).toContain('압축');
  });

  it('should join multiple paragraph texts with newlines', () => {
    const hwpBuffer = createTestHwp({
      paragraphs: ['단락1', '단락2', '단락3'],
    });
    const result = extractRichContent(hwpBuffer);
    
    expect(result.text).toContain('단락1');
    expect(result.text).toContain('단락2');
    expect(result.text).toContain('단락3');
    
    // Should be joined with newlines
    const lines = result.text.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });
});
