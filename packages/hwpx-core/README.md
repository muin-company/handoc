# @handoc/hwpx-core

Low-level HWPX (OPC/ZIP) package reader.

HWPX(OPC/ZIP) 패키지 리더.

## Installation

```bash
npm install @handoc/hwpx-core
```

## Usage

```typescript
import { OpcPackage, parseManifest } from '@handoc/hwpx-core';

// Read an HWPX file (ZIP-based OPC package)
const buffer = fs.readFileSync('document.hwpx');
const pkg = new OpcPackage(new Uint8Array(buffer));

// Get file content from the package
const headerXml = pkg.getText('Contents/header.xml');

// Parse the OPF manifest
const manifest = parseManifest(pkg.getText('Contents/content.hpf'));
console.log(manifest.items); // [{ id, href, mediaType }]
```

## API

### `OpcPackage`

Read entries from an OPC (ZIP) package.

- **`new OpcPackage(data: Uint8Array)`** — Open a ZIP archive
- **`.getText(path: string): string`** — Read a text file from the archive
- **`.getBinary(path: string): Uint8Array`** — Read binary data
- **`.entries(): string[]`** — List all entries

### `parseManifest(xml: string): OPFManifest`

Parse an OPF manifest XML into structured items.

## License

MIT © [MUIN Company](https://muin.company)

본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
