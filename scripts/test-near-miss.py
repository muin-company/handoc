#!/usr/bin/env python3
"""Test near-miss C-grade files after line-height fix"""
import subprocess, os, json, sys

HANDOC_DIR = "/Users/mj/handoc"
FIXTURES_DIR = "/Users/mj/handoc-fixtures"
OUTPUT_DIR = "/tmp/handoc-near-miss-test"
CLI = f"node {HANDOC_DIR}/packages/handoc-cli/dist/index.js"

# Clean output
os.system(f"rm -rf {OUTPUT_DIR}")

# Files to test
files = [
    # Near-miss C-grade (top 10)
    "education/2025 원안지 및 문항정보표 교차검토 확인표",
    "education-hwp/3학년 1학기(2차) 사전활동지",
    "20260220/[별표 9] 인증평가팀 자격 요건 및 구성기준(제16조 관련)(클라우드컴퓨팅서비스 보안인증에 관한 고시)",
    "20260220/[별표 8] 인증 수수료 산정 및 평가원 보수 기준(제12조 관련)(클라우드컴퓨팅서비스 보안인증에 관한 고시)",
    "education/2학기 수행평가 마감 순서",
    "education-hwp/2025학년도 3학년 졸업평가 담임용 양식(1)",
    "education/급훈과 선생님 말씀(3-8)",
    "education/B4 설정 방법",
    "education-hwp/[서식1]선정 평가표",
    "education/생기부 안내(출결관리, 나이스 이름)",
    # Regression A-grade
    "education/시험범위 목차",
    "education/제본정보",
    "education/3.4 개인정보 활용 동의 가정통신문(겉표지)",
    # Regression B-grade
    "education/고입원서_상자 체크박스 하는 방법",
    "education/독감관련 안내",
    "education/2025학년도 2학기 2차 지필평가 출제 협의록( 00과)",
]

# Generate PDFs
print("=== Generating PDFs ===")
for f in files:
    subdir = os.path.dirname(f)
    outdir = os.path.join(OUTPUT_DIR, subdir)
    os.makedirs(outdir, exist_ok=True)
    
    src = None
    for ext in ['hwpx', 'hwp']:
        p = os.path.join(FIXTURES_DIR, 'real-world', f + '.' + ext)
        if os.path.exists(p):
            src = p
            break
    
    if not src:
        print(f"  SKIP: {os.path.basename(f)} (no source)")
        continue
    
    outpdf = os.path.join(OUTPUT_DIR, f + '.pdf')
    basename = os.path.basename(f)
    result = subprocess.run(
        f'{CLI} to-pdf --direct -o "{outpdf}" "{src}"',
        shell=True, capture_output=True, text=True
    )
    status = "OK" if result.returncode == 0 else "FAIL"
    print(f"  {status}: {basename}")

# Compare
print("\n=== Comparing ===")
subprocess.run([
    'python3', f'{HANDOC_DIR}/scripts/compare-pdfs.py',
    '--reference', f'{FIXTURES_DIR}/pdf-hancom/real-world',
    '--handoc', OUTPUT_DIR,
    '--output', f'{OUTPUT_DIR}/comparison',
    '--dpi', '150'
], capture_output=True)

# Results
print("\n=== Results ===")
with open(f'{OUTPUT_DIR}/comparison/comparison-results.json') as f:
    data = json.load(f)

# Get v29 scores for comparison
with open(f'{FIXTURES_DIR}/comparison-v29/comparison-results.json') as f:
    v29 = json.load(f)
v29_scores = {r['reference']: (r['avg_ssim'], r['grade']) for r in v29['results']}

for r in sorted(data['results'], key=lambda x: x['avg_ssim'], reverse=True):
    ref = r['reference']
    old = v29_scores.get(ref, (0, '?'))
    delta = r['avg_ssim'] - old[0]
    arrow = '↑' if delta > 0 else '↓' if delta < 0 else '='
    print(f"  {old[1]}→{r['grade']} {old[0]:.4f}→{r['avg_ssim']:.4f} ({arrow}{abs(delta):.4f}) {os.path.basename(ref)}")
