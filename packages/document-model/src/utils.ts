import { HWPUNIT_PER_INCH } from './constants';

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

/** Convert HwpUnit (1/7200 inch) to millimeters */
export function hwpUnitToMm(hu: number): number {
  return (hu / HWPUNIT_PER_INCH) * MM_PER_INCH;
}

/** Convert millimeters to HwpUnit */
export function mmToHwpUnit(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * HWPUNIT_PER_INCH);
}

/** Convert HwpUnit to points (1/72 inch) */
export function hwpUnitToPt(hu: number): number {
  return (hu / HWPUNIT_PER_INCH) * PT_PER_INCH;
}

/** Convert font height (1/100 pt) to pt */
export function fontHeightToPt(height: number): number {
  return height / 100;
}
