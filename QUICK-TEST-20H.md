# Quick Comparison Test Results - 20:00
**Date:** 2026-02-25 20:01  
**Test:** 5 representative documents  
**Current Code:** 33fb6ed (v32 peak state reset)

## Results Summary

| Document | v30 Baseline | Current | Change | Status |
|----------|--------------|---------|--------|--------|
| mot | 0.70 (C) | 0.49 (F) | -30.0% | ⚠️ SEVERE REGRESSION |
| 디저트 카페 메뉴 | 0.42 (F) | 0.67 (D) | +59.5% | ✅ Improved |
| 230403 DB표준화 | 0.65 (D) | 0.62 (D) | -4.6% | ➡️ Minor regression |
| SimplePicture | 0.97 (A) | 0.97 (A) | 0.0% | ✅ Stable |
| ai-writing | 0.74 (C) | 0.68 (D) | -8.1% | ⚠️ Regression |

## Analysis

### Critical Issue: mot Document
**Problem:** Dropped from C-grade (0.70) to F-grade (0.49), pages 2→1  
**Impact:** This is the same severe regression we saw earlier today  
**Root Cause:** Unknown - supposedly v32 peak state but showing poor results

### Mixed Bag
**Improved:** 디저트 카페 메뉴 (F→D)  
**Regressed:** mot (C→F), ai-writing (C→D)  
**Stable:** SimplePicture (A)  
**Slightly down:** 230403 (D)

### Overall Assessment
**2 improved, 2 regressed, 1 stable** = Net negative trend

## Comparison with v30 Baseline

**v30 (15:07):** 20.9% pass rate (A+B)  
**Current estimate:** Likely **lower** than 20.9%

**Evidence:**
- 2 of 5 test documents regressed
- mot showing F-grade (severe)
- ai-writing dropped from C to D
- Only 1 of 5 passed (SimplePicture at A-grade)

**Estimated current pass rate:** ~15-18% (worse than v30)

## What Went Wrong?

### Hypothesis 1: v32 Peak State is Not Actually Peak
The commit 33fb6ed claims to reset to v32 peak (c0ce2b9), but results don't match expected performance.

### Hypothesis 2: v32 Had Problems We Didn't Know About
v30 might have been the actual peak, not v32.

### Hypothesis 3: Incomplete Reset
Some packages or dependencies may not have been fully reset.

### Hypothesis 4: Build/Cache Issues
Build artifacts or caches may be stale.

## Immediate Actions Needed

### 1. Verify Build State
```bash
cd ~/handoc
pnpm clean  # If available
rm -rf node_modules packages/*/dist
pnpm install
pnpm build
```

### 2. Compare with Known Good State
Git bisect or checkout known working commit (v30 baseline?)

### 3. Full Comparison Test
Run complete 43-document test to confirm actual pass rate.

### 4. Rollback Decision
Consider rolling back to v30 state if current state is confirmed worse.

## Recommendation

**URGENT: Do NOT continue development on this codebase.**

Current state appears to be **worse than v30 baseline** despite claiming to be v32 peak.

**Next steps:**
1. Clean build and retest
2. If still failing, rollback to v30
3. Establish working baseline before any new changes
4. Implement strict change control: ONE change at a time + immediate test

## Status

**Pass Rate:** Unknown (estimated 15-18%, down from 20.9%)  
**Severity:** HIGH - Major regressions detected  
**Recommended Action:** ROLLBACK and stabilize
