#!/bin/bash
cd /Users/mj/handoc

FILES=(
  "education/2025학년도 1학기 학교생활기록부 기재요령 및 점검 일정 연수자료"
  "education/2025학년도 2학기 학교생활기록부 기재요령 및 점검 일정 연수자료"
  "education/2학기 행특_1"
  "education-hwp/2025학년도 1학기 기말대비_개념잡기"
  "education-hwp/2025학년도 2학기 기말대비_개념잡기"
)

for f in "${FILES[@]}"; do
  HWP_PATH="/Users/mj/handoc-fixtures/test-files/$f.hwp"
  if [ ! -f "$HWP_PATH" ]; then
    HWP_PATH="/Users/mj/handoc-fixtures/test-files/$f.hwpx"
  fi
  
  echo "Processing $HWP_PATH..."
  
  OUT_PDF="/tmp/test_$(basename "$f").pdf"
  
  # Run handoc CLI
  ./packages/handoc-cli/bin/handoc.js pdf "$HWP_PATH" "$OUT_PDF"
  
  if [ -f "$OUT_PDF" ]; then
    PAGES=$(pdfinfo "$OUT_PDF" | grep "Pages:" | awk '{print $2}')
    echo "  New Test pages: $PAGES"
  else
    echo "  Failed to generate $OUT_PDF"
  fi
done
