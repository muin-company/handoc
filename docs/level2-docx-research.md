# Level 2 Pre-Research: DOCX 변환 라이브러리 조사

> 조사일: 2026-02-20

## 1. 라이브러리 비교

| 항목 | **docx** | **docxtemplater** | **mammoth** | officegen |
|------|----------|-------------------|-------------|-----------|
| 버전 | 9.5.3 | 3.68.2 | 1.11.0 | 0.6.5 |
| 라이선스 | MIT ✅ | MIT ✅ | BSD-2-Clause ✅ | MIT ✅ |
| 주간 다운로드 | 1.82M | 292K | 1.70M | 15K |
| GitHub Stars | 5,478 | 3,512 | 6,098 | — |
| Open Issues | 147 | 6 | 61 | — |
| 최근 Push | 2026-02-20 ✅ | 2026-02-17 ✅ | 2025-11-20 | 방치 |
| 번들 크기 | ~3.5MB (unpacked) | ~1.3MB | ~2.2MB | — |
| TypeScript | 네이티브 ✅ | @types 별도 | @types 별도 | ❌ |
| **읽기** | ❌ 쓰기 전용 | 읽기+수정 (템플릿) | ✅ 읽기 전용 | ❌ |
| **쓰기** | ✅ 프로그래매틱 생성 | ✅ 템플릿 기반 | ❌ | ✅ |
| 표 | ✅ 완전 지원 | ✅ (유료 모듈) | ✅ 읽기 | 기본 |
| 이미지 | ✅ 완전 지원 | ✅ (유료 모듈) | ✅ 읽기 | 기본 |
| 서식 (Bold/Italic 등) | ✅ 완전 지원 | ✅ | ✅ 읽기 | 기본 |
| 머리글/바닥글 | ✅ | ✅ | — | 기본 |
| 페이지 설정 | ✅ | ✅ | — | 기본 |

## 2. 각 라이브러리 심층 분석

### docx (dolanmiu/docx) — ⭐ 추천

**장점:**
- 순수 프로그래매틱 DOCX 생성 — HanDoc의 document-model → DOCX 변환에 최적
- 선언적 API: `new Paragraph({ children: [new TextRun("Hello")] })`
- Table, Image, Header/Footer, Numbering, Styles 등 OOXML 스펙 광범위 지원
- 네이티브 TypeScript, 타입 안전
- 활발한 유지보수 (당일 커밋)
- Node.js + 브라우저 모두 지원

**단점:**
- 쓰기 전용 — DOCX→HWPX (역변환) 시 별도 파서 필요
- 번들 크기가 큰 편

### mammoth

**용도:** DOCX → HTML/Markdown 읽기 전용. DOCX→HWPX 방향에 사용 가능.
**단점:** 의미 기반 변환이라 서식 세부사항 손실. 표/이미지는 지원하나 페이지 레이아웃 정보 없음.

### docxtemplater

**용도:** 기존 DOCX 템플릿에 데이터 삽입. 변환 용도에 부적합.
**단점:** 표/이미지 모듈이 유료, 프로그래매틱 생성 불가 (템플릿 필수).

### officegen

**평가:** 방치 상태, TypeScript 미지원. 탈락.

## 3. DOCX 읽기 (DOCX→HWPX 방향)

DOCX 읽기용 별도 라이브러리 필요:

| 옵션 | 설명 |
|------|------|
| **직접 XML 파싱** | DOCX = ZIP(OOXML). `jszip` + XML 파서로 직접 읽기. 가장 유연 |
| **mammoth** | 빠른 구현 가능하나 서식 손실 큼 |
| **docx-parser / simple-docx-parser** | 소규모 라이브러리들, 신뢰성 낮음 |

**추천:** 직접 XML 파싱 (`jszip` + `fast-xml-parser`). 이유:
- HWPX 파서와 동일한 패턴 (ZIP + XML)
- document-model로의 매핑을 완전 제어 가능
- 의존성 최소화

## 4. 변환 전략

### document-model을 중간 표현으로 사용 ✅ 추천

```
HWPX → [hwpx-parser] → document-model → [docx-writer] → DOCX
DOCX → [docx-parser] → document-model → [hwpx-writer] → HWPX
```

**장점:**
- Level 1에서 이미 HWPX ↔ document-model 파이프라인 구축됨
- 양방향 변환의 중심점 역할
- 향후 PDF, HTML 등 추가 포맷 확장 용이
- 각 모듈이 독립적으로 테스트 가능

**필요 작업:**
1. `docx-writer` 패키지: document-model → `docx` 라이브러리 API 호출 → .docx 파일
2. `docx-parser` 패키지: .docx → jszip + XML 파싱 → document-model

### 직접 XML 변환 (document-model 우회)

```
HWPX XML → XSLT/직접 변환 → DOCX XML
```

**단점:** 포맷별 쌍마다 변환기 필요 (N² 문제). 유지보수 악몽.

## 5. document-model 확장 필요사항

현재 document-model 검토 결과:
- `Section`, `Paragraph`, `Run`, `TextRun` 기본 구조 있음
- `table`은 GenericElement로 처리 중 → 타입 구체화 필요
- 이미지도 `inlineObject`로 통칭 → 구체화 필요
- DOCX 특유의 요소 (Numbering, Bookmarks 등)는 없지만, 공통 모델로 추상화 가능

## 6. 결론 및 추천

### DOCX 쓰기: `docx` (dolanmiu/docx)

- 프로그래매틱 생성에 최적화
- document-model → DOCX 매핑이 자연스러움
- TypeScript 네이티브, 활발한 유지보수
- MIT 라이선스

### DOCX 읽기: 직접 구현 (`jszip` + `fast-xml-parser`)

- HWPX 파서와 동일한 패턴으로 일관성 유지
- mammoth는 보조 참고용으로만 활용

### 아키텍처: document-model 중심 허브

```
packages/
  document-model/   # 공통 중간 표현 (확장 필요)
  hwpx-parser/      # HWPX → document-model (Level 1 완료)
  hwpx-writer/      # document-model → HWPX (Level 1 완료)
  docx-writer/      # document-model → DOCX (Level 2 신규)
  docx-parser/      # DOCX → document-model (Level 2 신규)
```
