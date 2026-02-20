# HanDoc — HWP/HWPX TypeScript 라이브러리

> **v2.0** | 2026-02-20 | 기존 2개 문서 통합 + 검증 완료

---

## 1. 프로젝트 정의

**이름:** HanDoc (한독)
**레포:** `muin-company/handoc` (모노레포)
**npm 스코프:** `@handoc/*`
**라이선스:** MIT + 한컴 저작권 고지

> "본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다."

**목표:** HWP 5.x(바이너리) + HWPX(XML/ZIP) 문서를 웹에서 읽고 쓰는 TypeScript 라이브러리.

**Phase 1 범위 (이 문서):**
- HWPX 읽기/쓰기
- HWP 5.x 읽기 (텍스트+표+이미지 추출)
- HWP → HWPX 변환

**Phase 2 (별도 문서):** 웹 뷰어, 편집기 — Phase 1 완료 후.

---

## 2. 레퍼런스 출처 (검증 완료)

### 2.1 한컴 공식 스펙 (PRIMARY — 자유롭게 참조 가능)

| 파일 | 내용 | 위치 |
|------|------|------|
| `hwpml-spec-r1.2.pdf` | **HWPML/HWPX XML 구조 전체 정의** (10,110줄) | `research/hwp-specs/` |
| `hwp5-spec-r1.3.pdf` | HWP 5.x 바이너리 포맷 (레코드, 스트림) | `research/hwp-specs/` |
| `hwp-dist-spec-r1.2.pdf` | 배포용 문서 구조 | `research/hwp-specs/` |
| `hwp-equation-spec-r1.3.pdf` | 수식 구조 | `research/hwp-specs/` |
| `hwp-chart-spec-r1.2.pdf` | 차트 구조 | `research/hwp-specs/` |

다운로드: https://www.hancom.com/etc/hwpDownload.do

### 2.2 실제 HWPX 파일 구조 (직접 검증)

`research/test-hwpx.hwpx` 파일 분석 결과:

```
test-hwpx.hwpx (ZIP)
├── mimetype                    (19B)
├── META-INF/
│   ├── container.xml           (475B)
│   ├── container.rdf           (867B)
│   └── manifest.xml            (134B)
├── Contents/
│   ├── content.hpf             (1,860B) — OPF manifest (spine + metadata)
│   ├── header.xml              (42,625B) — 글꼴/스타일/속성 정의
│   └── section0.xml            (3,156B) — 본문 (단락/런/텍스트)
├── Preview/
│   ├── PrvImage.png            (4,485B)
│   └── PrvText.txt             (2B)
├── settings.xml                (279B)
└── version.xml                 (310B)
```

### 2.3 XML 네임스페이스 (실제 파일에서 확인)

```
hp  = http://www.hancom.co.kr/hwpml/2011/paragraph   — 단락/런/텍스트
hh  = http://www.hancom.co.kr/hwpml/2011/head         — 헤더 (글꼴/스타일)
hs  = http://www.hancom.co.kr/hwpml/2011/section      — 섹션
hc  = http://www.hancom.co.kr/hwpml/2011/core         — 공통
ha  = http://www.hancom.co.kr/hwpml/2011/app          — 앱 속성
opf = http://www.idpf.org/2007/opf/                   — OPF 매니페스트
```

### 2.4 기존 오픈소스 (참고용)

| 이름 | 언어 | 라이선스 | 지원 | 상태 |
|------|------|---------|------|------|
| `hwp.js` (hahnlee) | JS | Apache-2.0 | HWP 5.x 읽기 | v0.0.3, 2020년 이후 업데이트 없음 |
| `@ohah/hwpjs` | Rust+Node | MIT | HWP 파서 | v0.1.0-rc.4, 2026-01 활성 |
| `python-hwpx` | Python | **Non-Commercial** | HWPX 읽기/쓰기 | v1.9, 활성 |
| `pyhwp` | Python | AGPL-3.0 | HWP 5.x 읽기 | 활성 |

