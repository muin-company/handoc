# 뷰어 & 에디터 심층 리뷰

**감사자:** 미르 (직접 코드 리뷰) | **일자:** 2026-02-23

---

## 1. 뷰어 (packages/viewer)

### 구조

```
viewer/src/
├── index.ts           # 엔트리 — React 컴포넌트 export
├── render.ts          # DocumentModel → HTML 문자열 변환 (395줄)
└── canvas/
    ├── layout-engine.ts  # 자체 레이아웃 엔진 (598줄)
    ├── canvas-renderer.ts # Canvas 2D 렌더링
    ├── font-map.ts       # 폰트 매핑
    ├── types.ts          # 렌더 커맨드 타입
    └── index.ts
```

### 두 가지 렌더링 경로

#### 경로 A: HTML 렌더링 (render.ts)
- `sectionsToHtml()` — DocumentModel을 HTML 문자열로 변환
- 스타일 인라인 적용 (paraStyle, runStyle 함수)
- 장점: 간단, 브라우저 레이아웃 활용
- 단점: 정밀한 페이지 분할 불가

#### 경로 B: Canvas 렌더링 (layout-engine.ts + canvas-renderer.ts)
- **자체 레이아웃 엔진** — Y 커서 방식, 페이지 분할 직접 계산
- Canvas 2D API로 직접 그리기
- 장점: 페이지 단위 정밀 렌더링
- 단점: 텍스트 측정 정확도 한계

### 레이아웃 엔진 분석 (layout-engine.ts, 598줄)

**설계 패턴:** PDF.js의 PartialEvaluator 영감

```typescript
// 핵심 로직: Y 커서 기반 페이지 분할
// Y가 콘텐츠 영역을 초과하면 새 페이지 시작
```

**구현된 기능:**
- ✅ 텍스트 렌더링 (폰트, 크기, 색상, 볼드/이탤릭)
- ✅ 문단 정렬 (left, center, right, justify)
- ✅ 줄 간격 (percent, fixed, betweenLines)
- ✅ 표 렌더링 (고정 컬럼 너비)
- ✅ 이미지 렌더링
- ✅ 페이지 분할

**미구현/제한:**
- ❌ 머리말/꼬리말 렌더링 (render.ts에만 있음)
- ❌ 각주 (render.ts에만 있음)
- ❌ 단(column) 레이아웃
- ❌ 텍스트 줄바꿈 정밀도 (Canvas measureText 의존)
- ⚠️ 셀 병합 처리 미확인

### 코드 품질 관찰

**render.ts의 문제:**
```typescript
// 전역 상태 — 모듈 레벨에서 currentHanDoc을 보관
let currentHanDoc: HanDoc | null = null; // ← 뷰어에서도 동일 패턴
```
→ 멀티 인스턴스 환경에서 충돌 가능. 의존성 주입 또는 컨텍스트 패턴 권고.

**폰트 매핑 (font-map.ts):**
- 한컴 폰트 → 웹 폰트 매핑 테이블
- 매핑되지 않은 폰트는 기본값 fallback
- **한계:** 폰트 메트릭이 다르면 줄바꿈 위치 달라짐 → 페이지 수 불일치

---

## 2. 에디터 (packages/editor)

### 구조

```
editor/src/
├── index.ts          # 엔트리
├── schema.ts         # ProseMirror 스키마 정의
├── converter.ts      # HWPX ↔ ProseMirror 변환 (565줄)
├── commands.ts       # 커스텀 커맨드
├── markCommands.ts   # 서식 관련 커맨드
├── tableKeymap.ts    # 표 키바인딩
└── imagePlugin.ts    # 이미지 처리 플러그인
```

### ProseMirror 스키마 분석

**노드 타입:**
| 노드 | content | 비고 |
|------|---------|------|
| doc | section+ | 섹션 기반 (HWPX 충실) |
| section | (paragraph\|heading\|table\|image)+ | 페이지 속성 보존 |
| paragraph | inline* | 정렬, 스타일 참조 |
| heading | inline* | h1~h6 |
| table | table_row+ | ProseMirror tables 표준 |
| table_cell | (paragraph\|heading)+ | colspan, rowspan 지원 |
| image | — | block 레벨, src/alt/width/height |

