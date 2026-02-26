#!/usr/bin/env python3
"""Test impact of cbe92d2 (header/footer commit) on SSIM scores."""
import subprocess, json, os, sys, tempfile
from pathlib import Path
import fitz
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim

FIXTURES = Path("/Users/mj/handoc-fixtures")
HANDOC = Path("/Users/mj/handoc")

# 10 test files: page-same between v36/v38 but SSIM dropped
TEST_FILES = [
    ("education/2025학년도 2학기 학생자치회장 및 부회장 명단", 1),
    ("education/2025학년도 교외체험학습 신청서 및 보고서", 4),
    ("education/2025학년도 1차 졸업앨범 촬영 계획", 2),
    ("education/3학년 1학기(1차)논술 시험지(수정)", 2),
    ("education/2025 동아리활동 공지  사항 알림(3.19)", 3),
    ("education/2025 진로박람회 '진로캠퍼스' 직업체험 운영 계획 인솔교사 안내문", 3),
    ("education/1. 교실,관리실(교무실, 행정실)", 1),
    ("education/3학년 2학기(2차)논술 시험지", 2),
    ("education/2025학년도 1학기 학업성적관리위원회 회의록", 3),
    ("education/2025학년도 2학기 역곡중학교 인사자문위원회 심의 결과 보고서", 2),
]

def pdf_to_gray_images(pdf_path, dpi=150):
    doc = fitz.open(str(pdf_path))
    images = []
    for page in doc:
        mat = fitz.Matrix(dpi/72, dpi/72)
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        gray = np.array(img.convert("L"))
        images.append(gray)
    doc.close()
    return images

def compute_ssim(ref_path, test_path):
    ref_imgs = pdf_to_gray_images(ref_path)
    test_imgs = pdf_to_gray_images(test_path)
    if len(ref_imgs) != len(test_imgs):
        return None, len(ref_imgs), len(test_imgs)
    scores = []
    for r, t in zip(ref_imgs, test_imgs):
        h = min(r.shape[0], t.shape[0])
        w = min(r.shape[1], t.shape[1])
        s = ssim(r[:h,:w], t[:h,:w])
        scores.append(s)
    return sum(scores)/len(scores), len(ref_imgs), len(test_imgs)

def generate_pdfs(output_dir, label):
    results = {}
    for fname, expected_pages in TEST_FILES:
        hwpx = FIXTURES / "real-world" / f"{fname}.hwpx"
        ref_pdf = FIXTURES / "pdf-hancom-win" / f"{fname}.pdf"
        if not hwpx.exists():
            print(f"  ⚠️  HWPX not found: {hwpx}")
            continue
        if not ref_pdf.exists():
            print(f"  ⚠️  Ref PDF not found: {ref_pdf}")
            continue
        
        out_pdf = Path(output_dir) / f"{Path(fname).name}.pdf"
        out_pdf.parent.mkdir(parents=True, exist_ok=True)
        
        r = subprocess.run(
            ["pnpm", "handoc", "to-pdf", str(hwpx), "-o", str(out_pdf)],
            cwd=str(HANDOC), capture_output=True, timeout=120
        )
        if r.returncode != 0 or not out_pdf.exists():
            print(f"  ❌ Failed: {fname}")
            continue
        
        avg_ssim, rp, tp = compute_ssim(ref_pdf, out_pdf)
        short = Path(fname).name
        results[short] = {"ssim": avg_ssim, "ref_pages": rp, "test_pages": tp}
        status = f"{avg_ssim:.4f}" if avg_ssim else f"page mismatch {rp}vs{tp}"
        print(f"  [{label}] {short}: {status}")
    return results

def main():
    phase = sys.argv[1] if len(sys.argv) > 1 else "current"
    outdir = sys.argv[2] if len(sys.argv) > 2 else f"/tmp/hf-test-{phase}"
    os.makedirs(outdir, exist_ok=True)
    print(f"\n🧪 Generating PDFs ({phase})...")
    results = generate_pdfs(outdir, phase)
    
    # Save results
    json_path = f"/tmp/hf-results-{phase}.json"
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n📊 Results saved to {json_path}")
    print(f"Files with SSIM: {sum(1 for v in results.values() if v['ssim'] is not None)}/{len(results)}")
    if results:
        valid = [v['ssim'] for v in results.values() if v['ssim'] is not None]
        if valid:
            print(f"Average SSIM: {sum(valid)/len(valid):.4f}")

if __name__ == "__main__":
    main()
