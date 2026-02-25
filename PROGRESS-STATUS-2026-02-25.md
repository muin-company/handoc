# HanDoc Progress Status
**Date:** 2026-02-25 13:00  
**Session:** Autonomous Operation Day 1

## 📊 Current Metrics

### Overall Performance
- **Total Documents:** 43
- **Pass Rate (A+B):** 16.3% (7 documents)
- **Grade Distribution:**
  - A (≥95%): 2 (4.7%)
  - B (≥85%): 5 (11.6%)
  - C (≥70%): 11 (25.6%)
  - D (≥50%): 23 (53.5%)
  - F (<50%): 2 (4.7%)

### Last Comparison Baseline
- **Timestamp:** 2026-02-25 00:02
- **Reference:** `comparison-midnight/`
- **Status:** Current code matches this baseline (verified)

---

## 🚧 What Was Attempted (04:00-12:00)

### Failed Batch Optimization
Made 6 sequential changes to `html-renderer.ts`:
1. Border width precision constants
2. Vertical alignment (th: middle)
3. Color palette precision
4. Table cell spacing increase
5. CellMargin scaling (20%→25%)
6. Body line-height increase (1.3→1.35)

**Expected:** +6-12% SSIM improvement  
**Actual:** -7.4% regression (SSIM 0.653 → 0.605)  
**Resolution:** Full revert in commit `da2c18c`

### Root Cause
- **Spacing inflation:** Multiple spacing increases compounded
- **Document-specific needs:** Some docs need tight spacing, others loose
- **Lack of validation:** 6 changes without intermediate testing

### Lessons Learned
1. **Never batch >3 changes** without validation
2. **Test early, test often** - especially for near-miss documents
3. **Spacing is document-specific** - global tuning doesn't work
4. **Even individual "safe" changes** can cause regressions

---

## 📋 Page Count Analysis

### Documents with Exact Page Match (20 docs)
These have structural fidelity even if SSIM is low:
- mot (2/2) - C grade
- [별표 6] 업무수행 요건 (3/3) - C grade
- [별지 1] 인증평가 업무 (1/1) - C grade
- multipara (1/1) - D grade
- 붙임1 ICT표준화 (1/1) - D grade
- [별표 1] 관리적 보호조치 (4/4) - D grade

### Documents with Page Overflow (12 docs)
Generating extra pages (content too loose):
- **역곡중 교수학습** (362→532, +47%) - F grade ⚠️ CRITICAL
- 2. 제안요청서 홈택스 (298→255, -14%) - D grade
- test_re (15→18, +20%) - D grade
- 2015년 재난안전 (75→64, -15%) - D grade

### Documents with Page Underflow (11 docs)
Missing pages (content too compressed):
- **졸업앨범 촬영 계획** (3→2, -33%) - F grade ⚠️ CRITICAL
- 디저트 카페 메뉴 (5→1, -80%) - D grade
- 취약점 점검 동의서 (2→1, -50%) - D grade
- (새양식) 동아리 활동 (1→2, +100%) - D grade

---

## 🎯 Priority Analysis

### Tier 1: F-Grade Blockers (2 docs, 4.7%)
**Critical for credibility**
1. **역곡중 교수학습** (0.47, 362→532p)
   - Page overflow +47%
   - Likely: table row height issues, font wrapping
   - High complexity, high risk
   
2. **졸업앨범 촬영 계획** (0.44, 3→2p)
   - Page underflow -33%
   - Missing content or excessive compression
   - Lower complexity, medium risk

**Recommendation:** Start with #2 (easier win)

### Tier 2: Near-Miss D→C (4 docs, gap <0.05)
**Quick wins if we can find the right fix**
1. 붙임1 고성능 컴퓨팅 (0.69, 3→4p) - Gap: 0.01
2. [별표 7] 인증평가 생략 (0.67, 3→3p) - Gap: 0.03
3. 2. 제안요청서 홈택스 (0.66, 298→255p) - Gap: 0.04
4. 230403 DB 표준화 (0.65, 24→22p) - Gap: 0.05

**Observation:** All have page count mismatches except #2  
**Hypothesis:** Page break handling is the bottleneck

