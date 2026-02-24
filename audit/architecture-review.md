# 아키텍처 리뷰

**감사자:** 미르 | **일자:** 2026-02-23

---

## 1. 전체 구조

### 모노레포 구성 (pnpm + Turborepo)

```
handoc/
├── packages/
│   ├── hwpx-core        # ZIP/파트 I/O (fflate)
│   ├── hwpx-parser      # HWPX → DocumentModel
│   ├── hwpx-writer      # DocumentModel → HWPX
│   ├── hwp-reader       # HWP 5.x 바이너리 (cfb)
│   ├── document-model   # 공통 문서 모델 (중립 IR)
│   ├── docx-reader      # DOCX → DocumentModel
│   ├── docx-writer      # DocumentModel → DOCX
│   ├── html-reader      # HTML → DocumentModel
│   ├── pdf-export       # DocumentModel → PDF
│   ├── viewer           # React 뷰어
│   ├── editor           # ProseMirror 에디터
│   ├── handoc-cli       # CLI 도구
│   └── demo             # 데모 앱
└── turbo.json
```

### 평가: ✅ 양호

**장점:**
- **document-model을 중심으로 한 허브-앤-스포크 패턴** — 모든 포맷 변환이 중립 IR(Intermediate Representation)을 경유. 이는 N개 포맷 지원 시 N×2 변환기만 필요 (N×N이 아닌)
- **패키지 경계가 명확** — reader/writer/parser 분리, 단일 책임 원칙 준수
- **Turborepo로 빌드 의존성 관리** — `dependsOn: ["^build"]`로 올바른 빌드 순서 보장
- **tsup 기반 빌드** — ESM + 타입 선언 생성, 트리쉐이킹 가능

**우려:**
- `docx-reader`가 `hwpx-writer`에 의존 — DOCX 읽기에 HWPX 쓰기가 필요한 이유가 불분명. 변환 로직이 reader에 포함된 것 같음
- `hwp-reader`도 `hwpx-writer`에 의존 — 동일한 커플링 문제

---

## 2. 의존성 그래프

```
document-model (의존성 없음)
    ↑
hwpx-core (fflate)
    ↑
hwpx-parser (fast-xml-parser, document-model, hwpx-core)
hwpx-writer (fflate, document-model, hwpx-core)
    ↑
hwp-reader (cfb, hwpx-writer) ⚠️
docx-reader (fflate, document-model, hwpx-writer) ⚠️
docx-writer (document-model, hwpx-parser, docx)
html-reader (document-model, cheerio)
pdf-export (document-model, hwpx-parser, pdf-lib)
viewer (document-model, hwpx-parser)
editor (document-model, hwpx-parser, hwpx-writer, prosemirror-*)
handoc-cli (거의 모든 패키지)
demo (viewer, editor, hwpx-parser, hwp-reader, docx-reader)
```

### 문제점: Reader → Writer 역방향 의존

`hwp-reader`와 `docx-reader`가 `hwpx-writer`에 의존하는 것은 **아키텍처 냄새(smell)**:

- **의도 추정:** HWP/DOCX를 읽으면서 바로 HWPX로 변환하는 편의 기능 제공
- **문제:** "읽기" 패키지가 "쓰기" 패키지에 의존하면 순환 가능성 ↑, 번들 크기 ↑
- **권고:** 변환 로직을 별도 패키지(`@handoc/converter`)로 분리하거나, document-model만 반환하고 HWPX 변환은 사용자 코드에 맡기기

---

## 3. 핵심 패키지 규모

| 패키지 | 주요 파일 | 라인 수 | 평가 |
|--------|----------|---------|------|
| pdf-export | pdf-direct.ts | 1,013 | ⚠️ 큰 단일 파일 |
| hwpx-writer | builder.ts | 847 | ⚠️ 큰 단일 파일 |
| pdf-export | html-renderer.ts | 616 | 적정 |
| docx-writer | converter.ts | 614 | 적정 |
| hwpx-parser | header-parser.ts | 601 | 적정 |
| viewer | layout-engine.ts | 598 | 적정 |
| editor | converter.ts | 565 | 적정 |

**총 프로덕션 코드:** 12,775줄 (13개 패키지)  
**파일당 평균:** ~250줄 — 양호

**우려:** `pdf-direct.ts`(1,013줄)와 `builder.ts`(847줄)는 분할 검토 필요

---

## 4. 외부 의존성 평가

| 의존성 | 용도 | 평가 |
|--------|------|------|
| `fflate` | ZIP 압축/해제 | ✅ 경량, 널리 사용 |
| `fast-xml-parser` | XML 파싱 | ✅ 성능 우수 |
| `cfb` | OLE2/CFB (HWP) | ✅ SheetJS 생태계 |
| `pdf-lib` | PDF 생성 | ✅ 순수 JS, 안정적 |
| `docx` | DOCX 생성 | ⚠️ 큰 라이브러리, 직접 구현 검토 |
| `cheerio` | HTML 파싱 | ✅ 표준적 선택 |
| `prosemirror-*` | 에디터 | ✅ 업계 표준 |

**의존성 수:** 적절. 불필요한 의존성 없음.

---

## 5. 빌드 시스템

```
pnpm v9.15.0 + Turborepo v2.4.0 + tsup v8.0.0
TypeScript 5.7.0 + vitest 4.0.18
```

**평가:** ✅ 현대적이고 빠른 스택. 캐싱 효과적 (11/13 cached).

**개선 포인트:**
- `pnpm-workspace.yaml` + `turbo.json` 조합은 현재 모노레포 베스트 프랙티스
- CI/CD 파이프라인 부재 — GitHub Actions 추가 권고

---

## 6. 종합 평가

| 항목 | 점수 | 설명 |
|------|------|------|
| 패키지 분리 | 8/10 | Reader→Writer 역의존만 해결하면 우수 |
| 의존성 관리 | 9/10 | 경량, 적절한 선택 |
| 빌드 시스템 | 8/10 | CI/CD만 추가하면 완성 |
| 확장성 | 9/10 | document-model 중심 설계로 새 포맷 추가 용이 |
| 코드 구조 | 7/10 | 일부 대형 파일 분할 필요 |

**총평:** 3일 만에 구축한 것치고는 놀라울 정도로 체계적. document-model 중심 설계는 장기적으로 올바른 선택. Reader→Writer 커플링만 정리하면 교과서적 구조.
