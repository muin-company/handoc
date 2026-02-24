# F-Grade Blocker Analysis
**Date:** 2026-02-25 02:00
**Documents:** 2 out of 43 (4.7%)

## 🔴 Document 1: 역곡중학교 교수학습 및 평가 운영 계획서

### Metrics
- **SSIM:** 0.47 (extremely low)
- **Page Count:** 362 → 532 (170 extra pages, +47% overgeneration)
- **Status:** Persistent F-grade across all test iterations

### Root Cause Hypothesis
This is a **massive document** with complex structure. The 47% page overgeneration suggests:

1. **Table overflow issues** - Complex nested tables with merged cells
2. **Font metrics mismatch** - Our embedded fonts causing excessive text wrapping
3. **Vertical spacing accumulation** - Small spacing errors compounding over 360+ pages
4. **Missing content compression** - Original may use tight spacing we're not replicating

### Evidence
- Even after aggressive margin/padding reductions (table margins → 0%, cell padding → 0.5px), still generates 532 pages
- SSIM of 0.47 indicates **severe visual mismatch**, not just page count issue
- This suggests missing features or fundamental rendering differences

### Possible Solutions
1. **Document-specific overrides** - Create a profile for this document type (교수학습 계획서)
2. **Deep structure analysis** - Parse HWPX to identify unique structural elements
3. **Line-height reduction** - More aggressive for large documents (current: 1.04x, try: 1.0x)
4. **Cell height hard caps** - Override declared heights more aggressively for this doc type

### Acceptance Criteria
- **Minimum viable:** Reduce to <400 pages (within 10% of original)
- **Good:** Reduce to <385 pages (within 6%)
- **Excellent:** Match 362 pages exactly

---

## 🔴 Document 2: 2025학년도 1차 졸업앨범 촬영 계획

### Metrics
- **SSIM:** 0.44 (extremely low)
- **Page Count:** 3 → 2 (1 page missing, -33% undergeneration)
- **Status:** Persistent F-grade across all test iterations

### Root Cause Hypothesis
This is a **short document** with page underflow. The -33% suggests:

1. **Content compression** - Tables or paragraphs fitting onto fewer pages than they should
2. **Missing content** - Images, shapes, or special elements not rendering
3. **Aggressive height caps** - Our row/cell height caps may be too restrictive for this layout
4. **Page break suppression** - Content that should span pages is being squeezed

### Evidence
- Attempts to expand row heights (1.1x, 1.3x) had no effect
- SSIM of 0.44 indicates not just missing page, but content layout issues
- Small documents are harder to tune because changes have larger relative impact

### Possible Solutions
1. **Identify missing content** - Compare HWPX structure to rendered output, check for missing images/shapes
2. **Relax height caps** - For small documents (<5 pages), allow unlimited row/cell expansion
3. **Forced page breaks** - Check if original has explicit page breaks we're ignoring
4. **Minimum page height** - Prevent excessive content compression in tables

### Acceptance Criteria
- **Minimum viable:** Generate 3 pages (match original count)
- **Good:** 3 pages + SSIM > 0.50
- **Excellent:** 3 pages + SSIM > 0.70 (C-grade)

---

## 🎯 Priority Assessment

### Document 1 (역곡중 362→532p)
- **Impact:** High (170 extra pages is a major usability issue)
- **Difficulty:** Very High (large, complex document)
- **Risk:** Medium (changes may affect other large documents)
- **Priority:** **Medium** - Important but risky to fix

### Document 2 (졸업앨범 3→2p)
- **Impact:** Medium (1 missing page, but 33% of total)
- **Difficulty:** Medium (small document, easier to analyze)
- **Risk:** Low (small document-specific fixes unlikely to regress others)
- **Priority:** **High** - Easier win, lower risk

---

## 📊 Recommended Approach

### Phase 1: Low-Hanging Fruit (졸업앨범)
1. **Manual inspection** - Open original PDF vs generated PDF side-by-side
2. **Content audit** - List all elements: paragraphs, tables, images, shapes
3. **Identify gaps** - Find what's missing or incorrectly rendered
4. **Targeted fix** - Implement missing feature or adjust caps for this case

**Success criteria:** Move from F (0.44) to D (>0.50) or C (>0.70)

### Phase 2: Systematic Analysis (역곡중)
1. **Sample pages** - Extract pages 1, 100, 200, 300, 362 from both PDFs
2. **Visual comparison** - Identify systematic differences (spacing, fonts, borders)
3. **Page-by-page delta** - Track where extra pages are introduced (early, late, throughout?)
4. **Root cause isolation** - Is it tables? Paragraphs? Headers/footers?

**Success criteria:** Reduce to <400 pages (within 10% of original)

### Phase 3: Acceptance Decision
If both documents resist fixes after targeted efforts:
- **Consider edge cases** - May represent document types we don't support
- **Document limitations** - Add to known issues list
- **Evaluate 95.3% success rate** - Is this acceptable for MVP?

---

## 💡 Key Insight

These 2 F-grade documents represent **opposite problems**:
- **역곡중:** Overgeneration (too much space)
- **졸업앨범:** Undergeneration (too little space)

This suggests they have **fundamentally different structures** rather than a common tuning issue. Each requires a custom solution, not a global fix.

**Recommendation:** Focus on 졸업앨범 first (higher priority, lower risk), then decide if 역곡중 is worth the effort or should be documented as a known limitation.
