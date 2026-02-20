# 무인 문서 엔진 (Muin Document Engine) — HWP/HWPX 라이브러리 개발 계획서

> **문서 버전:** 1.0  
> **작성일:** 2026-02-20  
> **프로젝트 코드명:** `muin-hwp`

---

## 1. 프로젝트 개요

### 프로젝트명
- **한글:** 무인 문서 엔진
- **영문:** Muin Document Engine (MDE)

### 비전 & 미션
- **비전:** HWP/HWPX 문서를 웹에서 자유롭게 — 한글 문서의 오픈 웹 표준화
- **미션:** 한국 공공기관·기업이 사용하는 HWP/HWPX 문서를 브라우저에서 읽고, 쓰고, 편집할 수 있는 오픈소스 TypeScript 라이브러리 제공

### 핵심 가치 제안
1. **탈한컴 의존:** 한컴오피스 없이도 HWP/HWPX 완전 처리
2. **웹 네이티브:** 서버 불필요, 브라우저에서 직접 동작
3. **개발자 친화:** npm 패키지로 즉시 통합, Tree-shakeable
4. **공공 호환:** 대한민국 공공기관 문서 서식 완벽 지원

### 타겟 사용자
| 사용자 | 유즈 케이스 |
|--------|------------|
| 웹 개발자 | HWP/HWPX 파일 업로드 → 텍스트/표 추출 |
| SaaS 제품 | 문서 뷰어 임베드 (계약서, 보고서) |
| 공공기관 SI | 전자문서 시스템에 HWP 뷰어 통합 |
| 개인 사용자 | 웹 기반 HWP 뷰어/편집기 |

### 저작권 고지
모든 배포물에 아래 문구를 포함:
> "본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다."

---

## 2. 기술 아키텍처

### 2.1 모노레포 구조

```
muin-hwp/
├── packages/
│   ├── hwpx-core/        # OPC 패키지 처리 (ZIP, 관계, 콘텐츠타입)
│   ├── hwpx-parser/      # HWPX XML → 내부 문서 모델
│   ├── hwpx-writer/      # 내부 모델 → HWPX 파일
│   ├── hwp-reader/       # HWP 5.x OLE2 바이너리 읽기
│   ├── hwp-converter/    # HWP → HWPX 변환
│   ├── document-model/   # 공유 문서 모델 (타입 정의)
│   ├── hwpx-renderer/    # Phase 2: DOM/Canvas 렌더링
│   └── hwpx-editor/      # Phase 2: 편집 기능
├── apps/
│   └── web-viewer/       # Phase 2: 웹 앱
├── fixtures/             # 테스트용 HWP/HWPX 샘플 파일
├── scripts/              # 빌드/테스트 스크립트
├── turbo.json
├── package.json
└── tsconfig.base.json
```

### 2.2 패키지 의존 관계

```
document-model  (의존 없음 — 순수 타입/인터페이스)
     ↑
     ├── hwpx-core → hwpx-parser → hwpx-writer
     │                    ↑              ↑
     │                    └── hwp-converter
     │                         ↑
     └── hwp-reader ─────────┘
     
Phase 2:
     document-model → hwpx-renderer → hwpx-editor → web-viewer
```

### 2.3 기술 스택

| 기술 | 선정 이유 |
|------|----------|
| **TypeScript 5.x** | 타입 안전성, HWP 스펙의 복잡한 구조를 타입으로 표현 |
| **Turborepo** | 모노레포 빌드 캐싱, 병렬 빌드 |
| **Vitest** | 빠른 테스트, ESM 네이티브 |
| **tsup** | 번들링 (ESM + CJS 동시 출력) |
| **fflate** | ZIP 압축/해제 (작고 빠름, 브라우저/Node 겸용) |
| **fast-xml-parser** | XML 파싱 (DOM 없이 JSON 변환, 성능 우수) |
| **React 19** | Phase 2 웹 앱 (SSR, Suspense) |
| **Canvas API** | Phase 2 페이지 렌더링 |

### 2.4 HWPX 파일 구조 상세 분석

HWPX는 **OPC(Open Packaging Convention)** 기반 ZIP 아카이브. OOXML(.docx)과 구조적으로 유사.

```
example.hwpx (ZIP)
├── [Content_Types].xml          # 콘텐츠 타입 매핑
├── _rels/
│   └── .rels                    # 최상위 관계 정의
├── META-INF/
│   └── container.xml            # 루트 파일 포인터
├── Contents/
│   ├── header.xml               # 문서 속성 (용지, 여백, 글꼴 매핑)
│   ├── content0.xml             # 섹션 0 본문 (단락, 표, 그림)
│   ├── content1.xml             # 섹션 1 (다중 섹션 시)
│   └── _rels/
│       └── content0.xml.rels    # 섹션별 리소스 관계
├── BinData/                     # 임베디드 바이너리 (이미지, OLE)
│   ├── image1.png
│   └── image2.jpg
├── Scripts/                     # 매크로 스크립트 (선택)
└── Preview/
    └── PrvImage.png             # 미리보기 이미지
```

#### 핵심 XML 스키마 요소

**header.xml** — 문서 설정:
```xml
<hh:head>
  <hh:beginNum page="1" footnote="1" endnote="1"/>
  <hh:refList>
    <hh:fontfaces>
      <hh:fontface lang="HANGUL">
        <hh:font face="함초롬돋움" type="TTF"/>
      </hh:fontface>
    </hh:fontfaces>
    <hh:charProperties>
      <hh:charPr id="0" height="1000" color="#000000"/>
    </hh:charProperties>
    <hh:paraProperties>
      <hh:paraPr id="0" align="JUSTIFY">
        <hh:margin indent="0" left="0" right="0"/>
      </hh:paraPr>
    </hh:paraProperties>
  </hh:refList>
  <hh:secProperties>
    <hh:secPr pageWidth="59528" pageHeight="84188" 
              marginLeft="8504" marginRight="8504" 
              marginTop="5668" marginBottom="4252"/>
  </hh:secPr>
</hh:head>
```
> 단위: 1/7200 인치 (HWP Unit). 59528 HU ≈ 210mm (A4 너비)

