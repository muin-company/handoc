#!/bin/bash
# Test near-miss C-grade files after line-height fix
set -e

HANDOC_DIR="/Users/mj/handoc"
FIXTURES_DIR="/Users/mj/handoc-fixtures"
OUTPUT_DIR="/tmp/handoc-near-miss-test"
CLI="node $HANDOC_DIR/packages/handoc-cli/dist/index.js"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# All test files (near-miss + regression)
declare -A FILES
# Near-miss C-grade
FILES["education/2025 원안지 및 문항정보표 교차검토 확인표"]=C
FILES["education-hwp/3학년 1학기(2차) 사전활동지"]=C
FILES["20260220/[별표 9] 인증평가팀 자격 요건 및 구성기준(제16조 관련)(클라우드컴퓨팅서비스 보안인증에 관한 고시)"]=C
FILES["20260220/[별표 8] 인증 수수료 산정 및 평가원 보수 기준(제12조 관련)(클라우드컴퓨팅서비스 보안인증에 관한 고시)"]=C
FILES["education/2학기 수행평가 마감 순서"]=C
FILES["education-hwp/2025학년도 3학년 졸업평가 담임용 양식(1)"]=C
FILES["education/급훈과 선생님 말씀(3-8)"]=C
FILES["education/B4 설정 방법"]=C
FILES["education-hwp/[서식1]선정 평가표"]=C
FILES["education/생기부 안내(출결관리, 나이스 이름)"]=C
# Regression A-grade
FILES["education/시험범위 목차"]=A
FILES["education/제본정보"]=A
FILES["education/3.4 개인정보 활용 동의 가정통신문(겉표지)"]=A
# Regression B-grade
FILES["education/고입원서_상자 체크박스 하는 방법"]=B
FILES["education/독감관련 안내"]=B
FILES["education/2025학년도 2학기 2차 지필평가 출제 협의록( 00과)"]=B

for f in "${!FILES[@]}"; do
  grade="${FILES[$f]}"
  subdir=$(dirname "$f")
  basename=$(basename "$f")
  mkdir -p "$OUTPUT_DIR/$subdir"
  
  # Find source
  src=""
  for ext in hwpx hwp; do
    if [ -f "$FIXTURES_DIR/real-world/$f.$ext" ]; then
      src="$FIXTURES_DIR/real-world/$f.$ext"
      break
    fi
  done
  
  if [ -z "$src" ]; then
    echo "SKIP ($grade): $basename (no source)"
    continue
  fi
  
  outpdf="$OUTPUT_DIR/$f.pdf"
  echo -n "  [$grade] $(basename "$f")... "
  if $CLI to-pdf --direct -o "$outpdf" "$src" 2>/dev/null; then
    echo "OK"
  else
    echo "FAIL"
  fi
done

echo ""
echo "=== Comparing ==="
python3 "$HANDOC_DIR/scripts/compare-pdfs.py" \
  --reference "$FIXTURES_DIR/pdf-hancom/real-world" \
  --handoc "$OUTPUT_DIR" \
  --output "$OUTPUT_DIR/comparison" \
  --dpi 150 2>&1 | tail -5

echo ""
echo "=== Results ==="
python3 -c "
import json
with open('$OUTPUT_DIR/comparison/comparison-results.json') as f:
    data = json.load(f)
for r in sorted(data['results'], key=lambda x: x['avg_ssim'], reverse=True):
    ref = r['reference']
    print(f\"{r['grade']} {r['avg_ssim']:.4f} {ref}\")
"
