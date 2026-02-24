# HanDoc PDF 렌더링 파이프라인 심층 분석

> 2026-02-24 | 코드 기준: packages/pdf-export/src/

---

## 1. 아키텍처 개요: 세 개의 렌더링 경로

| 파일 | 방식 | 한글 렌더링 | 완성도 |
|------|------|------------|--------|
| `html-renderer.ts` (616줄) | HWPX → HTML → (Playwright) → PDF | CSS 폰트 매핑, 브라우저 렌더링 | ★★★★ 가장 완성도 높음 |
| `pdf-direct.ts` (1,013줄) | HWPX → pdf-lib + fontkit 직접 | TTF 임베딩, 한글 글리프 직접 렌더 | ★★★☆ 프로덕션 지향 |
| `pdf-canvas-exporter.ts` (489줄) | HWPX → pdf-lib StandardFonts | CJK 미지원 (ASCII만 실제 렌더) | ★☆☆☆ 초기 프로토타입 |

### 결론: `pdf-canvas-exporter.ts`는 사실상 dead code

`pdf-canvas-exporter.ts`는 StandardFonts만 사용하여 **한글을 전혀 렌더링하지 못한다**. CJK 문자는 `drawX += ts.fontSize`로 빈 공간만 전진한다 (L330-332). `pdf-direct.ts`가 이를 완전히 대체했으므로 제거 가능.

---

## 2. HTML 렌더러 (`html-renderer.ts`) 상세 분석

### 2.1 폰트 처리 (L14-44)

```
resolveFontName() → fontFamilyCss()
```

12개 한글 폰트를 CSS font-family 스택으로 매핑. 매핑 구조:
- HWP 폰트명 → 시스템 폰트 + 웹 안전 폴백
- 예: `'함초롬바탕'` → `'HCR Batang', 'Batang', '바탕', 'AppleMyungjo', serif`

**문제점:** 매핑 테이블이 하드코딩. 12개 외의 폰트는 `'${fontName}', sans-serif` 폴백 (L43).

### 2.2 표 렌더링 (L203-268)

- `parseTable()` → 행/셀 순회 → `<table>` 생성
- 테이블 폭: `sz` 요소의 `width` → mm 변환 (L207-208)
- 셀 폭: `cellSz.width` → mm 변환, `table-layout:fixed` 사용
- 셀 패딩: `cellMargin` × **0.20** 스케일링 (L236-240) — 원본의 20%만 적용
- 배경색: `borderFillIDRef` → `fillBrush` 파싱 (L62-72)
- 개별 테두리: 상하좌우별 타입(Solid/Dash/Dot/None), 두께, 색상 파싱 (L74-101)

**셀 높이:** 의도적으로 고정 높이를 설정하지 않음 (L254 주석: "Fixed height causes page overflow when content is smaller than cell height"). 콘텐츠가 높이를 결정.

### 2.3 페이지 레이아웃 (L290-310)

```typescript
// renderSectionBody()
pw = sProps.pageWidth / 7200 * 25.4  // HWP → mm
// landscape 감지: pw < ph이면 swap
if (isLandscape && pw < ph) [pw, ph] = [ph, pw];
```

- 단 컬럼 지원 (`column-count`, `column-gap`, `break-after:column`)
- 페이지 브레이크: `page-break-before:always` (paraProp에서)

### 2.4 BASE_CSS (L375-389)

핵심 튜닝 값들:
- `body`: `font-size:9.5pt`, `line-height:1.3`
- `td, th`: `line-height:1.05`, `padding:0.5px 1px`
- `td p, th p`: `margin:0 !important; padding:0 !important; line-height:inherit !important`
- `p`: `orphans:2; widows:2`
- `tr`: `page-break-inside:auto` (행 분할 허용)

---

## 3. Direct PDF 렌더러 (`pdf-direct.ts`) 상세 분석

### 3.1 폰트 임베딩 (L145-190)

```
embedFonts() → serif/serifBold/sans/sansBold 4종
```

폰트 탐색 순서:
- **Serif:** `AppleMyungjo.ttf` → `NanumMyeongjo.ttf` → `batang.ttc`
- **Sans:** `AppleGothic.ttf` → `NanumGothic.ttf` → `malgun.ttf` → `AppleSDGothicNeo.ttc`

