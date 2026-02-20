import { describe, it, expect } from 'vitest';
import { hwpUnitToMm, mmToHwpUnit, hwpUnitToPt, fontHeightToPt } from '../utils';

describe('hwpUnitToMm', () => {
  it('converts A4 width correctly', () => {
    const mm = hwpUnitToMm(59528);
    expect(mm).toBeCloseTo(210, 0);
  });

  it('converts A4 height correctly', () => {
    const mm = hwpUnitToMm(84186);
    expect(mm).toBeCloseTo(297, 0);
  });

  it('returns 0 for 0', () => {
    expect(hwpUnitToMm(0)).toBe(0);
  });
});

describe('mmToHwpUnit', () => {
  it('converts 210mm to ~59528 HU', () => {
    const hu = mmToHwpUnit(210);
    expect(Math.abs(hu - 59528)).toBeLessThan(10);
  });

  it('round-trips with hwpUnitToMm', () => {
    const original = 8504;
    const mm = hwpUnitToMm(original);
    const back = mmToHwpUnit(mm);
    expect(Math.abs(back - original)).toBeLessThanOrEqual(1);
  });
});

describe('hwpUnitToPt', () => {
  it('converts 7200 HU to 72pt (1 inch)', () => {
    expect(hwpUnitToPt(7200)).toBe(72);
  });
});

describe('fontHeightToPt', () => {
  it('converts height 1000 to 10pt', () => {
    expect(fontHeightToPt(1000)).toBe(10);
  });

  it('converts height 1600 to 16pt', () => {
    expect(fontHeightToPt(1600)).toBe(16);
  });
});
