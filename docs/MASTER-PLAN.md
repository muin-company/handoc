# HanDoc 마스터 운영 문서

> 🟢 **Active Plan** — 이 문서가 유일한 계획 문서입니다. 다른 계획 문서는 `docs/archive/`로 이동되었습니다.

> **최종 업데이트:** 2026-02-20 (v3 — Level 2-4 현행화)  
> **목적:** 이 문서만 보면 누구든 (MJ, 서브에이전트) 다음 할 일을 즉시 판단 가능

---

## 1. 프로젝트 현황 요약

| 항목 | 수치 |
|------|------|
| 패키지 수 | **9개** |
| 소스 코드 | **4,476줄** (45 파일) |
| 테스트 | **170개** (전체 통과) |
| 빌드 | **9/9 패키지** ✅ |
| 실제 문서 파싱 | **349/349** (100%) |

### 레벨별 진행 상태

| Level | 내용 | 상태 |
|-------|------|------|
| **Level 1** | HWPX 읽기/쓰기 + HWP 5.x 읽기 | ✅ **완료** |
| **Level 2** | Format Converter (DOCX) | 🟡 **진행 중** — docx-writer, docx-reader 완료 |
| **Level 3** | PDF Export | 🟡 **진행 중** — pdf-export 기본 구현 완료 |
| **Level 4** | Web Viewer | ⬜ **미착수** |
| **Level 5** | Web Editor | ⬜ 별도 프로젝트 참조 |

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

## 3. Level 2: Format Converter (DOCX) 🟡 진행 중

### 3.1 구현 완료

| 패키지 | 기능 | 상태 |
|--------|------|------|
| **docx-writer** | HWPX → DOCX 변환 | ✅ 완료 (220줄, 테스트 5개) |
| **docx-reader** | DOCX → HWPX 변환 | ✅ 완료 (476줄, 테스트 10개) |
| **handoc-cli** | CLI 도구 (convert 명령) | ✅ 완료 (104줄, 테스트 6개) |

### 3.2 미완료

| # | 항목 | 상태 |
|---|------|------|
| L2-1 | HTML 변환 | ⬜ 미착수 |
| L2-2 | Google Docs API 연동 | ⬜ 미착수 |
| L2-3 | 표/이미지/수식 변환 정확도 개선 | ⬜ 평가 필요 |

---

## 4. Level 3: PDF Export 🟡 진행 중

### 4.1 구현 완료

| 패키지 | 기능 | 상태 |
|--------|------|------|
| **pdf-export** | HWPX → HTML → PDF (Puppeteer) | ✅ 기본 구현 완료 (265줄, 테스트 6개) |

### 4.2 미완료

| # | 항목 | 상태 |
|---|------|------|
| L3-1 | 한글 폰트 임베딩 | ⬜ 검증 필요 |
| L3-2 | 페이지 레이아웃 정확도 (줄바꿈, 페이지 나눔) | ⬜ 개선 필요 |
| L3-3 | 복잡 문서 (표/이미지/수식) PDF 품질 | ⬜ 평가 필요 |

---

## 5. Level 4: Web Viewer ⬜ 미착수

### 5.1 사전 조사 필요 항목

| # | 조사 항목 |
|---|----------|
| L4-1 | 렌더링 방식: DOM vs Canvas vs SVG |
| L4-2 | 프레임워크: React/Vue/Vanilla |
| L4-3 | 아래한글 렌더링 정확도 목표 |
| L4-4 | 페이지 뷰 vs 연속 스크롤 vs 양쪽 모두 |
| L4-5 | 모바일 반응형 전략 |

---

## 6. Level 5: Web Editor ⬜ 별도 프로젝트

| # | 조사 항목 |
|---|----------|
| L5-1 | 편집 엔진: ProseMirror vs Slate vs TipTap vs 자체 구현 |
| L5-2 | 실시간 협업 필요 여부 (CRDT/OT) |
| L5-3 | 편집 가능 범위 (텍스트만 vs 표/이미지도) |
| L5-4 | 실행취소/다시실행 아키텍처 |

---

## 7. 기능 매트릭스

참조: `docs/hwpml-element-catalog.md` (HWPML 스펙 130개 요소)

### 7.1 핵심 요소