**content0.xml** — 본문:
```xml
<hs:sec>
  <hp:p paraPrIDRef="0" styleIDRef="0">
    <hp:run charPrIDRef="0">
      <hp:secPr/>
      <hp:t>안녕하세요, 무인 문서 엔진입니다.</hp:t>
    </hp:run>
  </hp:p>
  <hp:tbl>
    <hp:tr>
      <hp:tc>
        <hp:p><hp:run><hp:t>셀 내용</hp:t></hp:run></hp:p>
      </hp:tc>
    </hp:tr>
  </hp:tbl>
</hs:sec>
```

**네임스페이스:**
| Prefix | URI | 역할 |
|--------|-----|------|
| `hh` | `http://www.hancom.co.kr/hwpml/2011/head` | 문서 헤더 |
| `hp` | `http://www.hancom.co.kr/hwpml/2011/paragraph` | 단락/런 |
| `hs` | `http://www.hancom.co.kr/hwpml/2011/section` | 섹션 |
| `hc` | `http://www.hancom.co.kr/hwpml/2011/core` | 공통 |
| `ha` | `http://www.hancom.co.kr/hwpml/2011/app` | 앱 속성 |

### 2.5 HWP 5.x 바이너리 구조 분석

HWP 5.x는 **MS-CFB(Compound File Binary, OLE2)** 기반.

```
HWP 5.x (OLE2 Compound File)
├── FileHeader              # 시그니처, 버전, 플래그 (암호화, 압축 등)
├── DocInfo                 # 문서 속성 (글꼴, 스타일, 색상 등)
├── BodyText/
│   ├── Section0            # 섹션 0 본문
│   ├── Section1            # 섹션 1
│   └── ...
├── BinData/
│   ├── BIN0001.png         # 임베디드 바이너리
│   └── ...
├── PrvText                 # 미리보기 텍스트
├── PrvImage                # 미리보기 이미지
├── DocOptions/             # 문서 옵션
│   └── _LinkDoc            # 연결 문서
├── Scripts/                # 매크로
└── Summary Information     # OLE2 표준 요약 정보
```

#### 레코드 구조
DocInfo, Section 스트림은 **연속된 레코드**로 구성:

```
┌─────────────────────────────────────────┐
│ Record Header (4 bytes)                 │
│  ├─ Tag ID    : 10 bits (레코드 타입)    │
│  ├─ Level     : 10 bits (트리 깊이)      │
│  └─ Size      : 12 bits (데이터 크기)    │
│     (Size == 0xFFF → 다음 4바이트가 실제 크기) │
├─────────────────────────────────────────┤
│ Record Data   (Size bytes)              │
└─────────────────────────────────────────┘
```

주요 태그 ID:
| Tag ID | 이름 | 설명 |
|--------|------|------|
| 16 | DOCUMENT_PROPERTIES | 섹션 수, 시작 번호 |
| 17 | ID_MAPPINGS | ID 매핑 개수 |
| 18 | BIN_DATA | 바이너리 데이터 정보 |
| 19 | FACE_NAME | 글꼴 이름 |
| 20 | BORDER_FILL | 테두리/채움 |
| 21 | CHAR_SHAPE | 글자 모양 |
| 22 | TAB_DEF | 탭 정의 |
| 23 | NUMBERING | 문단 번호 |
| 24 | BULLET | 글머리표 |
| 25 | PARA_SHAPE | 문단 모양 |
| 26 | STYLE | 스타일 |
| 66 | PARA_HEADER | 문단 헤더 |
| 67 | PARA_TEXT | 문단 텍스트 (UTF-16LE) |
| 68 | PARA_CHAR_SHAPE | 문단 내 글자 모양 |
| 69 | PARA_LINE_SEG | 줄 나누기 정보 |
| 71 | CTRL_HEADER | 컨트롤 헤더 (표, 그림 등) |
| 75 | TABLE | 표 속성 |
| 76 | LIST_HEADER | 셀 등 리스트 헤더 |

#### 압축 & 암호화
- **압축:** FileHeader 플래그 bit 0 → DocInfo, Section 스트림이 zlib deflate 압축
- **암호화:** FileHeader 플래그 bit 1 → 암호화 (Phase 1에서 미지원, 에러 반환)
- **배포용:** FileHeader 플래그 bit 2 → 배포용 문서 (읽기만 허용)

---

## 3. Phase 1 상세 — 핵심 라이브러리 (4주)

### 3.0 공유 문서 모델 — `@muin/document-model`

> **태스크 ID:** P1-MODEL-01  
> **소요 시간:** 2일 (에이전트 기준)  
> **의존성:** 없음 (최우선 착수)  
> **담당:** Agent A

모든 패키지가 공유하는 내부 문서 표현(IR). HWPX XML도, HWP 바이너리도 이 모델로 변환.

#### 핵심 타입 정의

