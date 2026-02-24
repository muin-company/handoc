# Visual Diff Strategy for D→C Promotion
**Date:** 2026-02-25 03:00
**Target:** 4 near-miss documents (SSIM 0.65-0.69)

## 🎯 Goal
Promote 4 D-grade documents to C-grade by improving SSIM from 0.65-0.69 to ≥0.70

## 📋 Target Documents

| # | Document | SSIM | Gap | Pages |
|---|----------|------|-----|-------|
| 1 | 붙임 1. 고성능 컴퓨팅 지원 | ~0.69 | ~0.01 | 3→4 |
| 2 | [별표 7] 인증평가 일부 생략 | 0.674 | 0.026 | 3→3 |
| 3 | 2. 제안요청서 홈택스 | 0.657 | 0.043 | 298→255 |
| 4 | 230403 데이터베이스 표준화 | 0.653 | 0.047 | 24→22 |

## 🔬 SSIM Analysis Primer

### What is SSIM?
Structural Similarity Index Measure (SSIM) compares:
1. **Luminance** - Overall brightness
2. **Contrast** - Dynamic range
3. **Structure** - Spatial patterns (edges, shapes, text)

### SSIM Interpretation
- **0.95-1.0:** Nearly identical (A-grade)
- **0.85-0.95:** Very similar (B-grade)
- **0.70-0.85:** Similar (C-grade) ← **Our target**
- **0.50-0.70:** Recognizable but different (D-grade)
- **<0.50:** Significantly different (F-grade)

### What Affects SSIM Most?
**High impact:**
- Font rendering (character shapes, widths, spacing)
- Border/line thickness and position
- Image placement and scaling
- Text color and background colors

**Medium impact:**
- Paragraph spacing (vertical margins)
- Table cell padding
- Line height and text alignment

**Low impact (SSIM-wise):**
- Page count differences (affects overall score but not per-page)
- Content order (if visually similar)

## 🛠️ Improvement Tactics

### Tactic 1: Border Thickness Matching
**Hypothesis:** HWP uses specific border widths (0.4pt, 0.5pt, 1pt) that we may be approximating.

**Implementation:**
```typescript
// Current: Approximating borders
border: '0.5px solid #000'

// Proposed: Exact HWP border mapping
const BORDER_WIDTHS = {
  THIN: '0.4pt',    // HWP "가는선"
  NORMAL: '0.5pt',  // HWP "보통선"
  THICK: '1.0pt',   // HWP "굵은선"
  DOUBLE_THIN: '2.5pt', // HWP "이중가는선"
};
```

**Expected impact:** +0.01-0.02 SSIM (especially for table-heavy docs)

---

### Tactic 2: Font Width Adjustment
**Hypothesis:** Embedded fonts are slightly wider than original HWP fonts, causing subtle layout shifts.

**Diagnostic approach:**
1. Extract text from reference PDF (page 1)
2. Extract text from our PDF (page 1)
3. Measure character widths for common characters (가, 나, A, 1)
4. Calculate average width ratio

**Implementation:**
```typescript
// If our fonts are 2% wider on average
const FONT_WIDTH_CORRECTION = 0.98;
ctx.scale(FONT_WIDTH_CORRECTION, 1.0);
// Apply before rendering text
```

**Risk:** May break A/B-grade documents if applied globally
**Mitigation:** Apply only to D-grade near-miss documents as experiment

**Expected impact:** +0.02-0.04 SSIM (significant for text-heavy docs)

---

### Tactic 3: Color Palette Precision
**Hypothesis:** HWP uses specific RGB values for common colors (table headers, backgrounds) that we're approximating.

**Common HWP colors:**
- Table header gray: `#F0F0F0` (current) vs actual `#EFEFEF`?
- Border black: `#000000` (current) vs actual `#1A1A1A`?
- Link blue: `#0000FF` (current) vs actual `#0563C1`?

**Diagnostic approach:**
1. Sample 10 pixels from reference PDF table headers
2. Sample 10 pixels from our PDF table headers
3. Compare RGB values
4. Build exact color mapping

**Expected impact:** +0.01-0.02 SSIM (especially for colorful documents)

---

### Tactic 4: Vertical Alignment Tuning
**Hypothesis:** Table cell vertical-align may not match HWP default.

**Current:**
```css
td, th { vertical-align: top; }
```