⚠️ **python-hwpx는 Non-Commercial License — 코드 복사/번역 금지. 구조 참고만 가능.**
⚠️ **pyhwp는 AGPL — 같은 제약. 구조 참고만.**
✅ **hwp.js는 Apache-2.0 — 자유롭게 참고 가능.**

### 2.5 python-hwpx 실제 API (2026-02-20 검증)

```python
# 실제 존재하는 API (document.py에서 확인)
HwpxDocument.open(source)       # 파일/bytes/BinaryIO → HwpxDocument
HwpxDocument.new()              # 빈 문서 생성
doc.sections                    # List[HwpxOxmlSection]
doc.headers                     # List[HwpxOxmlHeader]
doc.paragraphs                  # List[HwpxOxmlParagraph]
doc.add_paragraph(text, ...)    # 단락 추가
doc.add_table(rows, cols, ...)  # 표 추가
doc.add_shape(shape_type, ...)  # 도형 추가
doc.add_control(ctrl_type, ...) # 컨트롤 추가
doc.package.save(target)        # 저장

# Package (package.py에서 확인)
HwpxPackage.open(source)        # ZIP 열기
pkg.part_names()                # 파트 목록
pkg.get_part(name) → bytes      # 파트 데이터
pkg.set_part(name, payload)     # 파트 설정
pkg.get_xml(name) → ET.Element  # XML 파트
pkg.section_paths() → list[str] # 섹션 경로
pkg.header_paths() → list[str]  # 헤더 경로
pkg.save(target)                # ZIP 저장
```

---

## 3. 기술 스택

| 기술 | 용도 |
|------|------|
| TypeScript 5.x | 타입 안전성 |
| Turborepo + pnpm | 모노레포 빌드 |
| Vitest | 테스트 |
| tsup | 번들링 (ESM + CJS) |
| fflate | ZIP 처리 (브라우저/Node 겸용) |
| fast-xml-parser | XML 파싱 |
| cfb | OLE2/CFB 파싱 (HWP 5.x용) |

---

## 4. 패키지 구조

```
handoc/
├── packages/
│   ├── document-model/     # 공유 타입/인터페이스 (의존성 없음)
│   ├── hwpx-core/          # OPC(ZIP) 패키지 I/O
│   ├── hwpx-parser/        # HWPX XML → document-model
│   ├── hwpx-writer/        # document-model → HWPX ZIP
│   ├── hwp-reader/         # HWP 5.x OLE2 → document-model
│   └── hwp-converter/      # HWP → HWPX (reader + writer 조합)
├── fixtures/               # 테스트 HWPX/HWP 파일
│   ├── hwpx/               # HWPX 샘플
│   ├── hwp/                # HWP 5.x 샘플
│   └── expected/           # 기대 출력 JSON
├── scripts/                # 검증/생성 스크립트
├── turbo.json
├── package.json
└── tsconfig.base.json
```

### 의존 관계

```
document-model (순수 타입, 의존 없음)
     ↑
     ├── hwpx-core (fflate)
     │      ↑
     │      ├── hwpx-parser (fast-xml-parser)
     │      └── hwpx-writer (fast-xml-parser)
     │
     └── hwp-reader (cfb 또는 직접 구현)

hwp-reader + hwpx-writer → hwp-converter
```

---

## 5. 실제 HWPX XML 구조 (파일에서 추출)

### 5.1 section0.xml (본문)

```xml
<hs:sec xmlns:hs="...section" xmlns:hp="...paragraph">
  <hp:p id="..." paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:secPr id="" textDirection="HORIZONTAL" ...>
        <hp:grid lineGrid="0" charGrid="0" />
        <hp:startNum pageStartsOn="BOTH" page="0" />
        <hp:visibility ... />
        <hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY">
          <hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252" />
        </hp:pagePr>
        <hp:footNotePr>...</hp:footNotePr>
        <hp:endNotePr>...</hp:endNotePr>
        <hp:pageBorderFill type="BOTH" borderFillIDRef="1" ...>
          <hp:offset left="1417" right="1417" top="1417" bottom="1417" />
        </hp:pageBorderFill>
      </hp:secPr>
      <hp:ctrl>
        <hp:colPr type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0" />
      </hp:ctrl>
    </hp:run>
    <hp:run charPrIDRef="0"><hp:t /></hp:run>
    <hp:linesegarray>
      <hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" ... />
    </hp:linesegarray>
  </hp:p>

  <hp:p id="..." paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:t>테스트 문서입니다.</hp:t>
    </hp:run>
  </hp:p>
</hs:sec>
```