```typescript
// packages/document-model/src/types.ts

/** HWP 단위: 1/7200 인치 */
export type HwpUnit = number;

/** 문서 루트 */
export interface HwpDocument {
  properties: DocumentProperties;
  settings: DocumentSettings;
  sections: Section[];
  fonts: FontFace[];
  charShapes: CharShape[];
  paraShapes: ParaShape[];
  styles: Style[];
  binData: BinDataEntry[];
}

export interface DocumentProperties {
  version: string;          // "5.1.0.0"
  creator?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  title?: string;
  subject?: string;
  keywords?: string[];
}

export interface DocumentSettings {
  beginNumber: { page: number; footnote: number; endnote: number };
}

/** 섹션 */
export interface Section {
  pageSetup: PageSetup;
  paragraphs: Paragraph[];
  headers?: HeaderFooter[];
  footers?: HeaderFooter[];
}

export interface PageSetup {
  width: HwpUnit;           // A4 = 59528
  height: HwpUnit;          // A4 = 84188
  margin: {
    top: HwpUnit;
    bottom: HwpUnit;
    left: HwpUnit;
    right: HwpUnit;
    header: HwpUnit;
    footer: HwpUnit;
    gutter: HwpUnit;
  };
  orientation: 'portrait' | 'landscape';
  columns: ColumnSetup;
}

/** 단락 */
export interface Paragraph {
  paraShapeId: number;
  styleId: number;
  runs: Run[];
  controls?: Control[];     // 표, 그림, 각주 등
}

/** 텍스트 런 */
export interface Run {
  charShapeId: number;
  text: string;
}

/** 글자 모양 */
export interface CharShape {
  id: number;
  height: number;           // 1/100 pt (1000 = 10pt)
  color: string;            // "#RRGGBB"
  fontIds: Record<LangType, number>;
  bold: boolean;
  italic: boolean;
  underline: UnderlineType;
  strikeout: StrikeoutType;
  letterSpacing: number;    // % (기본 0)
}

export type LangType = 'HANGUL' | 'LATIN' | 'HANJA' | 'JAPANESE' | 'OTHER' | 'SYMBOL' | 'USER';

/** 문단 모양 */
export interface ParaShape {
  id: number;
  align: 'JUSTIFY' | 'LEFT' | 'RIGHT' | 'CENTER' | 'DISTRIBUTE';
  margin: { left: HwpUnit; right: HwpUnit; indent: HwpUnit };
  lineSpacing: { type: 'PERCENT' | 'FIXED'; value: number };
  spaceBefore: HwpUnit;
  spaceAfter: HwpUnit;
}

/** 컨트롤 (표, 그림 등) */
export type Control = TableControl | ImageControl | ShapeControl | FootnoteControl;

export interface TableControl {
  type: 'table';
  rows: TableRow[];
  borderFillId: number;
  cellSpacing: HwpUnit;
}

export interface TableRow {
  cells: TableCell[];
  height: HwpUnit;
}

export interface TableCell {
  colSpan: number;
  rowSpan: number;
  width: HwpUnit;
  paragraphs: Paragraph[];
  borderFillId: number;
  vertAlign: 'TOP' | 'MIDDLE' | 'BOTTOM';
}

export interface ImageControl {
  type: 'image';
  binDataId: number;
  width: HwpUnit;
  height: HwpUnit;
  offsetX: HwpUnit;
  offsetY: HwpUnit;
  wrapping: 'inline' | 'square' | 'tight' | 'behind' | 'infront';
}

export interface BinDataEntry {
  id: number;
  type: 'EMBED' | 'LINK' | 'STORAGE';
  format: string;           // "png", "jpg", "bmp", "ole"
  data?: Uint8Array;        // 임베디드 데이터
  path?: string;            // 링크 경로
}

export interface FontFace {
  lang: LangType;
  fonts: { name: string; type: 'TTF' | 'HFT'; altName?: string }[];
}

export interface Style {
  id: number;
  name: string;
  type: 'PARA' | 'CHAR';
  paraShapeId: number;
  charShapeId: number;
  nextStyleId: number;
}

// ... (ColumnSetup, HeaderFooter, UnderlineType, StrikeoutType 등 추가)
```

#### 입력/출력 명세
- **입력:** 없음 (순수 타입 정의 패키지)
- **출력:** TypeScript 타입, 유틸리티 함수 (단위 변환, 기본값 생성)
- **검증:** 타입 체크 통과, 문서 모델 생성/직렬화 테스트

---

### 3.1 `@muin/hwpx-core` — OPC 패키지 처리

> **태스크 ID:** P1-CORE-01  
> **소요 시간:** 3일  
> **의존성:** P1-MODEL-01  
> **담당:** Agent B

#### 역할
HWPX(ZIP) 파일의 저수준 패키지 처리. ZIP I/O, `[Content_Types].xml` 파싱, `_rels/*.rels` 관계 파싱.

#### API 설계

```typescript
// packages/hwpx-core/src/index.ts

export interface OpcPackage {
  contentTypes: ContentTypeMap;
  relationships: Relationship[];
  parts: Map<string, OpcPart>;
}

export interface OpcPart {
  path: string;             // "/Contents/content0.xml"
  contentType: string;      // "application/xml"
  data: Uint8Array;
  relationships: Relationship[];
}

export interface Relationship {
  id: string;               // "rId1"
  type: string;             // "http://www.hancom.co.kr/.../section"
  target: string;           // "Contents/content0.xml"
}

export interface ContentTypeMap {
  defaults: Map<string, string>;    // 확장자 → MIME
  overrides: Map<string, string>;   // 경로 → MIME
}

/** ZIP → OPC 패키지 */
export async function readPackage(input: Uint8Array | ReadableStream): Promise<OpcPackage>;

/** OPC 패키지 → ZIP */
export async function writePackage(pkg: OpcPackage): Promise<Uint8Array>;

/** 특정 파트 읽기 */
export function getPart(pkg: OpcPackage, path: string): OpcPart | undefined;

/** 파트 추가/수정 */
export function setPart(pkg: OpcPackage, path: string, data: Uint8Array, contentType: string): void;

/** 관계 조회 */
export function getRelationshipsByType(pkg: OpcPackage, type: string): Relationship[];
```

#### 테스트 케이스
| ID | 테스트 | 검증 기준 |
|----|--------|----------|
| P1-CORE-T01 | 빈 HWPX ZIP 읽기 | contentTypes, relationships 파싱 성공 |
| P1-CORE-T02 | 이미지 포함 HWPX 읽기 | BinData/ 파트 정상 추출 |
| P1-CORE-T03 | OPC 패키지 → ZIP 라운드트립 | 읽기 → 쓰기 → 읽기 동일 |
| P1-CORE-T04 | 잘못된 ZIP 입력 | 적절한 에러 메시지 |
| P1-CORE-T05 | 대용량 파일 (50MB+) | 메모리 사용량 < 200MB, 시간 < 3초 |

---

### 3.2 `@muin/hwpx-parser` — HWPX XML 파싱

> **태스크 ID:** P1-PARSE-01  
> **소요 시간:** 5일  
> **의존성:** P1-MODEL-01, P1-CORE-01  
> **담당:** Agent C

#### 역할
OPC 패키지의 XML 파트들을 파싱하여 `HwpDocument` 모델로 변환.

#### API 설계

