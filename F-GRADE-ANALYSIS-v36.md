# F-Grade Analysis — v30 Baseline → v36 Improvement Target

**Generated:** 2026-02-25  
**Baseline:** comparison-v30 (570 files)  
**F-grade count:** 66 / 570 (11.6%)

## Grade Distribution (v30)

| Grade | Count | % |
|-------|-------|---|
| A | 43 | 7.5% |
| B | 62 | 10.9% |
| C | 196 | 34.4% |
| D | 203 | 35.6% |
| **F** | **66** | **11.6%** |

## Root Cause Analysis

### #1: Page Count Mismatch (65/66 files, 98.5%)

Nearly all F-grade files have a **page count mismatch** between HanDoc output and reference. This is the dominant failure mode.

| Category | Files | Description |
|----------|-------|-------------|
| Massive overflow (>20% fewer pages) | 52 | HanDoc produces significantly fewer pages — content is lost |
| Moderate overflow (10-20% fewer) | 7 | Noticeable page deficit |
| Extra pages (test > ref) | 6 | HanDoc produces more pages than reference |
| Same page count | 1 | Equal pages but very low SSIM |

**Key insight:** 59/66 F-grade files have **fewer pages in HanDoc output**. Content that exists in the reference PDF is simply missing from the HanDoc output. The zero-SSIM pages are always at the end — meaning HanDoc ran out of pages before the reference content ended.

### #2: Low Visual Quality Even on Matched Pages

For pages that DO exist in both outputs (non-zero SSIM):
- **F-grade avg SSIM:** 0.549
- **D-grade avg SSIM:** 0.658

Even the pages that exist are significantly worse than D-grade, suggesting compound issues.

### #3: Visual Problems Identified from Diff Images

| Problem | Severity | Frequency |
|---------|----------|-----------|
| **Table row/column overflow** — content doesn't fit, fewer pages generated | Critical | ~60 files |
| **Dense table corruption** — timetables/grids become illegible | Critical | ~15 files |
| **Text weight/boldness** — Korean text renders heavier than reference | High | Ubiquitous |
| **Cell content misposition** — text shifted within table cells | High | ~40 files |
| **Merged cell rendering** — spans not calculated correctly | Medium | ~20 files |
| **Page break logic** — tables split incorrectly or not at all | Medium | ~30 files |

## File Source Distribution

| Source | F-grade Count |
|--------|---------------|
| education-hwp/ (HWP converted) | 37 |
| education/ (native HWP/HWPX) | 29 |

**Note:** Many files appear in both directories (same content, different conversion paths). Unique documents ≈ 40-45.

## Top 10 Worst Files (by page deficit)

| # | File | Ref Pages | Test Pages | Missing | Avg SSIM (matched) |
|---|------|-----------|------------|---------|---------------------|
| 1 | 역곡중 2학기 교수학습 계획서 검토본 | 362 | 296 | -66 | 0.544 |
| 2 | 2학기 교수학습 계획서 전교과 합본 | 362 | 296 | -66 | 0.544 |
| 3 | 2학기 전교과 교수학습 계획 내부결재 | 362 | 296 | -66 | 0.544 |
| 4 | 1학기 역곡중 전교과 교수학습 계획 | 337 | 279 | -58 | 0.547 |
| 5 | 1학기 역곡중 전교과 계획(최종) | 337 | 279 | -58 | 0.546 |
| 6 | 연구_1학기 전교과 교수학습 계획 | 337 | 279 | -58 | 0.547 |
| 7 | 생활기록부 챗지피티 활용 생기부 작성 | 52 | 16 | -36 | 0.687 |
| 8 | 1학기 학급시간표(임시) | 26 | 4 | -22 | 0.692 |
| 9 | 1학기 학급시간표(확정) | 26 | 4 | -22 | 0.692 |
| 10 | 의무교육 학생 관리 운영계획 | 17 | 6 | -11 | 0.690 |

## Improvement Priorities

### Priority 1: Fix Table Content Overflow → ~52 files affected

**Problem:** Tables with many rows cause HanDoc to produce fewer pages. Content overflows and is lost rather than paginating correctly.

**Root cause hypothesis:** Table height calculation is underestimating row heights, or page-break logic within tables is not splitting content to new pages correctly. The table content gets compressed, and when it runs out of available space, the remaining content is simply dropped.

**Impact:** Fixing this alone could rescue 52+ F-grade files (79% of all F-grades).