| 요소 | 파싱(읽기) | 생성(쓰기) | 라운드트립 | 상태 |
|------|-----------|-----------|-----------|------|
| **텍스트** (hp:t) | ✅ | ✅ | ✅ | 349개 100% 추출 |
| **문단** (hp:p) | ✅ | ✅ | ✅ | paraPrIDRef, styleIDRef 등 속성 파싱 |
| **런** (hp:run) | ✅ | ✅ | ✅ | charPrIDRef 파싱 |
| **섹션** (hs:sec) | ✅ | ✅ | ✅ | 다중 섹션 지원 |
| **글꼴 정보** (hh:fontfaces) | ✅ | ✅ | ✅ | lang별 font 목록 파싱 |
| **글자 모양** (hh:charPr) | ✅ | ✅ | ✅ | height, bold, italic, underline, strikeout, color, fontRef 등 |
| **문단 모양** (hh:paraPr) | ✅ | ✅ | ✅ | align, margin, lineSpacing |
| **스타일** (hh:style) | ✅ | ✅ | ✅ | id, type, name, engName |
| **표** (hp:tbl) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | table-parser: 행/열/셀/병합/크기 |
| **이미지** (hp:picture/pic) | ✅ 추출 API | ⚠️ GenericElement 보존 | ⚠️ | image-extractor |
| **섹션 속성** (hp:secPr) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | section-props-parser |
| **도형** (line/rect/ellipse 등) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | shape-parser: 20종 |
| **수식** (equation) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | equation-parser |
| **필드** (fieldBegin/End) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | field-parser |
| **머리말/꼬리말** | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | annotation-parser |
| **각주/미주** | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | annotation-parser |
| **변경추적** (trackChange) | ✅ 헤더 파싱 | ⚠️ GenericElement 보존 | ⚠️ | 마크 4종 인식 |
| 기타 (컨트롤, 메모, 테두리, 글머리표, 책갈피, OLE, 양식, 글맵시) | ⚠️ GenericElement | ⚠️ GenericElement 보존 | ⚠️ | |

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

| 패키지 | src 파일 수 | 소스 줄 수 | 테스트 수 | 빌드 |
|--------|------------|-----------|----------|------|
| document-model | 7 | 256 | 13 | ✅ |
| docx-reader | 4 | 476 | 10 | ✅ |
| docx-writer | 2 | 221 | 5 | ✅ |
| handoc-cli | 1 | 104 | 6 | ✅ |
| hwp-reader | 6 | 443 | 34 | ✅ |
| hwpx-core | 3 | 153 | 9 | ✅ |
| hwpx-parser | 14 | 1,632 | 61 (+11 skipped) | ✅ |
| hwpx-writer | 5 | 926 | 26 | ✅ |
| pdf-export | 3 | 265 | 6 | ✅ |
| **합계** | **45** | **4,476** | **170** | **9/9 ✅** |

### 7.3 인프라

| 항목 | 상태 |
|------|------|
| Warning 시스템 (WarningCollector) | ✅ |
| quality-gate 스크립트 | ✅ |
| benchmark 스크립트 | ✅ |
| 349개 실제 문서 통합 테스트 | ✅ |
| 라운드트립 테스트 | ✅ |

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
<summary>Level 2-3 태스크 (완료분)</summary>

| 태스크 | 내용 | 완료일 |
|--------|------|--------|
| — | docx-writer (HWPX → DOCX 변환) | 2026-02-20 |
| — | docx-reader (DOCX → HWPX 변환) | 2026-02-20 |
| — | handoc-cli (CLI 도구) | 2026-02-20 |
| — | pdf-export (HWPX → PDF) | 2026-02-20 |

</details>

### 🟠 P1: 높음 (다음 작업)

```
[TASK-012] HwpxBuilder API (프로그래매틱 문서 생성) — M5
  - 작업: 빌더 패턴 API로 새 HWPX 문서 생성
  - 완료 기준: 생성된 파일이 한컴오피스에서 열림 (수동 검증)
  - 예상 시간: 6시간

[TASK-017] DOCX 변환 품질 개선 (표/이미지/수식)
  - 작업: docx-writer/docx-reader에서 표, 이미지, 수식 변환 지원
  - 완료 기준: 표/이미지 포함 문서 변환 성공
  - 예상 시간: 8시간

[TASK-018] PDF Export 품질 개선 (한글 폰트, 레이아웃)
  - 작업: 한글 폰트 임베딩, 페이지 나눔, 표 렌더링
  - 완료 기준: 복잡 문서 PDF 출력 품질 수동 검증
  - 예상 시간: 8시간
```