### 5.2 header.xml (문서 속성) — 일부

```xml
<hh:head version="1.5" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="7">
      <hh:fontface lang="HANGUL" fontCnt="2">
        <hh:font id="0" face="함초롬돋움" type="TTF" isEmbedded="0">
          <hh:typeInfo familyType="FCAT_GOTHIC" weight="6" ... />
        </hh:font>
      </hh:fontface>
      <!-- LATIN, HANJA, JAPANESE, OTHER, SYMBOL, USER -->
    </hh:fontfaces>
    <hh:charProperties itemCnt="N">
      <hh:charPr id="0" height="1000" ... />
    </hh:charProperties>
    <hh:paraProperties>
      <hh:paraPr id="0" ...>
        <hh:align horizontal="JUSTIFY" ... />
      </hh:paraPr>
    </hh:paraProperties>
    <hh:styles>
      <hh:style id="0" type="PARA" name="바탕글" ... />
    </hh:styles>
    <hh:borderFills>...</hh:borderFills>
  </hh:refList>
</hh:head>
```

### 5.3 content.hpf (OPF Manifest)

```xml
<opf:package>
  <opf:metadata>
    <opf:title/>
    <opf:language>ko</opf:language>
    <opf:meta name="creator">kokyu</opf:meta>
    <opf:meta name="CreatedDate">2025-09-17T04:32:50Z</opf:meta>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>
    <opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>
    <opf:item id="settings" href="settings.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="header" linear="yes"/>
    <opf:itemref idref="section0" linear="yes"/>
  </opf:spine>
</opf:package>
```

### 5.4 단위 체계

- **HWP Unit:** 1/7200 인치
- A4 너비: 59528 HU = 210mm
- A4 높이: 84186 HU = 297mm
- 변환: `mm = hwpUnit / 7200 * 25.4`

---

## 6. Phase 1 태스크 시트

### 실행 순서 (의존성 기반)

```
G0 (병렬): SETUP-01, SETUP-02
G1 (G0 후 병렬): MODEL-01, CORE-01
G2 (G1 후 병렬): PARSE-01, PARSE-02, WRITE-01, WRITE-02, HWP-01
G3 (G2 후 병렬): PARSE-03, WRITE-03, HWP-02
G4 (G3 후): CONV-01
```

---

### SETUP-01: 모노레포 초기 설정

**산출물:**
- `package.json` (pnpm workspace root)
- `turbo.json`
- `tsconfig.base.json` (target: ES2022, module: ESNext, strict: true)
- 6개 패키지 디렉토리 (각각 `package.json` + `tsconfig.json` + `src/index.ts`)
- `.github/workflows/ci.yml`
- `LICENSE` (MIT + 한컴 고지)

**완료 기준:** `pnpm install && pnpm turbo build && pnpm turbo test` 모두 exit 0

