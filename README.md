# HanDoc

HWP/HWPX document parser and writer for TypeScript.

## Packages

| Package | Description |
|---------|-------------|
| `@handoc/document-model` | Document model types and structures |
| `@handoc/hwpx-core` | HWPX core utilities (ZIP handling) |
| `@handoc/hwpx-parser` | HWPX → Document model parser |
| `@handoc/hwpx-writer` | Document model → HWPX writer |

## Getting Started

```bash
pnpm install
pnpm build
```

## Usage

```typescript
import { VERSION } from '@handoc/hwpx-parser';
console.log(VERSION);
```

## Development

```bash
pnpm build      # Build all packages
pnpm test       # Run tests
pnpm typecheck  # Type check
```

## License

MIT © MUIN Company
