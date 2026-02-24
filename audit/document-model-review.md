# HanDoc `document-model` 패키지 타입 설계 심층 리뷰

> 리뷰 일시: 2026-02-24  
> 대상: `packages/document-model/src/` (7개 파일, ~300 LOC)

---

## 1. 아키텍처 개요

```
DocumentHeader (메타/스타일)
  ├─ BeginNum
  ├─ RefList
  │   ├─ FontFaceDecl[]
  │   ├─ CharProperty[]
  │   ├─ ParaProperty[]
  │   ├─ StyleDecl[]
  │   ├─ TabProperty[]
  │   ├─ NumberingProperty[]
  │   ├─ BulletProperty[]
  │   └─ GenericElement[] (borderFills, others)
  └─ TrackChange/Memo (stub)

Section[]
  ├─ SectionProperties (페이지 크기, 여백, 단)
  └─ Paragraph[]
      ├─ Run[]
      │   └─ RunChild (discriminated union)
      └─ LineSeg[]

GenericElement (round-trip 보존용 범용 노드)
```

**설계 철학**: HWPX XML 구조를 거의 1:1로 모델링하되, `GenericElement`로 미지원 요소를 보존하여 라운드트립 안전성을 확보.

---

## 2. IR(중간 표현)로서의 적절성

### ✅ 잘된 점
- **discriminated union** `RunChild`가 텍스트, 표, 도형, 수식 등 주요 인라인 요소를 커버
- `GenericElement`가 "알 수 없는 요소" 안전망 역할 — 새 포맷 추가 시 파싱 실패 없이 보존 가능
- 단위 변환 유틸(`hwpUnitToMm`, `hwpUnitToPt`)이 모델 패키지에 포함

### ⚠️ 문제점: HWPX-편향 IR

현재 모델은 **HWPX의 XML 구조를 거의 그대로 반영**하여, 범용 IR이라기보다 "파싱된 HWPX"에 가깝다.

| 개념 | HWPX 모델 지원 | DOCX 개념 매핑 | HTML 개념 매핑 |
|------|---------------|---------------|---------------|
| `paraPrIDRef` (ID 참조) | ✅ 네이티브 | ❌ DOCX는 인라인 속성 | ❌ 해당 없음 |
| `charPrIDRef` (ID 참조) | ✅ 네이티브 | ❌ DOCX는 `rPr` 인라인 | ❌ CSS 클래스 |
| `LineSeg` (레이아웃 힌트) | ✅ HWPX 전용 | ❌ DOCX에 없음 | ❌ 해당 없음 |
| `styleIDRef` (숫자 ID) | ✅ | ⚠️ DOCX는 문자열 styleId | ⚠️ CSS class |
| CSS/인라인 스타일 | ❌ | ❌ | ❌ 필요 |

**`html-reader`의 실제 코드**가 이를 증명:

```typescript
// html-reader/src/html-parser.ts — HWPX IDRef 시스템에 맞추려 별도 charProperty를 만들어야 함
import { Section, Paragraph, Run, CharProperty, ParaProperty, ... } from '@handoc/document-model';
```

HTML → document-model 변환 시, 원래 없는 `charPrIDRef`/`paraPrIDRef` 시스템을 인위적으로 구축해야 하는 구조적 마찰이 있다.

### 권고: 두 가지 방향

**A) 현 방향 유지 (HWPX-중심 IR)**
- 장점: HWPX 라운드트립 완벽, 구현 단순
- 단점: 다른 포맷 → IR 변환이 항상 "HWPX화" 과정 필요
- 적합: HWPX가 주 포맷이고 다른 건 export 위주

**B) 포맷-중립 IR로 리팩터링**
- `charPrIDRef` 대신 인라인 `CharStyle` 객체
- `LineSeg` 제거 (레이아웃은 렌더러 단 계산)
- 스타일 참조를 문자열 기반으로 통일
- 적합: 모든 포맷을 동등하게 다루는 경우

현재 HanDoc의 주 용도가 HWPX ↔ DOCX 변환이므로 **방향 A가 실용적**이지만, 문서에 이 설계 결정을 명시할 것을 권고.

---

## 3. 타입 안전성 분석

### ✅ 우수
- **`any` 사용 제로** — 전체 소스에 `any` 없음
- **discriminated union** `RunChild`가 `type` 필드로 깔끔하게 분기
- `GenericElement.attrs`가 `Record<string, string>`으로 타입화
- 상수가 `as const`로 선언

### ⚠️ 개선 필요

#### 3.1 `[key: string]: unknown` stub 타입들

