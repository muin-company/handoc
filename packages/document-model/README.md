# @handoc/document-model

TypeScript types and utilities for HWP/HWPX document model.

HWP/HWPX 문서 모델 타입 및 유틸리티.

## Installation

```bash
npm install @handoc/document-model
```

## Usage

```typescript
import type { Section, Paragraph, Run, PageSize, PageMargin } from '@handoc/document-model';
import type { DocumentHeader, FontFace, CharProperty } from '@handoc/document-model';
import { GenericElement } from '@handoc/document-model';
import { NS, INLINE_OBJECT_NAMES } from '@handoc/document-model';
```

## API

### Types

- **`Section`** — Document section with paragraphs, tables, and page properties
- **`Paragraph`** / **`Run`** / **`RunChild`** — Paragraph structure
- **`DocumentHeader`** — Font faces, char/para properties, styles, bullet definitions
- **`PageSize`** / **`PageMargin`** — Page layout
- **`GenericElement`** — Round-trip safe container for unknown XML elements
- **`CellAddress`** / **`CellSpan`** / **`CellSize`** — Table cell types

### Constants

- **`NS`** — HWPML XML namespace URIs
- **`INLINE_OBJECT_NAMES`** — Known inline drawing object names
- **`TRACK_CHANGE_MARKS`** — Track-change marker names

### Utilities

- **`resolveCharPropId()`** — Resolve character property by ID from header
- **`resolveParaPropId()`** — Resolve paragraph property by ID from header
- **`resolveStyleId()`** — Resolve style by ID from header

## License

MIT © [MUIN Company](https://muin.company)

본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