### 🟡 P2: 중간

```
[TASK-013] HWP→HWPX 변환
  - 의존: hwp-reader ✅
  - 작업: hwp-reader → document-model → hwpx-writer 파이프라인
  - 예상 시간: 8시간

[TASK-014] npm 0.1.0 배포 (**ONE 별도 지시 시 진행**)
  - 예상 시간: 2시간

[TASK-019] HTML 변환 (HWPX ↔ HTML)
  - 작업: html-renderer 확장 또는 별도 html-writer/html-reader
  - 예상 시간: 6시간
```

### 🔵 P3: 낮음 (개선)

```
[TASK-015] 표/이미지/도형 전용 Writer (GenericElement → 전용 직렬화)
[TASK-016] CharProperty 세부 속성 확장
[TASK-020] Web Viewer (Level 4) 프로토타입
```

### 실행 순서 요약

```
현재:     Level 2-3 기본 구현 완료
다음:     TASK-012 (Builder API) + TASK-017/018 (변환 품질)
후속:     TASK-013 (HWP→HWPX) + TASK-019 (HTML)
마무리:   TASK-014 (npm 배포 — ONE 지시 시)
미래:     Level 4 (Viewer) → Level 5 (Editor)
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

## 패키지 구조 (9개)
- packages/document-model/ — 공유 타입 + Warning 시스템
- packages/docx-reader/     — DOCX → HWPX 변환
- packages/docx-writer/     — HWPX → DOCX 변환
- packages/handoc-cli/      — CLI 도구
- packages/hwp-reader/      — HWP 5.x 바이너리 리더
- packages/hwpx-core/       — ZIP I/O (fflate)
- packages/hwpx-parser/     — XML→모델 (fast-xml-parser)
- packages/hwpx-writer/     — 모델→XML→ZIP
- packages/pdf-export/      — HWPX → PDF (Puppeteer)

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

- [ ] `pnpm turbo build` 전체 성공 (9/9)
- [ ] `pnpm turbo test` 전체 통과 (170개 이상)
- [ ] 변경된 파일이 태스크 범위 내인지
- [ ] 새 코드에 테스트가 포함되어 있는지
- [ ] 349개 실제 문서 파싱 성공률 유지 (100%)

### 9.3 충돌 방지 규칙

1. 같은 파일 동시 수정 금지
2. 패키지 단위 잠금: 한 패키지에 하나의 서브에이전트만
3. document-model 타입 변경은 MJ 승인 후 진행
4. git 브랜치 사용 권장: `feat/task-{ID}`

---

## 10. 품질 게이트

- [x] `pnpm turbo build` 성공 (9/9 패키지)
- [x] `pnpm turbo test` 전체 통과 (170개)
- [x] 349개 실제 문서 파싱 성공률 100%
- [x] 텍스트 추출 성공률 100% (349/349)
- [ ] 생성된 HWPX/DOCX/PDF 파일 한컴오피스/Word에서 열기 수동 검증

---

## 부록: 파일 위치 빠른 참조

```
/Users/mj/handoc/
├── docs/
│   ├── MASTER-PLAN.md          ← 이 문서
│   ├── REQUIREMENTS.md         ← 비전/로드맵
│   ├── hwpml-element-catalog.md
│   └── specs/                   ← 한컴 공식 스펙 PDF
├── packages/
│   ├── document-model/          ← 7 src, 256줄, 13 tests
│   ├── docx-reader/             ← 4 src, 476줄, 10 tests
│   ├── docx-writer/             ← 2 src, 221줄, 5 tests
│   ├── handoc-cli/              ← 1 src, 104줄, 6 tests
│   ├── hwp-reader/              ← 6 src, 443줄, 34 tests
│   ├── hwpx-core/               ← 3 src, 153줄, 9 tests
│   ├── hwpx-parser/             ← 14 src, 1,632줄, 61 tests
│   ├── hwpx-writer/             ← 5 src, 926줄, 26 tests
│   └── pdf-export/              ← 3 src, 265줄, 6 tests
├── scripts/
│   ├── benchmark.ts
│   ├── quality-gate.ts
│   ├── test-real-docs.ts
│   └── test-roundtrip.ts
├── test-documents/              ← 349개 실제 HWPX
└── turbo.json
```

---

*HanDoc — HWP를 웹으로.*
