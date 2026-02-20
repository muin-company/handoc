# HanDoc Test Fixtures

HanDoc 프로젝트의 테스트 픽스처 모음입니다. 다양한 HWPX 문서 구조를 테스트하기 위한 샘플 파일들을 포함합니다.

## 📁 디렉토리 구조

```
handoc-fixtures/
├── hwpx/               # HWPX 테스트 파일들
├── expected/           # 각 픽스처의 예상 출력 (JSON)
├── xml-dumps/          # 각 픽스처의 XML 구조 덤프
└── generate_fixtures.py # 픽스처 생성 스크립트
```

## 📄 픽스처 목록

### 1. `simple-text.hwpx` (7.2KB)
**설명:** 기본적인 텍스트 3단락으로 구성된 간단한 문서

**내용:**
- 첫 번째 단락입니다.
- 두 번째 단락입니다.
- 세 번째 단락입니다.

**용도:** 기본 텍스트 추출 및 단락 파싱 테스트

---

### 2. `styled-text.hwpx` (7.3KB)
**설명:** 서로 다른 문자 속성(charPrIDRef)을 사용하는 문서

**내용:**
- 일반 텍스트입니다.
- 굵은 텍스트입니다.
- 기울임 텍스트입니다.

**용도:** 문자 스타일 및 서식 처리 테스트

---

### 3. `table-basic.hwpx` (7.7KB)
**설명:** 3×3 표를 포함한 문서

**내용:**
- 표 예제 텍스트
- 3×3 표:
  - 헤더: 항목, 수량, 가격
  - 데이터: 사과(10개, 5,000원), 바나나(5개, 3,000원)

**용도:** 표 구조 파싱 및 셀 데이터 추출 테스트

---

### 4. `multi-section.hwpx` (7.3KB)
**설명:** 섹션 정보를 포함한 문서

**내용:**
- 첫 번째 섹션의 내용입니다.
- 이 섹션은 페이지 레이아웃을 포함합니다.

**용도:** 섹션 및 페이지 레이아웃 파싱 테스트
**참고:** python-hwpx는 새 섹션 추가를 직접 지원하지 않아, 기존 섹션에 내용 추가

---

### 5. `empty.hwpx` (7.3KB)
**설명:** 내용이 없는 빈 문서 (Skeleton.hwpx 기반)

**내용:**
- (빈 문서)

**용도:** 
- 최소 HWPX 구조 검증
- 빈 문서 처리 엣지 케이스 테스트
- HWPX 포맷의 기본 구조 분석

---

## 🔧 픽스처 재생성

픽스처를 다시 생성하려면:

```bash
cd /Users/mj/clawd/research/handoc-fixtures
python3 generate_fixtures.py
```

**요구사항:**
- Python 3.8+
- python-hwpx (`pip install python-hwpx`)

## 📦 HWPX 파일 구조

모든 HWPX 파일은 다음과 같은 ZIP 구조를 가집니다:

```
example.hwpx (ZIP)
├── mimetype
├── version.xml
├── settings.xml
├── META-INF/
│   ├── container.xml
│   ├── container.rdf
│   └── manifest.xml
├── Contents/
│   ├── content.hpf
│   ├── header.xml       # 문서 메타데이터, 스타일, 속성
│   └── section0.xml     # 실제 본문 내용
└── Preview/
    ├── PrvImage.png
    └── PrvText.txt
```

### 주요 XML 파일

- **`header.xml`**: 문서 전체의 메타데이터, 스타일 정의, 문자/단락 속성
- **`section0.xml`**: 본문 내용 (단락, 표, 이미지 등)

## 🧪 테스트 활용 예시

### 텍스트 추출 검증

```python
from hwp_parser import parse_document

doc = parse_document("hwpx/simple-text.hwpx")
text = doc.extract_text()

# expected/simple-text.json과 비교
import json
expected = json.load(open("expected/simple-text.json"))
assert text in expected["texts"]
```

### 표 데이터 검증

```python
doc = parse_document("hwpx/table-basic.hwpx")

for table in doc.tables:
    data = table.to_list()
    assert data[0] == ["항목", "수량", "가격"]
    assert data[1] == ["사과", "10", "5,000"]
```

## 🚧 HWP 5.x 샘플 (미완료)

**상태:** 수집 실패

**이유:**
- 공공데이터포털 API 키 없음
- 정부 사이트 직접 크롤링 제한
- python-hwpx는 HWP 5.x 생성 미지원

**대안:**
- 실제 HWP 파일은 수동으로 수집 필요
- 또는 한컴 오피스로 직접 생성 후 추가

## 📊 파일 크기 요약

| 파일 | 크기 | 단락 수 | 표 | 특징 |
|------|------|---------|-----|------|
| `simple-text.hwpx` | 7.2KB | 3 | 0 | 기본 텍스트 |
| `styled-text.hwpx` | 7.3KB | 3 | 0 | 스타일 적용 |
| `table-basic.hwpx` | 7.7KB | 1 | 1 (3×3) | 표 포함 |
| `multi-section.hwpx` | 7.3KB | 2 | 0 | 섹션 레이아웃 |
| `empty.hwpx` | 7.3KB | 0 | 0 | 빈 문서 |

## 📝 Notes

- 모든 픽스처는 `python-hwpx` 라이브러리로 생성됨
- XML 덤프는 가독성을 위해 pretty-print 처리됨
- 예상 출력(expected)은 간단한 정규식 기반 텍스트 추출로 생성됨

---

**생성일:** 2026-02-20  
**생성 도구:** python-hwpx v0.1.x  
**생성자:** MJ (Subagent for HanDoc project)