```typescript
// header-types.ts
export interface TrackChangeEntry {
  [key: string]: unknown;  // 사실상 any와 동일
}
export interface TrackChangeAuthor {
  [key: string]: unknown;
}
export interface MemoShape {
  [key: string]: unknown;
}
```

**문제**: 타입 가드 없이 사용 시 런타임 에러 가능. track change는 실제로 사용 중이므로(`RunChild`의 `trackChange` 타입) 구조를 정의해야 함.

**권고**:
```typescript
export interface TrackChangeEntry {
  id: number;
  type: 'insert' | 'delete' | 'modify';
  authorId: number;
  date?: string;
  content?: GenericElement[];
}
```

#### 3.2 string 리터럴 타입 미활용

```typescript
// CharProperty
underline?: string;   // 'NONE' | 'BOTTOM' | 'DOUBLE' 등이 가능
strikeout?: string;   // 'NONE' | 'LINE' 등
outline?: string;

// ParaProperty  
align?: 'left' | 'center' | 'right' | 'justify' | 'distribute';  // ✅ 이건 잘 됨
lineSpacing?: { type: string; value: number };  // type은 'PERCENT' | 'FIXED' | 'BETWEEN_LINES' 등
```

`align`은 잘 되어 있으나 나머지 문자열 필드들은 리터럴 유니온으로 제한해야 한다.

#### 3.3 `Paragraph.id: string | null`

```typescript
export interface Paragraph {
  id: string | null;        // null 허용 — undefined와 혼용 가능성
  paraPrIDRef: number | null;  // 같은 패턴
}
```

`null`과 `undefined`를 혼용하지 않도록 일관성 필요. `optional`로 통일하거나, `null`로 통일.

#### 3.4 optional 사용 현황

```
필수 필드:  ~60%
optional:   ~40%
```

대부분의 optional은 합리적 (예: `columns?`, `bold?`, `italic?` — 기본값이 있는 속성). 다만 `CharProperty`에서 `bold?: boolean`은 **3-state** (`true` / `false` / `undefined=상속`)를 의미하므로 문서화 필요.

---

## 4. 확장성 분석

### 새 포맷(ODT 등) 추가 시

| 변경 필요 여부 | 항목 |
|--------------|------|
| **변경 불필요** | `GenericElement`, `Section`, `Paragraph`, `Run`, 텍스트 `RunChild` |
| **변경 가능** | `RunChild`에 ODT 전용 타입 추가 필요할 수 있음 |
| **변경 필요** | `constants.ts`에 네임스페이스 추가, 단위 변환 함수 추가 |
| **구조적 한계** | `DocumentHeader`의 `RefList`가 HWPX ID 참조 시스템에 강결합 |

`GenericElement` 안전망 덕에 **파싱은 항상 가능**하지만, 시맨틱한 표현은 모델 확장 필요.

### RunChild 확장 패턴

```typescript
// 현재: 닫힌 union — 새 타입 추가 시 이 파일 수정 필요
export type RunChild =
  | { type: 'text'; content: string }
  | { type: 'table'; element: GenericElement }
  // ... 새 타입 추가하려면 여기에 |

// 권고: 확장 가능한 패턴 (필요 시)
export type RunChild = KnownRunChild | { type: string; element: GenericElement; [k: string]: unknown };
```

단, 현재 규모에서는 닫힌 union이 더 안전하므로 당장은 유지 권장.

---

## 5. 한컴 특유 개념 표현 가능 여부

| 한컴 개념 | 지원 여부 | 구현 방식 |
|----------|----------|----------|
| **쪽번호 시작** | ✅ | `SectionProperties.pageStartNumber`, `BeginNum.page` |
| **다단 (columns)** | ✅ | `SectionProperties.columns` |
| **글자겹침 (글자 장평)** | ✅ | `CharProperty.ratio` (장평), `CharProperty.spacing` (자간) |
| **위첨자/아래첨자** | ✅ | `CharProperty.superscript/subscript`, `offset` |
| **글머리 기호/번호매기기** | ✅ | `NumberingProperty`, `BulletProperty`, `ParaHead` |
| **탭 속성** | ✅ | `TabProperty`, `TabStop` |
| **변경 추적** | ⚠️ 부분 | `RunChild.trackChange`는 mark만, 실제 변경 내용은 stub |
| **메모/주석** | ⚠️ 부분 | `RunChild.hiddenComment`는 있지만 `MemoShape`는 stub |
| **LineSeg (줄 나눔 정보)** | ✅ | `LineSeg` 완전 보존 |
| **글꼴 언어별 분리** | ✅ | `CharProperty.fontRef` (hangul, latin, hanja 등 별도) |
| **테두리/배경** | ⚠️ | `borderFills`는 `GenericElement[]`로만 보존 — 타입화 안됨 |
| **OLE 객체** | ⚠️ | `GenericElement`로 보존만 |
| **한/영 자동 간격** | ✅ | `ParaProperty.autoSpacing.eAsianEng` |
| **단어 잘림 제어** | ✅ | `ParaProperty.breakSetting` |
| **양쪽 정렬/배분 정렬** | ✅ | `align: 'justify' | 'distribute'` |

