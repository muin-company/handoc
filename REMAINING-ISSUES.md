# HanDoc Remaining Issues Analysis

*Generated: 2026-02-22 01:00*

## Current Status
- **Pass Rate:** 33.3% (6/18 files)
- **Grade Distribution:** A=0, B=6, C=3, D=7, F=2

## F-Grade Files (Critical)

### 1. [별표 1] 관리적 보호조치 (SSIM: 0.40)
- **Issue:** Page count mismatch (4→3)
- **Analysis:** HanDoc is missing 1 page
- **Root Cause:** Likely premature page merge or content overflow
- **Priority:** HIGH
- **Action:** Investigate table layout and page break logic

### 2. 제안요청서_25년 홈택스 (SSIM: 0.48)
- **Issue:** Major page count mismatch (298→202)
- **Analysis:** Missing 96 pages (32% fewer pages)
- **Root Cause:** Aggressive table compaction or missing content
- **Priority:** MEDIUM (complex document, may have multiple issues)
- **Action:** Run page-by-page comparison to identify where content disappears

## D-Grade Files (Need Improvement)

### Page Count Increases (Unexpected)
These files have MORE pages in HanDoc than reference:

1. **[별지 2] 취약점 점검** (SSIM: 0.51, 2→3 pages)
   - Issue: Adding 1 extra page
   - Likely: Unexpected page break in table

2. **[별표 6] 업무수행 요건** (SSIM: 0.56, 3→4 pages)
   - Issue: Adding 1 extra page
   - Likely: Table row breaking across pages unnecessarily

### Page Count Decreases
3. **230403 공공기관 데이터베이스** (SSIM: 0.60, 24→20)
   - Issue: 4 pages fewer
   - Likely: Over-compacted tables

4. **소프트웨어사업_계약** (SSIM: 0.60, 51→40)
   - Issue: 11 pages fewer (21% reduction)
   - Likely: Aggressive table compaction

### Correct Page Count (SSIM Issues)
5. **[별표 7] 인증평가** (SSIM: 0.65, 3→3)
   - Issue: Visual differences despite correct page count
   - Likely: Font sizing, spacing, or alignment issues

6. **붙임1. 2023년 ICT** (SSIM: 0.70, 1→1)
   - Issue: Minor visual differences
   - Almost C-grade (threshold: 0.70)
   - Quick win possible with minor adjustments

7. **취약점_점검_및_침투테스트_동의서_사업자명 2** (SSIM: 0.51, 2→3)
   - Same issue as [별지 2]

## C-Grade Files (Near Pass)

1. **[별지 1] 인증평가 업무 직원 보유** (SSIM: 0.77)
2. **붙임 1. 2025년 고성능 컴퓨팅** (SSIM: 0.78)
3. **[별지 7] 이의신청서 2** (SSIM: 0.80)

All have correct page counts. These are close to B-grade (0.85 threshold).
Minor font/spacing tweaks could promote them.

## Root Cause Patterns

### Pattern 1: Table Page Break Issues
**Affected Files:** [별지 2], [별표 6], 취약점_점검_사업자명 2

**Symptom:** Adding extra pages (2→3, 3→4)

**Hypothesis:** Our "nearTop" check (30pt threshold) may not be sufficient.
Tables with specific row heights are still triggering unnecessary page breaks.

**Fix:** Refine page break logic:
- Increase nearTop threshold from 30pt to 50pt?
- OR: Check if current row is first row of table → never break
- OR: Calculate available space more accurately before breaking

### Pattern 2: Table Over-Compaction
**Affected Files:** 230403 공공기관, 소프트웨어사업_계약, 별표 1

**Symptom:** Fewer pages than reference (20% fewer)

**Hypothesis:** Our optimized table row heights (padding: 4pt, lineHeight: 1.2)
may be too aggressive for some documents.

**Fix:** Dynamic row height based on content density:
- If table has many columns → reduce padding less
- If cells have long text → increase line spacing
- If cells have nested lists → add extra padding

### Pattern 3: Font/Spacing Differences
**Affected Files:** C-grade and low-D-grade files

**Symptom:** Correct page count but low SSIM (0.60-0.80)

**Hypothesis:** Font sizing or inter-paragraph spacing differs from Hancom.

**Fix:**
- Audit actual font metrics vs. Hancom output
- Fine-tune line height calculations
- Review paragraph margin handling

## Recommended Action Plan

### Phase 1: Fix Table Page Break Issues (Quick Win)
**Target:** Promote 3 D-grade files to C/B by fixing page count

**Tasks:**
1. Analyze [별지 2] table structure
2. Adjust page break logic (increase nearTop threshold to 50pt)
3. Add "first row of table" check to prevent immediate breaks
4. Test on [별지 2], [별표 6], 취약점_점검_사업자명 2
5. Expected: D→C/B (3 files)

**ETA:** 1-2 hours

### Phase 2: Fix Table Over-Compaction
**Target:** Fix [별표 1] F→D and improve 230403, 소프트웨어사업

**Tasks:**
1. Add content density detection
2. Implement dynamic padding/spacing
3. Test on affected files
4. Expected: F→D (1 file), D→C (2 files)

**ETA:** 2-3 hours

### Phase 3: Fine-Tune Font/Spacing
**Target:** Promote C-grade files to B

**Tasks:**
1. Compare actual vs. reference font metrics
2. Adjust line height multipliers
3. Review paragraph spacing
4. Expected: C→B (3 files)

**ETA:** 1-2 hours

## Success Metrics

### Short-term (Next 3 hours)
- **Pass Rate:** 33% → 50% (9/18 files)
- **Grade Distribution:** A=0, B=9, C=6, D=3, F=0

### Long-term (Next 24 hours)
- **Pass Rate:** 50% → 75% (13-14/18 files)
- **Grade Distribution:** A=2, B=11, C=3, D=2, F=0

## Next Immediate Action

**Execute Phase 1, Task 1:**
Increase nearTop threshold from 30pt to 50pt and test on [별지 2].

This is a surgical fix that should immediately improve 3 D-grade files.
