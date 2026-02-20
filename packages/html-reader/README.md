# @handoc/html-reader

HTML to document-model parser for HanDoc project.

## Features

- Parse HTML to HanDoc document-model
- Support for common elements:
  - Headings (`<h1>-<h6>`)
  - Paragraphs (`<p>`)
  - Text formatting (`<b>`, `<i>`, `<u>`, `<s>`)
  - Lists (`<ul>`, `<ol>`, `<li>`)
  - Tables (`<table>`, `<tr>`, `<td>`, `<th>`)
  - Images (`<img>`)
- Preserve unsupported elements as GenericElement

## Usage

```typescript
import { parseHTML } from '@handoc/html-reader';

const html = '<p>Hello <b>world</b>!</p>';
const sections = parseHTML(html);
```

## API

### `parseHTML(html: string): Section[]`

Parses HTML string and returns an array of Section objects from document-model.

## License

MIT
