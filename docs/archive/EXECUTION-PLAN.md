# HanDoc 실행용 계획서

> **프로젝트명:** HanDoc (한독)  
> **레포:** `handoc` (모노레포)  
> **작성일:** 2026-02-20  
> **기반 문서:** [hwp-library-plan.md](https://github.com/mj-muin/workspace/blob/main/research/hwp-library-plan.md)  
> **목적:** 에이전트 4명이 이 문서만 보고 자율 실행 가능한 수준의 상세 태스크 시트

---

## 0. 프로젝트 개요 (기존 계획서 요약)

- **목표:** HWP/HWPX 문서를 웹에서 읽고, 쓰고, 변환하는 MIT 라이선스 TypeScript 라이브러리
- **기술 스택:** TypeScript 5.x, Turborepo, Vitest, tsup, fflate, fast-xml-parser
- **저작권 고지:** 모든 패키지의 `LICENSE` 파일 하단에 아래 문구 포함:
  > "본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다."
- **저작권 고지 위치:** `LICENSE`, 각 패키지 `README.md` 하단, npm `package.json`의 `"notice"` 필드

### 패키지 구조
```
handoc/
├── packages/
│   ├── document-model/     # 공유 타입/인터페이스
│   ├── hwpx-core/          # OPC 패키지 처리 (ZIP, 관계)
│   ├── hwpx-parser/        # HWPX XML → 문서 모델
│   ├── hwpx-writer/        # 문서 모델 → HWPX 파일
│   ├── hwp-reader/         # HWP 5.x OLE2 바이너리 읽기
│   └── hwp-converter/      # HWP → HWPX 변환
├── fixtures/               # 테스트 HWPX/HWP 파일
├── scripts/                # 검증/생성 스크립트
├── turbo.json
├── package.json
└── tsconfig.base.json
```

---

## A. python-hwpx 분석

### A.1 소스 구조

| 모듈 | 역할 | 코드량 |
|------|------|--------|
| `hwpx/package.py` | OPC ZIP 패키지 읽기/쓰기, 매니페스트(content.hpf) 파싱, spine/섹션/헤더 경로 캐시 | ~200줄 |
| `hwpx/document.py` | 고수준 API — 문단/표/이미지/메모 추가, 텍스트 교체, 헤더/푸터, 스타일 조회 | ~720줄 |
| `hwpx/templates.py` | Skeleton.hwpx 템플릿 로드 | ~35줄 |
| `hwpx/oxml/parser.py` | XML → Python 객체 변환 디스패처 (element_to_model) | ~70줄 |
| `hwpx/oxml/body.py` | Section/Paragraph/Run/TextSpan/Table/Control/InlineObject 파싱+직렬화 | ~430줄 |
| `hwpx/oxml/header.py` | Header/RefList/FontFace/CharProperty/ParaProperty/Style/TrackChange 파싱 | ~1360줄 |
| `hwpx/oxml/common.py` | GenericElement 폴백 파서 | ~35줄 |
| `hwpx/oxml/document.py` | HwpxOxmlDocument — 패키지 → 구조화된 객체 트리 (섹션/헤더/테이블/메모 등) | ~추정 500줄 |
| `hwpx/oxml/schema.py` | lxml XSD 스키마 로더 | ~40줄 |
| `hwpx/oxml/utils.py` | local_name, parse_bool, parse_int 등 유틸 | ~추정 50줄 |
| `hwpx/tools/text_extractor.py` | 텍스트 추출 도구 | — |
| `hwpx/tools/object_finder.py` | 객체 검색 도구 | — |
| `hwpx/tools/validator.py` | 문서 검증 도구 | — |

### A.2 핵심 클래스 매핑: python-hwpx → HanDoc TS

| python-hwpx 클래스 | HanDoc TS 타입/클래스 | 패키지 |
|--------------------|-----------------------|--------|
| `HwpxPackage` | `OpcPackage` | `hwpx-core` |
| `HwpxDocument` | `HwpxDocument` (고수준 API) | `hwpx-parser` + `hwpx-writer` |
| `HwpxOxmlDocument` | 내부 사용 (파싱 중간체) | `hwpx-parser` |
| `Section` (body) | `Section` | `document-model` |
| `Paragraph` (body) | `Paragraph` | `document-model` |
| `Run` (body) | `Run` | `document-model` |
| `TextSpan` (body) | `TextSpan` | `document-model` |
| `Table` (body) | `TableControl` | `document-model` |
| `Control` (body) | `Control` | `document-model` |
| `InlineObject` (body) | `InlineObject` | `document-model` |
| `GenericElement` | `GenericElement` | `document-model` |
| `Header` (header) | `DocumentHeader` | `document-model` |
| `FontFace` / `Font` | `FontFace` / `Font` | `document-model` |
| `CharProperty` | `CharShape` | `document-model` |
| `ParagraphProperty` | `ParaShape` | `document-model` |
| `Style` | `Style` | `document-model` |
| `TrackChange` / `TrackChangeAuthor` | `TrackChange` / `TrackChangeAuthor` | `document-model` |
| `Bullet` / `BulletParaHead` | `Bullet` | `document-model` |
| `MemoShape` | `MemoShape` | `document-model` |
| `BorderFillList` | `BorderFill[]` | `document-model` |
| `RunStyle` | `RunStyle` | `document-model` |

### A.3 python-hwpx가 처리하는 XML 요소 전체 목록

**Body (content*.xml) 요소:**
- `sec` — 섹션 루트
- `p` — 단락 (id, paraPrIDRef, styleIDRef, pageBreak, columnBreak, merged)
- `run` — 텍스트 런 (charPrIDRef)
- `t` — 텍스트 스팬 (인라인 마크 포함)
- `ctrl` — 컨트롤 (type 속성)
- `tbl` — 표 (GenericElement로 폴백)
- `secPr` — 섹션 속성 (GenericElement로 폴백)
- 인라인 객체 20종: `line`, `rect`, `ellipse`, `arc`, `polyline`, `polygon`, `curve`, `connectLine`, `picture`, `pic`, `shape`, `drawingObject`, `container`, `equation`, `ole`, `chart`, `video`, `audio`, `textart`
- 변경추적 마크: `insertBegin`, `insertEnd`, `deleteBegin`, `deleteEnd`

**Header (header.xml) 요소:**
- `head` — 헤더 루트
- `beginNum` — 시작 번호 (page, footnote, endnote, pic, tbl, equation)
- `refList` — 참조 목록
- `fontfaces` / `fontface` / `font` — 글꼴 정의
- `charProperties` / `charPr` — 글자 속성
- `paraProperties` / `paraPr` — 문단 속성 (margin, heading, breakSetting, autoSpacing, lineSpacing, alignment, border)
- `styles` / `style` — 스타일
- `borderFills` — 테두리/채움
- `bullets` / `bullet` — 글머리표
- `numberings` — 번호 매기기
- `tabProperties` — 탭 속성
- `memoProperties` / `memoShape` — 메모 속성
- `trackChangeConfig` — 변경추적 설정
- `trackChanges` / `trackChange` — 변경추적 항목
- `trackChangeAuthors` / `trackChangeAuthor` — 변경추적 저자
- `forbiddenWords` — 금칙 단어
- `docOption` / `linkInfo` / `licenseMark` — 문서 옵션

### A.4 python-hwpx 미지원 → HanDoc에서 추가 구현할 기능

| 기능 | 상세 |
|------|------|
| **HWP 5.x 바이너리 읽기** | python-hwpx는 HWPX만 지원. HanDoc은 OLE2/CFB 기반 HWP 5.x도 읽음 |
| **표 세부 파싱** | python-hwpx는 `tbl`을 GenericElement로 폴백. HanDoc은 행/열/셀 구조 완전 파싱 |
| **인라인 객체 세부 파싱** | python-hwpx는 속성+자식을 GenericElement로 저장. HanDoc은 picture/equation 등 세부 타입 파싱 |
| **섹션 속성 세부** | secPr를 GenericElement로 처리. HanDoc은 용지/여백/단 등 구체적 파싱 |
| **HWP → HWPX 변환** | python-hwpx에 없음 |
| **브라우저 환경** | python-hwpx는 Python/lxml. HanDoc은 브라우저+Node 겸용 |

### A.5 테스트 케이스 포팅 전략

python-hwpx 자체에 테스트가 제한적이므로, **python-hwpx의 기능을 사용해 픽스처를 생성**하는 전략:
1. `scripts/generate-fixtures.py`에서 python-hwpx로 다양한 HWPX 파일 생성
2. 동시에 expected output (텍스트, 구조 JSON) 생성
3. HanDoc 파서가 같은 파일을 읽어서 expected output과 비교

---

## B. 피드백 루프 체계

모든 태스크는 아래 7단계 검증을 거친다:

### B.1 자동 검증 파이프라인

```bash
# 1. 타입 체크
pnpm turbo typecheck --filter=@handoc/{패키지명}

# 2. 유닛 테스트
pnpm turbo test --filter=@handoc/{패키지명}

# 3. 빌드
pnpm turbo build --filter=@handoc/{패키지명}

# 4. 크로스 밸리데이션 (HWPX 패키지만)
pnpm turbo test:cross --filter=@handoc/{패키지명}
```

### B.2 호환성 검증

```bash
# python-hwpx → HanDoc (python-hwpx가 쓴 파일을 HanDoc이 읽음)
npx tsx scripts/cross-validate.ts --direction=py2ts

# HanDoc → python-hwpx (HanDoc이 쓴 파일을 python-hwpx가 읽음)
npx tsx scripts/cross-validate.ts --direction=ts2py
```

### B.3 한컴 호환성 (수동)

1. `pnpm generate:fixtures` 로 테스트 파일 생성
2. 생성된 `fixtures/output/*.hwpx` 파일을 한컴오피스에서 열기
3. 열림 여부, 텍스트 표시, 표 구조, 이미지 표시 확인
4. 결과를 `fixtures/compat-report.md`에 기록 (날짜, 파일명, 결과)

### B.4 실패 시 대응 프로세스

```
1. 테스트 실패 → 에러 메시지 확인
2. 실패한 테스트의 입력 파일을 hex dump / XML로 확인:
   npx tsx scripts/debug-hwpx.ts fixtures/failing-file.hwpx
3. python-hwpx로 같은 파일 파싱해서 비교:
   python3 scripts/compare-parse.py fixtures/failing-file.hwpx
4. diff 확인 → 코드 수정 → 테스트 재실행
5. 3회 실패 시: 해당 요소를 GenericElement로 폴백하고 TODO 주석 남기기
```

---

## C. 태스크 시트

---

### [P0-SETUP-01] 모노레포 초기 설정

- **담당:** 에이전트 A
- **의존:** 없음 (최우선)
- **레퍼런스:** 없음
- **입력:** 없음
- **출력:**
  - `handoc/package.json` — 워크스페이스 루트
  - `handoc/turbo.json` — Turborepo 설정
  - `handoc/tsconfig.base.json` — 공유 TS 설정
  - `handoc/.eslintrc.cjs` — ESLint 설정
  - `handoc/vitest.workspace.ts` — Vitest 워크스페이스
  - `handoc/.github/workflows/ci.yml` — CI 파이프라인
  - `handoc/LICENSE` — MIT + 한컴 저작권 고지
  - `handoc/packages/` — 6개 패키지 디렉토리 (빈 package.json + tsconfig.json)
  - `handoc/fixtures/` — 디렉토리 생성
  - `handoc/scripts/` — 디렉토리 생성
- **API:** N/A
- **테스트:**
  ```bash
  cd handoc && pnpm install && pnpm turbo build && pnpm turbo test
  ```
- **검증 스크립트:**
  ```bash
  # 모든 패키지가 빌드되는지 확인
  cd handoc && pnpm turbo build 2>&1 | tail -1
  # 출력: "Tasks: 6 successful, 6 total"
  ```
- **완료 기준:** `pnpm install` + `pnpm turbo build` + `pnpm turbo test` 모두 exit 0
- **예상 시간:** 2시간

#### 상세 설정

**package.json (루트):**
```json
{
  "name": "handoc",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "test:cross": "turbo test:cross",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "generate:fixtures": "python3 scripts/generate-fixtures.py"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "tsup": "^8.0.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0"
  }
}
```

**각 패키지 package.json 패턴:**
```json
{
  "name": "@handoc/{패키지명}",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "require": "./dist/index.cjs", "types": "./dist/index.d.ts" }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

**tsconfig.base.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

---

### [P0-SETUP-02] 테스트 픽스처 생성

- **담당:** 에이전트 B
- **의존:** 없음 (P0-SETUP-01과 병렬 가능 — 픽스처는 독립)
- **레퍼런스:** `python-hwpx` 패키지
- **입력:** python-hwpx 설치 (`pip install python-hwpx`)
- **출력:**
  - `handoc/scripts/generate-fixtures.py` — 픽스처 생성 스크립트
  - `handoc/scripts/compare-parse.py` — 파싱 비교 디버그 스크립트
  - `handoc/fixtures/simple-text.hwpx` — 단순 텍스트 1단락
  - `handoc/fixtures/multi-paragraph.hwpx` — 여러 단락 + 스타일
  - `handoc/fixtures/table-basic.hwpx` — 기본 표 (3x3)
  - `handoc/fixtures/table-merged.hwpx` — 셀 병합 표
  - `handoc/fixtures/image-embed.hwpx` — 이미지 포함
  - `handoc/fixtures/header-footer.hwpx` — 머리말/꼬리말
  - `handoc/fixtures/multi-section.hwpx` — 다중 섹션
  - `handoc/fixtures/styled-text.hwpx` — 굵게/기울임/밑줄
  - `handoc/fixtures/memo.hwpx` — 메모 포함
  - `handoc/fixtures/complex.hwpx` — 위 요소 모두 포함
  - `handoc/fixtures/expected/` — 각 픽스처의 예상 출력 JSON
- **테스트:**
  ```bash
  python3 scripts/generate-fixtures.py && ls fixtures/*.hwpx | wc -l
  # 출력: 10 (이상)
  ```
- **완료 기준:** 10개 이상 픽스처 파일 생성, 각각 expected JSON 존재
- **예상 시간:** 3시간

#### generate-fixtures.py 핵심 로직

```python
#!/usr/bin/env python3
"""python-hwpx를 사용해 HanDoc 테스트 픽스처를 생성한다."""

import json
import os
from pathlib import Path
from hwpx.document import HwpxDocument
from hwpx.tools.text_extractor import extract_text  # 있으면 사용

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
EXPECTED_DIR = FIXTURES_DIR / "expected"

def generate_simple_text():
    doc = HwpxDocument.new()
    section = doc.sections[0]
    doc.add_paragraph("안녕하세요, HanDoc 테스트입니다.", section=section)
    doc.add_paragraph("두 번째 단락입니다.", section=section)
    doc.save(str(FIXTURES_DIR / "simple-text.hwpx"))
    
    # expected output
    with open(EXPECTED_DIR / "simple-text.json", "w") as f:
        json.dump({
            "paragraphCount": 3,  # 빈 단락 + 2개
            "texts": ["", "안녕하세요, HanDoc 테스트입니다.", "두 번째 단락입니다."],
            "sectionCount": 1
        }, f, ensure_ascii=False, indent=2)

def generate_table_basic():
    doc = HwpxDocument.new()
    section = doc.sections[0]
    table = doc.add_table(3, 3, section=section)
    for r in range(3):
        for c in range(3):
            table.set_cell_text(r, c, f"R{r}C{c}")
    doc.save(str(FIXTURES_DIR / "table-basic.hwpx"))
    
    with open(EXPECTED_DIR / "table-basic.json", "w") as f:
        json.dump({
            "hasTable": True,
            "tableRows": 3,
            "tableCols": 3,
            "cellTexts": [[f"R{r}C{c}" for c in range(3)] for r in range(3)]
        }, f, ensure_ascii=False, indent=2)

# ... 각 유형별 함수 ...

if __name__ == "__main__":
    FIXTURES_DIR.mkdir(exist_ok=True)
    EXPECTED_DIR.mkdir(exist_ok=True)
    generate_simple_text()
    generate_table_basic()
    # ... 나머지 호출 ...
    print(f"Generated {len(list(FIXTURES_DIR.glob('*.hwpx')))} fixture files")
```

---

### [P1-MODEL-01] 공유 문서 모델

- **담당:** 에이전트 A (P0-SETUP-01 완료 후)
- **의존:** P0-SETUP-01
- **레퍼런스:**
  - `python-hwpx/hwpx/oxml/body.py` — Section, Paragraph, Run, TextSpan, Table, Control, InlineObject
  - `python-hwpx/hwpx/oxml/header.py` — Header, FontFace, CharProperty, ParaProperty, Style 등
  - `python-hwpx/hwpx/oxml/common.py` — GenericElement
- **입력:** python-hwpx 소스 코드 (위 파일들)
- **출력:**
  - `packages/document-model/src/index.ts` — 메인 export
  - `packages/document-model/src/types.ts` — 핵심 타입 (HwpDocument, Section, Paragraph, Run 등)
  - `packages/document-model/src/header-types.ts` — 헤더 관련 타입 (FontFace, CharShape, ParaShape, Style 등)
  - `packages/document-model/src/body-types.ts` — 본문 관련 타입 (Table, Control, InlineObject 등)
  - `packages/document-model/src/generic.ts` — GenericElement 타입
  - `packages/document-model/src/constants.ts` — 네임스페이스 URI, 기본값
  - `packages/document-model/src/utils.ts` — 단위 변환 (hwpUnitToMm, mmToHwpUnit 등)
  - `packages/document-model/src/__tests__/types.test.ts`
  - `packages/document-model/src/__tests__/utils.test.ts`
- **API:**
  ```ts
  // types.ts — 핵심만 발췌
  export type HwpUnit = number; // 1/7200 인치

  export interface HwpDocument {
    properties: DocumentProperties;
    settings: DocumentSettings;
    sections: Section[];
    header: DocumentHeader;
  }

  export interface DocumentHeader {
    beginNum: BeginNum;
    refList: RefList;
  }

  export interface RefList {
    fontFaces: FontFaceList;
    charProperties: CharProperty[];
    paraProperties: ParaProperty[];
    styles: Style[];
    borderFills: GenericElement[];
    bullets: Bullet[];
    numberings: GenericElement[];
    tabProperties: GenericElement[];
    memoProperties?: MemoProperties;
    trackChangeConfig?: TrackChangeConfig;
    trackChanges: TrackChange[];
    trackChangeAuthors: TrackChangeAuthor[];
  }

  export interface Section {
    paragraphs: Paragraph[];
    otherChildren: GenericElement[];
    attributes: Record<string, string>;
  }

  export interface Paragraph {
    id: number | null;
    paraPrIdRef: number | null;
    styleIdRef: number | null;
    pageBreak: boolean | null;
    columnBreak: boolean | null;
    merged: boolean | null;
    runs: Run[];
    otherChildren: GenericElement[];
    attributes: Record<string, string>;
  }

  export interface Run {
    charPrIdRef: number | null;
    sectionProperties: GenericElement[];
    controls: Control[];
    tables: Table[];
    inlineObjects: InlineObject[];
    textSpans: TextSpan[];
    otherChildren: GenericElement[];
    attributes: Record<string, string>;
    content: RunChild[];
  }

  export interface TextSpan {
    leadingText: string;
    marks: TextMarkup[];
    attributes: Record<string, string>;
  }

  export interface Table {
    attributes: Record<string, string>;
    children: GenericElement[];
  }

  export interface Control {
    controlType: string | null;
    attributes: Record<string, string>;
    children: GenericElement[];
  }

  export interface InlineObject {
    name: string;
    attributes: Record<string, string>;
    children: GenericElement[];
  }

  export interface GenericElement {
    name: string;
    tag: string | null;
    attributes: Record<string, string>;
    children: GenericElement[];
    text: string | null;
  }

  // utils.ts
  export function hwpUnitToMm(hwpUnit: HwpUnit): number;
  export function mmToHwpUnit(mm: number): HwpUnit;
  export function hwpUnitToPt(hwpUnit: HwpUnit): number;
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/document-model
  ```
- **검증 스크립트:**
  ```bash
  pnpm turbo typecheck --filter=@handoc/document-model
  pnpm turbo build --filter=@handoc/document-model
  ```
- **완료 기준:**
  - 모든 python-hwpx의 body.py + header.py 데이터클래스에 대응하는 TS 타입 존재
  - typecheck 통과
  - 유틸 함수 테스트 통과
  - build 성공 (dist/ 생성)
- **예상 시간:** 4시간

---

### [P1-CORE-01] OPC 패키지 리더/라이터

- **담당:** 에이전트 B (P0-SETUP-02 완료 후)
- **의존:** P0-SETUP-01
- **레퍼런스:** `python-hwpx/hwpx/package.py` — HwpxPackage 클래스
- **입력:** `.hwpx` 파일 (`fixtures/simple-text.hwpx`)
- **출력:**
  - `packages/hwpx-core/src/index.ts` — 메인 export
  - `packages/hwpx-core/src/opc-package.ts` — OpcPackage 클래스
  - `packages/hwpx-core/src/manifest.ts` — content.hpf 매니페스트 파싱
  - `packages/hwpx-core/src/content-types.ts` — [Content_Types].xml 파싱
  - `packages/hwpx-core/src/relationships.ts` — .rels 파싱
  - `packages/hwpx-core/src/__tests__/opc-package.test.ts`
  - `packages/hwpx-core/src/__tests__/manifest.test.ts`
- **API:**
  ```ts
  // opc-package.ts
  export class OpcPackage {
    /** ZIP 바이트 → OpcPackage */
    static async open(input: Uint8Array): Promise<OpcPackage>;
    
    /** 파트 이름 목록 */
    partNames(): string[];
    
    /** 파트 존재 여부 */
    hasPart(partName: string): boolean;
    
    /** 파트 데이터 가져오기 (없으면 throw) */
    getPart(partName: string): Uint8Array;
    
    /** 파트 추가/수정 */
    setPart(partName: string, data: Uint8Array | string): void;
    
    /** 파트 삭제 */
    deletePart(partName: string): void;
    
    /** ZIP 바이트로 저장 */
    async save(): Promise<Uint8Array>;
    
    /** 매니페스트에서 섹션 파트 경로 목록 */
    getSectionPaths(): string[];
    
    /** 헤더 파트 경로 목록 */
    getHeaderPaths(): string[];
    
    /** spine 순서 (content.hpf의 itemref) */
    getSpineOrder(): string[];
  }
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwpx-core
  ```
- **검증 스크립트:**
  ```bash
  # fixtures/simple-text.hwpx를 열어서 파트 목록 출력
  npx tsx scripts/verify-opc-reader.ts fixtures/simple-text.hwpx
  # 예상 출력:
  # Parts: [Content_Types].xml, Contents/header.xml, Contents/content0.xml, ...
  # Sections: ["Contents/content0.xml"]
  # Headers: ["Contents/header.xml"]
  ```
- **호환성 검증:**
  ```bash
  # 라운드트립: 읽기 → 쓰기 → 읽기 → 파트 목록 동일 확인
  npx tsx scripts/verify-opc-roundtrip.ts fixtures/simple-text.hwpx
  ```
- **완료 기준:**
  - 10개 픽스처 파일 모두 열기 성공
  - 라운드트립 테스트 통과 (읽기→쓰기→읽기, 파트 바이트 동일)
  - getSectionPaths(), getHeaderPaths() 정확
- **예상 시간:** 5시간

**의존 라이브러리:** `fflate` (ZIP)

---

### [P1-PARSE-01] HWPX XML 파서 — 헤더

- **담당:** 에이전트 C
- **의존:** P1-MODEL-01 + P1-CORE-01
- **레퍼런스:** `python-hwpx/hwpx/oxml/header.py` — parse_header_element, 1360줄
- **입력:** OpcPackage에서 가져온 header.xml 문자열
- **출력:**
  - `packages/hwpx-parser/src/index.ts`
  - `packages/hwpx-parser/src/header-parser.ts` — parseHeader 함수
  - `packages/hwpx-parser/src/xml-utils.ts` — XML 파싱 유틸 (localName, parseBool, parseInt)
  - `packages/hwpx-parser/src/__tests__/header-parser.test.ts`
- **API:**
  ```ts
  // header-parser.ts
  import { DocumentHeader } from '@handoc/document-model';
  
  /** header.xml 문자열 → DocumentHeader */
  export function parseHeader(xml: string): DocumentHeader;
  
  /** 개별 파싱 함수 (테스트용) */
  export function parseBeginNum(node: XmlNode): BeginNum;
  export function parseRefList(node: XmlNode): RefList;
  export function parseFontFaces(node: XmlNode): FontFaceList;
  export function parseCharProperties(node: XmlNode): CharProperty[];
  export function parseParaProperties(node: XmlNode): ParaProperty[];
  export function parseStyles(node: XmlNode): Style[];
  export function parseBullets(node: XmlNode): Bullet[];
  export function parseTrackChanges(node: XmlNode): TrackChange[];
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwpx-parser
  ```
- **검증 스크립트:**
  ```bash
  # fixtures의 header.xml을 파싱해서 글꼴 목록 출력
  npx tsx scripts/verify-header-parser.ts fixtures/simple-text.hwpx
  # 예상 출력:
  # Fonts: [{ lang: "HANGUL", fonts: [{ face: "함초롬돋움", type: "TTF" }] }, ...]
  # CharProperties: 2 items
  # ParaProperties: 1 items
  # Styles: 1 items
  ```
- **호환성 검증:**
  ```bash
  # python-hwpx로 같은 header.xml 파싱한 결과와 비교
  python3 scripts/compare-header.py fixtures/simple-text.hwpx > /tmp/py-header.json
  npx tsx scripts/compare-header.ts fixtures/simple-text.hwpx > /tmp/ts-header.json
  diff /tmp/py-header.json /tmp/ts-header.json
  ```
- **완료 기준:**
  - header.py의 모든 parse_* 함수에 대응하는 TS 함수 존재
  - 10개 픽스처의 header.xml 파싱 성공 (warning 0)
  - python-hwpx와 파싱 결과 일치
- **예상 시간:** 6시간

**의존 라이브러리:** `fast-xml-parser`

---

### [P1-PARSE-02] HWPX XML 파서 — 본문 (섹션/단락/런)

- **담당:** 에이전트 D
- **의존:** P1-MODEL-01 + P1-CORE-01
- **레퍼런스:** `python-hwpx/hwpx/oxml/body.py` — parse_section_element, parse_paragraph_element, parse_run_element, parse_text_span
- **입력:** OpcPackage에서 가져온 content*.xml 문자열
- **출력:**
  - `packages/hwpx-parser/src/section-parser.ts` — parseSection 함수
  - `packages/hwpx-parser/src/paragraph-parser.ts` — parseParagraph, parseRun, parseTextSpan
  - `packages/hwpx-parser/src/control-parser.ts` — parseControl, parseTable, parseInlineObject
  - `packages/hwpx-parser/src/generic-parser.ts` — parseGenericElement (폴백)
  - `packages/hwpx-parser/src/__tests__/section-parser.test.ts`
  - `packages/hwpx-parser/src/__tests__/paragraph-parser.test.ts`
- **API:**
  ```ts
  // section-parser.ts
  import { Section } from '@handoc/document-model';
  
  export function parseSection(xml: string): Section;
  
  // paragraph-parser.ts
  export function parseParagraph(node: XmlNode): Paragraph;
  export function parseRun(node: XmlNode): Run;
  export function parseTextSpan(node: XmlNode): TextSpan;
  
  // control-parser.ts
  export function parseControl(node: XmlNode): Control;
  export function parseTable(node: XmlNode): Table;
  export function parseInlineObject(node: XmlNode): InlineObject;
  
  // generic-parser.ts
  export function parseGenericElement(node: XmlNode): GenericElement;
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwpx-parser
  ```
- **검증 스크립트:**
  ```bash
  # fixtures의 content0.xml을 파싱해서 텍스트 추출
  npx tsx scripts/verify-section-parser.ts fixtures/simple-text.hwpx
  # 예상 출력:
  # Paragraphs: 3
  # Texts: ["", "안녕하세요, HanDoc 테스트입니다.", "두 번째 단락입니다."]
  ```
- **호환성 검증:**
  ```bash
  npx tsx scripts/cross-validate.ts --direction=py2ts --fixture=simple-text
  ```
- **완료 기준:**
  - body.py의 모든 parse_* 함수에 대응하는 TS 함수 존재
  - INLINE_OBJECT_NAMES 20종 모두 처리 (InlineObject로)
  - 변경추적 마크 4종 처리
  - 10개 픽스처 텍스트 추출 결과가 expected JSON과 일치
- **예상 시간:** 6시간

---

### [P1-PARSE-03] HWPX 통합 파서

- **담당:** 에이전트 C 또는 D (P1-PARSE-01, P1-PARSE-02 완료 후)
- **의존:** P1-PARSE-01, P1-PARSE-02
- **레퍼런스:** `python-hwpx/hwpx/oxml/document.py` — HwpxOxmlDocument.from_package
- **입력:** OpcPackage
- **출력:**
  - `packages/hwpx-parser/src/hwpx-parser.ts` — parseHwpx 통합 함수
  - `packages/hwpx-parser/src/__tests__/hwpx-parser.test.ts`
- **API:**
  ```ts
  import { HwpDocument } from '@handoc/document-model';
  import { OpcPackage } from '@handoc/hwpx-core';

  export interface ParseOptions {
    loadBinData?: boolean;  // default: true
    sections?: number[];    // 특정 섹션만
  }

  export interface ParseResult {
    document: HwpDocument;
    warnings: ParseWarning[];
    parseTimeMs: number;
  }

  export interface ParseWarning {
    code: 'UNKNOWN_ELEMENT' | 'UNSUPPORTED_FEATURE' | 'PARSE_ERROR';
    message: string;
    path: string;
  }

  export async function parseHwpx(pkg: OpcPackage, options?: ParseOptions): Promise<ParseResult>;
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwpx-parser
  ```
- **검증 스크립트:**
  ```bash
  # 전체 파이프라인: HWPX 파일 → HwpDocument → 텍스트 출력
  npx tsx scripts/verify-full-parse.ts fixtures/simple-text.hwpx
  npx tsx scripts/verify-full-parse.ts fixtures/table-basic.hwpx
  npx tsx scripts/verify-full-parse.ts fixtures/complex.hwpx
  ```
- **완료 기준:**
  - 10개 픽스처 모두 parseHwpx 성공
  - warnings 없이 파싱되는 파일이 8개 이상
  - parseTimeMs < 200ms (simple-text 기준)
- **예상 시간:** 3시간

---

### [P1-WRITE-01] HWPX 라이터 — 헤더 직렬화

- **담당:** 에이전트 C
- **의존:** P1-MODEL-01 + P1-CORE-01
- **레퍼런스:** `python-hwpx/hwpx/oxml/header.py` 내 직렬화 로직 (save 시 XML 생성)
- **입력:** DocumentHeader 객체
- **출력:**
  - `packages/hwpx-writer/src/index.ts`
  - `packages/hwpx-writer/src/header-serializer.ts` — serializeHeader 함수
  - `packages/hwpx-writer/src/__tests__/header-serializer.test.ts`
- **API:**
  ```ts
  import { DocumentHeader } from '@handoc/document-model';
  
  /** DocumentHeader → header.xml 문자열 */
  export function serializeHeader(header: DocumentHeader): string;
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwpx-writer
  ```
- **검증 스크립트:**
  ```bash
  # 라운드트립: header.xml → parse → serialize → parse → 비교
  npx tsx scripts/verify-header-roundtrip.ts fixtures/simple-text.hwpx
  ```
- **완료 기준:** 라운드트립 테스트 통과 (parse → serialize → parse 동일)
- **예상 시간:** 4시간

---

### [P1-WRITE-02] HWPX 라이터 — 본문 직렬화

- **담당:** 에이전트 D
- **의존:** P1-MODEL-01 + P1-CORE-01
- **레퍼런스:** `python-hwpx/hwpx/oxml/body.py` — serialize_paragraph, serialize_run
- **입력:** Section 객체
- **출력:**
  - `packages/hwpx-writer/src/section-serializer.ts` — serializeSection 함수
  - `packages/hwpx-writer/src/paragraph-serializer.ts` — serializeParagraph, serializeRun
  - `packages/hwpx-writer/src/__tests__/section-serializer.test.ts`
- **API:**
  ```ts
  import { Section, Paragraph, Run } from '@handoc/document-model';
  
  export function serializeSection(section: Section): string;
  export function serializeParagraph(paragraph: Paragraph): string;
  export function serializeRun(run: Run): string;
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwpx-writer
  ```
- **검증 스크립트:**
  ```bash
  # 라운드트립: content0.xml → parse → serialize → parse → 비교
  npx tsx scripts/verify-section-roundtrip.ts fixtures/simple-text.hwpx
  ```
- **완료 기준:** 라운드트립 테스트 통과
- **예상 시간:** 4시간

---

### [P1-WRITE-03] HWPX 라이터 — 통합 (문서 → HWPX 파일)

- **담당:** 에이전트 C 또는 D (WRITE-01, WRITE-02 완료 후)
- **의존:** P1-WRITE-01, P1-WRITE-02, P1-CORE-01
- **레퍼런스:** `python-hwpx/hwpx/package.py` — HwpxPackage.save()
- **입력:** HwpDocument 객체
- **출력:**
  - `packages/hwpx-writer/src/hwpx-writer.ts` — writeHwpx 함수
  - `packages/hwpx-writer/src/builder.ts` — HwpxBuilder 편의 API
  - `packages/hwpx-writer/src/__tests__/hwpx-writer.test.ts`
  - `packages/hwpx-writer/src/__tests__/builder.test.ts`
- **API:**
  ```ts
  import { HwpDocument } from '@handoc/document-model';

  export interface WriteOptions {
    compressionLevel?: number;  // 0-9, default: 6
  }

  /** HwpDocument → HWPX ZIP 바이트 */
  export async function writeHwpx(doc: HwpDocument, options?: WriteOptions): Promise<Uint8Array>;

  /** 편의 빌더 */
  export class HwpxBuilder {
    constructor(template?: 'blank' | 'a4');
    setTitle(title: string): this;
    addParagraph(text: string, options?: { bold?: boolean; italic?: boolean; fontSize?: number; align?: string }): this;
    addTable(rows: number, cols: number): TableBuilder;
    build(): HwpDocument;
    async toBuffer(options?: WriteOptions): Promise<Uint8Array>;
  }

  export class TableBuilder {
    setCell(row: number, col: number, text: string): this;
    end(): HwpxBuilder;
  }
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwpx-writer
  ```
- **검증 스크립트:**
  ```bash
  # 빌더로 문서 생성 → 파일 저장 → python-hwpx로 읽기
  npx tsx scripts/verify-writer-output.ts
  python3 scripts/verify-writer-compat.py fixtures/output/builder-test.hwpx
  ```
- **호환성 검증:**
  ```bash
  # HanDoc이 쓴 파일을 python-hwpx가 읽는지
  npx tsx scripts/cross-validate.ts --direction=ts2py
  ```
- **완료 기준:**
  - HwpxBuilder로 생성한 파일을 python-hwpx로 열기 성공
  - 전체 라운드트립: parse → write → parse 동일
  - 한컴오피스에서 열기 성공 (수동 확인)
- **예상 시간:** 5시간

---

### [P1-HWP-01] HWP 5.x OLE2 리더 — CFB 파싱

- **담당:** 에이전트 A (P1-MODEL-01 완료 후)
- **의존:** P1-MODEL-01
- **레퍼런스:** python-hwpx에 없음. `cfb` npm 패키지 + HWP 5.x 공개 스펙 참조
- **입력:** HWP 5.x 바이너리 파일
- **출력:**
  - `packages/hwp-reader/src/index.ts`
  - `packages/hwp-reader/src/cfb-reader.ts` — OLE2 컨테이너 읽기
  - `packages/hwp-reader/src/file-header.ts` — FileHeader 파싱
  - `packages/hwp-reader/src/record-parser.ts` — 레코드 헤더/데이터 파싱
  - `packages/hwp-reader/src/__tests__/cfb-reader.test.ts`
  - `packages/hwp-reader/src/__tests__/record-parser.test.ts`
- **API:**
  ```ts
  // cfb-reader.ts
  export interface CfbEntry {
    name: string;
    data: Uint8Array;
  }
  
  export function readCfb(input: Uint8Array): Map<string, CfbEntry>;

  // file-header.ts
  export interface HwpFileHeader {
    signature: string;   // "HWP Document File"
    version: { major: number; minor: number; build: number; revision: number };
    flags: {
      compressed: boolean;
      encrypted: boolean;
      distribution: boolean;
      script: boolean;
      drm: boolean;
      xmlTemplate: boolean;
    };
  }

  export function parseFileHeader(data: Uint8Array): HwpFileHeader;

  // record-parser.ts
  export interface HwpRecord {
    tagId: number;
    level: number;
    size: number;
    data: Uint8Array;
  }

  export function parseRecords(stream: Uint8Array): HwpRecord[];
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwp-reader
  ```
- **검증 스크립트:**
  ```bash
  # HWP 파일의 스트림 목록 출력
  npx tsx scripts/verify-hwp-cfb.ts fixtures/sample.hwp
  # 예상 출력:
  # Streams: FileHeader, DocInfo, BodyText/Section0, ...
  # Version: 5.1.0.0
  # Compressed: true
  ```
- **완료 기준:**
  - CFB 스트림 목록 추출 성공
  - FileHeader 플래그 정확히 파싱
  - 레코드 파서가 DocInfo/Section 스트림에서 레코드 목록 추출
  - 암호화 문서 → `EncryptedDocumentError` throw
- **예상 시간:** 6시간

**의존 라이브러리:** `cfb` (OLE2 파싱) 또는 직접 구현

**참고:** HWP 테스트 픽스처는 한컴오피스에서 직접 만들거나 공공데이터포털에서 수집. `fixtures/hwp/` 디렉토리에 저장.

---

### [P1-HWP-02] HWP 5.x 리더 — DocInfo + BodyText 해석

- **담당:** 에이전트 A
- **의존:** P1-HWP-01
- **레퍼런스:** HWP 5.x 공개 스펙 (레코드 태그 ID 16~76)
- **입력:** HwpRecord[] (P1-HWP-01에서 생성)
- **출력:**
  - `packages/hwp-reader/src/docinfo-parser.ts` — DocInfo 스트림 → 글꼴/스타일/형태 테이블
  - `packages/hwp-reader/src/bodytext-parser.ts` — Section 스트림 → Paragraph[]
  - `packages/hwp-reader/src/hwp-reader.ts` — 통합 readHwp 함수
  - `packages/hwp-reader/src/text-decoder.ts` — UTF-16LE + 인라인 제어 문자 처리
  - `packages/hwp-reader/src/__tests__/docinfo-parser.test.ts`
  - `packages/hwp-reader/src/__tests__/bodytext-parser.test.ts`
  - `packages/hwp-reader/src/__tests__/hwp-reader.test.ts`
- **API:**
  ```ts
  import { HwpDocument } from '@handoc/document-model';

  export interface HwpReadOptions {
    password?: string;
    loadBinData?: boolean;
    sections?: number[];
  }

  export interface HwpReadResult {
    document: HwpDocument;
    warnings: ParseWarning[];
    hwpVersion: string;
    flags: HwpFileHeader['flags'];
  }

  export async function readHwp(input: Uint8Array, options?: HwpReadOptions): Promise<HwpReadResult>;
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwp-reader
  ```
- **검증 스크립트:**
  ```bash
  # HWP 파일에서 텍스트 추출
  npx tsx scripts/verify-hwp-reader.ts fixtures/hwp/sample.hwp
  ```
- **완료 기준:**
  - 기본 텍스트 문서 텍스트 추출 성공
  - 압축된 HWP 처리 (zlib inflate)
  - 표 구조 추출 성공
  - 인라인 제어 문자 (0x0002, 0x000D, 0x0018 등) 정상 처리
- **예상 시간:** 10시간

---

### [P1-CONV-01] HWP → HWPX 변환기

- **담당:** 에이전트 A 또는 B (P1-HWP-02 + P1-WRITE-03 완료 후)
- **의존:** P1-HWP-02, P1-WRITE-03
- **레퍼런스:** 없음 (HanDoc 고유)
- **입력:** HWP 5.x Uint8Array
- **출력:**
  - `packages/hwp-converter/src/index.ts`
  - `packages/hwp-converter/src/converter.ts` — convertHwpToHwpx 함수
  - `packages/hwp-converter/src/__tests__/converter.test.ts`
- **API:**
  ```ts
  export interface ConvertResult {
    hwpx: Uint8Array;
    warnings: ConvertWarning[];
    lossReport: { unsupportedFeatures: string[]; approximatedFeatures: string[] };
  }

  export async function convertHwpToHwpx(input: Uint8Array): Promise<ConvertResult>;
  ```
- **테스트:**
  ```bash
  pnpm turbo test --filter=@handoc/hwp-converter
  ```
- **검증 스크립트:**
  ```bash
  # HWP → HWPX 변환 후 python-hwpx로 열기
  npx tsx scripts/verify-converter.ts fixtures/hwp/sample.hwp
  python3 -c "from hwpx.document import HwpxDocument; d=HwpxDocument.open('fixtures/output/converted.hwpx'); print('OK:', len(d.paragraphs), 'paragraphs')"
  ```
- **완료 기준:**
  - 텍스트 보존율 100%
  - 변환된 HWPX를 python-hwpx로 열기 성공
  - 한컴오피스에서 열기 성공 (수동)
- **예상 시간:** 6시간

---

## D. 크로스 밸리데이션 시스템

### D.1 `scripts/cross-validate.ts`

```ts
#!/usr/bin/env npx tsx
/**
 * 크로스 밸리데이션: HanDoc ↔ python-hwpx 양방향 호환성 테스트
 * 
 * 사용법:
 *   npx tsx scripts/cross-validate.ts --direction=py2ts  # python-hwpx → HanDoc
 *   npx tsx scripts/cross-validate.ts --direction=ts2py  # HanDoc → python-hwpx
 *   npx tsx scripts/cross-validate.ts --direction=both   # 양방향
 *   npx tsx scripts/cross-validate.ts --fixture=simple-text  # 특정 픽스처만
 */

