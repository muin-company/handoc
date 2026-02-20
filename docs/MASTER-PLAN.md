# HanDoc 마스터 운영 문서

> 🟢 **Active Plan** — 이 문서가 유일한 계획 문서입니다. 다른 계획 문서는 `docs/archive/`로 이동되었습니다.

> **최종 업데이트:** 2026-02-21 (v4 — 전체 통계 갱신 + Level 4-5 반영)  
> **목적:** 이 문서만 보면 누구든 (MJ, 서브에이전트) 다음 할 일을 즉시 판단 가능

---

## 1. 프로젝트 현황 요약

| 항목 | 수치 |
|------|------|
| 패키지 수 | **11개** |
| 소스 코드 | **7,809줄** (TypeScript) |
| 테스트 | **469개** (전체 통과) |
| 빌드 | **11/11 패키지** ✅ |
| 실제 문서 파싱 | **570/570** (100%, 349 HWPX + 221 HWP) |

### 레벨별 진행 상태

| Level | 내용 | 상태 |
|-------|------|------|
| **Level 1** | HWPX 읽기/쓰기 + HWP 5.x 읽기 | ✅ **완료** |
| **Level 2** | Format Converter (DOCX/HTML) | ✅ **완료** — DOCX 양방향, HTML 단방향 |
| **Level 3** | PDF Export | ✅ **완료** — HTML 렌더링 + Puppeteer |
| **Level 4** | Web Viewer | ✅ **완료** — React 컴포넌트 (235줄) |
| **Level 5** | Web Editor | 🟡 **진행 중** — ProseMirror 기반 (271줄, 21 tests) |

---

## 2. Level 1: HWPX 읽기/쓰기 + HWP 5.x 읽기 ✅ 완료

### 2.1 필수 기능 (Must Have)

| # | 기능 | 패키지 | 상태 |
|---|------|--------|------|
| M1 | HWPX 파일 열기 (ZIP→파트 추출) | hwpx-core | ✅ 완료 |
| M2 | HWPX 헤더 파싱 (글꼴, 스타일, 문단모양) | hwpx-parser | ✅ 완료 |
| M3 | HWPX 본문 파싱 (텍스트, 서식, 표) | hwpx-parser | ✅ 100% (349/349) |
| M4 | HWPX 파일 쓰기 (문서모델→ZIP) | hwpx-writer | ✅ 라운드트립 성공 |
| M5 | HwpxBuilder API (프로그래매틱 문서 생성) | hwpx-writer | ⬜ 미검증 |
| M6 | npm 배포 | 전체 | ⬜ **ONE 지시 시 진행** |

### 2.2 선택 기능 (Nice to Have)

| # | 기능 | 상태 |
|---|------|------|
| N1 | HWP 5.x 바이너리 읽기 | ✅ 완료 — hwp-reader |
| N2 | HWP→HWPX 변환 | ⬜ 미구현 |
| N3 | 표 세부 파싱 (셀 병합, 테두리) | ✅ 완료 — table-parser |
| N4 | 이미지/OLE 바이너리 데이터 추출 | ✅ 완료 — image-extractor |

---

## 3. Level 2: Format Converter (DOCX/HTML) ✅ 완료

### 3.1 구현 완료

| 패키지 | 기능 | 상태 |
|--------|------|------|
| **docx-writer** | HWPX → DOCX 변환 | ✅ 완료 (587줄, 38 tests) |
| **docx-reader** | DOCX → HWPX 변환 | ✅ 완료 (1,456줄, 82 tests) |
| **pdf-export** | HWPX → HTML 변환 (독립 HTML) | ✅ 완료 (378줄, TASK-019) |
| **handoc-cli** | CLI 도구 (convert, to-html 명령) | ✅ 완료 (173줄) |

### 3.2 선택 기능

| # | 항목 | 상태 |
|---|------|------|
| L2-1 | Google Docs API 연동 | ⬜ 미착수 (우선순위 낮음) |
| L2-2 | HTML → HWPX 역변환 | ⬜ 미착수 (필요시 구현) |

---

## 4. Level 3: PDF Export ✅ 완료

### 4.1 구현 완료

| 패키지 | 기능 | 상태 |
|--------|------|------|
| **pdf-export** | HWPX → HTML → PDF (Puppeteer) | ✅ 완료 (378줄, HTML 렌더링 포함) |
| **html-renderer** | 표, 이미지, 서식 HTML 변환 | ✅ base64 임베딩, CSS 스타일 |
| **CLI** | `handoc to-html`, `handoc to-pdf` | ✅ 실제 HWP 파일 테스트 통과 |

