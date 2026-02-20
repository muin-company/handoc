# HanDoc AI 자율 구현 검토서 — Dune Review v1

**검토자:** 듄 (Dune) — CTO 보좌, 코드 심층 리뷰 전문  
**검토일:** 2026-02-20  
**검토 범위:** handoc/ 전체 (docs 9, packages 4, fixtures, scripts, CI)  
**검토 관점:** AI 에이전트가 사람 개입 없이 Level 1 완성까지 자율 실행할 수 있는가  
**실제 빌드/테스트 수행:** 완료 (build 4/4 성공, test 34/36 통과)

---

## 0. 기존 리뷰 대비 이 검토의 차별점

Flux(7.5/10), Gem(85%), Hex(56/100) 세 리뷰어 모두 "문서가 잘 되어있다"는 것에 동의하면서도 각기 다른 점수를 줬습니다. 이 리뷰에서는 **실제 코드를 전수 읽고, 빌드/테스트를 직접 실행한 결과**를 기반으로 "설계 문서와 실제 코드 사이의 괴리"에 집중합니다.

---

## 1. 핵심 판정

**자율 구현 준비도: 45/100 (설계 문서 우수, 실행 인프라 미비)**

- **문서 품질:** 90/100 — MASTER-PLAN, EXECUTION-PLAN의 태스크 분해, API 시그니처, 의존성 그래프 훌륭
- **코드 품질:** 70/100 — 파서/모델 구현이 동작하고 구조가 깔끔하나 타입 일관성 문제 있음
- **자율 실행 가능성:** 30/100 — 에이전트가 "다음에 무엇을 하라"를 판단할 수 있는 기계적 장치가 없음

왜 Gem보다 훨씬 낮은가: Gem은 "EXECUTION-PLAN.md를 읽는 에이전트"를 전제했지만, 실제로는 에이전트가 **현재 상태를 파악하고, 다음 태스크를 자동 선택하고, 검증 결과를 해석해서 루프를 돌리는** 오케스트레이션이 전무합니다.

---

## 2. 설계 문서 vs 실제 코드: 5대 괴리

### 괴리 1: document-model 타입이 3벌 존재

| 위치 | GenericElement 정의 | Section/Paragraph 정의 |
|---|---|---|
| `packages/document-model/src/` | `{tag, attrs, children, text?}` | 풍부한 타입 (Table, SectionProperty, LineSeg 등) |
| `packages/hwpx-parser/src/types.ts` | `{tag, attrs, children, text: string\|null}` | 축약형 (Table 없음, RunChild discriminated union) |
| `packages/hwpx-writer/src/parser-types.ts` | 위와 동일한 복사본 | 위와 동일한 복사본 |

**문제점:**
- document-model은 `Table`에 `kind: 'table'`, `rows: TableRow[]`, `rowCnt`, `colCnt` 등 풍부한 타입을 정의함
- 그런데 parser는 이 타입을 **전혀 사용하지 않음**. 대신 `types.ts`에 자체 축약형 타입을 정의
- writer는 parser의 타입을 **복사**(`parser-types.ts`)하여 사용. document-model 의존 없음
- 결과: document-model의 `Table`, `SectionProperty`, `CellAddress` 등 정교한 타입이 **죽은 코드**

**에이전트 영향:** EXECUTION-PLAN의 API 시그니처는 document-model 타입을 사용하지만, 실제 코드는 다른 타입을 쓰므로 에이전트가 계획대로 코드를 작성하면 컴파일 에러 발생.

**수정 방향:** parser와 writer가 document-model의 타입을 직접 import하도록 통합. parser-types.ts 삭제. parser의 types.ts를 document-model로 이관하거나 re-export.

### 괴리 2: EXECUTION-PLAN의 API vs 실제 구현 불일치

| 항목 | EXECUTION-PLAN 명세 | 실제 구현 |
|---|---|---|
| 통합 파서 | `parseHwpx(pkg: OpcPackage): Promise<ParseResult>` | `HanDoc.open(buf): Promise<HanDoc>` (다른 인터페이스) |
| ParseResult | `{document, warnings, parseTimeMs}` | 없음 (HanDoc 클래스가 lazy 로딩) |
| ParseWarning | `{code, message, path}` | 없음 (warning 시스템 미구현) |
| writeHwpx | `async writeHwpx(doc: HwpDocument)` | `writeHwpx(doc: HwpxDocument)` (sync, 다른 타입명) |
| HwpxBuilder | 명세됨 (addParagraph, addTable 등) | 미구현 |

