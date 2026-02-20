# HanDoc 요구사항 문서

## 비전

아래한글(HWP/HWPX) 파일 포맷을 완벽하게 다루는 오픈소스 TypeScript 생태계.
99% 오픈소스, 1% 프리미엄 — 무인기업(MUIN) 모델로 운영.

## 제품 로드맵

### Level 1: Core Library (`@handoc/*`)
아래한글과 동일한 수준의 HWPX 읽기/쓰기/조작 TypeScript 라이브러리.

- HWPX 파일 열기, 파싱, 생성, 저장
- 문서 구조 완전 보존 (라운드트립 안전)
- 한컴 공식 스펙 기반 구현
- **상태:** Phase 1 진행 중 (파서/모델/코어 구현 완료, writer 구현 중)

### Level 2: Format Converter
HWPX ↔ 다른 문서 포맷 양방향 변환.

- HWPX → DOCX, HTML, Google Docs
- DOCX, HTML, Google Docs → HWPX
- 서식/스타일/표/이미지 최대한 보존
- **의존성:** Level 1

### Level 3: PDF Export
HWPX → PDF 변환 (인쇄 품질).

- 한글 폰트 임베딩
- 페이지 레이아웃 정확한 재현
- 머리말/꼬리말, 각주, 쪽번호
- **의존성:** Level 1

### Level 4: Web Viewer
브라우저에서 HWPX 파일을 열어보는 뷰어.

- 드래그앤드롭 또는 URL로 파일 열기
- 아래한글과 유사한 렌더링
- 반응형 (모바일 지원)
- **의존성:** Level 1 (렌더링 로직은 Level 3과 일부 공유 가능)

### Level 5: Web Editor
브라우저에서 HWPX 파일을 읽고 쓸 수 있는 편집기.

- 텍스트 편집, 서식, 표, 이미지
- HWPX 저장/내보내기
- 실시간 미리보기
- **의존성:** Level 4

## 병행 프로젝트: Web Editor (범용)

CKEditor / Toast UI Editor 급 범용 웹 에디터. HanDoc과 별도 프로젝트로 진행.

- 웹 페이지 편집 (WYSIWYG + Markdown)
- 플러그인으로 HWPX/DOCX import/export 지원
- **의존성:** Level 1과 독립 (에디터 코어 먼저, HanDoc 플러그인은 나중)

## 실행 순서 & 병렬화

```
Level 1 (Core) ──┬── Level 2 (Converter)   ← 병렬
                  ├── Level 3 (PDF Export)  ← 병렬
                  └── Level 4 (Viewer) ── Level 5 (Editor)

별도: Web Editor ──────────────────────────── (독립 병행)
```

- Level 1 완료 후 → Level 2, 3, 4를 에이전트 3팀으로 동시 진행
- Level 5는 Level 4 완료 후 시작
- 범용 Web Editor는 처음부터 병행 가능 (Level 1 무관)

## 비즈니스 전략

### 오픈소스 모델 (99% / 1%)
- **Core Library (Level 1~3):** MIT 라이선스, 완전 오픈소스
- **Viewer/Editor (Level 4~5):** 코어는 오픈소스, 엔터프라이즈 기능 프리미엄
- **프리미엄 1%:** 기술 지원, SLA, 엔터프라이즈 배포, 커스터마이징

### 타겟 고객
1차: 기존 HWP 뷰어 경쟁사(C, A, B)의 고객
- AI 에이전트 기반 지원으로 차별화 (빠르고, 완전하고, 저렴)
- 무인기업 모델 = 인건비 없는 24시간 지원

### 핵심 차별화
- **AI 에이전트 서포트:** 무인기업 모델로 경쟁사 인간 지원 대비 속도/비용 우위
- **오픈소스 생태계:** 개발자 커뮤니티 활용, 기여 유도
- **한컴 공식 스펙 기반:** 호환성 보장

## 기술 원칙

- **한컴 공식 스펙이 PRIMARY 참조** (python-hwpx 코드 복사 금지 — Non-Commercial 라이선스)
- **hwp.js (Apache-2.0)** 참조 가능 (HWP 5.x 바이너리 파싱)
- **GenericElement로 미구현 요소 보존** — 라운드트립 안전 최우선
- **MIT 라이선스 + 한컴 저작권 고지**
- 서브에이전트 결과는 반드시 검증 (빌드/테스트/파일 존재 확인)

## 패키지 구조

```
@handoc/document-model  — 타입, 상수, 유틸리티
@handoc/hwpx-core       — ZIP I/O, OPC 패키지, manifest
@handoc/hwpx-parser     — XML → document-model 변환
@handoc/hwpx-writer     — document-model → XML 변환
```

추후 추가 예정:
```
@handoc/converter-docx  — HWPX ↔ DOCX
@handoc/converter-html  — HWPX ↔ HTML
@handoc/pdf-export      — HWPX → PDF
@handoc/viewer          — Web Viewer 컴포넌트
@handoc/editor          — Web Editor 컴포넌트
```
