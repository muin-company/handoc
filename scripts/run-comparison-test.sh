#!/bin/bash
# Run full comparison test to validate recent improvements
# Target: 4 near-miss D-grade documents (SSIM 0.65-0.69)

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M)
OUTPUT_DIR="$HOME/handoc/comparison-${TIMESTAMP}"
FIXTURES_BASE="$HOME/handoc-fixtures/pdf-001"

echo "🧪 Running comparison test: $TIMESTAMP"
echo "Output: $OUTPUT_DIR"
echo ""

mkdir -p "$OUTPUT_DIR"

# Step 1: Generate test PDFs for near-miss documents
echo "📝 Step 1: Generating test PDFs..."

DOCS=(
  "붙임 1. 2025년 고성능 컴퓨팅 지원 사용자 모집 공고(제2025-0169호)_v7.0"
  "[별표 7] 인증평가 일부 생략의 범위(제11조 관련)(클라우드컴퓨팅서비스 보안인증에 관한"
  "2. 제안요청서_25년 홈택스 고도화 구축(2단계) 사업"
  "230403 공공기관의 데이터베이스 표준화 지침 개정 전문"
)

TEST_PDFS=()
REF_PDFS=()

for doc in "${DOCS[@]}"; do
  echo "  Processing: $doc"
  
  # Find HWPX file
  hwpx=$(find "$FIXTURES_BASE" -name "${doc}.hwpx" 2>/dev/null | head -1)
  
  if [ -z "$hwpx" ]; then
    echo "    ⚠️  HWPX not found, skipping"
    continue
  fi
  
  ref_pdf="${hwpx%.hwpx}.pdf"
  test_pdf="$OUTPUT_DIR/$(basename "$hwpx" .hwpx).pdf"
  
  # Generate PDF with HanDoc
  cd ~/handoc
  pnpm handoc to-pdf "$hwpx" -o "$test_pdf" >/dev/null 2>&1
  
  if [ -f "$test_pdf" ]; then
    echo "    ✅ Generated: $(basename "$test_pdf")"
    TEST_PDFS+=("$test_pdf")
    REF_PDFS+=("$ref_pdf")
  else
    echo "    ❌ Failed to generate PDF"
  fi
done

echo ""
echo "📊 Step 2: Comparing PDFs..."

# Step 2: Compare PDFs
cd ~/handoc
python3 - <<EOF
import fitz
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim
from pathlib import Path
import json

test_pdfs = [Path(p) for p in "${TEST_PDFS[@]}".split()]
ref_pdfs = [Path(p) for p in "${REF_PDFS[@]}".split()]

results = []

for test_pdf, ref_pdf in zip(test_pdfs, ref_pdfs):
    if not test_pdf.exists() or not ref_pdf.exists():
        continue
    
    print(f"Comparing: {test_pdf.name}")
    
    # Open PDFs
    ref_doc = fitz.open(str(ref_pdf))
    test_doc = fitz.open(str(test_pdf))
    
    page_scores = []
    
    for i in range(min(len(ref_doc), len(test_doc))):
        # Convert to images
        ref_page = ref_doc[i]
        test_page = test_doc[i]
        
        mat = fitz.Matrix(150/72, 150/72)
        ref_pix = ref_page.get_pixmap(matrix=mat)
        test_pix = test_page.get_pixmap(matrix=mat)
        
        ref_img = Image.frombytes("RGB", [ref_pix.width, ref_pix.height], ref_pix.samples)
        test_img = Image.frombytes("RGB", [test_pix.width, test_pix.height], test_pix.samples)
        
        # Ensure same size
        if ref_img.size != test_img.size:
            test_img = test_img.resize(ref_img.size, Image.Resampling.LANCZOS)
        
        # Convert to grayscale for SSIM
        ref_gray = np.array(ref_img.convert('L'))
        test_gray = np.array(test_img.convert('L'))
        
        # Calculate SSIM
        score = ssim(ref_gray, test_gray)
        page_scores.append(score)
    
    avg_ssim = sum(page_scores) / len(page_scores) if page_scores else 0
    
    result = {
        'file': test_pdf.name,
        'pages_ref': len(ref_doc),
        'pages_test': len(test_doc),
        'avg_ssim': round(avg_ssim, 4),
        'page_scores': [round(s, 4) for s in page_scores]
    }
    
    results.append(result)
    
    print(f"  Pages: {len(ref_doc)} → {len(test_doc)}")
    print(f"  Avg SSIM: {avg_ssim:.4f}")
    
    ref_doc.close()
    test_doc.close()

# Save results
output_file = Path("$OUTPUT_DIR") / "comparison-results.json"
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\n✅ Results saved to: {output_file}")

# Print summary
print("\n📊 Summary:")
print(f"{'File':<60} {'SSIM':>8} {'Pages':>10}")
print("-" * 80)
for r in results:
    pages = f"{r['pages_ref']}→{r['pages_test']}"
    grade = 'A' if r['avg_ssim'] >= 0.95 else 'B' if r['avg_ssim'] >= 0.85 else 'C' if r['avg_ssim'] >= 0.70 else 'D' if r['avg_ssim'] >= 0.50 else 'F'
    print(f"{r['file']:<60} {r['avg_ssim']:>8.4f} {pages:>10}  [{grade}]")
EOF

echo ""
echo "✅ Comparison test complete!"
echo "Results: $OUTPUT_DIR/comparison-results.json"