**Investigation areas:**
- Table row height calculation (especially for wrapped Korean text)
- Page break insertion within long tables
- Content clipping vs overflow behavior

### Priority 2: Dense Grid/Timetable Rendering → ~15 files affected

**Problem:** Timetable-style documents (학급시간표, 좌석표) with dense grids render as illegible masses of overlapping lines. These files often have the worst SSIM scores (0.08-0.15 avg).

**Root cause hypothesis:** Complex table structures with many merged cells, narrow columns, and dense content cause cascading layout errors. Column widths may be calculated incorrectly for the page dimensions.

**Impact:** Would significantly improve ~15 files from F to potentially C/D grade.

### Priority 3: Text Rendering Fidelity → All F-grade files

**Problem:** Korean text consistently renders heavier/bolder than reference, causing character bleeding and reduced readability. This affects SSIM scores across all files.

**Root cause hypothesis:** Font weight mapping or font substitution differences between HanDoc and LibreOffice/HWP reference renderer.

**Impact:** Moderate SSIM improvement across all 66 F-grade files (and likely all 570 files). Won't change grades by itself but combined with other fixes could push borderline cases.

### Priority 4: Extra Page Generation → 6 files affected

**Problem:** 6 files produce MORE pages than reference, suggesting content is expanding rather than fitting.

**Root cause hypothesis:** Line spacing or paragraph spacing is larger than reference, or page margins differ, causing content to overflow to extra pages.

**Impact:** Small file count but an easy diagnostic to check margin/spacing defaults.

## Recommended Action Plan

1. **Instrument table pagination** — Add logging to track when tables are being truncated vs paginated. Identify where content gets dropped.
2. **Compare page dimensions** — Verify HanDoc output page size matches reference exactly (A4 vs custom sizes, margins).
3. **Table row height audit** — Compare calculated vs actual row heights for the worst-performing files.
4. **Font weight mapping review** — Check if HWP font weight values map correctly to CSS/PDF font weights.
5. **Regression test** — After any fix, re-run comparison on the 66 F-grade files first (fast feedback loop).

## Files List

<details>
<summary>All 66 F-grade files (click to expand)</summary>