```typescript
// packages/hwpx-parser/src/index.ts

export interface ParseOptions {
  /** 바이너리 데이터 로드 여부 (이미지 등) */
  loadBinData?: boolean;     // default: true
  /** 특정 섹션만 파싱 */
  sections?: number[];
  /** 파싱 이벤트 콜백 (스트리밍 파싱용) */
  onProgress?: (progress: ParseProgress) => void;
}

export interface ParseResult {
  document: HwpDocument;
  warnings: ParseWarning[];
  /** 파싱 소요 시간 (ms) */
  parseTimeMs: number;
}

export interface ParseWarning {
  code: string;              // "UNKNOWN_ELEMENT", "UNSUPPORTED_FEATURE"
  message: string;
  path: string;              // XML 경로
}

/** HWPX OPC 패키지 → 문서 모델 */
export async function parseHwpx(pkg: OpcPackage, options?: ParseOptions): Promise<ParseResult>;

/** 개별 XML 파싱 (테스트/디버깅용) */
export function parseHeader(xml: string): Omit<HwpDocument, 'sections'>;
export function parseSection(xml: string, header: HwpDocument): Section;
```

#### 파싱 전략
1. `META-INF/container.xml` → 루트 파일 경로 확인
2. `Contents/header.xml` → 글꼴, 문단/글자 모양, 스타일 파싱
3. `Contents/content{N}.xml` → 섹션별 본문 파싱
4. `BinData/*` → 이미지/OLE 데이터 로드

#### 테스트 케이스
| ID | 테스트 | 검증 기준 |
|----|--------|----------|
| P1-PARSE-T01 | 텍스트만 있는 HWPX | 단락/런 정상 추출 |
| P1-PARSE-T02 | 표 포함 HWPX | TableControl 구조 정확 |
| P1-PARSE-T03 | 이미지 포함 HWPX | ImageControl + BinData 연결 |
| P1-PARSE-T04 | 다중 섹션 | 섹션별 독립 파싱 |
| P1-PARSE-T05 | 복잡 서식 (글머리표, 각주) | 모든 컨트롤 타입 파싱 |
| P1-PARSE-T06 | 한컴오피스 생성 실제 파일 10종 | 경고 0, 텍스트 일치 |

---

### 3.3 `@muin/hwpx-writer` — HWPX 쓰기

> **태스크 ID:** P1-WRITE-01  
> **소요 시간:** 4일  
> **의존성:** P1-MODEL-01, P1-CORE-01  
> **담당:** Agent D

#### 역할
`HwpDocument` 모델 → HWPX XML → ZIP 아카이브 생성.

#### API 설계

```typescript
// packages/hwpx-writer/src/index.ts

export interface WriteOptions {
  /** 압축 레벨 (0-9, default: 6) */
  compressionLevel?: number;
  /** 미리보기 이미지 생성 여부 */
  generatePreview?: boolean;
  /** 호환성 버전 */
  targetVersion?: string;    // default: "1.2"
}

/** 문서 모델 → HWPX 바이트 */
export async function writeHwpx(doc: HwpDocument, options?: WriteOptions): Promise<Uint8Array>;

/** 문서 빌더 (편의 API) */
export class HwpxBuilder {
  constructor(template?: 'blank' | 'a4' | 'letter');
  
  setTitle(title: string): this;
  addSection(setup?: Partial<PageSetup>): SectionBuilder;
  addFont(name: string, lang?: LangType): this;
  
  build(): HwpDocument;
  toBuffer(options?: WriteOptions): Promise<Uint8Array>;
}

export class SectionBuilder {
  addParagraph(text: string, style?: Partial<ParaShape & CharShape>): this;
  addTable(rows: number, cols: number): TableBuilder;
  addImage(data: Uint8Array, format: string, width: HwpUnit, height: HwpUnit): this;
  addPageBreak(): this;
}

export class TableBuilder {
  setCell(row: number, col: number, text: string): this;
  mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): this;
  setBorder(style: string, width: number, color: string): this;
  end(): SectionBuilder;
}
```

#### 사용 예시

```typescript
import { HwpxBuilder } from '@muin/hwpx-writer';

const doc = new HwpxBuilder('a4')
  .setTitle('보고서')
  .addSection()
    .addParagraph('제목입니다', { align: 'CENTER', height: 1800, bold: true })
    .addParagraph('본문 내용입니다.')
    .addTable(3, 4)
      .setCell(0, 0, '항목')
      .setCell(0, 1, '값')
      .end()
  .build();

const buffer = await writeHwpx(doc);
// → Uint8Array (유효한 .hwpx 파일)
```

#### 테스트 케이스
| ID | 테스트 | 검증 기준 |
|----|--------|----------|
| P1-WRITE-T01 | 빈 문서 생성 | 한컴오피스에서 열림 |
| P1-WRITE-T02 | 텍스트 문서 | 내용 정확히 표시 |
| P1-WRITE-T03 | 표 포함 | 셀 병합, 테두리 정상 |
| P1-WRITE-T04 | 이미지 포함 | 이미지 정상 표시 |
| P1-WRITE-T05 | 라운드트립 | parse → write → parse 동일 모델 |
| P1-WRITE-T06 | Builder API | 편의 API 동작 검증 |

---

### 3.4 `@muin/hwp-reader` — HWP 5.x 바이너리 읽기

> **태스크 ID:** P1-HWP-01  
> **소요 시간:** 7일  
> **의존성:** P1-MODEL-01  
> **담당:** Agent E

#### 역할
HWP 5.x OLE2(CFB) 바이너리 → `HwpDocument` 모델. 가장 복잡한 모듈.

#### API 설계

```typescript
// packages/hwp-reader/src/index.ts

export interface HwpReadOptions {
  /** 암호화 파일 비밀번호 */
  password?: string;
  /** 바이너리 데이터 로드 여부 */
  loadBinData?: boolean;
  /** 특정 섹션만 */
  sections?: number[];
}

export interface HwpReadResult {
  document: HwpDocument;
  warnings: ParseWarning[];
  /** HWP 파일 버전 */
  hwpVersion: string;
  /** 파일 속성 플래그 */
  flags: {
    compressed: boolean;
    encrypted: boolean;
    distribution: boolean;
    script: boolean;
    drm: boolean;
    xmlTemplate: boolean;
    vcs: boolean;
  };
}

/** HWP 5.x 바이너리 → 문서 모델 */
export async function readHwp(input: Uint8Array, options?: HwpReadOptions): Promise<HwpReadResult>;

/** 저수준: OLE2 스트림 직접 접근 */
export function readOleStreams(input: Uint8Array): Map<string, Uint8Array>;

/** 저수준: 레코드 파싱 */
export function parseRecords(stream: Uint8Array): HwpRecord[];

export interface HwpRecord {
  tagId: number;
  level: number;
  size: number;
  data: Uint8Array;
}
```