**에이전트 영향:** P1-PARSE-03(통합 파서)과 P1-WRITE-03(HwpxBuilder) 태스크를 수행할 에이전트가 EXECUTION-PLAN의 시그니처와 실제 코드 사이에서 혼란. 기존 HanDoc 클래스를 버리고 새로 짜야 하는지, 유지하면서 확장해야 하는지 판단 불가.

### 괴리 3: 헤더 파서의 얕은 파싱

MASTER-PLAN은 "CharProperty의 bold, italic, textColor, fontRef 등 세부 필드 파싱" (기능 매트릭스 ✅ 표시)이라고 하지만:

```typescript
// 실제 header-parser.ts의 CharProperty
interface CharProperty {
  id: number;
  height: number;
  attrs: Record<string, string>;  // ← 나머지 전부 여기에 flat 저장
  children: GenericElement[];      // ← 하위 요소도 generic으로
}
```

`bold`, `italic`, `textColor`, `fontRef`, `underline`, `strikeout` 등은 **모두 attrs나 children에 뭉뚱그려** 들어감. document-model에 정의된 `LangRecord`, `CharProperty.bold`, `CharProperty.underline` 등 상세 타입과 연결되지 않음.

ParaProperty도 동일: `align`, `heading`, `breakSetting`, `margin`, `lineSpacing` 등이 모두 `attrs: Record<string, string>` + `children: GenericElement[]`로 축소됨.

**심각도:** 중간-높음. 라운드트립은 가능(generic 보존)하지만, "AI 에이전트가 문서에서 '굵은 텍스트'를 찾아라" 같은 작업이 불가능. MASTER-PLAN이 약속하는 기능 수준과 실제 구현 사이에 큰 갭.

### 괴리 4: 테스트가 로컬 경로에 하드코딩

```typescript
// handoc.test.ts
const REAL_WORLD = resolve('/Users/mj/handoc-fixtures/real-world/20260220');
```

- 349개 실제 문서 테스트가 `/Users/mj/...` 경로에 의존
- CI(GitHub Actions)에서 실행 불가
- 다른 머신의 에이전트가 테스트 실행 불가
- 현재 테스트 결과: 36개 중 **2개 실패** (경로 미존재)

**에이전트 영향:** "테스트 전체 통과" 품질 게이트를 자동 판정할 수 없음. 에이전트가 코드 수정 후 `pnpm turbo test`를 돌리면 항상 2개 실패하므로 "내 변경이 문제인가, 기존 문제인가" 구분 불가.

### 괴리 5: EXECUTION-PLAN의 검증 스크립트가 존재하지 않음

EXECUTION-PLAN에 명시된 15개 이상의 검증 스크립트:
- `scripts/verify-opc-reader.ts`
- `scripts/verify-opc-roundtrip.ts`
- `scripts/verify-header-parser.ts`
- `scripts/verify-section-parser.ts`
- `scripts/verify-full-parse.ts`
- `scripts/verify-header-roundtrip.ts`
- `scripts/verify-section-roundtrip.ts`
- `scripts/verify-writer-output.ts`
- `scripts/verify-writer-compat.py`
- `scripts/cross-validate.ts`
- `scripts/compare-header.py` / `scripts/compare-header.ts`
- `scripts/read-with-pyhwpx.py`
- `scripts/coverage-report.ts`
- `scripts/debug-hwpx.ts`

**실제 존재하는 스크립트:** `test-real-docs.ts`(184줄), `check-zero-text.ts`(34줄) — 2개뿐.

이건 결정적입니다. EXECUTION-PLAN의 "에이전트 작업 흐름" Section F에서 6~7단계가 "검증 스크립트 실행"과 "크로스 밸리데이션"인데, 해당 스크립트가 하나도 없습니다.

---

## 3. 자율 실행을 가로막는 구조적 문제

### 3.1 오케스트레이터 부재

4명의 에이전트가 병렬 작업하려면:
1. **현재 완료 상태 판단** → coverage-tracker.json? → 파일 없음
2. **다음 태스크 선택** → 의존성 그래프 기계 판독? → 문서에만 존재 (Mermaid/텍스트)
3. **충돌 감지** → 같은 파일 동시 수정 방지? → git branch 전략만 언급, 실제 lock 없음
4. **실패 시 재시도/폴백** → "3회 실패 → GenericElement 폴백"? → 카운터/상태 저장 없음

### 3.2 python-hwpx 의존성의 실체