**각 패키지 빌드 설정:**
```json
{
  "name": "@handoc/{name}",
  "version": "0.1.0",
  "type": "module",
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

---

### SETUP-02: 테스트 픽스처 수집

**방법:** 한컴오피스 OR python-hwpx로 생성 (라이선스 문제 없음 — 생성된 파일은 자유)

**필요한 픽스처:**

| 파일명 | 내용 | 검증 포인트 |
|--------|------|------------|
| `simple-text.hwpx` | 텍스트 2-3단락 | 단락/런/텍스트 파싱 |
| `styled-text.hwpx` | 굵게/기울임/밑줄/색상 | charPrIDRef 참조 |
| `table-basic.hwpx` | 3×3 표 | 행/열/셀 구조 |
| `table-merged.hwpx` | 셀 병합 표 | colspan/rowspan |
| `multi-section.hwpx` | 2개 섹션 | section0.xml, section1.xml |
| `image-embed.hwpx` | 이미지 포함 | BinData/ 디렉토리 |
| `header-footer.hwpx` | 머리말/꼬리말 | 헤더/푸터 파싱 |
| `complex.hwpx` | 위 요소 모두 포함 | 통합 테스트 |

+ 각 픽스처의 기대 출력 JSON (`fixtures/expected/{name}.json`)

**산출물:**
- `fixtures/hwpx/*.hwpx` (8개+)
- `fixtures/expected/*.json`
- `scripts/generate-fixtures.py` (재현 가능한 생성 스크립트)

**완료 기준:** 모든 픽스처 파일이 한컴오피스에서 정상 열림 (수동 확인)

---

### MODEL-01: 공유 문서 모델 (`@handoc/document-model`)

**레퍼런스:** HWPML 스펙 §4 (헤더), §5 (본문)

**산출물:**
- `src/types.ts` — 핵심 타입 (아래 참조)
- `src/constants.ts` — 네임스페이스 URI, 인라인 객체 목록
- `src/utils.ts` — 단위 변환 함수
- `src/__tests__/utils.test.ts`

**핵심 타입 (한컴 스펙 기반으로 설계):**

```typescript
// 단위
export type HwpUnit = number; // 1/7200 inch

// 문서 루트
export interface HwpDocument {
  header: DocumentHeader;
  sections: Section[];
}

// 헤더 — HWPML §4
export interface DocumentHeader {
  beginNum: BeginNum;
  refList: RefList;
}

export interface BeginNum {
  page: number;
  footnote: number;
  endnote: number;
  pic: number;
  tbl: number;
  equation: number;
}

export interface RefList {
  fontFaces: FontFaceDecl[];
  charProperties: CharProperty[];
  paraProperties: ParaProperty[];
  styles: StyleDecl[];
  borderFills: GenericElement[];
  bullets: GenericElement[];
  numberings: GenericElement[];
  tabProperties: GenericElement[];
  memoProperties: GenericElement[];
}

// 글꼴 — HWPML §4.3.2
export interface FontFaceDecl {
  lang: string;          // HANGUL, LATIN, HANJA, JAPANESE, OTHER, SYMBOL, USER
  fonts: FontInfo[];
}
export interface FontInfo {
  id: number;
  face: string;          // "함초롬돋움"
  type: string;          // "TTF"
  isEmbedded: boolean;
}

// 글자 모양 — HWPML §4.3.4
export interface CharProperty {
  id: number;
  height: number;        // 1/100 pt (1000 = 10pt)
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: string;
  strikeout?: string;
  // 실제 속성은 스펙 §4.3.4 참조하여 확장
  attrs: Record<string, string>;  // 스펙에서 아직 매핑 안 된 속성 보존
}

// 문단 모양 — HWPML §4.3.7
export interface ParaProperty {
  id: number;
  align?: string;        // JUSTIFY, LEFT, RIGHT, CENTER
  margin?: { left: HwpUnit; right: HwpUnit; indent: HwpUnit };
  lineSpacing?: { type: string; value: number };
  attrs: Record<string, string>;
}

// 스타일 — HWPML §4.3.8
export interface StyleDecl {
  id: number;
  type: string;          // PARA, CHAR
  name: string;
  engName?: string;
  paraPrIDRef?: number;
  charPrIDRef?: number;
  nextStyleIDRef?: number;
}

// 섹션 — HWPML §5
export interface Section {
  paragraphs: Paragraph[];
  // 첫 번째 단락의 첫 번째 run에 secPr이 포함됨 (HWPX 구조)
}

// 단락 — HWPML §5.1
export interface Paragraph {
  id: string | null;
  paraPrIDRef: number | null;
  styleIDRef: number | null;
  pageBreak: boolean;
  columnBreak: boolean;
  merged: boolean;
  runs: Run[];
  lineSegArray?: LineSeg[];
}

// 런
export interface Run {
  charPrIDRef: number | null;
  children: RunChild[];
}

export type RunChild =
  | { type: 'text'; content: string }
  | { type: 'secPr'; element: GenericElement }
  | { type: 'ctrl'; element: GenericElement }
  | { type: 'table'; element: GenericElement }
  | { type: 'inlineObject'; name: string; element: GenericElement }
  | { type: 'trackChange'; mark: string };

// 줄 나누기 정보
export interface LineSeg {
  textpos: number;
  vertpos: number;
  vertsize: number;
  textheight: number;
  baseline: number;
  spacing: number;
  horzpos: number;
  horzsize: number;
  flags: number;
}

// 미파싱 요소를 위한 범용 타입
export interface GenericElement {
  tag: string;           // 로컬 이름
  attrs: Record<string, string>;
  children: GenericElement[];
  text: string | null;
}
```

**설계 원칙:**
1. 스펙에 정의된 속성 중 **Phase 1에서 필요한 것만** 타입으로 정의
2. 나머지는 `attrs: Record<string, string>`으로 보존 (데이터 손실 방지)
3. GenericElement로 미지원 요소도 라운드트립 가능

**완료 기준:** typecheck 통과, 단위 변환 테스트 통과, build 성공

---

### CORE-01: OPC 패키지 I/O (`@handoc/hwpx-core`)

**레퍼런스:** HWPX 파일 구조 (§2.2), OPF 스펙

**산출물:**
- `src/opc-package.ts` — 읽기/쓰기
- `src/manifest.ts` — content.hpf 파싱
- `src/__tests__/opc-package.test.ts`

**API:**
```typescript
export class OpcPackage {
  static async open(input: Uint8Array): Promise<OpcPackage>;
  partNames(): string[];
  hasPart(name: string): boolean;
  getPart(name: string): Uint8Array;
  getPartAsText(name: string): string;
  setPart(name: string, data: Uint8Array | string): void;
  deletePart(name: string): void;
  async save(): Promise<Uint8Array>;

  // content.hpf 기반
  getSectionPaths(): string[];
  getHeaderPaths(): string[];
  getMetadata(): { title?: string; creator?: string; language?: string; created?: string; modified?: string };
}
```

**테스트:**
- `test-hwpx.hwpx` 열기 → 파트 목록 = `[mimetype, META-INF/..., Contents/..., ...]`
- 라운드트립: open → save → open → 파트 동일
- 잘못된 ZIP → 명확한 에러

**완료 기준:** 8개 픽스처 모두 열기 성공, 라운드트립 통과

---

### PARSE-01: 헤더 파서

**레퍼런스:** HWPML 스펙 §4, `header.xml` 실제 구조

**산출물:**
- `hwpx-parser/src/header-parser.ts`
- `hwpx-parser/src/xml-utils.ts`
- 테스트

**API:**
```typescript
export function parseHeader(xml: string): DocumentHeader;
```

**파싱 대상 (스펙 §4 순서):**
1. `hh:beginNum` → BeginNum
2. `hh:refList > hh:fontfaces` → FontFaceDecl[]
3. `hh:refList > hh:charProperties > hh:charPr` → CharProperty[]
4. `hh:refList > hh:paraProperties > hh:paraPr` → ParaProperty[]
5. `hh:refList > hh:styles > hh:style` → StyleDecl[]
6. 나머지 (`borderFills`, `bullets`, `numberings`, `tabProperties`, `memoProperties`) → GenericElement[]

**완료 기준:** 8개 픽스처의 header.xml 파싱 성공, 글꼴/스타일 정보 정확

---

### PARSE-02: 본문 파서 (섹션/단락/런)

**레퍼런스:** HWPML 스펙 §5, `section0.xml` 실제 구조

**산출물:**
- `hwpx-parser/src/section-parser.ts`
- `hwpx-parser/src/paragraph-parser.ts`
- 테스트

**API:**
```typescript
export function parseSection(xml: string): Section;
export function parseParagraph(node: XmlNode): Paragraph;
export function parseRun(node: XmlNode): Run;
```

**파싱 대상:**
- `hs:sec` → Section
- `hp:p` (속성: id, paraPrIDRef, styleIDRef, pageBreak, columnBreak, merged) → Paragraph
- `hp:run` (속성: charPrIDRef) → Run
- `hp:t` → text
- `hp:secPr` → GenericElement (구조가 복잡, Phase 1에서는 GenericElement로 보존)
- `hp:ctrl` → GenericElement
- `hp:tbl` → GenericElement (§5.4 표 구조는 PARSE-04에서 상세 파싱)
- 인라인 객체 20종 → GenericElement
- 변경추적 마크 4종 → trackChange
- `hp:linesegarray > hp:lineseg` → LineSeg[]

**인라인 객체 목록 (스펙 §5.5~5.12):**
`line, rect, ellipse, arc, polyline, polygon, curve, connectLine, picture, pic, shape, drawingObject, container, equation, ole, chart, video, audio, textart`

**완료 기준:** 8개 픽스처에서 텍스트 추출 성공, expected JSON과 일치

---

### PARSE-03: 통합 파서

**의존:** PARSE-01 + PARSE-02

**산출물:**
- `hwpx-parser/src/index.ts` — parseHwpx

**API:**
```typescript
export interface ParseResult {
  document: HwpDocument;
  warnings: ParseWarning[];
  parseTimeMs: number;
}

export async function parseHwpx(pkg: OpcPackage, options?: { sections?: number[] }): Promise<ParseResult>;
```

**흐름:**
1. `pkg.getHeaderPaths()` → header.xml 파싱 → DocumentHeader
2. `pkg.getSectionPaths()` → 각 section XML 파싱 → Section[]
3. 조합 → HwpDocument

**완료 기준:** 전체 파이프라인 (파일 → OpcPackage → HwpDocument → 텍스트 추출) 동작

---

### WRITE-01: 헤더 직렬화

**산출물:** `hwpx-writer/src/header-serializer.ts`

```typescript
export function serializeHeader(header: DocumentHeader): string;
```

**완료 기준:** parse → serialize → parse 라운드트립 일치

---

### WRITE-02: 본문 직렬화

**산출물:** `hwpx-writer/src/section-serializer.ts`

```typescript
export function serializeSection(section: Section): string;
```

**완료 기준:** parse → serialize → parse 라운드트립 일치

---

### WRITE-03: 통합 라이터 + 빌더

**의존:** WRITE-01 + WRITE-02 + CORE-01

**산출물:**
- `hwpx-writer/src/hwpx-writer.ts`
- `hwpx-writer/src/builder.ts`

```typescript
export async function writeHwpx(doc: HwpDocument): Promise<Uint8Array>;

export class HwpxBuilder {
  constructor(template?: 'a4');
  addParagraph(text: string, options?: { bold?: boolean; fontSize?: number }): this;
  addTable(rows: number, cols: number): TableBuilder;
  build(): HwpDocument;
  async toBuffer(): Promise<Uint8Array>;
}
```

**완료 기준:**
- 라운드트립: parse → write → parse 동일
- HwpxBuilder로 생성한 파일을 한컴오피스에서 열기 성공

---

### HWP-01: HWP 5.x CFB 리더

**레퍼런스:** HWP 5.0 스펙 (hwp5-spec-r1.3.pdf), hwp.js (Apache-2.0)

**산출물:**
- `hwp-reader/src/cfb-reader.ts` — OLE2 스트림 읽기
- `hwp-reader/src/file-header.ts` — FileHeader 파싱
- `hwp-reader/src/record-parser.ts` — 레코드 헤더/데이터

**API:**
```typescript
export interface HwpFileHeader {
  signature: string;     // "HWP Document File"
  version: { major: number; minor: number; build: number; revision: number };
  flags: { compressed: boolean; encrypted: boolean; distribution: boolean };
}

export interface HwpRecord {
  tagId: number;
  level: number;
  size: number;
  data: Uint8Array;
}

export function parseFileHeader(data: Uint8Array): HwpFileHeader;
export function parseRecords(stream: Uint8Array): HwpRecord[];
```

**완료 기준:** HWP 파일에서 스트림 목록 + FileHeader + 레코드 목록 추출 성공

---

### HWP-02: HWP 5.x 본문 해석

**의존:** HWP-01 + MODEL-01

**산출물:**
- `hwp-reader/src/docinfo-parser.ts`
- `hwp-reader/src/bodytext-parser.ts`
- `hwp-reader/src/hwp-reader.ts` (통합)

```typescript
export async function readHwp(input: Uint8Array): Promise<{
  document: HwpDocument;
  warnings: ParseWarning[];
  hwpVersion: string;
}>;
```

**핵심 난이도:** UTF-16LE 텍스트 + 인라인 제어문자 처리 (0x0002, 0x000D, 0x0018 등)

**완료 기준:** 기본 텍스트 문서에서 텍스트 추출 성공, 표 구조 추출 성공

---

### CONV-01: HWP → HWPX 변환

**의존:** HWP-02 + WRITE-03

**산출물:** `hwp-converter/src/converter.ts`

```typescript
export async function convertHwpToHwpx(input: Uint8Array): Promise<{
  hwpx: Uint8Array;
  warnings: string[];
}>;
```

**완료 기준:** 변환된 HWPX를 한컴오피스에서 열기 성공, 텍스트 보존율 100%

---

## 7. 검증 체계

### 7.1 자동 검증

```bash
pnpm turbo typecheck   # 타입 체크
pnpm turbo test        # 유닛 테스트
pnpm turbo build       # 빌드
```

### 7.2 크로스 밸리데이션

```bash
# HanDoc이 쓴 HWPX → python-hwpx로 읽기 (호환성 확인)
npx tsx scripts/cross-validate.ts --direction=ts2py

# python-hwpx가 쓴 HWPX → HanDoc으로 읽기
npx tsx scripts/cross-validate.ts --direction=py2ts
```

### 7.3 한컴오피스 호환성 (수동)

1. `pnpm generate:fixtures` → `fixtures/output/*.hwpx`
2. 한컴오피스에서 열기
3. 결과를 `fixtures/compat-report.md`에 기록

### 7.4 에이전트 검증 프로토콜

**서브에이전트가 태스크 완료 보고 시 MJ가 반드시 확인:**
1. `ls` — 파일 존재?
2. `pnpm turbo test --filter=@handoc/{pkg}` — 테스트 통과?
3. `pnpm turbo build --filter=@handoc/{pkg}` — 빌드 성공?
4. `wc -l` — 실제 코드량 확인 (환각 방지)
5. 간단한 스모크 테스트 직접 실행

---

## 8. 일정 (4에이전트 병렬)

```
시간   0    4    8   12   16   20   24   28
       ├────┼────┼────┼────┼────┼────┼────┤
A:     [SETUP-01][MODEL-01 ][HWP-01     ][HWP-02          ][CONV-01  ]
B:     [SETUP-02   ][CORE-01     ][ 검증/CI              ][CONV-01  ]
C:     [   대기     ][   대기    ][PARSE-01    ][WRITE-01  ][PARSE-03][WRITE-03]
D:     [   대기     ][   대기    ][PARSE-02    ][WRITE-02  ][  합류  ][  합류  ]
```

**크리티컬 패스:** SETUP-01 → MODEL-01 → HWP-01 → HWP-02 → CONV-01 = ~28시간
**전체 예상:** ~28시간 (에이전트 시간), 실제 2-3일

---

## 9. 리스크

| 리스크 | 대응 |
|--------|------|
| HWP 5.x 미문서화 레코드 | hwp.js(Apache-2.0) 참고, 미지원은 skip + warning |
| python-hwpx 라이선스 오염 | 코드 참조 금지, 한컴 공식 스펙만 사용 |
| 한컴오피스 호환성 깨짐 | GenericElement로 미지원 요소 보존 → 라운드트립 안전 |
| 브라우저 환경 차이 | fflate/fast-xml-parser 모두 브라우저 지원 |

---

## 10. 삭제한 것

원본 계획서에서 **Phase 1에 불필요한 내용 제거:**
- ❌ Phase 2/3 (렌더러, 편집기, 협업, 모바일, 클라우드)
- ❌ 시장 분석, 수익화 모델
- ❌ python-hwpx 클래스 매핑표 (라이선스 위험)
- ❌ coverage-tracker.json (오버엔지니어링)
- ❌ 에이전트 5명 계획 (4명으로 통일)

---

*HanDoc — HWP를 웹으로.*
