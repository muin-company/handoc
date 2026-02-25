#!/bin/bash
# Quick comparison test on 5 key documents to validate current state
# Faster than full 43-document comparison

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M)
OUTPUT_DIR="$HOME/handoc/comparison-quick-${TIMESTAMP}"
FIXTURES_BASE="$HOME/handoc-fixtures"

echo "🧪 Quick Comparison Test: $TIMESTAMP"
echo "Testing 5 representative documents..."
echo ""

mkdir -p "$OUTPUT_DIR"

# 5 representative documents covering different grades
DOCS=(
  "mot"  # Was C-grade (0.70), simple 2-page doc
  "디저트 카페 메뉴"  # Was volatile F→B→F
  "230403 공공기관의 데이터베이스 표준화 지침 개정 전문"  # D-grade near-miss
  "SimplePicture"  # A-grade baseline
  "ai-writing"  # C-grade baseline
)

# Find and test each document
for doc in "${DOCS[@]}"; do
  echo "Testing: $doc"
  
  # Find HWPX file
  hwpx=$(find "$FIXTURES_BASE" -name "${doc}.hwpx" 2>/dev/null | head -1)
  
  if [ -z "$hwpx" ]; then
    echo "  ⚠️  HWPX not found, skipping"
    continue
  fi
  
  ref_pdf="${hwpx%.hwpx}.pdf"
  # Handle different fixture structures
  if [ ! -f "$ref_pdf" ]; then
    ref_pdf=$(find "$FIXTURES_BASE/pdf-001" -name "${doc}.pdf" 2>/dev/null | head -1)
  fi
  
  if [ -z "$ref_pdf" ] || [ ! -f "$ref_pdf" ]; then
    echo "  ⚠️  Reference PDF not found, skipping"
    continue
  fi
  
  test_pdf="$OUTPUT_DIR/${doc}.pdf"
  
  # Generate PDF
  cd ~/handoc
  node packages/handoc-cli/dist/index.js to-pdf "$hwpx" -o "$test_pdf" >/dev/null 2>&1
  
  if [ -f "$test_pdf" ]; then
    # Quick SSIM check using Python
    python3 - <<EOF
import fitz
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim
from pathlib import Path

ref_pdf = Path("$ref_pdf")
test_pdf = Path("$test_pdf")

ref_doc = fitz.open(str(ref_pdf))
test_doc = fitz.open(str(test_pdf))

scores = []
for i in range(min(3, min(len(ref_doc), len(test_doc)))):  # First 3 pages
    mat = fitz.Matrix(150/72, 150/72)
    ref_pix = ref_doc[i].get_pixmap(matrix=mat)
    test_pix = test_doc[i].get_pixmap(matrix=mat)
    
    ref_img = Image.frombytes("RGB", [ref_pix.width, ref_pix.height], ref_pix.samples)
    test_img = Image.frombytes("RGB", [test_pix.width, test_pix.height], test_pix.samples)
    
    if ref_img.size != test_img.size:
        test_img = test_img.resize(ref_img.size, Image.Resampling.LANCZOS)
    
    ref_gray = np.array(ref_img.convert('L'))
    test_gray = np.array(test_img.convert('L'))
    
    score = ssim(ref_gray, test_gray)
    scores.append(score)

avg = sum(scores) / len(scores) if scores else 0
grade = 'A' if avg >= 0.95 else 'B' if avg >= 0.85 else 'C' if avg >= 0.70 else 'D' if avg >= 0.50 else 'F'

print(f"  SSIM: {avg:.4f} [{grade}]  Pages: {len(ref_doc)}→{len(test_doc)}")

ref_doc.close()
test_doc.close()
EOF
  else
    echo "  ❌ Failed to generate PDF"
  fi
  echo ""
done

echo "✅ Quick test complete. Results in: $OUTPUT_DIR"
