# HanDoc Progress Log

## 2026-02-22 03:00 - Balanced Settings Test (v6)

### Results
- **Pass Rate:** 27.8% (unchanged from v3)
- **Grade Distribution:** A=0 B=5 C=6 D=5 F=2
- **Comparison:** v3 (A=0 B=5 C=8 D=2 F=3) → v4 (A=0 B=5 C=6 D=5 F=2)

### Changes from v3 to v6
**Settings:**
- Cell padding: 2pt → 3pt (balanced)
- Line height: 1.0 → 1.1 (balanced)
- Paragraph margins: 0.3x → 0.4x (balanced)

**Improvements:**
- ✅ [별표 7]: F (SSIM 0.40, 3→2 pages) → D (SSIM 0.65, 3→3 pages)
  - Fixed over-compression issue from v5

**Regressions:**
- ❌ [별지 2]: C (SSIM 0.75, 2→3) → D (SSIM 0.51, 2→3)
- ❌ 취약점_점검_사업자명 2: C (SSIM 0.75, 2→3) → D (SSIM 0.51, 2→3)
  - Page break issue persists (still adding extra page)
  - Lower SSIM suggests visual quality degraded

### Key Finding
**The page break problem is NOT solved by spacing adjustments.**

The `isTableStart` exception (first 2 rows) is not preventing the unwanted page break in [별지 2]. This suggests:

1. The table may have only 1-2 rows total, so the exception doesn't help
2. OR: The page break is happening AFTER the first 2 rows
3. OR: The logic is not being triggered correctly

### Next Investigation
Need to analyze [별지 2] table structure:
- How many rows does it have?
- Which row is triggering the page break?
- Is the `isTableStart` condition being evaluated correctly?

## 2026-02-22 02:00 - Balance Recovery Attempt

### Commit: 98102c6
- Balanced table spacing (padding 3pt, lh 1.1)
- Goal: Fix over-compression from v5 while maintaining page count improvements

## 2026-02-22 01:00 - Table Start Detection

### Commit: aac376f  
- Added `isTableStart` check (first 2 rows exception)
- Increased nearTop threshold 30pt → 50pt
- Initial tests showed no improvement

## 2026-02-22 00:00 - Major Quality Leap

### Commit: e67c2df
- Achieved D → B grade leap
- Pass rate: 6.7% → 33.3% (5x improvement)
- F-grade files: 17 → 2 (85% reduction)
- B-grade files: 2 → 6 (3x increase)

### Previous Optimizations
- Commit 9bcdf54: Table page break prevention logic
- Commit 1d3232b: Row height optimization (padding 8→4pt, lh 1.6→1.2)
- Commit 148f0f3: Batch PDF generation script

## Best Results So Far

**Best Pass Rate:** 33.3% (comparison-v2, before aggressive compression attempts)
- Settings: padding 4pt, lh 1.2, margins 0.5x

**Current Pass Rate:** 27.8% (comparison-v4, balanced settings)
- Settings: padding 3pt, lh 1.1, margins 0.4x

## Next Steps

### Immediate (03:00)
1. Inspect [별지 2] HWPX structure to understand table layout
2. Debug why isTableStart exception isn't working
3. Consider alternative page break strategies

### Strategic
- May need to revert to v2 settings (padding 4pt, lh 1.2) for better overall quality
- Then solve page break issue separately without touching spacing
- Trade-off: Accept 3 pages for [별지 2] if visual quality is better?
