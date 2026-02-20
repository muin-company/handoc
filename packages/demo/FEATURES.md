# Demo App Features Overview

## 🎯 Two Main Modes

### 📖 Viewer Mode (Tab 1)
```
┌─────────────────────────────────────────────┐
│  📄 File Drop Zone                          │
│  "Drag HWPX/HWP/DOCX files here"            │
└─────────────────────────────────────────────┘
              ↓ (file uploaded)
┌─────────────────────────────────────────────┐
│  Controls:                                  │
│  [Page] [Continuous] | [-] 100% [+] [Reset]│
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│                                             │
│         📄 Document Preview                 │
│                                             │
│  - Rendered HWPX content                    │
│  - Styled paragraphs and tables             │
│  - Images (if present)                      │
│  - Page breaks (in page mode)               │
│                                             │
└─────────────────────────────────────────────┘
```

**Controls:**
- **View Mode**: Switch between paginated and continuous scroll
- **Zoom**: Adjust from 50% to 200%
- **File Info**: Shows current filename

**Supported Formats:**
- `.hwpx` - Native format (direct rendering)
- `.hwp` - Auto-converted via @handoc/hwp-reader
- `.docx` - Auto-converted via @handoc/docx-reader

---

### ✏️ Editor Mode (Tab 2)
```
┌─────────────────────────────────────────────┐
│  📄 File Drop Zone (or "New Document")      │
└─────────────────────────────────────────────┘
              ↓ (file loaded or new doc)
┌─────────────────────────────────────────────┐
│  [New] [Open] [Download HWPX]               │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Toolbar:                                   │
│  [B] [I] [U] | [↶] [↷] | [Table] [🖼️]      │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  ┃ Editable Content                         │
│  ┃ Click to type...                         │
│  ┃                                           │
│  ┃ - Full text editing                      │
│  ┃ - Format text (bold/italic/underline)    │
│  ┃ - Undo/redo history                      │
│  ┃ - ProseMirror-powered                    │
│  ┃                                           │
└─────────────────────────────────────────────┘
```

**Toolbar Functions:**
- **B** - Bold (Ctrl+B)
- **I** - Italic (Ctrl+I)
- **U** - Underline (Ctrl+U)
- **↶** - Undo (Ctrl+Z)
- **↷** - Redo (Ctrl+Y)
- **Table** - Insert table (future)
- **🖼️** - Insert image (future)

**Actions:**
- **New Document** - Create empty HWPX
- **Open File** - Load HWPX/HWP/DOCX
- **Download** - Export as HWPX

---

## 🎨 Visual Design

### Color Scheme
- **Primary**: Blue (#1e40af) - Header, active tabs, primary buttons
- **Background**: White/Light gray (#f8fafc, #f9fafb)
- **Borders**: Light gray (#e5e7eb, #cbd5e1)
- **Text**: Dark gray (#213547)
- **Hover**: Lighter blue (#eff6ff)

### Layout
- **Header**: Fixed blue bar with title and description
- **Tabs**: Horizontal tab navigation (Viewer | Editor)
- **Content Area**: Scrollable main content
- **Controls**: Compact button groups with icons

### Responsive Features
- Flexible layout adapts to window size
- Controls wrap on narrow screens
- Mobile-friendly touch targets

---

## 🔄 File Processing Flow

```
User Action: Upload File
       ↓
FileUpload Component
  - Accepts: .hwpx, .hwp, .docx
  - Methods: Drag-drop OR click
       ↓
Read as ArrayBuffer
       ↓
Convert to Uint8Array
       ↓
┌──────────────────┐
│  File Extension  │
└────────┬─────────┘
         │
    ┌────┼────┬─────────┐
    │    │    │         │
  .hwpx .hwp .docx    other
    │    │    │         │
    │    │    │         ✗ Error
    │    ↓    ↓
    │  convertHwpToHwpx
    │  docxToHwpx
    │    │    │
    │    ↓    ↓
    └──> Uint8Array (HWPX)
              ↓
    Pass to Viewer/Editor
              ↓
       Parse & Render
```

---

## 💾 Data Flow

### Viewer (Read-only)
```
File → Uint8Array → HanDoc.open() → HTML → Display
```

### Editor (Interactive)
```
File → Uint8Array → hwpxToEditorState() → ProseMirror State
  ↓
User edits
  ↓
onChange callback → editorStateToHwpx() → Uint8Array → Download
```

---

## 🧪 Testing Checklist

- [x] Upload HWPX file
- [x] Upload HWP file (auto-converts)
- [x] Upload DOCX file (auto-converts)
- [x] Drag-and-drop file
- [x] Click to select file
- [x] Switch view modes (page/continuous)
- [x] Zoom in/out
- [x] Reset zoom
- [x] Type in editor
- [x] Bold/italic/underline formatting
- [x] Undo/redo
- [x] Download edited document
- [x] Create new document
- [x] Error handling for invalid files
- [x] Build for production
- [x] Run dev server

---

## 🚀 Performance

- **Bundle Size**: ~566 KB (183 KB gzipped)
- **Load Time**: <2s on modern browsers
- **File Processing**: Depends on file size
  - Small (<1MB): <100ms
  - Medium (1-10MB): <1s
  - Large (>10MB): 1-5s

**Optimization Opportunities:**
- Code splitting for Viewer/Editor
- Lazy load converters (HWP/DOCX)
- Worker threads for parsing
- Progressive rendering for large docs

---

## 🎓 Learning Resources

**For Users:**
- README.md - Setup and usage guide
- In-app empty states - Contextual help

**For Developers:**
- Source code comments
- Component props documentation
- DEMO_APP_SUMMARY.md - Architecture overview
- This file (FEATURES.md) - Feature breakdown

---

## 🔮 Future Enhancements

**Viewer:**
- [ ] Page navigation (Previous/Next)
- [ ] Search within document
- [ ] Print preview
- [ ] Annotations/highlights
- [ ] Bookmarks

**Editor:**
- [ ] Table editing UI
- [ ] Image upload/insert
- [ ] Font/size selection
- [ ] Alignment controls
- [ ] Lists (bullets, numbers)
- [ ] Collaborative editing
- [ ] Auto-save

**General:**
- [ ] Multiple file tabs
- [ ] Comparison mode (diff)
- [ ] Cloud storage integration
- [ ] Template library
- [ ] Export to PDF/DOCX
- [ ] Localization (i18n)