**핵심 누락**: `borderFills`가 `GenericElement[]`로만 되어 있어, 테두리/배경 속성의 프로그래밍적 접근이 불편. 타입화 권장:

```typescript
export interface BorderFill {
  id: number;
  borderType?: string;
  borderWidth?: number;
  borderColor?: string;
  fillColor?: string;
  fillType?: 'none' | 'color' | 'gradation' | 'image';
  // ...
}
```

---

## 6. 패키지 간 사용 패턴 분석

### 사용 빈도 (import 횟수)

| 패키지 | import 수 | 주로 사용하는 타입 |
|--------|----------|-----------------|
| `hwpx-parser` | 6 | `Section`, `Paragraph`, `Run`, `GenericElement`, `WarningCollector` |
| `hwpx-writer` | 10 | `Section`, `DocumentHeader`, `RunChild`, `GenericElement`, 모든 RefList 타입 |
| `docx-writer` | 10+ | `GenericElement`, `DocumentHeader`, `CharProperty`, `ParaProperty` |
| `html-reader` | 1 | `Section`, `Paragraph`, `Run`, `CharProperty`, `ParaProperty` |
| `viewer` | 4 | `Section`, `Paragraph`, `Run`, `RunChild`, 단위 변환 함수 |
| `editor` | 1 | `Section`, `Paragraph`, `Run`, `RunChild`, `CharProperty`, `ParaProperty` |
| `pdf-export` | 4 | `Section`, `Paragraph`, `Run`, `RunChild`, `CharProperty`, `ParaProperty` |

### 패턴 관찰

1. **핵심 4총사**: `Section`, `Paragraph`, `Run`, `RunChild` — 모든 소비자가 사용
2. **GenericElement 의존도 높음**: 특히 writer/converter에서 빈번 — 구조화된 타입 부족의 증거
3. **hwpx-parser에서 타입 재선언**: `handoc.ts`에 "track change types mirrored from document-model" 주석 — 타입 해결 문제로 복사함 → **코드 스멜**
4. **단위 변환 함수**: viewer, pdf-export에서 직접 import — 적절한 위치

### 개선 권고

```typescript
// hwpx-parser/src/handoc.ts 에서 발견된 패턴:
// Track change types (mirrored from document-model to avoid cross-package type resolution issues)
// → document-model의 stub 타입을 구체화하면 이 미러링이 불필요해짐
```

---

## 7. 종합 평가

| 항목 | 점수 | 비고 |
|------|------|------|
| 타입 안전성 | **B+** | any 없음, 하지만 string 리터럴과 stub 타입 개선 필요 |
| HWPX 표현력 | **A** | 핵심 개념 대부분 커버, borderFill만 미타입화 |
| DOCX 표현력 | **B** | ID 참조 시스템 마찰 있으나 작동 |
| HTML 표현력 | **B-** | 인라인 스타일 개념 부재, IDRef 강제 |
| 확장성 | **B+** | GenericElement 안전망, 하지만 RefList 강결합 |
| 코드 품질 | **A-** | 깔끔, 간결, 테스트 있음 |
| 문서화 | **C** | JSDoc 최소, 설계 결정 근거 미기록 |

### 우선순위별 액션 아이템

1. **🔴 높음**: `TrackChangeEntry`, `TrackChangeAuthor`, `MemoShape` stub 타입 구체화
2. **🔴 높음**: `borderFills`를 `BorderFill[]`로 타입화
3. **🟡 중간**: `underline`, `strikeout`, `lineSpacing.type` 등에 string literal union 적용
4. **🟡 중간**: `null` vs `undefined` 정책 통일 문서화
5. **🟢 낮음**: "왜 HWPX-중심 IR인가" 설계 결정 문서(ADR) 작성
6. **🟢 낮음**: `CharProperty.bold?: boolean`의 3-state 의미 JSDoc 추가

---

*Generated by document-model type review, 2026-02-24*
