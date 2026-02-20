# HanDoc

> TypeScript library for reading and writing HWPX (한글) documents.
>
> HWPX(한글) 문서를 읽고 쓰는 TypeScript 라이브러리.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@handoc/document-model`](./packages/document-model) | Document model types & utilities | [![npm](https://img.shields.io/npm/v/@handoc/document-model)](https://www.npmjs.com/package/@handoc/document-model) |
| [`@handoc/hwpx-core`](./packages/hwpx-core) | Low-level HWPX (OPC/ZIP) reader | [![npm](https://img.shields.io/npm/v/@handoc/hwpx-core)](https://www.npmjs.com/package/@handoc/hwpx-core) |
| [`@handoc/hwpx-parser`](./packages/hwpx-parser) | HWPX → document model parser | [![npm](https://img.shields.io/npm/v/@handoc/hwpx-parser)](https://www.npmjs.com/package/@handoc/hwpx-parser) |
| [`@handoc/hwpx-writer`](./packages/hwpx-writer) | Document model → HWPX writer | [![npm](https://img.shields.io/npm/v/@handoc/hwpx-writer)](https://www.npmjs.com/package/@handoc/hwpx-writer) |

## Quick Start

```bash
npm install @handoc/hwpx-parser
```

```typescript
import { HanDoc, extractText } from '@handoc/hwpx-parser';
import fs from 'fs';

const doc = new HanDoc(new Uint8Array(fs.readFileSync('document.hwpx')));

// Extract text from all sections
for (const section of doc.sections) {
  console.log(extractText(section));
}
```

### Round-trip (read → modify → write)

```typescript
import { HanDoc } from '@handoc/hwpx-parser';
import { buildHwpx } from '@handoc/hwpx-writer';
import fs from 'fs';

const doc = new HanDoc(new Uint8Array(fs.readFileSync('input.hwpx')));

// Modify doc.header / doc.sections as needed...

const output = buildHwpx({ header: doc.header, sections: doc.sections });
fs.writeFileSync('output.hwpx', output);
```

## Development

```bash
pnpm install
pnpm build      # Build all packages
pnpm test       # Run tests
pnpm typecheck  # Type check
```

## License

MIT © [MUIN Company](https://muin.company)

본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