**중요 제약:**
- `.ttc` (TrueType Collection)은 fontkit 서브셋 크래시 유발 (L158 주석)
- Noto CJK OTF (CFF 기반)도 동일 문제 (L156 주석)
- → TTF만 안정적. `AppleGothic.ttf`가 1순위로 올라옴 (커밋 `5b31320`)

**Bold 처리:** serifBold = serif 동일 파일. 실제 bold weight 적용 안 됨 — pdf-lib의 한계.

### 3.2 텍스트 측정 및 래핑 (L229-270)

```typescript
measureText() → font.widthOfTextAtSize() 
// 실패 시 글자별 fallback: CJK = fontSize×1.0, 라틴 = fontSize×0.5
```

`wrapText()`: 이진 탐색으로 줄바꿈 위치 결정 → CJK는 아무 곳에서나 분할 가능, 공백 우선 탐색 (15자 뒤로).

### 3.3 라인 높이 계산 (L225-233)

```typescript
function calcLineHeight(ps: ParaStyle, fontSize: number): number {
  if (ps.lineSpacingType === 'fixed') return hwpToPt(ps.lineSpacingValue);
  return fontSize * (ps.lineSpacingValue / 100) * 1.03;  // ← 핵심 보정 계수
}
```

**1.03x 보정의 역사** (커밋 로그):
1. 초기: 보정 없음
2. `703f1fc`: 1.08x 적용 → "HWP em-square 기반 spacing 보정"
3. `2e9c3bd`: 1.03x로 축소 → "1.08x가 12개 파일에서 페이지 오버플로 발생"

이것은 HWP의 lineSpacing이 font em-square 기준이라는 점과, pdf-lib의 행간 계산 방식 차이에서 오는 간극을 메우는 heuristic.

### 3.4 표 렌더링 — 2-pass 알고리즘 (L339-470)

**Pass 1: 행 높이 계산**
```
for each row:
  for each cell (rowSpan=1만):
    estimateCellHeight() → 셀 내용물 높이 계산
  rowHeight = max(cell heights)
```

**rowSpan 처리:**
```
for each rowSpan>1 cell:
  neededH = estimateCellHeight()
  spanH = sum of spanned rowHeights
  if neededH > spanH: distribute (neededH - spanH) / rs to each row
```

**Pass 2: 렌더링**
```
for each row:
  if curY - rowH < mB: newPage()
  for each cell:
    cellX = tableX + colX[colAddr]  // 그리드 기반 X
    cellW = colX[ci+colSpan] - colX[ci]  // colSpan 합산
    draw background → draw 4 borders → renderCellContent()
```

**`estimateCellHeight()`** (L442-476):
- 셀 패딩 (cellMargin → pt)
- 각 단락별: marginTop + runs + marginBottom
- text → `wrapText()` 결과의 줄 수 × lineHeight
- 중첩 테이블 → `estimateTableHeight()` 재귀 호출
- 이미지 → `curSz` 높이
- shape → `curSz` 높이
- `max(declaredHeight, calculatedHeight)` 반환

**열 폭 그리드 구성** (L350-370):
```
colWidths[]: colSpan=1인 셀에서 추출
→ 미할당 열은 (전체폭-기지폭)/미할당수로 균등 분배
→ colX[] 누적 배열 생성
```

### 3.5 이미지 렌더링 (L502-540)

- BMP → PNG 자체 변환 (L18-70, zlib deflate)
- 사이즈 우선순위: `curSz` > `orgSz` > `imgRect`
- 페이지 초과 시 비례 축소 (maxWidth, contentH)
- 사전 캐싱: `imageCache = Map<string, PDFImage>`

### 3.6 Shape 렌더링 (L543-593)

2단계 전략:
1. 직접 자식 탐색 (tbl, pic, drawText/subList)
2. 실패 시 재귀 하위 탐색 (legacy fallback)
3. 최후 수단: `extractShapeText()` 전체 텍스트 추출

---

## 4. 두 경로 비교 (HTML vs Direct)