**마크 타입:** bold, italic, underline, strikeout, textColor, fontSize, fontFamily

### 평가

**👍 강점:**
- ProseMirror 선택은 올바름 — 문서 편집의 업계 표준
- 스키마가 HWPX 구조를 반영 (section 노드)
- 표 지원 (prosemirror-tables)

**⚠️ 약점:**

1. **converter.ts의 전역 상태:**
```typescript
let currentHanDoc: HanDoc | null = null; // 모듈 전역
```
에디터와 뷰어 모두 동일한 안티패턴. 동시에 여러 문서를 열면 문제.

2. **HWPX 고유 서식 손실:**
- 장평(character width ratio) — 마크로 미정의
- 자간(letter spacing) — 마크로 미정의
- 위/아래첨자 — 마크로 미정의
- 글머리 번호/불릿 — 노드로 미정의
- 각주/미주 — 노드로 미정의
- 수식(equation) — 노드로 미정의

→ HWPX → ProseMirror → HWPX 라운드트립 시 **서식 정보 손실** 발생

3. **표 변환 로직의 취약점:**
```typescript
// converter.ts에서 GenericElement를 직접 파싱
if (cellChild.tag === 'tc') {
  const colspan = parseInt(cellChild.attrs?.colspan || '1', 10);
```
→ GenericElement에서 직접 태그명으로 분기 — document-model의 타입 추상화를 우회하고 있음. parser의 `parseTable`을 사용해야 함.

4. **에디터 → HWPX 저장 경로:**
- `editorStateToHwpx()` — ProseMirror state를 HWPX 바이너리로 변환
- 현재 상태에서 **새 문서 생성만 가능**, 기존 문서의 메타데이터/스타일 보존은 미구현

---

## 3. 뷰어 vs PDF-export 코드 중복

| 기능 | viewer/render.ts | pdf-export/html-renderer.ts | 중복 |
|------|-----------------|---------------------------|------|
| 문단 스타일 변환 | paraStyle() | 유사 함수 | ⚠️ |
| 글자 스타일 변환 | runStyle() | 유사 함수 | ⚠️ |
| 표 HTML 변환 | renderTable() | 유사 함수 | ⚠️ |
| 이미지 처리 | renderImage() | 유사 함수 | ⚠️ |

→ **DocumentModel → HTML 변환 로직이 최소 2곳에서 중복 구현.** 공통 모듈로 추출 권고.

---

## 4. 종합 평가

| 항목 | 뷰어 | 에디터 | 비고 |
|------|------|--------|------|
| 완성도 | 6/10 | 4/10 | 뷰어는 양 경로 모두 동작, 에디터는 기본만 |
| 아키텍처 | 7/10 | 6/10 | Canvas 레이아웃 엔진은 좋은 설계 |
| 서식 보존 | 5/10 | 3/10 | 에디터는 HWPX 고유 서식 대부분 손실 |
| 코드 품질 | 6/10 | 5/10 | 전역 상태, 코드 중복 |
| 실사용 가능성 | 6/10 | 3/10 | 뷰어는 데모용 OK, 에디터는 프로토타입 수준 |

### 핵심 권고

1. **에디터는 제품에서 제외하고 "실험적(experimental)" 라벨** — 현재 상태로 사용자 공개 시 기대 불충족
2. **뷰어의 Canvas 경로가 pdf-direct와 레이아웃 로직 공유 가능** — 장기적으로 통합 검토
3. **HTML 변환 로직 공통화** — render.ts와 html-renderer.ts 통합
4. **전역 상태 제거** — 클래스 또는 컨텍스트 객체로 전환

---

*뷰어의 자체 레이아웃 엔진(layout-engine.ts)은 PDF direct 렌더링의 토대가 될 수 있는 좋은 자산. 버리지 말고 발전시킬 것.*