### Content Overflow (59 files — test < ref)
| File | Ref | Test | Missing |
|------|-----|------|---------|
| (역곡중학교) 2025학년도 2학기 교수학습 및 평가 운영 계획서 검토본 | 362 | 296 | -66 |
| 0. 역사과_2025학년도 1학기 역곡중 전교과 교수학습 및 평가 운영 계획 | 337 | 279 | -58 |
| 0. 역사과_2025학년도 2학기 교수학습 및 평가 운영 계획서 양식(3학년 역사 OOO) | 11 | 8 | -3 |
| 0. 역사과_2025학년도 2학기 교수학습 및 평가 운영 계획서 양식(역곡중) | 11 | 9 | -2 |
| 2023학년도 2학기 학생자치회장 및 부회장 명단 | 2 | 1 | -1 |
| 2025학년도 1차 졸업앨범 촬영 계획 | 3 | 2 | -1 |
| 2025학년도 1학기 교수학습 및 평가 운영 계획서(역사과)_수정 | 20 | 14 | -6 |
| 2025학년도 1학기 역곡중 전교과 교수학습 및 평가 운영 계획(최종) | 337 | 279 | -58 |
| 2025학년도 2학기 교수학습 및 평가 운영 계획서-전교과 합본(최종) | 362 | 296 | -66 |
| 2025학년도 2학기 교수학습 및 평가 운영 계획서(역사과)_0819제출 | 21 | 15 | -6 |
| 2025학년도 2학기 역곡중 전교과 교수학습 및 평가 운영 계획-내부결재최종 | 362 | 296 | -66 |
| 2학기 행동특성 및 종합의견 입력 | 9 | 7 | -2 |
| 2학기 행특 | 2 | 1 | -1 |
| 3.2025학년도 1학기 교수학습 및 평가 운영 계획(역사)_최종 | 19 | 13 | -6 |
| 3.2025학년도 2학기 교수학습 및 평가 운영 계획서(역사)_최종본 | 21 | 15 | -6 |
| 명심보감 필사(바른말) | 2 | 1 | -1 |
| 명심보감 필사(지각) | 2 | 1 | -1 |
| 연구_2025학년도 1학기 역곡중 전교과 교수학습 및 평가 운영 계획 | 337 | 279 | -58 |
| 오답노트 작성하기 | 2 | 1 | -1 |
| 컨설팅_1학기 교수학습 및 평가 운영 계획_역사통합 | 19 | 13 | -6 |
| 컨설팅_2025학년도 1학기 교수학습 및 평가 운영 계획(역사) | 19 | 13 | -6 |
| 컨설팅_2025학년도 1학기 교수학습 및 평가 운영 계획(역사)_3학년 수정 | 19 | 13 | -6 |
| 필사(바른말) | 2 | 1 | -1 |
| 필사(지각) | 2 | 1 | -1 |
| 1-1. 학_선사문화와 고조선(수정)1-2 | 2 | 1 | -1 |
| 1-5. 삼국의 문화와 대외 교류11-12 | 2 | 1 | -1 |
| 1학기_(교사용, 학생용)시간표,진도표 | 3 | 1 | -2 |
| 2024학년도 2학기 평가 비율 및 학력향상방안 협의록(역사) | 3 | 1 | -2 |
| 2025 1차 가내신(석차순) | 8 | 1 | -7 |
| 2025 1학기 학급시간표(임시) | 26 | 4 | -22 |
| 2025 현장체험학습 핸드아웃(3-8) | 2 | 1 | -1 |
| 2025 현장체험학습 핸드아웃(비천당 버전) | 2 | 1 | -1 |
| 2025 현장체험학습 핸드아웃(유다인샘) | 2 | 1 | -1 |
| 2025-3학년 1학기사정안양식(학년계_부장) | 2 | 1 | -1 |
| 2025학년도 1학기 학급시간표(확정) | 26 | 4 | -22 |
| 2025학년도 1학기 학교생활기록부 자체점검표 및 표지_최종 | 4 | 1 | -3 |
| 2025학년도 3학년 학년말 교육과정 프로그램(작성용) | 2 | 1 | -1 |
| 2025학년도 의무교육 학생 관리 운영계획(각종서식 포함) | 17 | 6 | -11 |
| 2026학년도 고등학교 희망조사 안내 | 2 | 1 | -1 |
| 3-8_1학기_2025학년도 3학년 1학기 성적표 가정통신문 문구(예시) | 7 | 4 | -3 |
| 3월 교육급식소식지 | 3 | 2 | -1 |
| 4-1. 조선의 건국 27-28 | 4 | 1 | -3 |
| 4-3. 사림세력과 정치변화 31-32 | 3 | 1 | -2 |
| 5-1. 붕당,탕평정치 37-38 | 3 | 1 | -2 |
| [역곡중학교-3942] 2026학년도 경기도 고등학교 입학전형 기본계획 | 6 | 1 | -5 |
| sample-02-seating | 2 | 1 | -1 |
| sample-05-climate | 3 | 1 | -2 |
| sample-06-student-mgmt | 17 | 6 | -11 |
| 가정통신문-2025학년도 1학기 교과별 평가계획 안내 | 4 | 2 | -2 |
| 기후위기 | 3 | 1 | -2 |
| 독서감상반 독후활동지 | 13 | 1 | -12 |
| 생활기록부_장윤정샘(챗지피티 활용 생기부 작성) | 52 | 16 | -36 |
| 신혜샘_선정 평가표(1) | 6 | 2 | -4 |
| 자리 배치표(유다인샘) | 2 | 1 | -1 |
| 자리 배치표(좌석표, 명렬표) | 2 | 1 | -1 |
| 자리배치표 | 10 | 1 | -9 |
| 하반기 고입업무 담당자 연수 자료(학교안내) | 11 | 7 | -4 |
| 학부모상담_힉부모상담통지서(3-8_1학기) | 3 | 1 | -2 |
| 3학년 1학기(1차)논술 시험지 | 2 | 1 | -1 |

### Extra Pages (6 files — test > ref)
| File | Ref | Test | Extra |
|------|-----|------|-------|
| 2025 진로박람회 '진로캠퍼스' 참가 | 1 | 2 | +1 |
| 1학기 학교생활기록부 기재요령 및 점검 일정 연수자료 | 7 | 10 | +3 |
| 2학기 학교생활기록부 기재요령 및 점검 일정 연수자료 | 6 | 7 | +1 |
| 3학년 1학기(1차)논술 시험지 | 1 | 2 | +1 |
| 1학기 기말대비_개념잡기 | 4 | 6 | +2 |
| 2학기 기말대비_개념잡기 | 5 | 7 | +2 |

### Same Page Count (1 file)
| File | Pages | Avg SSIM |
|------|-------|----------|
| 2025학년도 1학기 주간시간표(확정) | 1 | 0.498 |

</details>
