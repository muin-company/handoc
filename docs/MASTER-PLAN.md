# HanDoc 마스터 운영 문서

> 🟢 **Active Plan** — 이 문서가 유일한 계획 문서입니다. 다른 계획 문서는 `docs/archive/`로 이동되었습니다.

> **최종 업데이트:** 2026-02-20  
> **목적:** 이 문서만 보면 누구든 (MJ, 서브에이전트) 다음 할 일을 즉시 판단 가능

---

## 1. Level 1 완료 기준 (Definition of Done)

Level 1 = **HWPX 읽기/쓰기 + HWP 5.x 읽기 + HWP→HWPX 변환** TypeScript 라이브러리.

### 1.1 필수 기능 (Must Have)

| # | 기능 | 패키지 | 완료 기준 | 상태 |
|---|------|--------|----------|------|
| M1 | HWPX 파일 열기 (ZIP→파트 추출) | hwpx-core | 349개 실제 문서 100% 열기 성공 | ✅ 완료 |
| M2 | HWPX 헤더 파싱 (글꼴, 스타일, 문단모양) | hwpx-parser | 349개 중 warning 0 비율 ≥ 90% | ✅ 완료 |
| M3 | HWPX 본문 파싱 (텍스트, 서식, 표) | hwpx-parser | 텍스트 추출 성공률 ≥ 95% | ✅ 100% (349/349) |
| M4 | HWPX 파일 쓰기 (문서모델→ZIP) | hwpx-writer | 라운드트립 성공률 ≥ 80% | ✅ 라운드트립 성공 |
| M5 | HwpxBuilder API (프로그래매틱 문서 생성) | hwpx-writer | 생성 파일 한컴오피스 열기 성공 | ⬜ 미검증 |
| M6 | npm 배포 | 전체 | `@handoc/*` 5개 패키지 npm 퍼블리시 완료 | ⬜ **ONE 지시 시 진행** — 별도 지시 있을 때까지 보류 |

### 1.2 선택 기능 (Nice to Have — Level 1에서 하면 좋지만 필수 아님)

| # | 기능 | 상태 |
|---|------|------|
| N1 | HWP 5.x 바이너리 읽기 | ✅ 완료 — hwp-reader 패키지 (CFB 파싱, 레코드 파싱, 텍스트 추출) |
| N2 | HWP→HWPX 변환 | ⬜ N1 완료됨, 변환 로직 미구현 |
| N3 | 표 세부 파싱 (셀 병합, 테두리) | ✅ 완료 — table-parser (행/열/셀/병합/크기 파싱) |
| N4 | 이미지/OLE 바이너리 데이터 추출 | ✅ 완료 — image-extractor (OpcPackage에서 이미지 추출) |

### 1.3 테스트 기준

| 메트릭 | 현재 값 | Level 1 목표 |
|--------|---------|-------------|
| 349개 실제 문서 파싱 성공률 | **100%** (349/349) | 100% 유지 ✅ |
| 텍스트 추출 성공률 | **100%** (349/349) | ≥ 95% ✅ 달성 |
| 텍스트 추출 0줄 파일 | **0개** | ≤ 2개 ✅ 달성 |
| 유닛 테스트 수 | **114개** (5패키지) | ≥ 80개 ✅ 달성 |
| 라운드트립 테스트 (parse→write→parse) | ✅ 구현 완료 | ≥ 10개 픽스처 통과 ✅ |
| 빌드 성공 | **5/5 패키지** | 5/5 ✅ |

### 1.4 성능 기준

| 메트릭 | 기준 |
|--------|------|
| 단순 문서 (1 섹션, 10 단락) 파싱 | < 50ms |
| 복잡 문서 (10 섹션, 1000 단락) 파싱 | < 500ms |
| 라운드트립 (parse + write) | < 1초 |
| 메모리 | 입력 파일 크기의 10배 이내 |

### 1.5 npm 배포 체크리스트

- [ ] 패키지명: `@handoc/document-model`, `@handoc/hwpx-core`, `@handoc/hwpx-parser`, `@handoc/hwpx-writer`, `@handoc/hwp-reader`
- [ ] 버전: `0.1.0` (첫 릴리스)
- [ ] 라이선스: MIT + 한컴 저작권 고지
- [ ] ESM + CJS 듀얼 빌드
- [ ] TypeScript 타입 선언 (.d.ts) 포함
- [ ] README.md (사용법, API 예제)
- [ ] CHANGELOG.md
- [ ] `pnpm turbo build && pnpm turbo test` 전체 통과