import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { OpcPackage } from '@handoc/hwpx-core';
import { parseHwpx } from '@handoc/hwpx-parser';

// py2ts: python-hwpx가 쓴 파일 → HanDoc 파서로 읽기
//   1. fixtures/*.hwpx 각각에 대해
//   2. parseHwpx 실행
//   3. 텍스트 추출 결과를 fixtures/expected/*.json과 비교
//   4. 불일치 시 diff 출력

// ts2py: HanDoc이 쓴 파일 → python-hwpx로 읽기
//   1. HwpxBuilder로 문서 생성 → fixtures/output/*.hwpx 저장
//   2. python3 scripts/read-with-pyhwpx.py fixtures/output/*.hwpx 실행
//   3. python이 출력한 텍스트/구조 JSON과 비교
```

### D.2 `scripts/read-with-pyhwpx.py`

```python
#!/usr/bin/env python3
"""HanDoc이 생성한 HWPX 파일을 python-hwpx로 읽어서 검증."""

import json
import sys
from hwpx.document import HwpxDocument

path = sys.argv[1]
doc = HwpxDocument.open(path)

result = {
    "sectionCount": len(doc.sections),
    "paragraphCount": len(doc.paragraphs),
    "texts": [],
}

for para in doc.paragraphs:
    text = ""
    for run in para.runs:
        text += run.text
    result["texts"].append(text)