### Tier 3: C→B Promotion (11 docs)
**Medium effort, medium impact**
- Need +0.15 SSIM average
- Require structural improvements, not just spacing
- Lower priority for now

---

## 🔍 Root Cause Patterns

### Pattern 1: Page Count Mismatch = SSIM Penalty
Documents with wrong page counts automatically score lower:
- Extra blank pages hurt SSIM (0.0 score per extra page)
- Missing content hurts SSIM (unmatched reference pages)
- **Solution:** Fix page break logic before optimizing spacing

### Pattern 2: Table-Heavy Documents Struggle
Most D-grade docs have complex tables:
- Merged cells, nested tables
- Variable row heights
- Cell padding/margin complexity
- **Current approach:** 20% cellMargin scale is too aggressive for some
- **Better approach:** Detect table complexity, apply profiles

### Pattern 3: Small Documents (<5 pages) Are Fragile
Small changes have big relative impact:
- 1-page docs: Any change = 100% difference
- 3-page docs: 1 missing page = 33% penalty
- **Strategy:** Handle small docs with tighter tolerances

---

## 🛠️ Safe Optimization Vectors

### ✅ Low Risk (Try These First)
1. **Page break detection**
   - Analyze where we insert breaks vs. reference
   - Add missing page-break-before/after rules
   - Expected: +5-10% for page-mismatch docs

2. **Table row height caps**
   - Current: unlimited max-height
   - Try: Respect declared row heights more strictly
   - Expected: Reduce page overflow

3. **Font fallback order**
   - Current: Multiple fallbacks per font
   - Optimize: Reduce font variation, improve consistency
   - Expected: +1-2% SSIM (small but safe)

### ⚠️ Medium Risk (Test Carefully)
1. **Document type detection**
   - Classify docs (government/education/business)
   - Apply spacing profiles per type
   - Requires: Validation per profile

2. **Image size precision**
   - Check if image scaling is accurate
   - Verify aspect ratios match HWP
   - May affect layout

### ❌ High Risk (Avoid for Now)
1. **Global spacing changes** - PROVEN TO FAIL
2. **Line-height adjustments** - Causes compounding errors
3. **Cell padding changes** - Document-specific needs

---

## 📈 Recommended Next Steps

### Immediate (Today)
1. ✅ Create this status document (DONE)
2. Analyze page break handling in code
3. Identify missing page-break rules
4. Test on 1-2 documents with page mismatch

### Short-term (This Week)
1. Fix page break logic (high impact, medium risk)
2. Implement table row height caps (reduce overflow)
3. Test on F-grade document #2 (졸업앨범)
4. Document results, iterate

### Medium-term (Next Week)
1. Document type classification system
2. Spacing profiles per document type
3. Automated regression testing
4. Continuous improvement loop

---

## 🎓 Key Learnings

### What Works
- Small, incremental changes
- Test each change independently
- Focus on structural fixes over cosmetic ones
- Measure twice, commit once

### What Doesn't Work
- Batch optimizations without validation
- Global spacing adjustments
- "Looks right" without SSIM verification
- Assuming one-size-fits-all solutions

### Philosophy
> "16.3% → 50% is a marathon, not a sprint.  
> Make 1-2% improvements consistently.  
> Avoid 10% swings that backfire."

---

## 📊 Success Criteria

### Minimum Viable (MVP)
- **Target:** 30% pass rate (A+B)
- **Timeline:** 1 week
- **Strategy:** Fix page breaks + F-grade docs

### Good
- **Target:** 50% pass rate (A+B)
- **Timeline:** 2 weeks
- **Strategy:** + D→C near-miss promotion

### Excellent
- **Target:** 70% pass rate (A+B)
- **Timeline:** 1 month
- **Strategy:** + C→B systematic improvements

---

## 📝 Next Autonomous Action

**For 14:00 report:**
- Analyze page break handling in html-renderer.ts
- Document current page-break CSS rules
- Identify missing or incorrect rules
- Create targeted fix for 1 document
- Test and measure

**Rationale:** Page breaks are structural, not spacing-based.  
Lower risk than previous attempts. High impact if successful.
