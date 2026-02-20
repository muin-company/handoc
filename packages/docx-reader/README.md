# @handoc/docx-reader

Parse DOCX files and convert to HWPX via HanDoc document model.

## Installation

```bash
npm install @handoc/docx-reader
```

## Usage

```typescript
import { readDOCX } from '@handoc/docx-reader';

const hwpxDoc = await readDOCX(docxBuffer);
```

## License

MIT
