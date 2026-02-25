#!/bin/bash
# Batch convert HWP files to PDF using handoc CLI --direct mode
INPUT_DIR="/Users/mj/handoc-fixtures/real-world/education-hwp"
OUTPUT_DIR="/Users/mj/handoc-fixtures/real-world/education-hwp-pdf"
mkdir -p "$OUTPUT_DIR"

SUCCESS=0
FAIL=0
ERRORS=""

for hwp in "$INPUT_DIR"/*.hwp; do
  name=$(basename "$hwp" .hwp)
  out="$OUTPUT_DIR/${name}.pdf"
  if node /Users/mj/handoc/packages/handoc-cli/dist/index.js to-pdf --direct "$hwp" -o "$out" 2>/dev/null; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL: $name"
  fi
  printf "\r  Progress: %d success, %d fail" $SUCCESS $FAIL
done

echo ""
echo "=== RESULTS ==="
echo "Success: $SUCCESS"
echo "Fail:    $FAIL"
echo "Total:   $((SUCCESS + FAIL))"
if [ -n "$ERRORS" ]; then
  echo -e "\nFailed files:$ERRORS"
fi