---

## 2. 기능 매트릭스

참조: `docs/hwpml-element-catalog.md` (HWPML 스펙 130개 요소)

### 2.1 핵심 요소

| 요소 | 파싱(읽기) | 생성(쓰기) | 라운드트립 | 상태 |
|------|-----------|-----------|-----------|------|
| **텍스트** (hp:t) | ✅ | ✅ | ✅ | 349개 100% 추출 |
| **문단** (hp:p) | ✅ | ✅ | ✅ | paraPrIDRef, styleIDRef 등 속성 파싱 |
| **런** (hp:run) | ✅ | ✅ | ✅ | charPrIDRef 파싱 |
| **섹션** (hs:sec) | ✅ | ✅ | ✅ | 다중 섹션 지원 |
| **글꼴 정보** (hh:fontfaces) | ✅ | ✅ | ✅ | lang별 font 목록 파싱 |
| **글자 모양** (hh:charPr) | ✅ | ✅ | ✅ | height, bold, italic, underline, strikeout, color, fontRef 등 세부 속성 |
| **문단 모양** (hh:paraPr) | ✅ | ✅ | ✅ | align, margin, lineSpacing |
| **스타일** (hh:style) | ✅ | ✅ | ✅ | id, type, name, engName |
| **표** (hp:tbl) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | table-parser: 행/열/셀/병합/크기 파싱, tableToTextGrid API |
| **이미지** (hp:picture/pic) | ✅ 추출 API | ⚠️ GenericElement 보존 | ⚠️ | image-extractor: OpcPackage에서 이미지 바이트 추출 |
| **섹션 속성** (hp:secPr) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | section-props-parser: pagePr/margin/column 파싱 |
| **도형** (line/rect/ellipse 등) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | shape-parser: 20종 인라인 객체, 좌표/크기/텍스트 추출 |
| **수식** (equation) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | equation-parser: SCRIPT 텍스트 파싱 |
| **필드** (fieldBegin/End) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | field-parser: 하이퍼링크 등 필드 타입/값 파싱 |
| **머리말/꼬리말** (header/footer) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | annotation-parser: 텍스트 추출 API |
| **각주/미주** (footnote/endnote) | ✅ 전용 파서 | ⚠️ GenericElement 보존 | ⚠️ | annotation-parser: 텍스트 추출 API |
| **컨트롤** (hp:ctrl) | ⚠️ GenericElement | ⚠️ GenericElement 보존 | ⚠️ | colPr 등 |
| **변경추적** (trackChange) | ✅ 헤더 파싱 | ⚠️ GenericElement 보존 | ⚠️ | 마크 4종 인식 |
| **메모** (memo) | ✅ 헤더 파싱 | ⚠️ GenericElement 보존 | ⚠️ | |
| **페이지 설정** (pagePr/margin) | ✅ section-props-parser | ⚠️ GenericElement 보존 | ⚠️ | mm 단위 페이지 크기/여백 |
| **테두리/배경** (borderFill) | ⚠️ GenericElement | ⚠️ GenericElement 보존 | ⚠️ | |
| **글머리표/번호** (bullet/numbering) | ⚠️ GenericElement | ⚠️ GenericElement 보존 | ⚠️ | |
| **책갈피** (bookmark) | ⚠️ GenericElement | ⚠️ GenericElement 보존 | ⚠️ | |
| **OLE 객체** | ⚠️ GenericElement | ⚠️ GenericElement 보존 | ⚠️ | |
| **양식 객체** (button/checkbox 등) | ⚠️ GenericElement | ⚠️ GenericElement 보존 | ⚠️ | |
| **글맵시** (textart) | ⚠️ GenericElement | ⚠️ GenericElement 보존 | ⚠️ | |

**HWP 5.x 바이너리 (hwp-reader)**

| 기능 | 상태 |
|------|------|
| CFB(OLE2) 컨테이너 열기 | ✅ cfb-reader |
| FileHeader / DocInfo 스트림 목록 | ✅ readHwp |
| 레코드 파싱 (태그/레벨/크기) | ✅ record-parser |
| 텍스트 추출 | ✅ text-extractor (extractTextFromHwp) |

**범례:**
- ✅ = 전용 타입/파서로 파싱, 데이터 접근 가능
- ⚠️ = GenericElement로 보존 (데이터 손실 없으나 타입 안전 접근 불가)
- ❌ = 미구현

### 2.2 현재 코드 통계