json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
```

---

## E. XML 요소 커버리지 트래커

파일: `handoc/coverage-tracker.json`

```json
{
  "lastUpdated": "2026-02-20",
  "summary": { "total": 0, "parsing": 0, "readWrite": 0, "tested": 0 },
  "elements": {
    "body": {
      "sec": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "p": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "run": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "t": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "ctrl": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "tbl": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "secPr": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "line": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "rect": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "ellipse": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "arc": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "polyline": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "polygon": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "curve": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "connectLine": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "picture": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "pic": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "shape": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "drawingObject": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "container": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "equation": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "ole": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "chart": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "video": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "audio": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "textart": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "insertBegin": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "insertEnd": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "deleteBegin": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" },
      "deleteEnd": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-02" }
    },
    "header": {
      "head": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "beginNum": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "refList": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "fontfaces": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "fontface": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "font": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "charProperties": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "charPr": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "paraProperties": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "paraPr": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "styles": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "style": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "borderFills": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "bullets": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "numberings": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "tabProperties": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "memoProperties": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "trackChangeConfig": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "trackChanges": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "trackChangeAuthors": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" },
      "docOption": { "status": "not-implemented", "package": "hwpx-parser", "task": "P1-PARSE-01" }
    }
  }
}
```

**커버리지 계산 스크립트:** `scripts/coverage-report.ts`
```ts
#!/usr/bin/env npx tsx
import tracker from '../coverage-tracker.json';