| 항목 | HTML 경로 | Direct 경로 |
|------|-----------|------------|
| **한글 렌더링** | 브라우저 폰트 렌더링 (완벽) | TTF 임베딩 (글리프 누락 가능) |
| **Bold/Italic** | CSS로 완벽 처리 | Bold = 같은 TTF 재사용 (가짜 bold) |
| **표 페이지 분할** | 브라우저 CSS 페이지 브레이크 | 수동 rowH 계산 + checkBreak |
| **이미지** | base64 data URI | pdf-lib embedPng/embedJpg |
| **BMP 지원** | 브라우저 네이티브 | 자체 BMP→PNG 변환기 |
| **외부 의존성** | Playwright (Chromium) | fontkit + 시스템 TTF |
| **셀 패딩** | cellMargin × 0.20 | cellMargin → pt 그대로 |
| **Landscape** | pw/ph swap if needed | sectionProps 그대로 사용 |
| **Character spacing** | letter-spacing CSS | 미지원 |
| **장평 (ratio)** | transform:scaleX() | 미지원 |
| **Superscript/subscript** | vertical-align CSS | 미지원 |
| **다단 (columns)** | column-count CSS | 미지원 |
| **머리말/꼬리말** | renderHeaderFooter() | 미지원 |

---

## 5. 폰트 처리 심층

### HTML 경로
- **매핑:** 12개 한글 폰트명 → CSS font-family stack (L27-42)
- **메트릭:** 브라우저가 처리
- **한계:** Playwright가 실행되는 환경에 폰트가 설치되어 있어야 함

### Direct 경로
- **매핑:** `SERIF_NAMES` Set으로 serif/sans 이진 분류 (L142)
- **임베딩:** `findSystemFont()` → 6개 경로 탐색 (macOS/Linux/Windows)
- **메트릭:** `font.widthOfTextAtSize()` — 실패 시 CJK=1em, Latin=0.5em 추정
- **한계:**
  - `.ttc` 파일 사용 불가 (fontkit 크래시)
  - Bold weight 미분리 (serifBold = serif 동일 파일)
  - 폰트 4개로만 전체 문서 렌더 (원본 문서가 다양한 폰트 사용 시 차이 발생)

---

## 6. 페이지 레이아웃

### 용지 크기
```
HTML: pageSize.width/height (mm, doc.pageSize에서)
      sectionProps → HWP units / 7200 * 25.4 → mm
Direct: sectionProps → hwpToPt() → PDF pt
        기본값: 595.28 × 841.89 pt (A4)
```

### 마진
- HTML: `sectionProps.margins` → mm, `<section>` padding으로 적용
- Direct: `sectionProps.margins` → pt, 커서 범위 제한 (`mB` 체크)

### Landscape
- **HTML (L305-308):** `isLandscape && pw < ph`이면 pw↔ph swap — 조건부 swap
- **Direct:** landscape 관련 코드 없음 — `sectionProps`의 `pageWidth/pageHeight`를 그대로 사용. HWPX가 landscape일 때 이미 넓은 값이 width에 들어있다고 가정.

**잠재 버그:** 커밋 로그에 landscape 관련 3번의 수정/리버트가 있음 (`ed14a58`, `2f1b1e7`, `c4d7091`). HWPX 파서가 landscape 시 dimensions를 어떻게 전달하는지에 따라 동작이 달라짐.

---

## 7. 최근 파라미터 튜닝 분석

### 튜닝 히스토리 (최신→과거)

| 커밋 | 변경 | 효과 |
|------|------|------|
| `2e9c3bd` | lineHeight 1.08x → 1.03x | 페이지 오버플로 12건 해결 |
| `703f1fc` | lineHeight 1.08x 적용 | 줄간격 부족 문서 개선, 오버플로 발생 |
| `19ba320` | paragraph margin × 0.5 | 문단 간격 줄여 페이지 수 감소 |
| `4dc1c34` | body line-height 1.5→1.3 | 전체 줄간격 축소 |
| `ec7b7b6` | cellMargin scale 25%→20% | 셀 내부 여백 추가 감소 |
| `603ca8f` | cell padding 1px 2px → 0.5px 1px | 셀 패딩 절반으로 |
| `c5eb10a` | cell padding 50%→25%, orphans 2→1 | 테이블 높이 감소 |
| `36f65ae` | table row `page-break-inside:auto` | 행 분할 허용 |
| `0bb2332` | p `page-break-inside:avoid` 제거 | 긴 문단 분할 가능 |
| `9ddc863` → `7074870` | body line-height 1.6→1.5 → **리버트** | 리버트됨 |
| `3120a4b` → `013c0be` | letter-spacing -0.015em → **리버트** | 리버트됨 |
| `8cf38fb` → `fea546f` | font-size 10pt→9.5pt → **리버트** | 리버트됨 |