#### 구현 전략
1. **OLE2 파싱:** `cfb` npm 패키지 활용 또는 직접 구현 (FAT/Mini-FAT 읽기)
2. **FileHeader 파싱:** 시그니처 검증, 버전, 플래그
3. **스트림 디컴프레스:** zlib inflate (compressed 플래그 시)
4. **레코드 파싱:** 4바이트 헤더 → tag/level/size → 재귀 트리 구성
5. **DocInfo 해석:** 글꼴, 스타일, 문단/글자 모양 테이블 구축
6. **BodyText 해석:** 각 Section 스트림 → 문단, 표, 그림 등

#### 특수 처리
- **문단 텍스트 (Tag 67):** UTF-16LE, 인라인 제어 문자:
  - `0x0002`: 섹션/단 정의
  - `0x0003`: 필드 시작
  - `0x000B`: 그리기 개체
  - `0x000D`: 문단 끝
  - `0x0010`: 하이퍼링크
  - `0x0018`: 표/그림 등 개체
- **암호화:** Phase 1에서는 미지원 → `EncryptedDocumentError` throw

#### 테스트 케이스
| ID | 테스트 | 검증 기준 |
|----|--------|----------|
| P1-HWP-T01 | HWP 5.0 기본 문서 | 텍스트 정상 추출 |
| P1-HWP-T02 | 압축된 HWP | zlib 해제 후 정상 파싱 |
| P1-HWP-T03 | 표 포함 HWP | 표 구조 정확 |
| P1-HWP-T04 | 이미지 포함 HWP | BinData 추출 성공 |
| P1-HWP-T05 | 다양한 버전 (5.0~5.1) | 버전별 호환 |
| P1-HWP-T06 | 암호화 문서 | 명확한 에러 메시지 |
| P1-HWP-T07 | 깨진 파일 | 그레이스풀 에러 핸들링 |
| P1-HWP-T08 | 공공기관 실제 파일 20종 | 텍스트 추출 일치율 >95% |

---

### 3.5 `@muin/hwp-converter` — HWP → HWPX 변환

> **태스크 ID:** P1-CONV-01  
> **소요 시간:** 4일  
> **의존성:** P1-HWP-01, P1-WRITE-01 (모두 완료 후)  
> **담당:** Agent F (또는 먼저 끝난 에이전트)

#### 역할
HWP 5.x 파일을 읽어 HWPX로 변환. 내부적으로 `hwp-reader` → `document-model` → `hwpx-writer` 파이프라인.

#### API 설계

```typescript
// packages/hwp-converter/src/index.ts

export interface ConvertOptions extends HwpReadOptions, WriteOptions {
  /** 변환 시 손실되는 기능 처리 */
  onUnsupported?: (feature: string) => 'skip' | 'warn' | 'error';
}

export interface ConvertResult {
  hwpx: Uint8Array;
  warnings: ConvertWarning[];
  /** 변환 손실 요약 */
  lossReport: {
    unsupportedFeatures: string[];
    approximatedFeatures: string[];
  };
}

/** HWP → HWPX 변환 */
export async function convertHwpToHwpx(
  hwpInput: Uint8Array, 
  options?: ConvertOptions
): Promise<ConvertResult>;

/** 스트림 변환 (대용량) */
export function createConvertStream(options?: ConvertOptions): TransformStream;
```

#### 테스트 케이스
| ID | 테스트 | 검증 기준 |
|----|--------|----------|
| P1-CONV-T01 | 기본 텍스트 HWP → HWPX | 한컴오피스에서 HWPX 정상 열림 |
| P1-CONV-T02 | 표+이미지 HWP → HWPX | 레이아웃 유지 |
| P1-CONV-T03 | 변환 손실 보고서 | 미지원 기능 명확히 리포트 |
| P1-CONV-T04 | 배치 변환 10파일 | 전체 성공, 총 시간 < 30초 |

---

## 4. Phase 2 상세 — 웹 뷰어/편집기 (6주)

### 4.1 `@muin/hwpx-renderer` — 문서 렌더링

> **태스크 ID:** P2-RENDER-01  
> **소요 시간:** 10일  
> **의존성:** Phase 1 완료  
> **담당:** Agent A + Agent B

#### 역할
`HwpDocument` → DOM 또는 Canvas 기반 페이지 렌더링.

#### 렌더링 전략
- **레이어 1: 레이아웃 엔진** — 문단 배치, 줄바꿈, 페이지 나누기 계산
- **레이어 2: DOM 렌더** — HTML/CSS 기반 (텍스트 선택, 접근성 유리)
- **레이어 3: Canvas 렌더** — 정밀 렌더링 (인쇄용, 픽셀 퍼펙트)

#### API 설계

```typescript
// packages/hwpx-renderer/src/index.ts

export interface RenderOptions {
  mode: 'dom' | 'canvas';
  /** 렌더링 대상 컨테이너 */
  container: HTMLElement;
  /** 확대/축소 (1.0 = 100%) */
  zoom?: number;
  /** 페이지 범위 */
  pageRange?: { start: number; end: number };
  /** 페이지 간격 (px) */
  pageGap?: number;
}

export interface RenderedDocument {
  totalPages: number;
  /** 특정 페이지로 스크롤 */
  scrollToPage(page: number): void;
  /** 줌 변경 */
  setZoom(zoom: number): void;
  /** 텍스트 검색 */
  findText(query: string): TextMatch[];
  /** 정리 */
  destroy(): void;
}

export async function renderDocument(
  doc: HwpDocument, 
  options: RenderOptions
): Promise<RenderedDocument>;
```

#### 한글 조판 특성 처리