const statuses = { 'not-implemented': 0, 'parsing': 0, 'read-write': 0, 'tested': 0 };
const all = [...Object.values(tracker.elements.body), ...Object.values(tracker.elements.header)];
all.forEach(e => statuses[e.status]++);
const total = all.length;

console.log(`Coverage Report (${tracker.lastUpdated})`);
console.log(`  Total elements: ${total}`);
console.log(`  Not implemented: ${statuses['not-implemented']} (${(statuses['not-implemented']/total*100).toFixed(0)}%)`);
console.log(`  Parsing only: ${statuses['parsing']} (${(statuses['parsing']/total*100).toFixed(0)}%)`);
console.log(`  Read+Write: ${statuses['read-write']} (${(statuses['read-write']/total*100).toFixed(0)}%)`);
console.log(`  Fully tested: ${statuses['tested']} (${(statuses['tested']/total*100).toFixed(0)}%)`);
```

**에이전트 규칙:** 태스크 완료 시 `coverage-tracker.json`의 해당 요소 status를 업데이트한다.
- 파싱 함수만 구현 → `"parsing"`
- 파싱+직렬화 구현 → `"read-write"`
- 테스트까지 통과 → `"tested"`

---

## F. 에이전트 작업 흐름

```
1. 이 문서에서 자기 태스크 확인 (담당 에이전트 필드)
2. 의존 태스크가 완료되었는지 확인 (git pull → 해당 패키지 빌드 통과 여부)
3. 레퍼런스 코드 분석:
   - python-hwpx 소스 읽기: /Users/mj/Library/Python/3.14/lib/python/site-packages/hwpx/
   - 해당 파일의 함수/클래스 구조 파악
