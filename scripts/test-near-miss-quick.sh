#!/bin/bash
# Quick test of 4 near-miss D-grade documents to measure improvement
# Target: SSIM 0.65-0.69 → ≥0.70 (C-grade)

set -e

FIXTURES_BASE="$HOME/handoc-fixtures/pdf-001"
OUTPUT_DIR="$HOME/handoc/test-output/near-miss-$(date +%H%M)"

mkdir -p "$OUTPUT_DIR"

echo "🎯 Testing 4 near-miss documents..."
echo "Expected improvement from recent changes:"
echo "  - Border width precision (+0.01-0.02)"
echo "  - Vertical alignment (+0.01-0.03)"
echo "  - Color palette (+0.01-0.02)"
echo ""

# Near-miss documents from VISUAL-DIFF-STRATEGY.md
DOCS=(
  "붙임 1. 2025년 고성능 컴퓨팅 지원 사용자 모집 공고(제2025-0169호)_v7.0"
  "[별표 7] 인증평가 일부 생략의 범위(제11조 관련)(클라우드컴퓨팅서비스 보안인증에 관한"
  "230403 공공기관의 데이터베이스 표준화 지침 개정 전문"
)

for doc in "${DOCS[@]}"; do
  echo "Testing: $doc"
  
  # Find the HWPX file
  hwpx=$(find "$FIXTURES_BASE" -name "${doc}.hwpx" 2>/dev/null | head -1)
  
  if [ -n "$hwpx" ]; then
    ref_pdf="${hwpx%.hwpx}.pdf"
    test_pdf="$OUTPUT_DIR/${doc}.pdf"
    
    # Generate PDF
    cd ~/handoc
    pnpm handoc to-pdf "$hwpx" -o "$test_pdf" 2>&1 | grep -v "Debugger\|inspector" || true
    
    if [ -f "$test_pdf" ]; then
      # Quick page count check
      ref_pages=$(pdfinfo "$ref_pdf" 2>/dev/null | grep "Pages:" | awk '{print $2}')
      test_pages=$(pdfinfo "$test_pdf" 2>/dev/null | grep "Pages:" | awk '{print $2}')
      echo "  Pages: $ref_pages → $test_pages"
    fi
  else
    echo "  ⚠️  HWPX not found"
  fi
  echo ""
done

echo "✅ Quick test complete. Results in: $OUTPUT_DIR"
echo "Run full comparison to measure SSIM changes."
