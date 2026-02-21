# HanDoc Editor Test Fix - 2026-02-21

## Problem
21 tests in `@handoc/editor` were failing with error: `No content.hpf manifest found`

### Affected Tests
- **converter.test.ts**: 14 tests - all roundtrip tests for HWPX ↔ EditorState conversion
- **image.test.ts**: 7 tests - all image roundtrip tests

## Root Cause
**JavaScript Realm Issue with Uint8Array**

When `writeHwpx()` created ZIP files using `fflate.zipSync()`, the Uint8Arrays created by `TextEncoder.encode()` were from a different JavaScript realm/global context than the Uint8Array constructor that `fflate` expected.

This caused:
- `value.constructor.name === 'Uint8Array'` → TRUE
- `value instanceof Uint8Array` → FALSE ❌

When `fflate` received these "foreign" Uint8Arrays, it treated them as array-like objects and iterated over each byte index, creating a corrupted ZIP structure like:
- `mimetype/` (directory)
- `mimetype/0/` (subdirectory for byte 0)
- `mimetype/1/` (subdirectory for byte 1)
- etc.

Instead of:
- `mimetype` (file)
- `Contents/content.hpf` (file)
- etc.

## Solution
Added realm normalization in `/packages/hwpx-writer/src/index.ts`:

```typescript
// Fix realm issue: ensure all Uint8Arrays are from the current realm
const normalizedParts: Record<string, Uint8Array> = {};
for (const [key, value] of Object.entries(parts)) {
  normalizedParts[key] = new Uint8Array(value);
}

return zipSync(normalizedParts);
```

This creates new Uint8Arrays in the current realm, ensuring `instanceof` checks pass.

## Results
✅ All 73 tests in @handoc/editor now pass
✅ All 13 packages build successfully
✅ No regressions in other packages

## Files Modified
1. `/packages/hwpx-writer/src/index.ts` - Added Uint8Array normalization in `writeHwpx()`

## Technical Notes
- This is a known issue when mixing code from different JavaScript contexts (e.g., different V8 isolates, iframes, workers)
- The issue manifested in the test environment due to how modules were loaded
- Solution is minimal and surgical - only normalizes the arrays right before zipping