4. TS 구현:
   - 태스크의 "출력" 섹션에 명시된 파일을 생성
   - "API" 섹션의 시그니처를 정확히 따름
5. 유닛 테스트 작성 + 통과:
   - pnpm turbo test --filter=@handoc/{패키지}
6. 검증 스크립트 실행:
   - 태스크의 "검증 스크립트" 섹션 명령어 실행
7. 크로스 밸리데이션 실행 (HWPX 패키지만):
   - npx tsx scripts/cross-validate.ts
8. coverage-tracker.json 업데이트
9. git commit + push
10. 다음 태스크로 이동

실패 시:
  a. 테스트 에러 메시지 확인
  b. 입력 파일을 직접 열어 XML 구조 확인
  c. python-hwpx로 같은 입력 처리한 결과와 비교
  d. 코드 수정 → 4번으로 돌아감
  e. 3회 실패 → GenericElement 폴백 + TODO 주석 + 다음 태스크
```

---

## G. 의존성 그래프 + 병렬 스케줄

### G.1 의존성 그래프

```
P0-SETUP-01 (모노레포) ──┬──→ P1-MODEL-01 (문서 모델) ──┬──→ P1-CORE-01 (OPC) ──┬──→ P1-PARSE-01 (헤더 파서)
                         │                              │                       ├──→ P1-PARSE-02 (본문 파서)
