# HanDoc Improvement Lessons Learned

## 2026-02-25: Failed Batch Optimization (04:00-10:00)

### What Happened
Made 6 sequential improvements to html-renderer.ts over 6 hours (cron job):
1. Border width precision (HWP_BORDER constants)
2. Vertical alignment (th: middle)
3. Color palette (#1a1a1a, #efefef)
4. Table cell spacing (padding 0.5px→1px, line-height 1.05→1.08)
5. CellMargin scaling (20%→25%)
6. Body line-height (1.3→1.35)

**Expected:** +0.06-0.12 SSIM cumulative improvement  
**Actual:** -7.4% regression (SSIM 0.653 → 0.605)

### Root Cause
**Spacing inflation:** Multiple spacing increases compounded:
- Cell padding: 0.5px→1px
- Cell line-height: 1.05→1.08
- Body line-height: 1.3→1.35
- CellMargin scale: 20%→25%

This caused:
- Page underflow (22→18 pages, content compressed)
- Visual mismatch (layout too loose)
- Lower SSIM despite "better" spacing

### Key Insight
**HWP documents vary widely in optimal spacing.**  
Some documents need tight spacing (government forms), others need loose spacing (presentations).

**One-size-fits-all tuning doesn't work.**

### Violation of HEARTBEAT.md
HEARTBEAT.md explicitly warns against this:
> **자율 운영 원칙:**  
> COO가 더 자율적이어야 해. 하지만 **실패해도 괜찮아**.  
> **허락 기다리다 아무것도 안 하는 것보다 낫다.**

But also:
> **Git push 자주!** 작업 완료마다, 최소 1시간에 1번.

**Problem:** Cron job made 6 commits without validation between them.  
**Should have:** Run comparison test after 2-3 changes, not after 6.

---

## Lessons for Future

### 1. Test Early, Test Often
- **Never batch >3 changes** without validation
- Run comparison test after each significant change
- Use focused tests (near-miss documents) for quick feedback

### 2. Document-Specific Optimization
Instead of global tuning, consider:
```typescript
const SPACING_PROFILES = {
  'tight': { cellPadding: '0.5px 1px', lineHeight: 1.05, cellMarginScale: 0.20 },
  'normal': { cellPadding: '1px 2px', lineHeight: 1.08, cellMarginScale: 0.25 },
  'loose': { cellPadding: '2px 3px', lineHeight: 1.15, cellMarginScale: 0.30 },
};

// Auto-detect or allow manual override
const profile = detectSpacingProfile(doc) || 'normal';
```

### 3. Regression Detection
Implement automatic regression detection:
- Store baseline SSIM scores for key documents
- Alert if any improvement causes >5% regression on any document
- Trade-offs are OK, but need visibility

### 4. Incremental Improvement Strategy
**Good:**
1. Change one thing
2. Test on 4-5 near-miss documents
3. If improvement >0, commit
4. If regression, analyze why
5. Repeat

**Bad:**
1. Change 6 things
2. Hope they all work together
3. Discover regression 6 hours later
4. Revert everything, lose progress

---

## What We Learned About HWP Rendering

### Border Width
- HWP uses 0.4pt (thin), 0.5pt (normal), 1.0pt (thick)
- Our approximation was close, minimal impact

### Vertical Alignment
- `th { vertical-align: middle }` is correct for HWP
- `td { vertical-align: top }` is correct
- This was a good change, should keep

### Color Palette
- HWP border: #000 (pure black), not #1a1a1a
- HWP header: #f0f0f0, not #efefef
- Color precision has minimal SSIM impact (<1%)

### Spacing (The Problem Area)
- **Cell padding:** HWP varies widely (0.5px-3px depending on document)
- **Line-height:** HWP varies (1.0-1.4 depending on paragraph style)
- **CellMargin:** 20% scale was actually closer than 25% for most docs
- **Body line-height:** 1.3 was closer than 1.35 for compact documents

**Takeaway:** Spacing is document-specific. Don't tune globally.

---

## Recommended Next Steps

### Short-term (Today)
1. ✅ Revert the 6 changes (DONE: da2c18c)
2. Re-apply **only** the vertical alignment fix (th: middle)
3. Test on near-miss documents
4. If positive, commit and stop

### Medium-term (This Week)
1. Implement document-type detection (government/education/business)
2. Create spacing profiles per document type
3. Test each profile independently
4. Measure improvement per profile

### Long-term (Next Sprint)
1. Machine learning model to predict optimal spacing per document
2. Train on current 43 documents
3. Apply to new documents automatically
4. Continuous improvement loop

---

## Success Metrics

**Before (00:02):** 16.3% pass rate (A+B)  
**After rollback (10:03):** 16.3% pass rate (baseline restored)

**Goal:** 50% pass rate (A+B)  
**Stretch goal:** 70% pass rate

**Strategy:** Slow and steady wins the race.  
Make 1-2% improvements consistently, not 10% swings that backfire.
