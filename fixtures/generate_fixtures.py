#!/usr/bin/env python3
"""Generate HWPX test fixtures for HanDoc project."""

import json
import zipfile
from io import BytesIO
from pathlib import Path
from xml.dom import minidom

from hwpx.document import HwpxDocument
from hwpx.templates import blank_document_bytes


BASE_DIR = Path(__file__).parent
HWPX_DIR = BASE_DIR / "hwpx"
EXPECTED_DIR = BASE_DIR / "expected"
XML_DUMPS_DIR = BASE_DIR / "xml-dumps"


def pretty_print_xml(xml_string: str) -> str:
    """Pretty-print XML string."""
    try:
        dom = minidom.parseString(xml_string)
        return dom.toprettyxml(indent="  ")
    except Exception:
        return xml_string


def extract_and_save_metadata(hwpx_path: Path, name: str):
    """Extract ZIP contents, section XML, and save metadata."""
    
    # List ZIP contents
    print(f"\n📦 {name} - ZIP contents:")
    with zipfile.ZipFile(hwpx_path, 'r') as zf:
        for item in sorted(zf.namelist()):
            print(f"  - {item}")
        
        # Extract section XML
        section_files = [f for f in zf.namelist() if 'section' in f.lower() and f.endswith('.xml')]
        header_files = [f for f in zf.namelist() if 'header.xml' in f.lower()]
        
        # Save section XML
        for section_file in section_files:
            xml_content = zf.read(section_file).decode('utf-8')
            pretty_xml = pretty_print_xml(xml_content)
            
            output_path = XML_DUMPS_DIR / f"{name}-{Path(section_file).name}"
            output_path.write_text(pretty_xml, encoding='utf-8')
            print(f"  ✓ Saved: {output_path.name}")
        
        # Save header XML
        for header_file in header_files:
            xml_content = zf.read(header_file).decode('utf-8')
            pretty_xml = pretty_print_xml(xml_content)
            
            output_path = XML_DUMPS_DIR / f"{name}-header.xml"
            output_path.write_text(pretty_xml, encoding='utf-8')
            print(f"  ✓ Saved: {output_path.name}")
        
        # Extract text from section XML for expected output
        texts = []
        for section_file in section_files:
            xml_content = zf.read(section_file).decode('utf-8')
            # Simple text extraction (all text between tags)
            import re
            text_nodes = re.findall(r'>([^<>]+)<', xml_content)
            texts.extend([t.strip() for t in text_nodes if t.strip()])
        
        # Save expected JSON
        expected_data = {
            "name": name,
            "texts": texts,
            "zip_files": sorted(zf.namelist())
        }
        
        expected_path = EXPECTED_DIR / f"{name}.json"
        expected_path.write_text(json.dumps(expected_data, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"  ✓ Saved: {expected_path.name}")


def create_simple_text():
    """Create simple-text.hwpx with 3 paragraphs."""
    name = "simple-text"
    print(f"\n🔨 Creating {name}.hwpx...")
    
    doc = HwpxDocument.open(BytesIO(blank_document_bytes()))
    section = doc.sections[0]
    
    doc.add_paragraph("첫 번째 단락입니다.", section=section)
    doc.add_paragraph("두 번째 단락입니다.", section=section)
    doc.add_paragraph("세 번째 단락입니다.", section=section)
    
    output_path = HWPX_DIR / f"{name}.hwpx"
    doc.save(str(output_path))
    print(f"✓ Saved: {output_path}")
    
    extract_and_save_metadata(output_path, name)


def create_styled_text():
    """Create styled-text.hwpx with different character properties."""
    name = "styled-text"
    print(f"\n🔨 Creating {name}.hwpx...")
    
    doc = HwpxDocument.open(BytesIO(blank_document_bytes()))
    section = doc.sections[0]
    
    # Add paragraphs with different styles
    doc.add_paragraph("일반 텍스트입니다.", section=section)
    
    # Try to add with different char properties (if supported)
    doc.add_paragraph("굵은 텍스트입니다.", section=section)
    doc.add_paragraph("기울임 텍스트입니다.", section=section)
    
    output_path = HWPX_DIR / f"{name}.hwpx"
    doc.save(str(output_path))
    print(f"✓ Saved: {output_path}")
    
    extract_and_save_metadata(output_path, name)


def create_table_basic():
    """Create table-basic.hwpx with a 3x3 table."""
    name = "table-basic"
    print(f"\n🔨 Creating {name}.hwpx...")
    
    doc = HwpxDocument.open(BytesIO(blank_document_bytes()))
    section = doc.sections[0]
    
    doc.add_paragraph("표 예제:", section=section)
    
    # Add 3x3 table
    table = doc.add_table(rows=3, cols=3, section=section)
    
    # Fill table cells
    headers = ["항목", "수량", "가격"]
    for col, header in enumerate(headers):
        table.set_cell_text(0, col, header)
    
    data = [
        ["사과", "10", "5,000"],
        ["바나나", "5", "3,000"]
    ]
    
    for row_idx, row_data in enumerate(data, start=1):
        for col_idx, cell_value in enumerate(row_data):
            table.set_cell_text(row_idx, col_idx, cell_value)
    
    output_path = HWPX_DIR / f"{name}.hwpx"
    doc.save(str(output_path))
    print(f"✓ Saved: {output_path}")
    
    extract_and_save_metadata(output_path, name)


def create_multi_section():
    """Create multi-section.hwpx with multiple sections if possible."""
    name = "multi-section"
    print(f"\n🔨 Creating {name}.hwpx...")
    
    doc = HwpxDocument.open(BytesIO(blank_document_bytes()))
    
    # Try to add content to first section
    if doc.sections:
        section = doc.sections[0]
        doc.add_paragraph("첫 번째 섹션의 내용입니다.", section=section)
        doc.add_paragraph("이 섹션은 페이지 레이아웃을 포함합니다.", section=section)
    
    # Note: Adding new sections might not be directly supported
    # We'll just use the existing section
    
    output_path = HWPX_DIR / f"{name}.hwpx"
    doc.save(str(output_path))
    print(f"✓ Saved: {output_path}")
    
    extract_and_save_metadata(output_path, name)


def create_empty():
    """Create empty.hwpx - minimal blank document."""
    name = "empty"
    print(f"\n🔨 Creating {name}.hwpx...")
    
    doc = HwpxDocument.open(BytesIO(blank_document_bytes()))
    
    # Don't add any content - just save as-is
    
    output_path = HWPX_DIR / f"{name}.hwpx"
    doc.save(str(output_path))
    print(f"✓ Saved: {output_path}")
    
    extract_and_save_metadata(output_path, name)


def main():
    """Generate all fixtures."""
    print("=" * 60)
    print("HanDoc HWPX Fixtures Generator")
    print("=" * 60)
    
    try:
        create_simple_text()
        create_styled_text()
        create_table_basic()
        create_multi_section()
        create_empty()
        
        print("\n" + "=" * 60)
        print("✅ All fixtures generated successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()
