#!/usr/bin/env python3
"""
PDF 시각 비교 스크립트

한/글 레퍼런스 PDF vs HanDoc PDF를 페이지별로 비교
SSIM (Structural Similarity Index) 기반 유사도 측정

사용법:
  pip install pymupdf Pillow scikit-image numpy
  python compare-pdfs.py --reference ./reference-pdfs --handoc ./handoc-pdfs --output ./comparison-report

출력:
  - comparison-report.json (파일별 점수)
  - comparison-report.md (사람이 읽을 수 있는 리포트)
  - diffs/ (차이가 큰 파일의 시각적 diff 이미지)
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime

try:
    import fitz  # PyMuPDF
    import numpy as np
    from PIL import Image
    from skimage.metrics import structural_similarity as ssim
except ImportError:
    print("필수 패키지 설치 필요:")
    print("  pip install pymupdf Pillow scikit-image numpy")
    sys.exit(1)


def pdf_to_images(pdf_path: Path, dpi: int = 150) -> list[np.ndarray]:
    """PDF를 페이지별 이미지로 변환"""
    doc = fitz.open(str(pdf_path))
    images = []
    for page in doc:
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(np.array(img))
    doc.close()
    return images


def compare_pages(ref_img: np.ndarray, test_img: np.ndarray) -> dict:
    """두 페이지 이미지 비교"""
    # 크기 맞추기 (더 작은 쪽에 맞춤)
    h = min(ref_img.shape[0], test_img.shape[0])
    w = min(ref_img.shape[1], test_img.shape[1])
    ref_crop = ref_img[:h, :w]
    test_crop = test_img[:h, :w]

    # Grayscale로 변환
    ref_gray = np.mean(ref_crop, axis=2).astype(np.uint8)
    test_gray = np.mean(test_crop, axis=2).astype(np.uint8)

    # SSIM 계산
    score, diff = ssim(ref_gray, test_gray, full=True)

    # 크기 차이 비율
    size_diff = abs(ref_img.shape[0] * ref_img.shape[1] - test_img.shape[0] * test_img.shape[1])
    size_ratio = min(ref_img.shape[0] * ref_img.shape[1], test_img.shape[0] * test_img.shape[1])
    size_match = 1.0 - (size_diff / max(size_ratio, 1))

    return {
        "ssim": round(float(score), 4),
        "size_match": round(float(size_match), 4),
        "ref_size": [ref_img.shape[1], ref_img.shape[0]],
        "test_size": [test_img.shape[1], test_img.shape[0]],
        "diff": diff
    }


def compare_pdfs(ref_path: Path, test_path: Path, diff_dir: Path = None) -> dict:
    """두 PDF 파일 비교"""
    result = {
        "reference": str(ref_path),
        "test": str(test_path),
        "status": "unknown",
        "pages": [],
        "avg_ssim": 0,
        "min_ssim": 1.0,
        "grade": "F"
    }

    try:
        ref_images = pdf_to_images(ref_path)
        test_images = pdf_to_images(test_path)

        result["ref_pages"] = len(ref_images)
        result["test_pages"] = len(test_images)

        if len(ref_images) == 0:
            result["status"] = "ref_empty"
            return result

        if len(test_images) == 0:
            result["status"] = "test_empty"
            return result

        # 페이지 수 차이
        max_pages = max(len(ref_images), len(test_images))
        min_pages = min(len(ref_images), len(test_images))

        for i in range(min_pages):
            page_result = compare_pages(ref_images[i], test_images[i])
            result["pages"].append({
                "page": i + 1,
                "ssim": page_result["ssim"],
                "size_match": page_result["size_match"]
            })

            # 차이가 큰 페이지 diff 이미지 저장
            if diff_dir and page_result["ssim"] < 0.8:
                diff_path = diff_dir / f"{ref_path.stem}_page{i+1}_diff.png"
                diff_path.parent.mkdir(parents=True, exist_ok=True)
                diff_img = Image.fromarray((page_result["diff"] * 255).astype(np.uint8))
                diff_img.save(str(diff_path))

        # 누락된 페이지 처리
        for i in range(min_pages, max_pages):
            result["pages"].append({
                "page": i + 1,
                "ssim": 0.0,
                "size_match": 0.0,
                "note": "missing_in_" + ("test" if i >= len(test_images) else "reference")
            })

        # 평균/최소 SSIM (누락 페이지 제외하고 계산, 페이지 수 차이 페널티 별도 적용)
        matched_scores = [p["ssim"] for p in result["pages"] if p.get("note") is None]
        all_scores = [p["ssim"] for p in result["pages"]]
        if matched_scores:
            matched_avg = sum(matched_scores) / len(matched_scores)
            # 페이지 매칭률 페널티: 누락 비율만큼 감점 (최대 30% 감점)
            page_match_ratio = len(matched_scores) / len(all_scores) if all_scores else 1
            penalty = min(0.30, (1 - page_match_ratio) * 0.3)
            result["avg_ssim"] = round(matched_avg - penalty, 4)
        else:
            result["avg_ssim"] = 0
        result["min_ssim"] = round(min(all_scores), 4) if all_scores else 0

        # 등급
        avg = result["avg_ssim"]
        if avg >= 0.95:
            result["grade"] = "A"  # 거의 동일
        elif avg >= 0.85:
            result["grade"] = "B"  # 약간 차이
        elif avg >= 0.70:
            result["grade"] = "C"  # 눈에 띄는 차이
        elif avg >= 0.50:
            result["grade"] = "D"  # 심각한 차이
        else:
            result["grade"] = "F"  # 완전히 다름

        result["status"] = "compared"

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)

    return result


def generate_report(results: list[dict], output_dir: Path):
    """마크다운 리포트 생성"""
    grades = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for r in results:
        grades[r.get("grade", "F")] += 1

    total = len(results)
    pass_rate = (grades["A"] + grades["B"]) / total * 100 if total else 0

    lines = [
        "# HanDoc 시각 품질 리포트",
        f"",
        f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*",
        f"",
        f"## 요약",
        f"",
        f"| 항목 | 값 |",
        f"|------|-----|",
        f"| 총 문서 | {total} |",
        f"| 통과 (A+B) | {grades['A'] + grades['B']} ({pass_rate:.1f}%) |",
        f"| A (≥95%) | {grades['A']} |",
        f"| B (≥85%) | {grades['B']} |",
        f"| C (≥70%) | {grades['C']} |",
        f"| D (≥50%) | {grades['D']} |",
        f"| F (<50%) | {grades['F']} |",
        f"",
        f"## 등급 기준",
        f"- **A**: SSIM ≥ 0.95 — 아래한글과 거의 동일",
        f"- **B**: SSIM ≥ 0.85 — 약간의 차이 (폰트, 간격 등)",
        f"- **C**: SSIM ≥ 0.70 — 눈에 띄는 차이",
        f"- **D**: SSIM ≥ 0.50 — 심각한 레이아웃 차이",
        f"- **F**: SSIM < 0.50 — 완전히 다름 / 빈 출력",
        f"",
    ]

    # 문제 파일 목록 (C 이하)
    problems = [r for r in results if r.get("grade", "F") in ("C", "D", "F")]
    if problems:
        lines.append("## ⚠️ 문제 파일")
        lines.append("")
        lines.append("| 파일 | 등급 | SSIM | 페이지 | 비고 |")
        lines.append("|------|------|------|--------|------|")
        for r in sorted(problems, key=lambda x: x.get("avg_ssim", 0)):
            name = Path(r.get("reference", "?")).stem[:40]
            grade = r.get("grade", "?")
            avg = r.get("avg_ssim", 0)
            pages = f"{r.get('ref_pages', '?')}/{r.get('test_pages', '?')}"
            error = r.get("error", "")[:30] if r.get("status") == "error" else ""
            lines.append(f"| {name} | {grade} | {avg:.2f} | {pages} | {error} |")
        lines.append("")

    # 전체 결과 (간략)
    lines.append("## 전체 결과")
    lines.append("")
    lines.append("| 파일 | 등급 | SSIM |")
    lines.append("|------|------|------|")
    for r in sorted(results, key=lambda x: x.get("avg_ssim", 0)):
        name = Path(r.get("reference", "?")).stem[:50]
        lines.append(f"| {name} | {r.get('grade', '?')} | {r.get('avg_ssim', 0):.2f} |")

    report_path = output_dir / "VISUAL-QUALITY-REPORT.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"📝 리포트: {report_path}")


def main():
    parser = argparse.ArgumentParser(description="PDF 시각 비교")
    parser.add_argument("--reference", default=None, help="한/글 레퍼런스 PDF 디렉토리 (기본: ../handoc-fixtures/pdf-hancom-win)")
    parser.add_argument("--handoc", default=None, help="HanDoc PDF 디렉토리 (기본: ../handoc-fixtures/pdf-001)")
    parser.add_argument("--output", default="./comparison", help="결과 출력 디렉토리")
    parser.add_argument("--dpi", type=int, default=150, help="비교 DPI")
    parser.add_argument("--limit", type=int, help="비교할 최대 파일 수")
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    fixtures_dir = script_dir.parent.parent / "handoc-fixtures"
    ref_dir = Path(args.reference) if args.reference else fixtures_dir / "pdf-hancom"
    test_dir = Path(args.handoc) if args.handoc else fixtures_dir / "pdf-001"
    out_dir = Path(args.output)
    diff_dir = out_dir / "diffs"
    out_dir.mkdir(parents=True, exist_ok=True)

    # 레퍼런스 PDF 찾기
    ref_pdfs = sorted(ref_dir.rglob("*.pdf"))
    if args.limit:
        ref_pdfs = ref_pdfs[:args.limit]

    print(f"🔍 레퍼런스 PDF: {len(ref_pdfs)}개")
    print(f"📁 HanDoc PDF: {test_dir}")
    print()

    results = []
    for i, ref_pdf in enumerate(ref_pdfs):
        rel = ref_pdf.relative_to(ref_dir)
        test_pdf = test_dir / rel

        if not test_pdf.exists():
            results.append({
                "reference": str(rel),
                "status": "missing",
                "grade": "F",
                "avg_ssim": 0
            })
            print(f"[{i+1}/{len(ref_pdfs)}] ❌ {rel.stem} — HanDoc PDF 없음")
            continue

        r = compare_pdfs(ref_pdf, test_pdf, diff_dir)
        r["reference"] = str(rel)
        results.append(r)

        icon = {"A": "🟢", "B": "🔵", "C": "🟡", "D": "🟠", "F": "🔴"}.get(r["grade"], "⚪")
        print(f"[{i+1}/{len(ref_pdfs)}] {icon} {rel.stem} — {r['grade']} (SSIM: {r['avg_ssim']:.2f})")

    # JSON 결과 저장
    summary = {
        "generated": datetime.now().isoformat(),
        "dpi": args.dpi,
        "total": len(results),
        "grades": {g: sum(1 for r in results if r.get("grade") == g) for g in "ABCDF"},
        "results": results
    }
    json_path = out_dir / "comparison-results.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    # 마크다운 리포트
    generate_report(results, out_dir)

    print()
    print(f"{'='*60}")
    grades = summary["grades"]
    print(f"📊 결과: A={grades['A']} B={grades['B']} C={grades['C']} D={grades['D']} F={grades['F']}")
    print(f"✅ 통과율: {(grades['A']+grades['B'])/len(results)*100:.1f}%" if results else "")
    print(f"📁 출력: {out_dir}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