### 4.2 개선 가능 영역 (선택)

| # | 항목 | 상태 |
|---|------|------|
| L3-1 | 한글 폰트 임베딩 최적화 | ⬜ 현재 시스템 폰트 사용 (필요시 개선) |
| L3-2 | 페이지 레이아웃 고급 제어 | ⬜ 현재 기본 구현 (필요시 개선) |

---

## 5. Level 4: Web Viewer ✅ 완료

### 5.1 구현 완료

| 패키지 | 기능 | 상태 |
|--------|------|------|
| **@handoc/viewer** | React 기반 HWPX 뷰어 컴포넌트 | ✅ 완료 (235줄) |
| **렌더링 방식** | DOM 기반 (HTML/CSS) | ✅ 선택 완료 |
| **스타일 지원** | 서식, 문단, 표 렌더링 | ✅ styles.css 포함 |

### 5.2 아키텍처 결정

| 항목 | 선택 | 이유 |
|------|------|------|
| 렌더링 | DOM | 웹 표준 활용, 접근성 우수 |
| 프레임워크 | React | 생태계, 재사용성 |
| 레이아웃 | 연속 스크롤 | 웹 문서 표준 UX |

---

## 6. Level 5: Web Editor 🟡 진행 중

### 6.1 구현 완료

| 패키지 | 기능 | 상태 |
|--------|------|------|
| **@handoc/editor** | ProseMirror 기반 HWPX 에디터 | ✅ 기본 기능 완료 (14 tests, 267 total tests) |
| **스키마 매핑** | HWPX ↔ ProseMirror 변환 | ✅ CharPr/ParaPr → marks/align |
| **편집 기능** | 텍스트/서식/정렬 편집 | ✅ bold/italic/underline/fontSize/color/align |
| **라운드트립** | 편집 → HWPX 저장 | ✅ 검증 완료 |

### 6.2 아키텍처 결정

| 항목 | 선택 | 이유 |
|------|------|------|
| 편집 엔진 | **ProseMirror** | 확장성, 문서 구조 매핑 우수 |
| 협업 | 미정 | 추후 필요시 Y.js (CRDT) 고려 |
| 편집 범위 | 텍스트 + 서식 우선 | 표/이미지는 후속 작업 |
| Undo/Redo | ProseMirror 내장 | prosemirror-history |

### 6.3 미완료

| # | 항목 | 상태 |
|---|------|------|
| L5-1 | HWPX ↔ ProseMirror 스키마 완전 매핑 | ✅ **완료 (TASK-021)** |
| L5-2 | 표 편집 UI | ⬜ 미착수 |
| L5-3 | 이미지 삽입/편집 | ⬜ 미착수 |
| L5-4 | 실시간 협업 | ⬜ 미착수 (우선순위 낮음) |

### 6.4 알려진 제한사항

- 한 문단 내 혼합 인라인 서식 미지원 ("일반 **굵게** 일반")
- HwpxBuilder API에서 run-level 서식 지원 필요 (향후 개선)

---

## 7. 기능 매트릭스

참조: `docs/hwpml-element-catalog.md` (HWPML 스펙 130개 요소)

### 7.1 핵심 요소

| 요소 | 파싱(읽기) | 생성(쓰기) | 라운드트립 | 상태 |
|------|-----------|-----------|-----------|------|
| **텍스트** (hp:t) | ✅ | ✅ | ✅ | 570개 100% 추출 (HWPX+HWP) |
| **문단** (hp:p) | ✅ | ✅ | ✅ | paraPrIDRef, styleIDRef 등 속성 파싱 |
| **런** (hp:run) | ✅ | ✅ | ✅ | charPrIDRef 파싱 |
| **섹션** (hs:sec) | ✅ | ✅ | ✅ | 다중 섹션 지원 |
| **글꼴 정보** (hh:fontfaces) | ✅ | ✅ | ✅ | lang별 font 목록, HWP 변환 포함 |
| **글자 모양** (hh:charPr) | ✅ | ✅ | ✅ | bold/italic/underline/strikeout/color/fontRef/spacing/ratio |
| **문단 모양** (hh:paraPr) | ✅ | ✅ | ✅ | align/margin/lineSpacing/tabs/border/break |
| **스타일** (hh:style) | ✅ | ✅ | ✅ | id, type, name, engName |
| **넘버링/글머리표** (hh:numbering) | ✅ | ✅ | ✅ | 헤더 파싱 완료 (TASK-numbering) |
| **표** (hp:tbl) | ✅ | ✅ | ✅ | 행/열/셀/병합, DOCX 변환 테스트 (TASK-017) |
| **이미지** (hp:picture/pic) | ✅ | ✅ | ✅ | base64 임베딩, DOCX 변환 테스트 (TASK-017) |
| **섹션 속성** (hp:secPr) | ✅ | ⚠️ GenericElement | ⚠️ | 페이지 크기, 여백, 방향 파싱 |
| **도형** (line/rect/ellipse 등) | ✅ | ✅ | ✅ | 20종 전용 직렬화 (TASK-023) |
| **수식** (equation) | ✅ | ✅ | ✅ | MathML 전용 직렬화 (TASK-023) |
| **필드** (fieldBegin/End) | ✅ | ⚠️ GenericElement | ⚠️ | 페이지 번호, 날짜 등 |
| **머리말/꼬리말** | ✅ | ✅ | ✅ | HwpxBuilder v2 지원 |
| **각주/미주** | ✅ | ✅ | ✅ | HwpxBuilder v2 지원 |
| **변경추적** (trackChange) | ✅ | ⚠️ GenericElement | ⚠️ | 마크 4종 인식 (trackchange-memo) |
| **숨은댓글** (memo) | ✅ | ⚠️ GenericElement | ⚠️ | 파싱 완료 (trackchange-memo) |
| 기타 (컨트롤, 테두리, 책갈피, OLE, 양식, 글맵시) | ⚠️ GenericElement | ⚠️ GenericElement | ⚠️ | 데이터 보존 |

