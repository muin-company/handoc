# HanDoc

TypeScript library for reading and writing Korean HWP/HWPX documents.

한글(HWP/HWPX) 문서를 읽고 쓰는 TypeScript 라이브러리.

## Features

- 📖 **Read HWPX** files — tested on 349 real-world documents
- ✍️ **Write HWPX** files — programmatic document creation with builder API
- 📄 **Read HWP 5.x** binary files (OLE2/CFB format)
- 🔄 **Round-trip preservation** — parse → write → identical output
- 📊 **Rich content extraction** — tables, images, equations, shapes, headers/footers, footnotes
- 📐 **Page layout** — size, margins, columns, section properties
- 🔤 **Full text extraction** with per-section support

## Quick Start

```bash
npm install @handoc/hwpx-parser @handoc/hwpx-writer
```

### Read an HWPX file

```typescript
import { HanDoc } from '@handoc/hwpx-parser';
import fs from 'fs';

const doc = await HanDoc.open(new Uint8Array(fs.readFileSync('document.hwpx')));

// Extract all text
console.log(doc.extractText());

// Access structured data
for (const section of doc.sections) {
  console.log(section);
}

// Images, tables, metadata
console.log(doc.metadata);   // { title, creator, language }
console.log(doc.images);     // [{ path, data, contentType }, ...]
```

### Read an HWP 5.x file

```typescript
import { readHwp, extractTextFromHwp } from '@handoc/hwp-reader';
import fs from 'fs';

const buf = new Uint8Array(fs.readFileSync('document.hwp'));
const text = extractTextFromHwp(buf);
console.log(text);
```

### Create an HWPX from scratch

```typescript
import { HwpxBuilder } from '@handoc/hwpx-writer';
import fs from 'fs';

const bytes = HwpxBuilder.create()
  .addParagraph('Hello World', { bold: true, fontSize: 20 })
  .addTable([['Name', 'Score'], ['Alice', '95']])
  .addParagraph('Second paragraph')
  .build();

fs.writeFileSync('output.hwpx', bytes);
```

### Round-trip (read → modify → write)

```typescript
import { HanDoc } from '@handoc/hwpx-parser';
import { writeHwpx } from '@handoc/hwpx-writer';
import fs from 'fs';

const doc = await HanDoc.open(new Uint8Array(fs.readFileSync('input.hwpx')));

// Access doc.header, doc.sections for modifications...

const output = writeHwpx(
  { header: doc.header, sections: doc.sections },
  doc.opcPackage,  // pass original for round-trip fidelity
);
fs.writeFileSync('output.hwpx', output);
```

## Packages

| Package | Description |
|---------|-------------|
| [`@handoc/document-model`](./packages/document-model) | Shared TypeScript types and utilities for the HWP/HWPX document model |
| [`@handoc/hwpx-core`](./packages/hwpx-core) | Low-level HWPX (OPC/ZIP) package reader |
| [`@handoc/hwpx-parser`](./packages/hwpx-parser) | Parse HWPX files into a structured document model — the main read API |
| [`@handoc/hwpx-writer`](./packages/hwpx-writer) | Generate HWPX files from a document model, with `HwpxBuilder` for easy creation |
| [`@handoc/hwp-reader`](./packages/hwp-reader) | Read HWP 5.x binary format (OLE2/CFB) and extract text |

## API Overview

### `@handoc/hwpx-parser` — HanDoc

| API | Description |
|-----|-------------|
| `HanDoc.open(buf)` | Parse an HWPX buffer, returns `Promise<HanDoc>` |
| `doc.extractText()` | Get all text as a single string |
| `doc.extractTextBySection()` | Get text per section as `string[]` |
| `doc.sections` | Parsed section tree (paragraphs, tables, shapes, etc.) |
| `doc.header` | Document header (fonts, styles, char/para properties) |
| `doc.metadata` | `{ title, creator, language }` |
| `doc.images` | Embedded images with binary data |
| `doc.sectionProps` | Page size, margins, columns |
| `doc.headers` / `doc.footers` | Page headers and footers |
| `doc.footnotes` | Footnotes |
| `doc.warnings` | Parse warnings (non-fatal issues) |

### `@handoc/hwpx-writer`

| API | Description |
|-----|-------------|
| `writeHwpx(doc, original?)` | Serialize a document model to HWPX bytes |
| `HwpxBuilder.create()` | Fluent builder for creating documents from scratch |
| `.addParagraph(text, style?)` | Add text with optional `{ bold, italic, fontSize, align }` |
| `.addTable(rows)` | Add a table from a 2D string array |
| `.addImage(data, ext, w?, h?)` | Add an image |
| `.addSectionBreak()` | Start a new section |
| `.build()` | Returns `Uint8Array` of the HWPX file |

### `@handoc/hwp-reader`

| API | Description |
|-----|-------------|
| `readHwp(buf)` | Parse HWP 5.x binary, returns `HwpDocument` |
| `extractTextFromHwp(buf)` | Extract plain text from HWP binary |
| `openCfb(buf)` | Low-level OLE2/CFB reader |
| `parseRecords(stream)` | Parse HWP binary records |

## Stats

- **Tests:** 117 passed (61 parser + 26 writer + 30 HWP reader)
- **Packages:** 5 (monorepo with Turborepo + pnpm)

## Development

```bash
pnpm install
pnpm build      # Build all packages
pnpm test       # Run all tests
pnpm typecheck  # Type check
```

## License

MIT © [MUIN Company](https://muin.company)

본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
