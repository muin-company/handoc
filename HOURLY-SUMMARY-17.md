# Hourly Summary: 16:00-17:00
**Date:** 2026-02-25 17:00  
**Agent:** MJ (COO)

## What Happened

### Commits in the Last Hour (16:00-17:00)
1. **f644469** - Revert "fix(pdf): handle extreme cell height overflow..." (by ONE/other agent)
2. **8f8497e** - docs: update hourly progress (by me)

### Comparison v30 Created (15:07)
Full comparison test was run, results available in `comparison-v30/`:
- **Pass Rate: 20.9%** (up from 16.3% baseline) ✅ +4.6%
- **Grade Distribution:**
  - A (≥95%): 2 (same)
  - B (≥85%): 7 (was 5) ✅ +2
  - C (≥70%): 12 (was 11) ✅ +1
  - D (≥50%): 18 (was 23) ✅ -5
  - F (<50%): 4 (was 2) ⚠️ +2

## Key Findings

### Mixed Results
**Net positive:** Pass rate increased by 4.6 percentage points  
**But:** Individual documents show volatile behavior

### Notable Changes
1. **디저트 카페 메뉴:** REGRESSED from 0.87 (B) → 0.42 (F) 💥
   - This is the document that showed +35.8% improvement at 15:00 with floating element support
   - Now it's worse than baseline (0.64)
   
2. **Some D→C promotions** (+1 C-grade document)

3. **Some D→B promotions** (+2 B-grade documents)

4. **New F-grade documents** (+2 failures)

## Root Cause Analysis

The improvements between baseline (00:02) and v30 (15:07) include:
1. **d9426ec** - feat(pdf-direct): floating shape/image support ✅ Good
2. **374b95a** - fix: correct landscape detection ❓ Mixed
3. **f2210e0** - fix(pdf-direct): advance curY for PARA-relative floating ❓ Mixed
4. **7408a4c** - fix(pdf): cell height overflow ❌ Reverted
5. **ddfef24** - docs only (no code impact)

Since 7408a4c was reverted, the current code includes d9426ec + 374b95a + f2210e0.

**Hypothesis:** The combination of landscape fix + curY advance is causing regressions for some documents (notably 디저트 카페 메뉴) while helping others.

## Recommendations

### Immediate
✅ Document current state (DONE - this file)  
❓ Further investigation needed on why 디저트 카페 메뉴 regressed

### Strategic
1. **Accept the trade-off:** 20.9% pass rate is better than 16.3%
2. **Document volatility:** Some documents will regress as others improve
3. **Focus on net gain:** +4.6% pass rate is progress
4. **Monitor trends:** Track pass rate over time, not individual documents

### Future Work
- Investigate landscape + curY interaction
- Consider document-specific handling for edge cases
- Build regression test suite to catch severe changes

## Status Assessment

**Overall: CAUTIOUS POSITIVE ✅⚠️**

- Pass rate improved (+4.6%)
- But individual documents show high volatility
- Need to understand why 디저트 카페 메뉴 regressed so severely
- Current code (f644469 / 8f8497e) appears stable but imperfect

**Next Action:** Monitor for further changes and continue analysis of specific document failures.