| 특성 | 처리 방법 |
|------|----------|
| **양쪽 정렬 (JUSTIFY)** | 단어 간격 + 글자 간격 동시 조절 (한글은 글자 단위 정렬) |
| **줄바꿈 규칙** | 한글 음절 단위 가능, 영문은 단어 단위, 금칙 처리 |
| **들여쓰기** | 첫째 줄 들여쓰기 vs 둘째 줄 이후 들여쓰기 구분 |
| **글머리표/번호** | HWP 고유 번호 체계 (가, 나, 다 / ㄱ, ㄴ, ㄷ) |
| **표 레이아웃** | 셀 내 단락 독립 렌더, 자동 높이 조절 |
| **페이지 나누기** | 단락 전/후, 표 분할, 과부/고아 줄 방지 |
| **세로쓰기** | 일부 문서에서 사용 (Phase 2 후반) |

### 4.2 `@muin/hwpx-editor` — 편집 기능

> **태스크 ID:** P2-EDIT-01  
> **소요 시간:** 12일  
> **의존성:** P2-RENDER-01  
> **담당:** Agent C + Agent D

#### 기능 범위 (Phase 2 MVP)
- 텍스트 입력/삭제/선택
- 기본 서식 (굵게, 기울임, 밑줄, 글꼴 크기/색상)
- 단락 정렬 변경
- 표 셀 편집 (텍스트만)
- 이미지 삽입/삭제/크기 조절
- 실행 취소/다시 실행 (Undo/Redo)
- 클립보드 (복사/붙여넣기)

#### API 설계

```typescript
// packages/hwpx-editor/src/index.ts

export interface EditorOptions extends RenderOptions {
  mode: 'dom';              // 편집은 DOM 모드만
  editable: boolean;
  onChange?: (ops: EditOperation[]) => void;
  onSelectionChange?: (selection: Selection) => void;
}

export interface HwpxEditor extends RenderedDocument {
  /** 현재 문서 모델 반환 */
  getDocument(): HwpDocument;
  
  /** 편집 명령 */
  insertText(text: string): void;
  deleteSelection(): void;
  formatSelection(format: Partial<CharShape>): void;
  setParagraphAlign(align: ParaShape['align']): void;
  
  insertTable(rows: number, cols: number): void;
  insertImage(data: Uint8Array, format: string): void;
  
  undo(): void;
  redo(): void;
  
  /** 저장 */
  toHwpx(options?: WriteOptions): Promise<Uint8Array>;
}

export function createEditor(
  doc: HwpDocument, 
  options: EditorOptions
): Promise<HwpxEditor>;
```

### 4.3 웹 앱 (`apps/web-viewer`)

> **태스크 ID:** P2-APP-01  
> **소요 시간:** 8일  
> **의존성:** P2-RENDER-01 (뷰어 먼저), P2-EDIT-01 (편집 나중)  
> **담당:** Agent E

- **프레임워크:** React 19 + Vite
- **기능:** 파일 열기 (드래그앤드롭), 페이지 탐색, 줌, 인쇄, 텍스트 검색, 편집 모드 전환
- **배포:** Vercel/Cloudflare Pages (정적 사이트)

---

## 5. Phase 3 상세 — 풀 에디터 (장기, 3개월+)

### 5.1 실시간 협업
- **CRDT 기반:** Yjs 또는 Automerge 통합
- **문서 모델 → CRDT 매핑:** 각 단락/런을 CRDT 노드로
- **서버:** WebSocket 기반 동기화 서버 (Hocuspocus 등)

### 5.2 플러그인 시스템
```typescript
export interface MuinPlugin {
  name: string;
  version: string;
  activate(editor: HwpxEditor): void;
  deactivate(): void;
}

// 예: 맞춤법 검사 플러그인
const spellCheckPlugin: MuinPlugin = {
  name: 'spell-check',
  version: '1.0.0',
  activate(editor) {
    editor.on('change', () => { /* 맞춤법 검사 */ });
  },
  deactivate() {}
};
```

### 5.3 모바일 최적화
- 터치 제스처 (핀치 줌, 스와이프 페이지)
- 가상 키보드 대응
- PWA 오프라인 지원

### 5.4 클라우드 스토리지
- 파일 저장/불러오기 API
- 버전 관리
- 공유 링크 생성

---

## 6. 병렬 작업 분배

### 6.1 에이전트 태스크 매핑

```
Phase 1 (4주):

Week 1-2:
  Agent A: P1-MODEL-01 (문서 모델, 2일) → P1-CORE-01 지원
  Agent B: P1-CORE-01 (OPC 코어, 3일) → 대기 중 fixtures 준비
  Agent C: P1-PARSE-01 준비 (XML 스키마 분석, 테스트 데이터 준비)
  Agent D: P1-WRITE-01 준비 (XML 직렬화 유틸리티, 테스트 데이터 준비)
  Agent E: P1-HWP-01 (OLE2 파서, 독립 작업 가능 — 7일)

  ── P1-MODEL-01 완료 (Day 2) ──
  Agent A → P1-CORE-01 합류 또는 CI/CD 구축
  Agent C → P1-PARSE-01 시작 (P1-CORE-01 인터페이스 확정 후)
  Agent D → P1-WRITE-01 시작 (P1-CORE-01 인터페이스 확정 후)

Week 3-4:
  Agent A: CI/CD, 문서화, 통합 테스트
  Agent B: P1-CORE-01 마무리 → P1-CONV-01 시작
  Agent C: P1-PARSE-01 계속
  Agent D: P1-WRITE-01 계속
  Agent E: P1-HWP-01 계속 → P1-CONV-01 합류

  ── P1-HWP-01 + P1-WRITE-01 완료 ──
  Agent E + Agent D → P1-CONV-01 (4일)
```

### 6.2 의존성 그래프

```
P1-MODEL-01 ─┬──→ P1-CORE-01 ──┬──→ P1-PARSE-01
             │                  └──→ P1-WRITE-01 ──┐
             │                                      ├──→ P1-CONV-01
             └──→ P1-HWP-01 ──────────────────────┘

동시 작업 가능 그룹:
  Group A: [P1-MODEL-01]                     ← 최우선
  Group B: [P1-CORE-01, P1-HWP-01]          ← MODEL 완료 후 동시 착수
  Group C: [P1-PARSE-01, P1-WRITE-01]       ← CORE 완료 후 동시 착수
  Group D: [P1-CONV-01]                      ← HWP + WRITE 완료 후
```