P0-SETUP-02 (픽스처) ────┘                              │                       ├──→ P1-WRITE-01 (헤더 직렬화)
                                                        │                       └──→ P1-WRITE-02 (본문 직렬화)
                                                        │
                                                        └──→ P1-HWP-01 (CFB) ──→ P1-HWP-02 (DocInfo+Body)
                                                        
P1-PARSE-01 + P1-PARSE-02 ──→ P1-PARSE-03 (통합 파서)
P1-WRITE-01 + P1-WRITE-02 ──→ P1-WRITE-03 (통합 라이터)
P1-HWP-02 + P1-WRITE-03   ──→ P1-CONV-01 (HWP→HWPX 변환)
```

### G.2 4에이전트 병렬 스케줄 (간트 차트)

```
시간(h)  0   2   4   6   8  10  12  14  16  18  20  22  24  26
         ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
Agent A: [P0-SETUP-01 ][P1-MODEL-01    ][P1-HWP-01      ][P1-HWP-02              ][ P1-CONV-01   ]
Agent B: [P0-SETUP-02      ][P1-CORE-01          ][ 대기 ][ 크로스밸리데이션/CI    ][ P1-CONV-01   ]
Agent C: [ 대기              ][ 대기     ][P1-PARSE-01      ][P1-WRITE-01    ][P1-PARSE-03][P1-WRITE-03 ]
Agent D: [ 대기              ][ 대기     ][P1-PARSE-02      ][P1-WRITE-02    ][  합류      ][  합류      ]
```

### G.3 태스크별 시작 가능 조건

| 태스크 | 시작 조건 | 블로커 |
|--------|----------|--------|
| P0-SETUP-01 | 즉시 | 없음 |
| P0-SETUP-02 | 즉시 | 없음 (python-hwpx만 있으면 됨) |
| P1-MODEL-01 | P0-SETUP-01 완료 (pnpm install 가능) | P0-SETUP-01 |
| P1-CORE-01 | P0-SETUP-01 완료 | P0-SETUP-01 |
| P1-PARSE-01 | P1-MODEL-01 + P1-CORE-01 빌드 통과 | P1-MODEL-01, P1-CORE-01 |
| P1-PARSE-02 | P1-MODEL-01 + P1-CORE-01 빌드 통과 | P1-MODEL-01, P1-CORE-01 |
| P1-WRITE-01 | P1-MODEL-01 + P1-CORE-01 빌드 통과 | P1-MODEL-01, P1-CORE-01 |
| P1-WRITE-02 | P1-MODEL-01 + P1-CORE-01 빌드 통과 | P1-MODEL-01, P1-CORE-01 |
| P1-PARSE-03 | P1-PARSE-01 + P1-PARSE-02 테스트 통과 | P1-PARSE-01, P1-PARSE-02 |
| P1-WRITE-03 | P1-WRITE-01 + P1-WRITE-02 + P1-CORE-01 테스트 통과 | P1-WRITE-01, P1-WRITE-02 |
| P1-HWP-01 | P1-MODEL-01 빌드 통과 | P1-MODEL-01 |
| P1-HWP-02 | P1-HWP-01 테스트 통과 | P1-HWP-01 |
| P1-CONV-01 | P1-HWP-02 + P1-WRITE-03 테스트 통과 | P1-HWP-02, P1-WRITE-03 |

---

## H. 태스크 ID 총괄표

| ID | 태스크 | 담당 | 의존 | 예상 시간 | 동시 그룹 |
|----|--------|------|------|----------|----------|
| P0-SETUP-01 | 모노레포 초기 설정 | A | 없음 | 2h | G0 |
| P0-SETUP-02 | 테스트 픽스처 생성 | B | 없음 | 3h | G0 |
| P1-MODEL-01 | 공유 문서 모델 | A | P0-SETUP-01 | 4h | G1 |
| P1-CORE-01 | OPC 패키지 리더/라이터 | B | P0-SETUP-01 | 5h | G1 |
| P1-PARSE-01 | HWPX 헤더 파서 | C | P1-MODEL-01, P1-CORE-01 | 6h | G2 |
| P1-PARSE-02 | HWPX 본문 파서 | D | P1-MODEL-01, P1-CORE-01 | 6h | G2 |
| P1-WRITE-01 | HWPX 헤더 직렬화 | C | P1-MODEL-01, P1-CORE-01 | 4h | G2 |
| P1-WRITE-02 | HWPX 본문 직렬화 | D | P1-MODEL-01, P1-CORE-01 | 4h | G2 |
| P1-PARSE-03 | HWPX 통합 파서 | C/D | P1-PARSE-01, P1-PARSE-02 | 3h | G3 |
| P1-WRITE-03 | HWPX 통합 라이터 + 빌더 | C/D | P1-WRITE-01, P1-WRITE-02 | 5h | G3 |
| P1-HWP-01 | HWP 5.x CFB 파싱 | A | P1-MODEL-01 | 6h | G1 |
| P1-HWP-02 | HWP 5.x DocInfo+Body | A | P1-HWP-01 | 10h | G2 |
| P1-CONV-01 | HWP→HWPX 변환 | A/B | P1-HWP-02, P1-WRITE-03 | 6h | G4 |
| **총계** | | | | **64h** | |

**4에이전트 병렬 시 예상 완료: ~26시간 (크리티컬 패스: A의 SETUP→MODEL→HWP-01→HWP-02→CONV-01)**

---

## I. 네임스페이스 상수

모든 패키지에서 사용할 HWPX XML 네임스페이스:

```ts
// packages/document-model/src/constants.ts