**HWP default may be:**
- `vertical-align: middle;` for headers
- `vertical-align: top;` for body cells
- Or even baseline/text-top in some cases

**Diagnostic approach:**
1. Visual inspection of reference vs test PDF
2. Measure distance from cell top to first text baseline
3. Adjust vertical-align CSS

**Expected impact:** +0.01-0.03 SSIM (for table-heavy docs)

---

### Tactic 5: Line-Height Per-Document Tuning
**Current approach:** Global 1.04x line-height correction

**Hypothesis:** Different document types may need different corrections:
- Government forms: 1.03x (tight spacing)
- Reports: 1.04x (current default)
- Presentations: 1.06x (loose spacing)

**Implementation:**
```typescript
const LINE_HEIGHT_PROFILES = {
  'default': 1.04,
  'government-form': 1.03,
  'report': 1.04,
  'presentation': 1.06,
};

// Auto-detect or manual override
const profile = detectDocumentType(doc) || 'default';
const correction = LINE_HEIGHT_PROFILES[profile];
```

**Expected impact:** +0.02-0.05 SSIM (varies by document)

---

## 🎬 Action Plan

### Phase 1: Quick Wins (1-2 hours)
1. **Border thickness audit** - Check if we're using exact HWP border widths
2. **Color sampling** - Sample 5 common colors from each near-miss document
3. **Visual alignment check** - Screenshot reference vs test, overlay in image editor

**Deliverable:** List of specific mismatches (borders, colors, alignments)

### Phase 2: Targeted Fixes (2-4 hours)
1. Implement exact border width mapping
2. Implement exact color palette mapping
3. Adjust vertical-align for table cells if needed

**Deliverable:** Updated code, rebuild, retest

### Phase 3: Validation (1 hour)
1. Run comparison on near-miss documents only
2. Check if SSIM improved
3. Check if A/B/C documents regressed

**Success criteria:** ≥2 of 4 near-miss docs promoted to C-grade, 0 regressions

---

## 📊 Expected Outcomes

### Optimistic Scenario
- All 4 near-miss docs promoted to C-grade
- Pass rate: 41.9% → 48.8% (+6.9pp)
- No regressions in A/B/C

### Realistic Scenario
- 2-3 near-miss docs promoted to C-grade
- Pass rate: 41.9% → 46.5% (+4.6pp)
- 0-1 minor regressions (C→D)

### Pessimistic Scenario
- 1 near-miss doc promoted
- Pass rate: 41.9% → 44.2% (+2.3pp)
- 1-2 regressions

**Any positive movement is progress.** These documents are so close to C-grade that even small improvements could push them over.

---

## 🔍 Diagnostic Tools Needed

### Tool 1: Color Sampler Script
```python
# Extract RGB values from specific coordinates
from pdf2image import convert_from_path
from PIL import Image

def sample_colors(pdf_path, page=1, coords=[(100,100), (200,200)]):
    images = convert_from_path(pdf_path, first_page=page, last_page=page)
    img = images[0]
    for x, y in coords:
        rgb = img.getpixel((x, y))
        print(f"({x},{y}): RGB{rgb}")
```

### Tool 2: Text Width Analyzer
```python
# Measure text bounding boxes
from PyPDF2 import PdfReader

def analyze_text_widths(pdf_path, page=0):
    reader = PdfReader(pdf_path)
    page_obj = reader.pages[page]
    # Extract text with positions
    # Calculate average character width
```

### Tool 3: Border Inspector
```bash
# Extract border lines from PDF
pdf2svg input.pdf output.svg
# Inspect SVG line elements for stroke-width
grep 'stroke-width' output.svg | sort | uniq -c
```

---

## 💭 Philosophical Note

We're at the **diminishing returns** stage of optimization. The first 41 documents (95.3%) were relatively easy to fix with broad strokes. These last 4 near-miss documents require **surgical precision**:

- Measuring exact pixel values
- Matching exact RGB colors
- Tuning sub-point spacing

This is the difference between **"good enough"** and **"production ready"**. The question is: **Is 48.8% pass rate worth the extra effort vs 41.9%?**

For an MVP, **41.9% may be sufficient**. For a commercial product, **48.8% would be better**. For perfect fidelity, **100% is impossible** without using the original HWP rendering engine.

**Recommendation:** Attempt Phase 1 (Quick Wins) to identify low-hanging fruit. If easy fixes exist, implement. If not, accept 41.9% as MVP and document limitations.
