# HanDoc

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![Tests](https://img.shields.io/badge/tests-469%20passed-brightgreen.svg)](#)

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
- 🔁 **Format conversion** — DOCX ↔ HWPX, HTML export, PDF export
- 👁️ **Web viewer** — React component for rendering HWPX documents
- ✏️ **Web editor** — ProseMirror-based WYSIWYG editor (in progress)

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

### Convert HWPX to DOCX

```typescript
import { HanDoc } from '@handoc/hwpx-parser';
import { writeDOCX } from '@handoc/docx-writer';
import fs from 'fs';

const doc = await HanDoc.open(new Uint8Array(fs.readFileSync('input.hwpx')));
const docxBuffer = await writeDOCX(doc);
fs.writeFileSync('output.docx', docxBuffer);
```

## Packages

This is a monorepo with 12 packages:

### Core Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@handoc/document-model`](./packages/document-model) | Shared TypeScript types and utilities for the HWP/HWPX document model | 0.1.0 |
| [`@handoc/hwpx-core`](./packages/hwpx-core) | Low-level HWPX (OPC/ZIP) package reader | 0.1.0 |
| [`@handoc/hwpx-parser`](./packages/hwpx-parser) | Parse HWPX files into a structured document model — the main read API | 0.1.0 |
| [`@handoc/hwpx-writer`](./packages/hwpx-writer) | Generate HWPX files from a document model, with `HwpxBuilder` for easy creation | 0.1.0 |
| [`@handoc/hwp-reader`](./packages/hwp-reader) | Read HWP 5.x binary format (OLE2/CFB) and extract text | 0.1.0 |

### Format Conversion

| Package | Description | Version |
|---------|-------------|---------|
| [`@handoc/docx-reader`](./packages/docx-reader) | Parse DOCX files and convert to HWPX via HanDoc document model | 0.1.0 |
| [`@handoc/docx-writer`](./packages/docx-writer) | Convert HWPX documents to DOCX format | 0.1.0 |
| [`@handoc/html-reader`](./packages/html-reader) | Parse HTML and convert to HWPX document model | 0.1.0 |
| [`@handoc/pdf-export`](./packages/pdf-export) | HWPX to PDF export via HTML rendering and Playwright | 0.1.0 |

### UI Components

| Package | Description | Version |
|---------|-------------|---------|
| [`@handoc/viewer`](./packages/viewer) | React component for rendering HWPX documents in the browser | 0.1.0 |
| [`@handoc/editor`](./packages/editor) | ProseMirror-based HWPX document editor | 0.1.0 |

### CLI

| Package | Description | Version |
|---------|-------------|---------|
| [`@handoc/cli`](./packages/handoc-cli) | CLI tool for HanDoc - inspect, extract, and convert HWP/HWPX documents | 0.1.0 |

## Roadmap

### Level 1: HWPX Read/Write + HWP 5.x Read ✅ Complete

- [x] HWPX file parsing (ZIP → parts extraction)
- [x] HWPX header parsing (fonts, styles, paragraph styles)
- [x] HWPX body parsing (text, formatting, tables)
- [x] HWPX file writing (document model → ZIP)
- [x] HwpxBuilder API (programmatic document creation)
- [x] HWP 5.x binary reading (OLE2/CFB format)
- [x] Table parsing (cell merging, borders)
- [x] Image/OLE binary data extraction
- **Stats:** 349/349 HWPX files parsed successfully, 221/221 HWP files

### Level 2: Format Conversion ✅ Complete

- [x] HWPX → DOCX conversion
- [x] DOCX → HWPX conversion
- [x] HWPX → HTML conversion (standalone HTML)
- [x] CLI tool (convert, to-html commands)
- **Stats:** 587 lines (docx-writer), 1,456 lines (docx-reader), 120 tests

### Level 3: PDF Export ✅ Complete

- [x] HWPX → HTML → PDF (Puppeteer/Playwright)
- [x] Table, image, formatting HTML rendering
- [x] Base64 image embedding, CSS styling
- [x] CLI commands: `handoc to-html`, `handoc to-pdf`
- **Stats:** 378 lines (pdf-export), real HWP file tests passed

### Level 4: Web Viewer ✅ Complete

- [x] React component for HWPX rendering
- [x] Responsive layout, mobile support
- [x] Table rendering, image display
- [x] Section-based rendering
- **Stats:** 235 lines, 13 tests

### Level 5: Web Editor 🟡 In Progress

- [x] ProseMirror-based editor setup
- [x] HWPX → ProseMirror schema conversion
- [x] Basic editing (text, bold, italic, headings)
- [ ] Table editing
- [ ] Image insertion
- [ ] Full WYSIWYG features
- **Stats:** 271 lines, 21 tests

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

- **Packages:** 12 (monorepo with Turborepo + pnpm)
- **Source Code:** 7,809 lines (TypeScript)
- **Tests:** 469 passed
- **Real Documents:** 570/570 parsed (349 HWPX + 221 HWP)
- **Build:** 12/12 packages ✅

## Development

```bash
pnpm install
pnpm build      # Build all packages
pnpm test       # Run all tests
pnpm typecheck  # Type check
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © [MUIN Company](https://muin.company)

본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