**HWP 5.x 바이너리 (hwp-reader)**

| 기능 | 상태 |
|------|------|
| CFB(OLE2) 컨테이너 열기 | ✅ |
| FileHeader / DocInfo 스트림 목록 | ✅ |
| 레코드 파싱 (태그/레벨/크기) | ✅ |
| 텍스트 추출 | ✅ |

**DOCX 변환 (docx-writer / docx-reader)**

| 기능 | 상태 |
|------|------|
| HWPX → DOCX (텍스트, 서식, 문단) | ✅ docx-writer |
| DOCX → HWPX (텍스트, 서식, 문단) | ✅ docx-reader |
| CLI (handoc convert) | ✅ handoc-cli |

**PDF Export (pdf-export)**

| 기능 | 상태 |
|------|------|
| HWPX → HTML 렌더링 | ✅ html-renderer |
| HTML → PDF (Puppeteer) | ✅ pdf-exporter |

### 7.2 현재 코드 통계

| 패키지 | 소스 줄 수 | 테스트 수 | 빌드 |
|--------|-----------|----------|------|
| document-model | 342 | 26 | ✅ |
| docx-reader | 1,456 | 82 | ✅ |
| docx-writer | 587 | 38 | ✅ |
| editor | 271 | 21 | ✅ |
| handoc-cli | 173 | 0 | ✅ |
| hwp-reader | 955 | 46 | ✅ |
| hwpx-core | 161 | 24 | ✅ |
| hwpx-parser | 2,069 | 127 | ✅ |
| hwpx-writer | 1,182 | 61 | ✅ |
| pdf-export | 378 | 0 | ✅ |
| viewer | 235 | 0 | ✅ |
| **합계** | **7,809** | **425** | **11/11 ✅** |

**참고:** 테스트 수는 `*.test.ts` 파일 내 `it()`/`test()` 호출 수. CLI/viewer는 통합 테스트로 검증.

### 7.3 인프라 & 도구

| 항목 | 상태 |
|------|------|
| Warning 시스템 (WarningCollector) | ✅ document-model |
| quality-gate 스크립트 | ✅ scripts/ |
| benchmark 스크립트 | ✅ scripts/ |
| 570개 실제 문서 통합 테스트 | ✅ (349 HWPX + 221 HWP) |
| 라운드트립 테스트 | ✅ scripts/test-roundtrip.ts |
| HwpxBuilder API (v2) | ✅ 이미지, 머리글, 각주, 제목, 페이지번호 |
| CLI 도구 | ✅ convert, to-html, to-pdf, inspect |

---

## 8. 작업 큐

### ✅ 완료된 태스크

<details>
<summary>Level 1 태스크 (전부 완료) — 클릭하여 펼치기</summary>