- 픽스처 생성, 크로스 밸리데이션, 호환성 검증 모두 python-hwpx 필요
- pip install이 에이전트 환경에서 가능한지 불확실
- python-hwpx의 Non-Commercial 라이선스 → 에이전트가 "참고"와 "복사"의 경계를 판단해야 함
- EXECUTION-PLAN A.1~A.5가 python-hwpx 분석인데, 에이전트가 이것을 읽고 코드를 생성할 때 "의도치 않은 코드 유사성"을 스스로 검증할 방법 없음

### 3.3 HWP 5.x 바이너리 파싱의 난이도 과소평가

EXECUTION-PLAN은 P1-HWP-01(6h) + P1-HWP-02(10h)로 HWP 바이너리 파싱을 예상하지만:
- HWP 5.x 레코드는 가변 길이, 압축(zlib), 중첩 레코드
- DocInfo 스트림에 태그 ID 16~76까지 60종의 레코드 타입
- BodyText의 HWPTAG_PARA_TEXT는 UTF-16LE + 인라인 제어 문자 (0x0002~0x001F) 혼재
- hwp.js (Apache-2.0, 참고 가능)도 테이블 파싱이 불완전

16시간으로는 텍스트 추출 수준이 한계. 표/이미지까지 하려면 40시간 이상 필요.

---

## 4. 부족한 문서/자산 목록 (에이전트 자율 실행 기준)

| # | 부족 항목 | 현재 상태 | 필요한 것 | 영향도 |
|---|---|---|---|---|
| **D1** | 오케스트레이션 스크립트 | 없음 | 태스크 상태 추적 + 다음 태스크 자동 할당 + 완료 검증 루프 | 치명적 |
| **D2** | 검증 스크립트 15종 | 2종만 존재 | EXECUTION-PLAN에 명시된 verify-*.ts, cross-validate.ts 전부 | 치명적 |
| **D3** | coverage-tracker.json | 없음 | EXECUTION-PLAN Section E에 스키마 정의됨, 실제 파일 필요 | 높음 |
| **D4** | 타입 통합 | 3벌 타입 분산 | parser/writer가 document-model 타입을 직접 사용 | 높음 |
| **D5** | 테스트 경로 이식성 | `/Users/mj/` 하드코딩 | 환경변수 또는 상대경로 기반 | 높음 |
| **D6** | 라운드트립 테스트 | 없음 | parse→write→parse 비교 테스트 최소 5개 | 높음 |
| **D7** | 헤더 상세 파싱 | attrs flat 저장 | CharProperty, ParaProperty 세부 필드 파싱 | 중간 |
| **D8** | HwpxBuilder API | 미구현 | EXECUTION-PLAN P1-WRITE-03 참조 | 중간 |
| **D9** | HWP 5.x 테스트 파일 | 없음 | 최소 5개 HWP 바이너리 샘플 | 중간 |
| **D10** | 에러 핸들링/Warning 시스템 | 없음 | ParseWarning 타입 + 수집 로직 | 중간 |
| **D11** | 성능 벤치마크 | 없음 | MASTER-PLAN 1.4 기준 (<50ms 등) 자동 측정 | 낮음 |

---

## 5. 코드 수준 이슈 (빌드/테스트 결과 기반)

### 5.1 빌드: 4/4 성공 (이전 Buffer 에러 해결됨)

MASTER-PLAN의 TASK-001 "hwpx-parser 빌드 에러"는 이미 해결됨. Flux/Hex 리뷰에서 언급된 블로커는 현재 없음.

### 5.2 테스트: 34/36 통과

| 패키지 | 결과 | 비고 |
|---|---|---|
| document-model | 통과 | 12개 테스트 |
| hwpx-core | 통과 | 9개 테스트 |
| hwpx-parser | **2 실패** / 34 통과 | 실패: 로컬 경로 의존 (real-world 테스트) |
| hwpx-writer | 통과 | 8개 테스트 |

실패 원인: `/Users/mj/handoc-fixtures/real-world/20260220/` 경로의 파일 미존재. 코드 결함이 아닌 환경 문제.

### 5.3 writer 구현 상태 (Flux "1줄 미구현" 지적은 구버전)

실제로는 writer가 상당히 구현됨:
- `header-writer.ts`: 150줄, RefList/FontFace/CharPr/ParaPr/Style 직렬화
- `section-writer.ts`: 120줄, Paragraph/Run/RunChild/LineSeg 직렬화
- `xml-helpers.ts`: 50줄, GenericElement 직렬화
- `index.ts`: `writeHwpx()` 함수 — header + sections → ZIP 생성까지 구현
- `buildManifest()` — content.hpf 자동 생성

