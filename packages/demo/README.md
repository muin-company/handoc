# @handoc/demo

Interactive demo application showcasing HanDoc Viewer and Editor components.

## Features

### 📖 Viewer Demo
- **File Upload**: Drag-and-drop or click to upload HWPX, HWP, or DOCX files
- **View Modes**: Toggle between page and continuous scroll modes
- **Zoom Controls**: Zoom in/out from 50% to 200%
- **Auto-conversion**: Automatically converts HWP and DOCX to HWPX for viewing

### ✏️ Editor Demo
- **ProseMirror-based Editor**: Full-featured WYSIWYG editing
- **File Support**: Open and edit HWPX, HWP, and DOCX files
- **Toolbar**: Text formatting (bold, italic, underline), undo/redo
- **Export**: Download edited documents as HWPX
- **Keyboard Shortcuts**:
  - `Ctrl+B` - Bold
  - `Ctrl+I` - Italic
  - `Ctrl+U` - Underline
  - `Ctrl+Z` - Undo
  - `Ctrl+Y` / `Ctrl+Shift+Z` - Redo

## Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run development server
cd packages/demo
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

The demo will be available at http://localhost:5173/

## Tech Stack

- **Vite** - Fast development and build tooling
- **React** - UI framework
- **@handoc/viewer** - Document viewer component
- **@handoc/editor** - ProseMirror-based editor
- **@handoc/hwp-reader** - HWP to HWPX conversion
- **@handoc/docx-reader** - DOCX to HWPX conversion
- **pako** - Browser-compatible zlib polyfill

## Browser Compatibility

This demo runs entirely in the browser with no server dependencies. It uses:
- Native browser File API for file uploads
- pako for zlib decompression (HWP files)
- Modern JavaScript features (ES2020+)

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Architecture

```
┌─────────────────┐
│  File Upload    │
└────────┬────────┘
         │
         ├─ .hwpx ──────────────────┐
         ├─ .hwp  ─→ convertHwpToHwpx  ─→ Uint8Array
         └─ .docx ─→ docxToHwpx      ─→ Uint8Array
                                         │
         ┌───────────────────────────────┘
         │
         ├──→ HanDocViewer (read-only)
         └──→ HanDocEditor (editable)
                     │
                     └─→ Download HWPX
```

## Limitations

- **Browser-only HWP support**: Uses pako (JavaScript) instead of native zlib, may be slower for large files
- **Memory constraints**: Large documents (>50MB) may cause performance issues
- **No server-side processing**: All conversion and rendering happens client-side

## License

MIT