| 태스크 | 내용 | 완료일 |
|--------|------|--------|
| TASK-001 | hwpx-parser 빌드 에러 수정 | 2026-02-20 |
| TASK-002 | 텍스트 추출 실패 원인 분석 | 2026-02-20 |
| TASK-003 | 중첩 구조 텍스트 추출 개선 | 2026-02-20 |
| TASK-004 | 특수 요소 텍스트 추출 → 100% 달성 | 2026-02-20 |
| TASK-005 | 헤더 직렬화 (DocumentHeader → header.xml) | 2026-02-20 |
| TASK-006 | 본문 직렬화 (Section → section*.xml) | 2026-02-20 |
| TASK-007 | 통합 라이터 + HanDoc.fromBuffer/open API | 2026-02-20 |
| TASK-008 | 실제 문서 349개 라운드트립 대량 검증 | 2026-02-20 |
| TASK-009 | 표 세부 파싱 API | 2026-02-20 |
| TASK-010 | 이미지/바이너리 데이터 추출 | 2026-02-20 |
| TASK-011 | 섹션 속성 세부 파싱 | 2026-02-20 |
| — | annotation/shape/equation/field 파서들 | 2026-02-20 |
| — | hwp-reader (HWP 5.x) | 2026-02-20 |
| — | Warning 시스템 + quality-gate + benchmark | 2026-02-20 |

</details>

<details>
<summary>Level 2-5 태스크 (완료분)</summary>

| 태스크 | 내용 | 완료일 |
|--------|------|--------|
| TASK-012 | HwpxBuilder API (프로그래매틱 문서 생성) v2 | 2026-02-20 |
| TASK-013 | HWP→HWPX 변환 (폰트/스타일 보존) | 2026-02-21 |
| numbering | 넘버링/글머리표 헤더 파싱 | 2026-02-20 |
| trackchange-memo | 변경추적/숨은댓글 파싱 | 2026-02-20 |
| shape-detect-fix | 도형/수식 분리 파싱 | 2026-02-20 |
| docx-quality (TASK-017) | 표/이미지 DOCX 변환 테스트 강화 | 2026-02-21 |
| TASK-019 | HTML 독립 내보내기 (시맨틱 태그, print CSS, a11y) | 2026-02-21 |
| **TASK-021** | **Editor 스키마 완성 (CharPr/ParaPr → ProseMirror marks/align)** | **2026-02-21** |
| **TASK-023** | **도형/수식 Writer (shape/equation 전용 직렬화)** | **2026-02-21** |
| — | pdf-export (HWPX → PDF) | 2026-02-20 |
| — | viewer (React 컴포넌트) | 2026-02-20 |
| — | editor (ProseMirror 프로토타입) | 2026-02-20 |
| — | 570개 실제 문서 100% 파싱 성공 | 2026-02-20 |

</details>

### 🟠 P1: 높음 (다음 작업)

```
[TASK-022] npm 패키지 배포 (**ONE 지시 시 진행**)
  - 작업: 11개 패키지 npm 배포 준비 (README, LICENSE, 버전 관리)
  - 완료 기준: @handoc/* 패키지 npmjs.com에서 설치 가능
  - 예상 시간: 4시간
```

### 🟡 P2: 중간

```
[TASK-024] Editor 표 편집 UI
  - 작업: 표 삽입, 행/열 추가/삭제, 셀 병합
  - 예상 시간: 12시간

[TASK-025] Editor 이미지 삽입/편집
  - 작업: 이미지 업로드, 크기 조절, 정렬
  - 예상 시간: 8시간

[TASK-026] HTML → HWPX 역변환
  - 작업: HTML 파싱 → document-model → HWPX
  - 예상 시간: 10시간
```

### 🔵 P3: 낮음 (개선/미래)

```
[TASK-027] 실시간 협업 (Y.js CRDT)
[TASK-028] Google Docs API 연동
[TASK-029] PDF 페이지 레이아웃 고급 제어
[TASK-030] Viewer 모바일 반응형 최적화
```

### 실행 순서 요약

```
완료:     Level 1-4 완료 ✅
          - HWPX/HWP 읽기/쓰기
          - DOCX 양방향, HTML 단방향
          - PDF export
          - React Viewer
          - 570개 문서 100% 파싱
현재:     Level 5 진행 중 — Editor (ProseMirror)
다음:     TASK-021 (스키마 완성) → TASK-024/025 (표/이미지 편집)
후속:     TASK-023 (도형/수식 Writer)
준비:     TASK-022 (npm 배포 — ONE 지시 시)
미래:     실시간 협업, Google Docs 연동
```

---

## 9. 서브에이전트 운영 가이드

### 9.1 spawn 시 필수 포함 정보