**라운드트립 테스트도 writer 쪽에 이미 존재** (index.test.ts 199줄). 다만 fixtures 기반이라 범위 제한적.

---

## 6. 실행 가능한 개선 로드맵 (에이전트 투입 전 필수)

### Phase 0: 인프라 정비 (사람 또는 인프라 에이전트, 4~6시간)

```
[INFRA-01] 타입 통합 (2h)
  - parser/writer가 document-model 타입을 직접 import
  - hwpx-parser/src/types.ts → document-model로 이관
  - hwpx-writer/src/parser-types.ts 삭제
  - 전체 빌드/테스트 통과 확인

[INFRA-02] 테스트 경로 이식성 (1h)
  - HANDOC_FIXTURES_DIR 환경변수 기반
  - CI에서는 fixtures/ 디렉토리만 사용
  - real-world 테스트는 conditional skip

[INFRA-03] 검증 스크립트 기본 세트 (2h)
  - scripts/verify-roundtrip.ts (parse→write→parse 비교)
  - scripts/verify-text-extraction.ts (fixtures/expected/*.json 대조)
  - scripts/coverage-report.ts (coverage-tracker.json 읽기/출력)

[INFRA-04] coverage-tracker.json 초기화 (30m)
  - EXECUTION-PLAN Section E 스키마 기반
  - 현재 구현 상태 반영 (parsing: body/header 주요 요소)
```

### Phase 1: 에이전트 자율 실행 가능 영역 (HWPX parser/writer 완성)

Phase 0 완료 후 에이전트에게 위임 가능:
- TASK-002~004: 텍스트 추출률 76%→95%
- TASK-005~007: 라운드트립 검증 강화, HwpxBuilder
- TASK-008: 표 세부 파싱
- TASK-011: 추가 픽스처

### Phase 2: 사람 개입 필요 영역

- HWP 5.x: 스펙 복잡도 + 테스트 파일 수집 → 사람의 방향 설정 필요
- npm 배포: 계정, 라이선스 최종 확인 → 사람 판단
- python-hwpx 크로스 밸리데이션: 라이선스 경계 → 사람 감독

---

## 7. 다른 리뷰어 평가에 대한 코멘트

| 리뷰어 | 점수 | 동의하는 점 | 보완이 필요한 점 |
|---|---|---|---|
| **Flux** (7.5/10) | 테스트 픽스처/라운드트립 부재 정확히 지적 | writer를 "1줄 미구현"이라 한 것은 구버전 정보. 실제로는 상당히 구현됨 (350줄+). |
| **Gem** (85%) | API 시그니처 명확성, 검증 루프 설계 긍정 평가 동의 | "85%"는 문서 품질 기준. 실행 인프라 기준으로는 과대 평가. 검증 스크립트 15종이 전무한 상태에서 "검증 루프가 갖춰져 있다"는 평가는 부정확. |
| **Hex** (56/100) | "운영자 없이 끝까지 완수하는 문서는 아님" — 가장 현실적. 환경 재현, 데이터 접근, 우선순위 충돌 해소 지적 정확. | 코드를 직접 읽지 않아 타입 3벌 문제, writer 실제 구현 상태 등 코드 레벨 이슈를 놓침. |

---

## 8. 최종 요약

**잘 된 것:**
- 문서 설계 수준 (MASTER-PLAN, EXECUTION-PLAN)은 이 규모 프로젝트 대비 상위 10%
- HWPX parser 동작함 (349개 파일 100% 열기, 텍스트 76% 추출)
- Writer가 예상보다 많이 구현됨 (header + section 직렬화 + ZIP 생성)
- 빌드 시스템 정상 동작 (pnpm + turbo + tsup + vitest)

**부족한 것 (자율 실행 관점):**
- **설계 문서와 실제 코드가 다른 타입 체계를 사용** (가장 큰 문제)
- **검증 인프라 전무** (15종 검증 스크립트 중 0종 존재)
- **오케스트레이션 없음** (4에이전트 병렬 실행 불가)
- **테스트가 특정 머신에 종속**

**한 줄 결론:** 설계서는 "에이전트가 읽고 따라할 수 있는" 수준이지만, "에이전트가 스스로 돌면서 검증하고 다음 단계로 나아가는" 수준까지는 Phase 0(인프라 정비 4~6시간)이 필요합니다.

---

*Reviewed by Dune — 2026-02-20*
