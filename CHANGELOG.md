# Changelog

## v0.1.0 (2026-02-20)

Initial release. 🎉

### @handoc/document-model
- TypeScript types for HWP/HWPX document structure (sections, paragraphs, runs, tables)
- Document header types (fonts, styles, char/para properties)
- `GenericElement` for round-trip preservation of unknown XML elements
- HWPML namespace constants and utility functions

### @handoc/hwpx-core
- `OpcPackage` — Read HWPX files as OPC/ZIP archives
- `parseManifest` — Parse OPF manifest XML
- Based on `fflate` for fast ZIP decompression

### @handoc/hwpx-parser
- `HanDoc` — High-level HWPX document parser
- Header, section, paragraph, and table parsing
- `extractText()` — Plain text extraction
- `tableToTextGrid()` — Table to 2D array conversion
- XML utility functions

### @handoc/hwpx-writer
- `buildHwpx()` — Generate complete HWPX files from document model
- Header, section, and generic element serialization
- Round-trip support (parse → modify → write)
