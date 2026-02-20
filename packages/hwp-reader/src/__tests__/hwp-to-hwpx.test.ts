import { describe, it, expect } from 'vitest';
import { convertHwpToHwpx } from '../hwp-to-hwpx.js';
import { createTestHwp } from './create-test-hwp.js';
import { HanDoc } from '@handoc/hwpx-parser';

describe('convertHwpToHwpx', () => {
  it('should convert a simple HWP to HWPX with text preserved', async () => {
    const paragraphs = ['안녕하세요 한글 문서입니다.', '두 번째 문단입니다.'];
    const hwp = createTestHwp({ paragraphs });

    const hwpxBytes = convertHwpToHwpx(hwp);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);
    expect(hwpxBytes.length).toBeGreaterThan(0);

    // Verify text via HanDoc
    const doc = await HanDoc.open(hwpxBytes);
    const text = doc.extractText();
    for (const p of paragraphs) {
      expect(text).toContain(p);
    }
  });

  it('should handle an empty HWP (no paragraphs)', async () => {
    const hwp = createTestHwp({ paragraphs: [] });

    const hwpxBytes = convertHwpToHwpx(hwp);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);

    const doc = await HanDoc.open(hwpxBytes);
    const text = doc.extractText().trim();
    expect(text).toBe('');
  });

  it('should convert multi-section HWP to multi-section HWPX', async () => {
    const section0 = ['섹션 1 첫째 문단', '섹션 1 둘째 문단'];
    const section1 = ['섹션 2 첫째 문단'];
    const section2 = ['섹션 3 첫째 문단', '섹션 3 둘째 문단', '섹션 3 셋째 문단'];

    const hwp = createTestHwp({
      paragraphs: section0,
      extraSections: [section1, section2],
    });

    const hwpxBytes = convertHwpToHwpx(hwp);
    const doc = await HanDoc.open(hwpxBytes);

    // Verify all section texts present
    const text = doc.extractText();
    for (const p of [...section0, ...section1, ...section2]) {
      expect(text).toContain(p);
    }

    // Verify section count
    const sections = doc.sections;
    expect(sections.length).toBe(3);
  });

  it('should handle uncompressed HWP', async () => {
    const paragraphs = ['비압축 문서입니다.'];
    const hwp = createTestHwp({ compressed: false, paragraphs });

    const hwpxBytes = convertHwpToHwpx(hwp);
    const doc = await HanDoc.open(hwpxBytes);
    expect(doc.extractText()).toContain('비압축 문서입니다.');
  });

  it('should preserve font and style information from DocInfo', async () => {
    const paragraphs = ['스타일 있는 문서입니다.', '두 번째 문단.'];
    const hwp = createTestHwp({ paragraphs });

    const hwpxBytes = convertHwpToHwpx(hwp);
    expect(hwpxBytes).toBeInstanceOf(Uint8Array);

    const doc = await HanDoc.open(hwpxBytes);
    
    // Verify font faces are extracted
    expect(doc.header.refList.fontFaces.length).toBeGreaterThan(0);
    
    // Verify char properties exist
    expect(doc.header.refList.charProperties.length).toBeGreaterThan(0);
    
    // Verify para properties exist
    expect(doc.header.refList.paraProperties.length).toBeGreaterThan(0);
    
    // Text should still be preserved
    const text = doc.extractText();
    for (const p of paragraphs) {
      expect(text).toContain(p);
    }
  });
});