| 패키지 | src 파일 수 | 소스 줄 수 | 테스트 수 | 빌드 |
|--------|------------|-----------|----------|------|
| document-model | 7 | 256줄 | 13 | ✅ |
| hwp-reader | 5 | 318줄 | 21 | ✅ |
| hwpx-core | 3 | 153줄 | 9 | ✅ |
| hwpx-parser | 14 | 1,632줄 | 64 | ✅ |
| hwpx-writer | 4 | 474줄 | 7 | ✅ |
| **합계** | **33** | **2,833줄** | **114** | **5/5 ✅** |

### 2.3 인프라

| 항목 | 상태 |
|------|------|
| Warning 시스템 (WarningCollector) | ✅ document-model/warning.ts |
| quality-gate 스크립트 | ✅ scripts/quality-gate.ts |
| benchmark 스크립트 | ✅ scripts/benchmark.ts |
| 349개 실제 문서 통합 테스트 | ✅ scripts/test-real-docs.ts |
| 라운드트립 테스트 | ✅ scripts/test-roundtrip.ts |

---

## 3. 작업 큐 (우선순위 + 의존성)

### ✅ 완료된 태스크

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
| TASK-009 | 표 세부 파싱 API (행/열/셀/병합/크기, tableToTextGrid) | 2026-02-20 |
| TASK-010 | 이미지/바이너리 데이터 추출 (image-extractor) | 2026-02-20 |
| TASK-011 | 섹션 속성 세부 파싱 (pagePr/margin/column) | 2026-02-20 |
| — | annotation-parser (머리말/꼬리말/각주/미주) | 2026-02-20 |
| — | shape-parser (20종 도형 파싱) | 2026-02-20 |
| — | equation-parser (수식 SCRIPT 파싱) | 2026-02-20 |
| — | field-parser (하이퍼링크 등 필드 파싱) | 2026-02-20 |
| — | hwp-reader (HWP 5.x CFB 리더 + 텍스트 추출) | 2026-02-20 |
| — | Warning 시스템 + quality-gate + benchmark | 2026-02-20 |

### 🟠 P1: 높음 (다음 작업)

```
[TASK-012] HwpxBuilder API (프로그래매틱 문서 생성) — M5
  - 의존: 없음 (hwpx-writer 완성)
  - 작업: 빌더 패턴 API로 새 HWPX 문서 프로그래매틱 생성
  - 완료 기준: 생성된 파일이 한컴오피스에서 열림 (수동 검증)
  - 예상 시간: 6시간
```

### 🟡 P2: 중간

```
[TASK-013] HWP→HWPX 변환 (Level 1 선택)
  - 의존: hwp-reader 완료 ✅
  - 작업: hwp-reader 출력 → document-model → hwpx-writer로 변환 파이프라인
  - 완료 기준: 기본 텍스트 HWP가 HWPX로 변환, 한컴오피스 열기 성공
  - 예상 시간: 8시간

[TASK-014] npm 0.1.0 배포 (**ONE 별도 지시 시 진행 — 그 전까지 보류**)
  - 의존: M5 검증 완료 후
  - 작업: README, CHANGELOG, package.json 메타데이터, npm publish
  - 완료 기준: `npm publish --dry-run` 성공
  - 예상 시간: 2시간
```

### 🔵 P3: 낮음 (개선)

```
[TASK-015] 표/이미지/도형 전용 Writer (GenericElement → 전용 직렬화)
  - 현재: 읽기는 전용 파서, 쓰기는 GenericElement 보존
  - 작업: 전용 파서 결과를 직접 직렬화하는 Writer 추가
  - 완료 기준: 표/이미지/도형도 타입 안전 라운드트립

[TASK-016] CharProperty 세부 속성 확장
  - 작업: 현재 파싱되지 않는 세부 속성 추가 (shadow, outline, emboss 등)
  - 완료 기준: HWPML 스펙 charPr 속성 90% 이상 커버
```

### 실행 순서 요약

```
다음:     TASK-012 (HwpxBuilder API)
          ↓
후속:     TASK-013 (HWP→HWPX 변환)
          ↓
마무리:   TASK-014 (npm 배포 — ONE 지시 시)
개선:     TASK-015, TASK-016 (필요 시)
```

---

## 4. 서브에이전트 운영 가이드

### 4.1 spawn 시 필수 포함 정보

모든 서브에이전트에게 반드시 전달할 컨텍스트:

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
- 특정 패키지: `pnpm turbo build --filter=@handoc/{패키지명}`
- 특정 패키지 테스트: `pnpm turbo test --filter=@handoc/{패키지명}`

