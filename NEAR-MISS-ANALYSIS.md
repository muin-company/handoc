# Near-Miss D→C Promotion Analysis
**Date:** 2026-02-25 01:00
**Current Threshold:** C-grade = SSIM ≥ 0.70

## 🎯 Target Documents (D-grade, SSIM ≥ 0.65)

Based on `comparison-midnight` results, the following D-grade documents are within 0.05 SSIM of C-grade promotion:

| Document | SSIM | Gap to C | Pages (ref→test) | Notes |
|----------|------|----------|------------------|-------|
| 붙임 1. 고성능 컴퓨팅 지원 | ~0.69 | ~0.01 | 3→4 | **Closest to promotion** |
| [별표 7] 인증평가 일부 생략 | 0.674 | 0.026 | 3→3 | Perfect page count |
| 2. 제안요청서 홈택스 | 0.657 | 0.043 | 298→255 | Large doc, -43 pages (good) |
| 230403 데이터베이스 표준화 | 0.653 | 0.047 | 24→22 | -2 pages |

## 🔍 Common Characteristics

### Page Count Patterns
- **Perfect match (3→3):** [별표 7] - suggests layout is close but visual fidelity needs work
- **Slight undergeneration (24→22, 3→4):** Most are within ±10% of target
- **Significant improvement (298→255):** 홈택스 reduced from previous 298→321 overflow

### SSIM Score Distribution
All 4 documents cluster in the 0.65-0.69 range, suggesting a **systematic issue** rather than document-specific problems. Likely causes:

1. **Font rendering differences**
   - Embedded fonts may have slightly different metrics than original HWP fonts
   - Character spacing, kerning, or baseline alignment issues

2. **Border/line rendering**
   - Table borders, paragraph borders, or decorative lines may not match exactly
   - Line thickness (0.5px vs 1px) can affect SSIM significantly

3. **Color/shading accuracy**
   - Background colors, text colors, or gradient fills
   - HWP uses specific color palettes that may not be perfectly replicated

4. **Alignment precision**
   - Vertical alignment within table cells
   - Text justification (left/right/center/distributed)
   - Paragraph indentation accuracy

## 💡 Improvement Strategies

### High-Impact, Low-Risk
1. **Font metrics tuning** - Compare character widths, heights, and spacing
2. **Border rendering** - Ensure exact border thickness and color matching
3. **Color palette mapping** - Create exact RGB mappings for common HWP colors

### Medium-Impact, Medium-Risk
4. **Vertical alignment** - Review table cell vertical-align (top/middle/bottom)
5. **Justification algorithm** - Ensure distributed/justified text matches HWP spacing
6. **Line-height precision** - Current 1.04x correction factor may need per-document tuning

### Low-Impact, High-Risk (avoid)
7. **Aggressive layout changes** - May regress other documents
8. **Font substitution** - Could break A/B/C-grade documents

## 📊 Expected Impact

Promoting these 4 documents would improve:
- **C-grade count:** 11 → 15 (+36%)
- **Pass rate:** 41.9% → 48.8% (+6.9pp)
- **D-grade count:** 23 → 19 (-17%)

This would be a **meaningful improvement** without risking F-grade regressions.

## 🎓 Recommended Next Steps

1. **Visual diff analysis** - Compare page 1 of each document side-by-side to identify specific visual differences
2. **Font audit** - Measure actual vs expected character widths in rendered PDFs
3. **Border inspection** - Check border thickness consistency across all documents
4. **Color sampling** - Extract and compare RGB values from reference vs test PDFs

## 🔬 Experimental Ideas

### A. Font Width Scaling
If embedded fonts are consistently wider than originals, apply a subtle horizontal scale (e.g., 0.98x) to compress text slightly.

**Risk:** Could break A/B documents if their fonts are already well-matched.

### B. SSIM-Targeted Border Rendering
If borders are the main SSIM bottleneck, implement exact HWP border thickness/color matching.

**Risk:** Low - borders should not affect layout significantly.

### C. Per-Document Tuning
Create a document-specific configuration system to override line-height, font-size, or margins for known problematic documents.

**Risk:** Medium - increases maintenance burden, but provides surgical precision.

---

**Conclusion:** The 4 near-miss documents represent low-hanging fruit. Focused improvements on font rendering, borders, and colors could yield significant score improvements without layout risk.
