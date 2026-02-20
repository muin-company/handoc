# @handoc/hwpx-writer

Generate HWPX files from a structured document model.

구조화된 문서 모델로 HWPX 파일 생성.

## Installation

```bash
npm install @handoc/hwpx-writer
```

## Usage

```typescript
import { buildHwpx } from '@handoc/hwpx-writer';
import { HanDoc } from '@handoc/hwpx-parser';
import fs from 'fs';

// Parse → modify → write round-trip
const original = new HanDoc(new Uint8Array(fs.readFileSync('input.hwpx')));

const hwpxBytes = buildHwpx({
  header: original.header,
  sections: original.sections,
});

fs.writeFileSync('output.hwpx', hwpxBytes);
```

## API

### `buildHwpx(doc: HwpxDocument): Uint8Array`

Build a complete HWPX file (ZIP archive) from a document model.

```typescript
interface HwpxDocument {
  header: DocumentHeader;
  sections: Section[];
  extraParts?: Map<string, string | Uint8Array>;
}
```

### Lower-level functions

- **`writeHeader(header)`** — Serialize document header to XML
- **`writeSection(section)`** — Serialize a section to XML
- **`writeGenericElement(el)`** — Serialize a generic element to XML
- **`escapeXml(text)`** — Escape XML special characters

## License

MIT © [MUIN Company](https://muin.company)

본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