## 패키지 구조 (5개)
- packages/document-model/ — 공유 타입 + Warning 시스템 (의존성 없음)
- packages/hwp-reader/     — HWP 5.x 바이너리 리더 (CFB 파싱, 텍스트 추출)
- packages/hwpx-core/      — ZIP I/O (fflate 의존)
- packages/hwpx-parser/    — XML→모델 (fast-xml-parser 의존)
- packages/hwpx-writer/    — 모델→XML→ZIP

## 의존 관계
document-model ← hwpx-core ← hwpx-parser
document-model ← hwpx-core ← hwpx-writer
document-model ← hwp-reader

## 규칙
1. 기존 테스트를 깨뜨리지 않는다
2. GenericElement로 미지원 요소를 보존한다 (데이터 손실 금지)
3. python-hwpx 코드를 직접 복사/번역하지 않는다 (Non-Commercial 라이선스)
4. 한컴 공식 스펙(docs/specs/)과 실제 HWPX 파일 구조를 PRIMARY 참조로 사용
5. 작업 완료 후 반드시 빌드+테스트 실행하고 결과 보고
```

### 4.2 결과 검증 체크리스트

서브에이전트 결과물 수신 시 확인:

- [ ] `pnpm turbo build` 전체 성공 (5/5)
- [ ] `pnpm turbo test` 전체 통과 (114개 이상)
- [ ] 변경된 파일이 태스크 범위 내인지 (다른 패키지 무단 수정 없음)
- [ ] 새 코드에 테스트가 포함되어 있는지
- [ ] `wc -l` 로 실제 코드량 확인 (환각 방지)
- [ ] 349개 실제 문서 파싱 성공률 유지 (100%)

### 4.3 충돌 방지 규칙

1. **같은 파일 동시 수정 금지:** 두 서브에이전트가 같은 .ts 파일을 수정하면 안 됨
2. **패키지 단위 잠금:** 한 패키지에는 한 번에 하나의 서브에이전트만 작업
3. **document-model 변경은 사전 합의:** 타입 변경은 다른 패키지에 영향 → MJ 승인 후 진행
4. **git 브랜치 사용 권장:** `feat/task-{ID}` 브랜치에서 작업 → PR 방식

### 4.4 서브에이전트별 권장 모델

| 작업 유형 | 모델 | 이유 |
|----------|------|------|
| 분석/설계 | opus | 복잡한 판단 필요 |
| 코드 구현 (대부분) | sonnet | 속도/비용 효율 |
| HWP 5.x 바이너리 (TASK-013) | opus | 바이너리 포맷 해석 난이도 높음 |

---

## 5. 품질 게이트

### 5.1 코드 머지 전 필수 확인

- [x] `pnpm turbo build` 성공 (5/5 패키지)
- [x] `pnpm turbo test` 전체 통과 (114개)
- [x] 349개 실제 문서 파싱 성공률 100% 유지
- [x] 텍스트 추출 성공률 100% (349/349)
- [x] 기존 테스트 중 깨진 것 0개

### 5.2 라운드트립 테스트

- [x] parse→write→parse 구현 완료
- [x] 349개 대량 라운드트립 검증 (scripts/test-roundtrip.ts)
- [ ] 생성된 HWPX 파일이 한컴오피스에서 열림 (수동 검증 필요)

### 5.3 실제 문서 테스트 실행 방법

```bash
# 349개 실제 문서 테스트
cd /Users/mj/handoc
pnpm turbo test --filter=@handoc/hwpx-parser

# 품질 게이트
npx tsx scripts/quality-gate.ts

