# TASK-025: Editor Image Insert/Edit - COMPLETED ✅

## Summary
Successfully implemented image upload, editing, and roundtrip functionality for the HanDoc ProseMirror editor.

## Implementation Details

### 1. Image Commands (`packages/editor/src/commands.ts`)
Created comprehensive image manipulation commands:

- **`insertImage(options)`** - Insert image at cursor position
- **`updateImage(pos, attrs)`** - Update image attributes (size, alt text)
- **`fileToDataURL(file)`** - Convert File/Blob to base64 data URL
- **`insertImageFromFile(file)`** - Handle file upload and insertion
- **`setImageAlignment(pos, align)`** - Placeholder for future alignment support

### 2. HWPX ↔ ProseMirror Converter Updates (`packages/editor/src/converter.ts`)

#### Image Parsing (HWPX → ProseMirror)
- Enhanced `imageElementToNode()` to extract `hp:pic` elements
- Extracts width/height from `hp:sz` element
- Retrieves binary path from `hp:img` binaryItemIDRef attribute
- Loads actual image data from HanDoc BinData
- Converts Uint8Array to base64 data URL
- Supports PNG, JPEG, GIF, BMP formats with proper MIME types
- Fallback logic for path variations

#### Image Serialization (ProseMirror → HWPX)
- Updated `editorStateToHwpx()` to handle image nodes
- Parses data URLs to extract format and base64 data
- Converts base64 back to Uint8Array
- Uses HwpxBuilder.addImage() with proper dimensions (in HWPU units)
- Default size: 7200 HWPU (~1 inch) if not specified

### 3. Helper Functions
- **`uint8ArrayToBase64(bytes)`** - Converts binary to base64 string
- **`base64ToUint8Array(base64)`** - Converts base64 string to binary

### 4. Schema Updates
- Added `lib: ["ES2022", "DOM"]` to `tsconfig.json` for FileReader support
- Image node already existed in schema with proper attrs (src, alt, width, height)

### 5. Table Commands Integration
- Created `tableKeymap.ts` for table keyboard shortcuts
- Re-exported all prosemirror-tables commands from `commands.ts`
- Maintained backward compatibility with existing table functionality

## Test Coverage

Created `packages/editor/src/__tests__/image.test.ts` with 10 tests:

### Image Commands (2 tests)
✅ Insert image at cursor position
✅ Update image attributes

### Image Roundtrip (8 tests)
✅ Roundtrip image through HWPX (base64 encoding/decoding)
✅ Preserve image dimensions in roundtrip
✅ Handle multiple images
✅ Handle image with text before and after
✅ Handle JPEG images
✅ Encode and decode base64 correctly
✅ Handle images in multiple sections
⏭️ Convert File to data URL (skipped - requires browser FileReader API)

## Build & Test Results

```bash
pnpm turbo test --filter=@handoc/editor
```

**Results:**
- ✅ **4 test files passed**
- ✅ **40 tests passed**
- ⏭️ **1 test skipped** (FileReader browser-only)
- ⏱️ **95ms duration**

### Existing Tests Still Pass
- ✅ Schema tests (4 tests)
- ✅ Table commands tests (13 tests)
- ✅ Converter tests (14 tests)
- ✅ Image tests (9 tests passed, 1 skipped)

## Verification Checklist

- [x] `pnpm turbo build` succeeds
- [x] `pnpm turbo test --filter=@handoc/editor` passes
- [x] Image insertion functionality implemented
- [x] Image size adjustment (width/height) working
- [x] Image alignment commands created (placeholder for UI integration)
- [x] HWPX save with base64 embedding working
- [x] Roundtrip test passes: insert → save → reload → display
- [x] Base64 encoding accuracy verified
- [x] No existing tests broken (14 converter tests still pass)

## Usage Example

```typescript
import { insertImage, updateImage, insertImageFromFile } from '@handoc/editor';

// Insert from data URL
const command = insertImage({
  src: 'data:image/png;base64,iVBORw0KG...',
  alt: 'My image',
  width: 7200,
  height: 7200
});
command(editorState, dispatch);

// Insert from File (browser only)
const file = event.target.files[0];
const insertCmd = await insertImageFromFile(file);
insertCmd(editorState, dispatch);

// Update image size
updateImage(pos, { width: 14400, height: 7200 })(editorState, dispatch);
```

## Architecture

```
User File Upload
     ↓
fileToDataURL() → data:image/png;base64,...
     ↓
insertImage() → ProseMirror EditorState
     ↓
editorStateToHwpx() → base64 → Uint8Array
     ↓
HwpxBuilder.addImage() → HWPX file with BinData
     ↓
hwpxToEditorState() → HanDoc.getImage()
     ↓
Uint8Array → base64 → data URL → ProseMirror
```

## Files Modified

1. `packages/editor/src/commands.ts` - NEW (image & table commands)
2. `packages/editor/src/tableKeymap.ts` - NEW (table keyboard shortcuts)
3. `packages/editor/src/converter.ts` - Enhanced image conversion
4. `packages/editor/src/index.ts` - Export new commands
5. `packages/editor/src/__tests__/image.test.ts` - NEW (10 tests)
6. `packages/editor/tsconfig.json` - Added DOM lib

## Notes

1. **FileReader limitation**: The `fileToDataURL()` function requires a browser environment. In Node.js tests, it returns an error, which is expected.

2. **Image alignment**: The `setImageAlignment()` command is a placeholder. Full alignment support would require additional schema changes to support inline images or paragraph-wrapped images.

3. **HWPU units**: Image dimensions in HWPX use HWPU (Hancom Word Processing Units). 7200 HWPU ≈ 1 inch (72 DPI).

4. **Binary path matching**: The converter includes fallback logic to match image paths with/without "Contents/" prefix for robustness.

5. **MIME type detection**: Automatically detects PNG, JPEG, GIF, BMP from file extension.

## Completion Date
2026-02-21 01:46 KST

---

**Status: COMPLETE ✅**
**Test Coverage: 40/40 passing (1 skipped as expected)**
**Build Status: ✅ PASSING**
