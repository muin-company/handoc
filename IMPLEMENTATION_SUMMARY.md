# HanDoc Editor: Undo/Redo + Keyboard Shortcuts + Toolbar Implementation

**Date:** 2026-02-21  
**Completed by:** MJ (AI subagent)

## Summary

Successfully implemented undo/redo functionality, keyboard shortcuts, and a full-featured toolbar for the HanDoc ProseMirror-based editor.

---

## ✅ Completed Features

### 1. **Undo/Redo Functionality**
- Integrated `prosemirror-history` plugin
- Commands: `Mod-z` (undo), `Mod-y` / `Mod-Shift-z` (redo)
- History preserved across all editing operations (text, formatting, tables, images)
- Tests: 7 tests passing in `keyboardShortcuts.test.ts`

### 2. **Keyboard Shortcuts**
- **Mod-b**: Toggle bold
- **Mod-i**: Toggle italic  
- **Mod-u**: Toggle underline
- **Mod-z**: Undo
- **Mod-y / Mod-Shift-z**: Redo

All shortcuts integrated via `prosemirror-keymap`

### 3. **Toolbar Component**
**Location:** `packages/editor/src/Toolbar.tsx`

**Features:**
- **Text formatting**: Bold, Italic, Underline buttons
- **Headings**: Paragraph, H1, H2, H3 buttons
- **Alignment**: Left, Center, Right, Justify buttons
- **Export**: "HWPX로 저장" button with auto-download
- **Active state**: Visual feedback for active marks
- **Customizable**: Accepts `onExport` callback prop

**Props:**
```typescript
interface ToolbarProps {
  view: EditorView | null;
  onExport?: (hwpx: Uint8Array) => void;
}
```

### 4. **Mark Commands**
**Location:** `packages/editor/src/markCommands.ts`

**Exported Commands:**
- `toggleBold`, `toggleItalic`, `toggleUnderline`, `toggleStrikeout`
- `isMarkActive(state, markType)` - Check if mark is active
- `setAlignment(align)` - Set paragraph alignment
- `setHeading(level)` - Convert to heading
- `setParagraph()` - Convert heading to paragraph

### 5. **Updated HanDocEditor Component**
**Props Added:**
- `showToolbar?: boolean` (default: true)
- `onExport?: (hwpx: Uint8Array) => void`

**Usage:**
```tsx
<HanDocEditor 
  buffer={hwpxBuffer}
  onChange={handleChange}
  showToolbar={true}
  onExport={(hwpx) => { /* custom export logic */ }}
/>
```

---

## 📦 Files Created/Modified

### Created:
1. `packages/editor/src/markCommands.ts` - Mark toggle commands
2. `packages/editor/src/Toolbar.tsx` - React toolbar component
3. `packages/editor/src/__tests__/markCommands.test.ts` - Mark commands tests (10 tests)
4. `packages/editor/src/__tests__/keyboardShortcuts.test.ts` - Keyboard shortcut tests (7 tests)
5. `packages/editor/src/__tests__/Toolbar.test.tsx` - Toolbar UI tests (8 tests)
6. `packages/editor/vitest.config.ts` - Vitest configuration
7. `packages/editor/vitest.setup.ts` - Test setup

### Modified:
1. `packages/editor/src/HanDocEditor.tsx` - Added toolbar, keyboard shortcuts
2. `packages/editor/src/index.ts` - Exported new components and commands
3. `packages/editor/package.json` - Added test dependencies

---

## 🧪 Test Results

### ✅ Passing (All New Tests):
- **markCommands.test.ts**: 10/10 tests passing
  - toggleBold, toggleItalic, toggleUnderline
  - setAlignment (left, center, right, justify)
  - setHeading (H1, H2, H3)
  - setParagraph
  - isMarkActive

- **keyboardShortcuts.test.ts**: 7/7 tests passing
  - Keyboard mapping verification
  - Bold/Italic/Underline toggles via shortcuts
  - Undo/Redo functionality

- **Toolbar.test.tsx**: 8/8 tests passing
  - Render all buttons
  - Button click interactions
  - Export functionality
  - Null view handling

### ⚠️ Pre-existing Test Failures (Not Related to This Work):
- `converter.test.ts`: 14 failures (HWPX roundtrip issues)
- `image.test.ts`: 7 failures (Image roundtrip issues)

**Note:** These failures existed before this implementation and are unrelated to undo/redo, keyboard shortcuts, or toolbar features.

---

## 🏗️ Build Status

✅ **All builds passing:**
```bash
pnpm turbo build
# Tasks: 13 successful, 13 total
# @handoc/editor builds successfully
```

---

## 📋 Dependencies Added

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1"
  }
}
```

**Note:** `prosemirror-history` and `prosemirror-keymap` were already present.

---

## 🎯 Success Criteria - Met

- [x] `pnpm turbo build` passes for entire project
- [x] Undo/Redo working with prosemirror-history
- [x] Keyboard shortcuts (Ctrl+B, I, U, Z, Y) implemented and tested
- [x] Toolbar component with formatting buttons created
- [x] HWPX export button integrated in toolbar
- [x] All new tests passing (25 tests total)
- [x] Exports properly typed and documented

---

## 🚀 Usage Example

```tsx
import { HanDocEditor } from '@handoc/editor';

function MyEditor() {
  const [buffer, setBuffer] = useState<Uint8Array | undefined>();

  return (
    <HanDocEditor
      buffer={buffer}
      onChange={(newHwpx) => setBuffer(newHwpx)}
      showToolbar={true}
      onExport={(hwpx) => {
        // Custom export logic
        const blob = new Blob([hwpx], { 
          type: 'application/vnd.hancom.hwpx' 
        });
        // ... download or upload
      }}
    />
  );
}
```

---

## 🔧 Next Steps (Optional Enhancements)

1. Fix pre-existing converter roundtrip issues
2. Add more toolbar buttons (font size, color, etc.)
3. Add keyboard shortcut hints/tooltips
4. Implement toolbar customization API
5. Add strikethrough keyboard shortcut (Mod-Shift-X?)
6. Add table insert/edit toolbar buttons

---

## 📝 Notes

- All surgical changes - no existing functionality broken
- Toolbar styling is inline CSS (can be externalized to CSS modules if needed)
- Mark toggle logic uses ProseMirror's built-in `toggleMark` command
- Export button defaults to auto-download if no `onExport` callback provided
- Tests configured with jsdom environment for React component testing

---

**Implementation completed successfully. All acceptance criteria met.**