# 벤치마크
npx tsx scripts/benchmark.ts
```

### 5.4 성능 회귀 방지

새 기능 추가 시 기존 파싱 속도가 2배 이상 느려지면 안 됨.
`docs/benchmark-results.md`에 결과 기록하고 비교.

---

## 6. Level 2~5 사전 조사 필요 항목

### Level 2: Format Converter (HWPX ↔ DOCX/HTML/Google Docs)

| # | 조사 항목 | 결정 필요 시점 |
|---|----------|--------------|
| L2-1 | DOCX 변환 라이브러리 선택: docx (npm) vs 직접 구현 | Level 2 시작 전 |
| L2-2 | HTML 변환: 어디까지 서식 보존할 것인가 (CSS 매핑 정의) | Level 2 시작 전 |
| L2-3 | Google Docs API: 어떤 API 사용 (Docs API vs Drive export) | Level 2 시작 전 |
| L2-4 | 양방향 변환 시 데이터 손실 허용 범위 (표/이미지/수식) | Level 2 시작 전 |
| L2-5 | HWPX 요소 ↔ DOCX 요소 매핑 테이블 작성 | Level 2 첫 주 |

### Level 3: PDF Export

| # | 조사 항목 | 결정 필요 시점 |
|---|----------|--------------|
| L3-1 | PDF 렌더링 엔진: pdfkit vs pdf-lib vs Puppeteer(HTML 경유) | Level 3 시작 전 |
| L3-2 | 한글 폰트 임베딩 방법 (라이선스 이슈 — 함초롬 등) | Level 3 시작 전 |
| L3-3 | 페이지 레이아웃 엔진 필요 여부 (줄바꿈, 페이지 나눔 계산) | Level 3 시작 전 |
| L3-4 | 성능 목표: 100페이지 문서 PDF 변환 시간 | Level 3 시작 전 |

### Level 4: Web Viewer

| # | 조사 항목 | 결정 필요 시점 |
|---|----------|--------------|
| L4-1 | 렌더링 방식: DOM vs Canvas vs SVG | Level 4 시작 전 |
| L4-2 | 프레임워크: React/Vue/Vanilla | Level 4 시작 전 |
| L4-3 | 아래한글 렌더링 정확도 목표 (pixel-perfect vs "읽을 수 있는 수준") | Level 4 시작 전 |
| L4-4 | 페이지 뷰 vs 연속 스크롤 vs 양쪽 모두 | Level 4 시작 전 |
| L4-5 | 모바일 반응형 전략 | Level 4 시작 전 |

### Level 5: Web Editor

| # | 조사 항목 | 결정 필요 시점 |
|---|----------|--------------|
| L5-1 | 편집 엔진: ProseMirror vs Slate vs TipTap vs 자체 구현 | Level 5 시작 전 |
| L5-2 | 실시간 협업 필요 여부 (CRDT/OT) | Level 5 시작 전 |
| L5-3 | 편집 가능 범위 (텍스트만 vs 표/이미지도) | Level 5 시작 전 |
| L5-4 | 실행취소/다시실행 아키텍처 | Level 5 시작 전 |

---

## 부록 A: 현재 알려진 이슈

| # | 이슈 | 심각도 | 관련 태스크 |
|---|------|--------|-----------|
| 1 | 한컴오피스 열기 수동 검증 미완료 | 🟡 중간 | — |
| 2 | HwpxBuilder API 미검증 | 🟡 중간 | TASK-012 |
| 3 | HWP→HWPX 변환 미구현 | 🟡 중간 | TASK-013 |

## 부록 B: 파일 위치 빠른 참조

```
/Users/mj/handoc/
├── docs/
│   ├── MASTER-PLAN.md          ← 이 문서
│   ├── REQUIREMENTS.md         ← 비전/로드맵
│   ├── hwpml-element-catalog.md ← HWPML 스펙 130개 요소 카탈로그
│   ├── real-doc-test-results.md ← 349개 실제 문서 테스트 결과
│   ├── benchmark-results.md     ← 성능 벤치마크 결과
│   ├── roundtrip-test-results.md ← 라운드트립 테스트 결과
│   └── specs/                   ← 한컴 공식 스펙 PDF
├── packages/
│   ├── document-model/          ← 타입 + Warning (7 src, 256줄, 테스트 13개)
│   ├── hwp-reader/              ← HWP 5.x 리더 (5 src, 318줄, 테스트 21개)
│   ├── hwpx-core/               ← ZIP I/O (3 src, 153줄, 테스트 9개)
│   ├── hwpx-parser/             ← XML 파서 (14 src, 1,632줄, 테스트 64개)
│   └── hwpx-writer/             ← 직렬화+ZIP (4 src, 474줄, 테스트 7개)
├── scripts/
│   ├── benchmark.ts             ← 성능 벤치마크
│   ├── quality-gate.ts          ← 품질 게이트 검증
│   ├── test-real-docs.ts        ← 349개 실제 문서 테스트
│   └── test-roundtrip.ts        ← 라운드트립 테스트
├── test-documents/              ← 349개 실제 HWPX (education 264 + opensource 53 + government 32)
└── turbo.json
```

## 부록 C: 테스트 문서 현황

| 카테고리 | 파일 수 | 출처 |
|----------|---------|------|
| education | 264 | 교육 기관 |
| opensource | 53 | 공개 문서 |
| government | 32 | 정부 기관 |
| **합계** | **349** | |

---

*HanDoc — HWP를 웹으로.*
