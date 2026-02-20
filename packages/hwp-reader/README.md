# @handoc/hwp-reader

HWP 5.x binary format reader (OLE2/CFB).

HWP 5.x 바이너리 포맷(OLE2/CFB) 리더.

## Usage

```typescript
import { readHwp, extractTextFromHwp } from '@handoc/hwp-reader';
import fs from 'fs';

const buf = new Uint8Array(fs.readFileSync('document.hwp'));

// Quick text extraction
const text = extractTextFromHwp(buf);

// Structured access
const doc = readHwp(buf);
console.log(doc.fileHeader); // version, flags
console.log(doc.bodyText);   // raw section streams
```
