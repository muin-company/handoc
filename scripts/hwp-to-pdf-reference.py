#!/usr/bin/env python3
"""
한/글 → PDF 일괄 변환 스크립트 (Ground Truth 생성)

Windows에서 실행:
  pip install pywin32
  python hwp-to-pdf-reference.py --input ./fixtures --output ./reference-pdfs

Mac에서 실행 (한/글 for Mac 설치 필요):
  python hwp-to-pdf-reference.py --input ./fixtures --output ./reference-pdfs --mac

요구사항:
  - Windows: 한/글 설치 + pywin32
  - Mac: 한/글 for Mac 설치
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime


def find_documents(input_dir: str) -> list[Path]:
    """HWPX/HWP 파일 검색"""
    docs = []
    for ext in ('*.hwpx', '*.hwp'):
        docs.extend(Path(input_dir).rglob(ext))
    return sorted(docs)


def convert_windows(input_path: Path, output_path: Path) -> dict:
    """Windows 한/글 COM 자동화로 PDF 변환"""
    try:
        import win32com.client
    except ImportError:
        print("pip install pywin32 필요!")
        sys.exit(1)

    result = {"file": str(input_path), "status": "unknown", "time_ms": 0}
    start = time.time()

    try:
        hwp = win32com.client.gencache.EnsureDispatch("HWPFrame.HwpObject")
        hwp.XHwpWindows.Item(0).Visible = False  # 창 숨기기

        # 파일 열기
        hwp.Open(str(input_path.resolve()), "HWP", "forceopen:true")

        # PDF로 저장
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 한/글 PDF 저장 방식
        hwp.HAction.GetDefault("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)
        hwp.HParameterSet.HFileOpenSave.filename = str(output_path.resolve())
        hwp.HParameterSet.HFileOpenSave.Format = "PDF"
        hwp.HAction.Execute("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)

        hwp.Clear(option=1)  # 문서 닫기 (저장 안 함)

        result["status"] = "success"
        result["size"] = output_path.stat().st_size if output_path.exists() else 0

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)

    finally:
        result["time_ms"] = int((time.time() - start) * 1000)
        try:
            hwp.Quit()
        except:
            pass

    return result


def convert_windows_batch(input_dir: str, output_dir: str) -> list[dict]:
    """Windows 일괄 변환 (한/글 인스턴스 재사용)"""
    try:
        import win32com.client
    except ImportError:
        print("pip install pywin32 필요!")
        sys.exit(1)

    docs = find_documents(input_dir)
    print(f"📂 {len(docs)}개 문서 발견")

    results = []
    hwp = None

    try:
        hwp = win32com.client.gencache.EnsureDispatch("HWPFrame.HwpObject")
        hwp.XHwpWindows.Item(0).Visible = False
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")  # 보안 모듈 우회

        for i, doc_path in enumerate(docs):
            # 출력 경로 계산 (입력 디렉토리 구조 유지)
            rel = doc_path.relative_to(input_dir)
            pdf_path = Path(output_dir) / rel.with_suffix('.pdf')
            pdf_path.parent.mkdir(parents=True, exist_ok=True)

            result = {
                "file": str(rel),
                "status": "unknown",
                "time_ms": 0
            }
            start = time.time()

            try:
                # 파일 열기
                if not hwp.Open(str(doc_path.resolve()), "HWP", "forceopen:true"):
                    result["status"] = "open_failed"
                    results.append(result)
                    continue

                # PDF 저장
                hwp.HAction.GetDefault("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)
                hwp.HParameterSet.HFileOpenSave.filename = str(pdf_path.resolve())
                hwp.HParameterSet.HFileOpenSave.Format = "PDF"
                hwp.HAction.Execute("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)

                hwp.Clear(option=1)

                result["status"] = "success"
                result["size"] = pdf_path.stat().st_size if pdf_path.exists() else 0

            except Exception as e:
                result["status"] = "error"
                result["error"] = str(e)
                try:
                    hwp.Clear(option=1)
                except:
                    pass

            result["time_ms"] = int((time.time() - start) * 1000)
            results.append(result)

            # 진행률
            status_icon = "✅" if result["status"] == "success" else "❌"
            print(f"[{i+1}/{len(docs)}] {status_icon} {rel} ({result['time_ms']}ms)")

    finally:
        if hwp:
            try:
                hwp.Quit()
            except:
                pass

    return results


def convert_mac_applescript(input_path: Path, output_path: Path) -> dict:
    """Mac 한/글 AppleScript로 PDF 변환"""
    import subprocess

    result = {"file": str(input_path), "status": "unknown", "time_ms": 0}
    start = time.time()

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # AppleScript로 한/글 제어 시도
    script = f'''
    tell application "Hancom Word"
        open POSIX file "{input_path.resolve()}"
        delay 2
        tell application "System Events"
            keystroke "p" using command down
            delay 1
            -- PDF 드롭다운 선택
            click menu button "PDF" of sheet 1 of window 1 of process "Hancom Word"
            delay 0.5
            click menu item "Save as PDF…" of menu 1 of menu button "PDF" of sheet 1 of window 1 of process "Hancom Word"
            delay 1
            -- 파일명 입력
            keystroke "a" using command down
            keystroke "{output_path.resolve()}"
            keystroke return
            delay 2
        end tell
        close front document saving no
    end tell
    '''

    try:
        subprocess.run(
            ['osascript', '-e', script],
            capture_output=True, text=True, timeout=30
        )
        if output_path.exists():
            result["status"] = "success"
            result["size"] = output_path.stat().st_size
        else:
            result["status"] = "error"
            result["error"] = "PDF not created"
    except subprocess.TimeoutExpired:
        result["status"] = "timeout"
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)

    result["time_ms"] = int((time.time() - start) * 1000)
    return result


def main():
    parser = argparse.ArgumentParser(description="한/글 → PDF 레퍼런스 생성")
    parser.add_argument("--input", required=True, help="HWPX/HWP 파일 디렉토리")
    parser.add_argument("--output", required=True, help="PDF 출력 디렉토리")
    parser.add_argument("--mac", action="store_true", help="Mac 모드 (AppleScript)")
    parser.add_argument("--limit", type=int, help="변환할 최대 파일 수")
    args = parser.parse_args()

    docs = find_documents(args.input)
    if args.limit:
        docs = docs[:args.limit]

    print(f"🔍 {len(docs)}개 문서 발견 (input: {args.input})")
    print(f"📁 출력: {args.output}")
    print(f"🖥️  모드: {'Mac (AppleScript)' if args.mac else 'Windows (COM)'}")
    print()

    if sys.platform == 'win32' and not args.mac:
        results = convert_windows_batch(args.input, args.output)
    else:
        # Mac or fallback: one by one
        results = []
        for i, doc in enumerate(docs):
            rel = doc.relative_to(args.input)
            pdf_path = Path(args.output) / rel.with_suffix('.pdf')

            if args.mac:
                r = convert_mac_applescript(doc, pdf_path)
            else:
                print(f"❌ Windows가 아닌 환경에서 --mac 없이 실행됨")
                sys.exit(1)

            r["file"] = str(rel)
            results.append(r)

            status_icon = "✅" if r["status"] == "success" else "❌"
            print(f"[{i+1}/{len(docs)}] {status_icon} {rel} ({r['time_ms']}ms)")

    # 결과 저장
    summary = {
        "generated": datetime.now().isoformat(),
        "platform": sys.platform,
        "total": len(results),
        "success": sum(1 for r in results if r["status"] == "success"),
        "failed": sum(1 for r in results if r["status"] != "success"),
        "results": results
    }

    summary_path = Path(args.output) / "reference-summary.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print()
    print(f"{'='*60}")
    print(f"📊 결과: {summary['success']}/{summary['total']} 성공")
    print(f"📝 요약: {summary_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
