# @handoc/hwpx-parser

Parse HWPX files into a structured document model.

HWPX 파일을 구조화된 문서 모델로 파싱.

## Installation

```bash
npm install @handoc/hwpx-parser
```

## Usage

```typescript
import { HanDoc } from '@handoc/hwpx-parser';
import fs from 'fs';

// Parse an HWPX file
const buffer = fs.readFileSync('document.hwpx');
const doc = new HanDoc(new Uint8Array(buffer));

// Access metadata
console.log(doc.metadata); // { title, creator, ... }

// Access document header (fonts, styles, properties)
console.log(doc.header);

// Access sections (pages)
for (const section of doc.sections) {
  for (const para of section.paragraphs) {
    console.log(para.runs.map(r => r.children));
  }
}

// Extract plain text
import { extractText } from '@handoc/hwpx-parser';
const text = extractText(doc.sections[0]);

// Parse tables
import { parseTable, tableToTextGrid } from '@handoc/hwpx-parser';
// tableToTextGrid returns a 2D string array from a parsed table
```

## API

### `HanDoc`

High-level HWPX document parser.

- **`new HanDoc(data: Uint8Array)`** — Parse an HWPX file
- **`.metadata`** — Document metadata (title, creator, etc.)
- **`.header`** — Document header (fonts, styles, char/para properties)
- **`.sections`** — Parsed document sections

### Functions

- **`parseHeader(xml: string)`** — Parse header XML
- **`parseSection(xml: string)`** — Parse a section XML
- **`extractText(section)`** — Extract plain text from a section
- **`parseParagraph(node)`** / **`parseRun(node)`** — Low-level paragraph parsing
- **`parseTable(element)`** — Parse a table element
- **`tableToTextGrid(table)`** — Convert parsed table to 2D text array
- **`parseXml(xml)`** / **`getAttr()`** / **`getChildren()`** — XML utilities

## License

MIT © [MUIN Company](https://muin.company)

본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