### 6.3 태스크 입력/출력/검증 기준

| 태스크 ID | 입력 | 출력 | 검증 기준 |
|-----------|------|------|----------|
| P1-MODEL-01 | HWPX/HWP 스펙 문서 | TypeScript 타입 패키지 | 타입 체크 통과, 모든 주요 요소 타입 정의 |
| P1-CORE-01 | HWPX ZIP 파일 | `OpcPackage` 객체 | 라운드트립 테스트 통과, 10개 샘플 파일 |
| P1-PARSE-01 | `OpcPackage` | `HwpDocument` | 한컴오피스 생성 파일 10종 텍스트 일치 |
| P1-WRITE-01 | `HwpDocument` | HWPX ZIP `Uint8Array` | 한컴오피스에서 정상 열림 |
| P1-HWP-01 | HWP 5.x `Uint8Array` | `HwpDocument` | pyhwp 추출 결과와 비교 일치율 >95% |
| P1-CONV-01 | HWP 5.x `Uint8Array` | HWPX `Uint8Array` | 변환 후 한컴오피스에서 열림, 텍스트 보존 |

---

## 7. 품질 보증

### 7.1 테스트 전략

```
테스트 피라미드:

        ╱╲
       ╱E2E╲         ← 한컴오피스 호환성 (수동 + 자동화)
      ╱──────╲
     ╱ 통합    ╲      ← 파이프라인 테스트 (파싱→모델→쓰기)
    ╱────────────╲
   ╱   유닛 테스트  ╲   ← 각 모듈 함수 단위 (>80% 커버리지)
  ╱──────────────────╲
```

- **유닛 테스트:** Vitest, 각 함수/클래스별
- **통합 테스트:** 실제 HWP/HWPX 파일 파이프라인 (fixtures/)
- **호환성 테스트:** 한컴오피스 2020/2022에서 생성한 파일 50종 수집
- **퍼즈 테스트:** 임의 변형 파일로 크래시 방지 확인

### 7.2 한컴오피스 호환성 검증

1. **테스트 문서 세트 구축:** 한컴오피스로 다양한 문서 생성 (텍스트, 표, 이미지, 서식, 다단, 머리말/꼬리말)
2. **텍스트 추출 비교:** 파싱 결과 vs 한컴오피스 텍스트 내보내기
3. **시각적 비교:** 렌더링 결과 스크린샷 vs 한컴오피스 스크린샷 (Phase 2, pixelmatch)
4. **라운드트립:** HWPX 읽기 → 쓰기 → 한컴오피스 열기 → 내용 동일 확인

### 7.3 벤치마크

| 파일 크기 | 파싱 목표 | 렌더링 목표 (Phase 2) |
|-----------|----------|----------------------|
| 10KB (1페이지) | < 50ms | < 100ms |
| 100KB (10페이지) | < 200ms | < 500ms |
| 1MB (100페이지) | < 1초 | < 3초 |
| 10MB (이미지 다수) | < 3초 | < 5초 |
| 50MB (대용량) | < 10초 | 가상 스크롤 |

### 7.4 CI/CD 파이프라인

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npx turbo test --filter=...changed
      - run: npx turbo build
      - run: npx turbo test:compat  # 호환성 테스트
  
  benchmark:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npx turbo bench
      - uses: benchmark-action/github-action-benchmark@v1
```

---

## 8. 리스크 & 대응

| # | 리스크 | 확률 | 영향 | 대응 |
|---|--------|------|------|------|
| R1 | **스펙 미공개 영역:** HWP 5.x의 일부 레코드 타입이 문서화되지 않음 | 높음 | 중간 | pyhwp 소스 분석, 리버스 엔지니어링, 미지원 레코드는 skip + 경고 |
| R2 | **한컴 저작권 리스크:** 스펙 활용 범위 불명확 | 낮음 | 높음 | 공개 스펙만 사용, 저작권 고지 명시, MIT 라이선스, 법률 검토 |
| R3 | **HWP 5.x 바이너리 복잡도:** 레코드 타입이 100+, 버전별 차이 | 높음 | 높음 | 점진적 구현 (핵심 레코드 우선), 미지원은 graceful degradation |
| R4 | **브라우저 호환성:** Canvas API, TextMetrics 차이 | 중간 | 중간 | 브라우저별 테스트 (Chrome/Firefox/Safari), 폴리필 |
| R5 | **한글 조판 정확도:** 줄바꿈, 자간, 정렬이 한컴과 다를 수 있음 | 높음 | 중간 | "근사치" 접근, 중요 케이스만 픽셀 퍼펙트 목표 |
| R6 | **성능:** 대용량 파일에서 메모리/시간 초과 | 중간 | 중간 | 스트리밍 파싱, 가상 스크롤, Web Worker 활용 |

---

## 9. 일정 & 마일스톤

### Phase 1 (Week 1-4)

| 주차 | 마일스톤 | 완료 기준 |
|------|---------|----------|
| **W1** | 프로젝트 셋업 + 문서 모델 + OPC 코어 시작 | 모노레포 구축, P1-MODEL-01 완료, P1-CORE-01 50% |
| **W2** | OPC 코어 완료 + 파서/라이터 시작 + HWP 리더 진행 | P1-CORE-01 완료, P1-PARSE-01/P1-WRITE-01 30%, P1-HWP-01 50% |
| **W3** | 파서/라이터 완료 + HWP 리더 완료 | P1-PARSE-01/P1-WRITE-01 완료, P1-HWP-01 완료 |
| **W4** | 변환기 + 통합 테스트 + npm 퍼블리시 | P1-CONV-01 완료, 모든 테스트 통과, npm 0.1.0 배포 |

### Phase 2 (Week 5-10)

| 주차 | 마일스톤 | 완료 기준 |
|------|---------|----------|
| **W5-6** | 레이아웃 엔진 + DOM 렌더러 | 텍스트 문서 렌더링 성공 |
| **W7-8** | 표/이미지 렌더링 + 편집 기본 | 복잡 문서 렌더링, 텍스트 편집 가능 |
| **W9-10** | 웹 앱 + 편집 완성 + 배포 | 웹 뷰어 퍼블릭 런칭 |

### Phase별 Go/No-Go 기준

**Phase 1 → Phase 2 Go 기준:**
- [ ] 한컴오피스 생성 HWPX 파일 20종 파싱 성공률 >95%
- [ ] HWP 5.x 파일 20종 텍스트 추출 성공률 >90%
- [ ] HWPX 라운드트립 (읽기→쓰기→한컴오피스 열기) 성공
- [ ] npm 패키지 배포 완료

**Phase 2 → Phase 3 Go 기준:**
- [ ] 웹 뷰어에서 공공기관 문서 30종 정상 렌더링
- [ ] 기본 편집 (텍스트, 표) 동작
- [ ] 주간 활성 사용자 100+ (웹 앱)

### MVP 정의

**Phase 1 MVP (최소 출시 가능 제품):**
- HWPX 읽기 + 텍스트/표 추출
- HWP 5.x 읽기 + 텍스트 추출
- npm 패키지로 설치 가능

```typescript
// MVP 사용 예시
import { parseHwpx } from '@muin/hwpx-parser';
import { readHwp } from '@muin/hwp-reader';
import { readPackage } from '@muin/hwpx-core';

