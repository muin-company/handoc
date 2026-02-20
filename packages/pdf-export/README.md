# @handoc/pdf-export

HWPX to PDF export via HTML rendering and Playwright.

## Installation

```bash
npm install @handoc/pdf-export playwright
```

## Usage

```typescript
import { exportToPDF } from '@handoc/pdf-export';

const pdfBuffer = await exportToPDF(hwpxDoc, {
  format: 'A4',
  margin: { top: 20, bottom: 20, left: 20, right: 20 }
});
```

## License

MIT
