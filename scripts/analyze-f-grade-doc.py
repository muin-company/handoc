#!/usr/bin/env python3
"""
Analyze F-grade documents to identify missing content and structural issues.
"""
import sys
import json
import subprocess
from pathlib import Path

def find_hwpx_file(doc_name: str) -> Path | None:
    """Find HWPX file by document name."""
    fixtures_base = Path.home() / "handoc-fixtures" / "pdf-001"
    
    # Search in all subdirectories
    for hwpx in fixtures_base.rglob("*.hwpx"):
        if doc_name in hwpx.stem:
            return hwpx
    return None

def analyze_hwpx_structure(hwpx_path: Path) -> dict:
    """Parse HWPX and extract structural information."""
    try:
        # Use handoc CLI to inspect the document
        result = subprocess.run(
            ["pnpm", "handoc", "inspect", str(hwpx_path)],
            capture_output=True,
            text=True,
            cwd=Path.home() / "handoc"
        )
        
        if result.returncode != 0:
            return {"error": result.stderr}
        
        # Parse the output
        lines = result.stdout.strip().split('\n')
        info = {
            "sections": 0,
            "paragraphs": 0,
            "tables": 0,
            "images": 0,
            "shapes": 0,
        }
        
        for line in lines:
            if "sections:" in line.lower():
                info["sections"] = int(line.split(":")[-1].strip())
            elif "paragraphs:" in line.lower():
                info["paragraphs"] = int(line.split(":")[-1].strip())
            elif "tables:" in line.lower():
                info["tables"] = int(line.split(":")[-1].strip())
            elif "images:" in line.lower():
                info["images"] = int(line.split(":")[-1].strip())
            elif "shapes:" in line.lower():
                info["shapes"] = int(line.split(":")[-1].strip())
        
        return info
        
    except Exception as e:
        return {"error": str(e)}

def get_pdf_info(pdf_path: Path) -> dict:
    """Get PDF page count and metadata."""
    try:
        result = subprocess.run(
            ["pdfinfo", str(pdf_path)],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            return {"error": result.stderr}
        
        info = {}
        for line in result.stdout.split('\n'):
            if line.startswith("Pages:"):
                info["pages"] = int(line.split(":")[-1].strip())
            elif line.startswith("Page size:"):
                info["page_size"] = line.split(":")[-1].strip()
        
        return info
        
    except Exception as e:
        return {"error": str(e)}

def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze-f-grade-doc.py <document-name>")
        sys.exit(1)
    
    doc_name = sys.argv[1]
    print(f"🔍 Analyzing: {doc_name}\n")
    
    # Find HWPX file
    hwpx_path = find_hwpx_file(doc_name)
    if not hwpx_path:
        print(f"❌ HWPX file not found for: {doc_name}")
        sys.exit(1)
    
    print(f"📄 Found HWPX: {hwpx_path}")
    
    # Analyze HWPX structure
    print("\n📊 HWPX Structure:")
    structure = analyze_hwpx_structure(hwpx_path)
    for key, value in structure.items():
        print(f"  {key}: {value}")
    
    # Find reference PDF
    ref_pdf = hwpx_path.with_suffix('.pdf')
    if ref_pdf.exists():
        print(f"\n📑 Reference PDF: {ref_pdf}")
        ref_info = get_pdf_info(ref_pdf)
        print(f"  Pages: {ref_info.get('pages', 'unknown')}")
        print(f"  Size: {ref_info.get('page_size', 'unknown')}")
    else:
        print(f"\n⚠️  Reference PDF not found: {ref_pdf}")
    
    # Find generated PDF (in test-output)
    test_output = Path.home() / "handoc" / "test-output"
    generated_pdfs = list(test_output.glob(f"*{hwpx_path.stem}*.pdf"))
    
    if generated_pdfs:
        print(f"\n🔨 Generated PDF: {generated_pdfs[0]}")
        gen_info = get_pdf_info(generated_pdfs[0])
        print(f"  Pages: {gen_info.get('pages', 'unknown')}")
        print(f"  Size: {gen_info.get('page_size', 'unknown')}")
        
        # Compare
        if ref_info.get('pages') and gen_info.get('pages'):
            diff = gen_info['pages'] - ref_info['pages']
            print(f"\n📉 Page difference: {diff:+d} ({diff/ref_info['pages']*100:+.1f}%)")
    
    print("\n" + "="*60)
    print("💡 Next steps:")
    print("  1. Open both PDFs side-by-side")
    print("  2. Identify missing/extra content")
    print("  3. Check diff images in comparison-midnight/diffs/")
    print("="*60)

if __name__ == "__main__":
    main()