// HWPX 파일 읽기
const pkg = await readPackage(hwpxBuffer);
const { document } = await parseHwpx(pkg);
console.log(document.sections[0].paragraphs[0].runs[0].text);

// HWP 파일 읽기
const { document: hwpDoc } = await readHwp(hwpBuffer);
console.log(hwpDoc.sections[0].paragraphs[0].runs[0].text);
```

---

## 10. 시장 분석

### 10.1 한국 공공기관 HWP 사용 현황
- 대한민국 **모든 공공기관**이 HWP 사용 (국가기록원, 법원, 지자체 등)
- 2020년 "개방형 문서 포맷(ODF) 도입" 정책에도 HWP 관성 지속
- 2023년부터 HWPX(OWPML) 전환 가속 — KS X 6101 국가표준
- 공공데이터포털(data.go.kr)의 다수 문서가 HWP/HWPX

### 10.2 경쟁 제품

| 제품 | 유형 | HWP 지원 | 가격 | 단점 |
|------|------|---------|------|------|
| **한컴오피스** | 데스크톱 | 완벽 | 유료 (~10만원/년) | 웹 미지원, 무거움 |
| **한컴독스** | 웹 | HWP 뷰어 | 무료/유료 | 편집 제한, 한컴 종속 |
| **폴라리스 오피스** | 모바일/웹 | 부분 지원 | 유료 | HWP 호환성 낮음 |
| **LibreOffice** | 데스크톱 | HWP 읽기 (부분) | 무료 | 레이아웃 깨짐 심각 |
| **pyhwp** | Python 라이브러리 | HWP 읽기 | 무료 (AGPL) | AGPL 라이선스, Python만, HWPX 미지원 |
| **python-hwpx** | Python 라이브러리 | HWPX 읽기/쓰기 | 무료 | Python만, 웹 통합 어려움 |

### 10.3 우리의 차별점
1. **JavaScript/TypeScript:** 브라우저에서 직접 동작 (서버 불필요)
2. **MIT 라이선스:** 상업적 사용 자유
3. **HWP + HWPX 동시 지원:** 레거시 + 신규 모두 커버
4. **모듈화:** 필요한 기능만 tree-shake로 가져가기

### 10.4 수익화 가능성

| 모델 | 대상 | 예상 수익 |
|------|------|----------|
| **오픈코어:** 핵심 무료, 고급 기능 유료 | 기업 | 프리미엄 렌더링, 서버사이드 변환 |
| **SaaS 뷰어:** 임베더블 뷰어 위젯 | SaaS 기업 | 월 구독 (문서 수 기반) |
| **SI 컨설팅:** 공공기관 시스템 통합 | 공공기관 | 프로젝트 단위 |
| **클라우드 API:** REST API 변환 서비스 | 개발자 | API 콜 기반 과금 |

잠재 시장 규모 (추정):
- 한국 공공기관 SI 시장 중 문서 관련: 연 100억원+
- 한국 SaaS 기업 HWP 뷰어 수요: 연 20억원+
- 글로벌 한국어 문서 처리: 틈새 시장

---

## 부록: 태스크 ID 총괄표

| ID | 태스크 | 소요 | 의존성 | 동시 작업 그룹 |
|----|--------|------|--------|--------------|
| **P1-MODEL-01** | 문서 모델 타입 정의 | 2일 | 없음 | Group A |
| **P1-CORE-01** | OPC 패키지 코어 | 3일 | P1-MODEL-01 | Group B |
| **P1-HWP-01** | HWP 5.x 바이너리 리더 | 7일 | P1-MODEL-01 | Group B |
| **P1-PARSE-01** | HWPX XML 파서 | 5일 | P1-MODEL-01, P1-CORE-01 | Group C |
| **P1-WRITE-01** | HWPX 라이터 | 4일 | P1-MODEL-01, P1-CORE-01 | Group C |
| **P1-CONV-01** | HWP→HWPX 변환기 | 4일 | P1-HWP-01, P1-WRITE-01 | Group D |
| **P2-RENDER-01** | DOM/Canvas 렌더러 | 10일 | Phase 1 전체 | Group E |
| **P2-EDIT-01** | 편집 기능 | 12일 | P2-RENDER-01 | Group F |
| **P2-APP-01** | 웹 앱 | 8일 | P2-RENDER-01 | Group F |
| **P3-COLLAB-01** | 실시간 협업 | 15일 | Phase 2 전체 | Group G |
| **P3-PLUGIN-01** | 플러그인 시스템 | 5일 | Phase 2 전체 | Group G |
| **P3-MOBILE-01** | 모바일 최적화 | 8일 | P2-APP-01 | Group G |
| **P3-CLOUD-01** | 클라우드 스토리지 | 10일 | Phase 2 전체 | Group G |

**총 Phase 1 예상 소요: ~25 에이전트·일 (5 에이전트 병렬 시 ~1주)**  
**총 Phase 2 예상 소요: ~30 에이전트·일 (5 에이전트 병렬 시 ~1.5주)**

---

*문서 끝. 무인 문서 엔진 — HWP를 웹으로.*
