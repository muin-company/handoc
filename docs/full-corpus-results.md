# HanDoc Full Corpus Test Results

Generated: 2026-02-20 15:08:35

## HWPX (349 files)

| Metric | Count | Rate |
|--------|-------|------|
| HanDoc.open() | 349 | 100.0% |
| extractText() | 349 | 100.0% |
| Zero-text files | 7 | 2.0% |
| writeHwpx() roundtrip | 349 | 100.0% |
| Roundtrip text match | 349 | 100.0% |
| Total images | 418 | — |
| Total tables | 0 | — |
| Total headers | 13 | — |
| Total footers | 4 | — |

### HWPX Zero-Text Files (7)

- opensource/PageSize_Margin.hwpx
- opensource/SimpleButtons.hwpx
- opensource/SimpleComboBox.hwpx
- opensource/SimpleCompose.hwpx
- opensource/blank.hwpx
- opensource/presentation오류.hwpx
- opensource/pypandoc-blank.hwpx

## HWP (221 files, 0 encrypted)

| Metric | Count | Rate (non-encrypted) |
|--------|-------|---------------------|
| readHwp() | 221 | 100.0% |
| Encrypted | 0 | 0.0% of total |
| extractText() | 221 | 100.0% |
| Zero-text files | 0 | — |
| convertHwpToHwpx() | 221 | 100.0% |
| Converted → HanDoc.open() | 221 | 100.0% |

### HWP Version Distribution

| Version | Count |
|---------|-------|
| 5.1.1.0 | 209 |
| 5.1.0.1 | 12 |

## Overall Summary

- **Total files:** 570 (349 HWPX + 221 HWP)
- **HWPX success rate:** 100.0%
- **HWP read rate:** 100.0% (excluding 0 encrypted)
- **HWP→HWPX conversion rate:** 100.0%
- **Roundtrip text match (HWPX):** 100.0% of roundtripped files
