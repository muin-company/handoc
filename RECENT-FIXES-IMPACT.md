# Recent Fixes Impact Analysis (15:00-16:00)
**Date:** 2026-02-25 16:00

## Commits Analyzed

4 commits made between 15:00-16:00:

1. **374b95a** - fix: correct landscape detection (NARROWLY=landscape, WIDELY=portrait)
2. **f2210e0** - fix(pdf-direct): advance curY for PARA-relative floating elements  
3. **ddfef24** - docs(pdf-direct): document calcLineHeight em-ratio analysis
4. **7408a4c** - fix(pdf): handle extreme cell height overflow in auto-expanding table cells

## Test Document: 230403 공공기관의 데이터베이스 표준화 지침 개정 전문

This is a near-miss D-grade document (baseline SSIM 0.653, gap to C-grade: 0.047).

### Results
**Baseline (00:02):** SSIM 0.6530 (D-grade), 22 pages  
**After fixes (16:00):** SSIM 0.4118 (F-grade), 21→15 pages  
**Change:** -36.9% SSIM (SEVERE REGRESSION) ⚠️  
**Page change:** 22→15 pages (-32% page underflow)

**Analysis:** The cell height overflow fix may be TOO aggressive, causing content to compress excessively. Tables that should span multiple pages are now fitting on fewer pages, but with poor visual quality.

## Additional Test: mot

**After floating (15:00):** SSIM 0.6958 (D-grade), 2→2 pages  
**After fixes (16:00):** SSIM 0.2429 (F-grade), 2→1 page  
**Change:** -65.1% SSIM (CATASTROPHIC REGRESSION) ⚠️⚠️⚠️

## Root Cause Analysis

The **cell height overflow fix (7408a4c)** appears to be overly aggressive:
- Causing severe content compression
- Reducing page counts dramatically
- Collapsing multi-page layouts into single pages

This is similar to the earlier failed spacing optimization attempts, but worse.

## Impact Summary

**Tested documents:**
1. 230403 DB 표준화: -36.9% SSIM (D→F)
2. mot: -65.1% SSIM (D→F)

Both show:
- Severe SSIM regression
- Page underflow (content compressed)
- Grade degradation to F

**Pattern:** Table-heavy and floating-element documents both affected.

## Recommendations

### Immediate (URGENT)
1. **REVERT commit 7408a4c** (cell height overflow fix)
2. Test if 374b95a/f2210e0 alone are safe
3. Isolate which commit caused the regression

### Strategic
1. Cell height handling needs document-specific thresholds
2. Test fixes on multiple documents BEFORE merging
3. Maintain baseline comparison before/after each change
4. Consider feature flags for experimental fixes