```markdown
## 프로젝트 정보
- 경로: /Users/mj/handoc/
- 모노레포: pnpm workspace + Turborepo
- 언어: TypeScript 5.x
- 테스트: Vitest
- 번들러: tsup (ESM + CJS)

## 빌드/테스트 명령
- 전체 빌드: `cd /Users/mj/handoc && pnpm turbo build`
- 전체 테스트: `cd /Users/mj/handoc && pnpm turbo test`
- 특정 패키지: `pnpm turbo test --filter=@handoc/{패키지명}`

## 패키지 구조 (11개)
- packages/document-model/ — 공유 타입 + Warning 시스템
- packages/docx-reader/     — DOCX → HWPX 변환
- packages/docx-writer/     — HWPX → DOCX 변환
- packages/editor/          — ProseMirror 기반 에디터 (Level 5)
- packages/handoc-cli/      — CLI 도구 (convert, to-html, to-pdf)
- packages/hwp-reader/      — HWP 5.x 바이너리 리더
- packages/hwpx-core/       — ZIP I/O (fflate)
- packages/hwpx-parser/     — XML→모델 (fast-xml-parser)
- packages/hwpx-writer/     — 모델→XML→ZIP
- packages/pdf-export/      — HWPX → HTML → PDF (Puppeteer)
- packages/viewer/          — React 뷰어 컴포넌트 (Level 4)

## 의존 관계
document-model ← hwpx-core ← hwpx-parser
document-model ← hwpx-core ← hwpx-writer
document-model ← hwp-reader
hwpx-parser + hwpx-writer ← docx-reader
hwpx-parser ← docx-writer
hwpx-parser ← pdf-export
전체 ← handoc-cli

## 규칙
1. 기존 테스트를 깨뜨리지 않는다
2. GenericElement로 미지원 요소를 보존한다 (데이터 손실 금지)
3. python-hwpx 코드를 직접 복사/번역하지 않는다 (Non-Commercial 라이선스)
4. 한컴 공식 스펙(docs/specs/)과 실제 HWPX 파일 구조를 PRIMARY 참조로 사용
5. 작업 완료 후 반드시 빌드+테스트 실행하고 결과 보고
```

### 9.2 결과 검증 체크리스트

- [ ] `pnpm turbo build` 전체 성공 (11/11)
- [ ] `pnpm turbo test` 전체 통과 (425개 이상)
- [ ] 변경된 파일이 태스크 범위 내인지
- [ ] 새 코드에 테스트가 포함되어 있는지
- [ ] 570개 실제 문서 파싱 성공률 유지 (100%)

### 9.3 충돌 방지 규칙

1. 같은 파일 동시 수정 금지
2. 패키지 단위 잠금: 한 패키지에 하나의 서브에이전트만
3. document-model 타입 변경은 MJ 승인 후 진행
4. git 브랜치 사용 권장: `feat/task-{ID}`

---

## 10. 품질 게이트

- [x] `pnpm turbo build` 성공 (11/11 패키지)
- [x] `pnpm turbo test` 전체 통과 (425개)
- [x] 570개 실제 문서 파싱 성공률 100% (349 HWPX + 221 HWP)
- [x] 텍스트 추출 성공률 100% (570/570)
- [x] HWPX/DOCX 라운드트립 검증 (TASK-017)
- [x] HTML/PDF 출력 검증 (TASK-019)
- [ ] Editor 생성 문서 한컴오피스 호환성 (진행 중)

---

## 부록: 파일 위치 빠른 참조

```
/Users/mj/handoc/
├── docs/
│   ├── MASTER-PLAN.md          ← 이 문서
│   ├── REQUIREMENTS.md         ← 비전/로드맵
│   ├── CHANGELOG.md            ← 버전 이력
│   ├── hwpml-element-catalog.md
│   └── specs/                   ← 한컴 공식 스펙 PDF
├── packages/
│   ├── document-model/          ← 342줄, 26 tests
│   ├── docx-reader/             ← 1,456줄, 82 tests
│   ├── docx-writer/             ← 587줄, 38 tests
│   ├── editor/                  ← 271줄, 21 tests (ProseMirror)
│   ├── handoc-cli/              ← 173줄 (convert, to-html, to-pdf)
│   ├── hwp-reader/              ← 955줄, 46 tests
│   ├── hwpx-core/               ← 161줄, 24 tests
│   ├── hwpx-parser/             ← 2,069줄, 127 tests
│   ├── hwpx-writer/             ← 1,182줄, 61 tests
│   ├── pdf-export/              ← 378줄 (HTML renderer + PDF)
│   └── viewer/                  ← 235줄 (React)
├── scripts/
│   ├── benchmark.ts
│   ├── quality-gate.ts
│   ├── test-real-docs.ts
│   └── test-roundtrip.ts
├── test-documents/              ← 570개 실제 파일 (349 HWPX + 221 HWP)
└── turbo.json
```

---

*HanDoc — HWP를 웹으로.*
