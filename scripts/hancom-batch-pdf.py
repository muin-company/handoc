#!/usr/bin/env python3
"""
한/글 → PDF 일괄 변환 (Windows)

사용법:
  1. pip install pywin32
  2. python hancom-batch-pdf.py "C:\hwpx-files" "C:\pdf-output"

인자:
  - 첫째: HWPX/HWP 파일이 있는 폴더 (하위폴더 포함 검색)
  - 둘째: PDF 출력 폴더

주의:
  - 한/글이 설치되어 있어야 함
  - 실행 중 한/글 창이 열렸다 닫힘 (자동)
  - 보안 경고 뜨면 '허용' 클릭 필요할 수 있음
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime

def main():
    if len(sys.argv) < 3:
        print("사용법: python hancom-batch-pdf.py <입력폴더> <출력폴더>")
        print("예시: python hancom-batch-pdf.py C:\\hwpx-files C:\\pdf-output")
        sys.exit(1)

    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    if not input_dir.exists():
        print(f"❌ 입력 폴더 없음: {input_dir}")
        sys.exit(1)

    # 파일 검색
    docs = []
    for ext in ('*.hwpx', '*.hwp'):
        docs.extend(input_dir.rglob(ext))
    docs = sorted(docs)

    if not docs:
        print(f"❌ HWPX/HWP 파일 없음: {input_dir}")
        sys.exit(1)

    print(f"📂 {len(docs)}개 문서 발견")
    print(f"📁 출력: {output_dir}")
    print()

    # pywin32 import
    try:
        import win32com.client
    except ImportError:
        print("❌ pywin32 필요! 설치:")
        print("   pip install pywin32")
        sys.exit(1)

    # 한/글 실행
    try:
        hwp = win32com.client.gencache.EnsureDispatch("HWPFrame.HwpObject")
    except Exception:
        try:
            hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
        except Exception as e:
            print(f"❌ 한/글 실행 실패: {e}")
            print("   한/글이 설치되어 있는지 확인하세요.")
            sys.exit(1)

    # 보안 모듈 등록 (자동 허용)
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except:
        pass

    try:
        hwp.XHwpWindows.Item(0).Visible = False
    except:
        pass

    results = []
    success = 0
    failed = 0
    start_all = time.time()

    for i, doc_path in enumerate(docs):
        rel = doc_path.relative_to(input_dir)
        pdf_path = output_dir / rel.with_suffix('.pdf')
        pdf_path.parent.mkdir(parents=True, exist_ok=True)

        start = time.time()
        try:
            # 파일 열기
            opened = hwp.Open(str(doc_path.resolve()), "HWP", "forceopen:true")
            if not opened:
                raise Exception("파일 열기 실패")

            # PDF로 저장
            hwp.HAction.GetDefault("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)
            hwp.HParameterSet.HFileOpenSave.filename = str(pdf_path.resolve())
            hwp.HParameterSet.HFileOpenSave.Format = "PDF"
            hwp.HAction.Execute("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)

            # 문서 닫기
            hwp.Clear(option=1)

            elapsed = int((time.time() - start) * 1000)
            size = pdf_path.stat().st_size if pdf_path.exists() else 0

            if pdf_path.exists() and size > 0:
                success += 1
                print(f"[{i+1}/{len(docs)}] ✅ {rel} ({elapsed}ms, {size:,}B)")
                results.append({"file": str(rel), "status": "ok", "size": size, "ms": elapsed})
            else:
                failed += 1
                print(f"[{i+1}/{len(docs)}] ⚠️ {rel} — PDF 생성됐지만 비어있음")
                results.append({"file": str(rel), "status": "empty", "ms": elapsed})

        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            failed += 1
            print(f"[{i+1}/{len(docs)}] ❌ {rel} — {e}")
            results.append({"file": str(rel), "status": "error", "error": str(e), "ms": elapsed})
            try:
                hwp.Clear(option=1)
            except:
                pass

    # 한/글 종료
    try:
        hwp.Quit()
    except:
        pass

    total_time = int(time.time() - start_all)

    # 결과 저장
    summary = {
        "generated": datetime.now().isoformat(),
        "input": str(input_dir),
        "output": str(output_dir),
        "total": len(docs),
        "success": success,
        "failed": failed,
        "time_seconds": total_time,
        "results": results
    }

    summary_path = output_dir / "conversion-summary.json"
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print()
    print("=" * 60)
    print(f"📊 완료: {success}/{len(docs)} 성공, {failed} 실패")
    print(f"⏱️  소요: {total_time}초")
    print(f"📝 요약: {summary_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