### 패턴 분석

**핵심 문제: 페이지 수 불일치.** HWP 원본과 PDF 출력의 페이지 수가 다른 것이 반복 튜닝의 원인.

튜닝 방향: **줄이기** (line-height, padding, margin 모두 감소 방향)
- 3개 변경이 리버트됨 → 전역 값 변경은 일부 문서를 개선하면 다른 문서를 악화시킴
- 최종 안정점: `line-height:1.3` (body), `1.05` (table cell), `1.03x` 보정 계수

**근본 원인:** CSS의 line-height와 HWP의 lineSpacing 계산 방식이 다름. HWP는 em-square 기반, CSS는 font metrics 기반. 단일 보정 계수로는 모든 문서에 맞출 수 없음.

---

## 8. 구체적 개선 제안

### 🔴 Critical

1. **`pdf-canvas-exporter.ts` 제거** — CJK 미지원으로 사실상 무용. `pdf-direct.ts`가 완전 대체.

2. **Direct 경로: Bold 폰트 분리** (pdf-direct.ts L185-186)
   ```
   현재: serifBold = serif 동일 파일
   개선: NanumMyeongjoBold.ttf / AppleGothic Bold 별도 탐색
   ```

3. **Direct 경로: lineHeight 보정 계수를 폰트별로 분리** (pdf-direct.ts L225-233)
   ```
   현재: 전역 1.03x
   개선: serif 폰트와 sans 폰트별 다른 계수, 또는 폰트 ascender/descender 메트릭에서 동적 계산
   ```

### 🟡 Important

4. **Direct 경로: character spacing, 장평(ratio) 지원 추가**
   - HTML 경로는 `letter-spacing`, `transform:scaleX()` 지원 (html-renderer.ts L110-125)
   - Direct 경로는 완전 무시 — 특히 장평은 한글 문서에서 흔함

5. **Direct 경로: 다단 레이아웃(columns) 지원**
   - HTML 경로는 CSS `column-count` 사용 (html-renderer.ts L315-325)
   - Direct 경로는 미지원

6. **Direct 경로: 머리말/꼬리말 지원**
   - HTML 경로는 `renderHeaderFooter()` 구현 (html-renderer.ts L333-355)
   - Direct 경로는 미구현

7. **HTML 경로: cellMargin 스케일링을 하드코딩 대신 adaptive하게**
   - 현재: `cellMargin × 0.20` 고정 (html-renderer.ts L236)
   - 문서별 테이블 밀도에 따라 다른 값이 적절할 수 있음

### 🟢 Nice-to-have

8. **표 페이지 브레이크: row-level splitting**
   - Direct 경로: 현재 행 단위로만 페이지 분할. 행 내용이 페이지보다 클 때 `cellH = contentH` 클램프 (pdf-direct.ts L415) → 콘텐츠 잘림
   - 행 중간 분할 + 테이블 헤더 반복이 필요

9. **폰트 캐싱/공유** 
   - Direct 경로에서 매 PDF 생성마다 폰트를 읽고 임베딩 → 다수 파일 변환 시 성능 저하
   - 폰트 바이트 캐시 또는 PDFDocument 간 공유 메커니즘

10. **통합 렌더링 테스트 프레임워크**
    - 커밋 `914d786`에서 10개 파일 회귀 테스트 추가 → 이를 CI에 통합하여 파라미터 튜닝 시 자동 검증

---

## 9. 코드 품질 메모

- `pdf-direct.ts`의 `renderTable`, `renderImage`, `renderShapeContent`는 `generatePdf` 내부의 중첩 함수로 closure 변수(`page`, `curY`, `newPage`, `checkBreak`)에 의존 → 테스트 어려움. 클래스 또는 context 객체로 리팩터링 권장.
- `estimateCellHeight`와 `renderCellContent`의 로직이 거의 동일 (높이 계산 vs 실제 렌더) → 한 번의 layout pass로 통합 가능.
- `html-renderer.ts`의 `getBorderStyles`와 `pdf-direct.ts`의 `resolveBorderFill`은 같은 일을 다른 방식으로 함 → 공통 border 해석 레이어 추출 가능.