export const NS = {
  HP: 'http://www.hancom.co.kr/hwpml/2011/paragraph',
  HH: 'http://www.hancom.co.kr/hwpml/2011/head',
  HS: 'http://www.hancom.co.kr/hwpml/2011/section',
  HC: 'http://www.hancom.co.kr/hwpml/2011/core',
  HA: 'http://www.hancom.co.kr/hwpml/2011/app',
  OPF: 'http://www.idpf.org/2007/opf/',
} as const;

export const MANIFEST_PATH = 'Contents/content.hpf';
export const HEADER_PATH = 'Contents/header.xml';

export const INLINE_OBJECT_NAMES = new Set([
  'line', 'rect', 'ellipse', 'arc', 'polyline', 'polygon', 'curve',
  'connectLine', 'picture', 'pic', 'shape', 'drawingObject', 'container',
  'equation', 'ole', 'chart', 'video', 'audio', 'textart',
]);

export const TRACK_CHANGE_MARK_NAMES = new Set([
  'insertBegin', 'insertEnd', 'deleteBegin', 'deleteEnd',
]);
```

---

## J. python-hwpx 라이선스 주의사항

python-hwpx는 **Non-Commercial License**이다.
- 소스 코드를 직접 복사/번역하면 안 됨
- **참고(레퍼런스)만 가능:** 구조, 로직 흐름을 파악하되, 코드는 새로 작성
- HanDoc은 MIT 라이선스로, python-hwpx 코드와의 유사성을 피해야 함
- 구체적으로: 함수명, 변수명, 클래스 구조를 python-hwpx와 다르게 설계 (이 문서의 API 시그니처 따름)
- HWPX XML 스펙 자체는 한컴의 공개 표준(KS X 6101)이므로 자유롭게 참조 가능

---

*문서 끝. HanDoc — HWP를 웹으로.*
