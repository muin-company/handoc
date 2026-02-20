# Level 4 Pre-Research: Web Viewer 렌더링 엔진

> 2026-02-20 | HanDoc HWPX Web Viewer 접근법 조사

## 1. 브라우저 문서 뷰어 렌더링 접근법

### A. Canvas 기반 (PDF.js 스타일)
- **원리**: 문서를 파싱 → 레이아웃 엔진으로 좌표 계산 → Canvas 2D에 그리기
- **장점**: 픽셀 단위 정확한 렌더링, 브라우저 CSS 영향 없음, 인쇄 품질
- **단점**: 텍스트 선택/복사 어려움 (투명 텍스트 레이어 필요), 접근성 불리, 개발 비용 높음
- **사례**: PDF.js, Google Docs (Canvas 전환 완료)
- **HWPX 적합도**: ⭐⭐⭐ — 정확한 레이아웃이 필요하면 최종 목표. MVP에는 과도함

### B. DOM 기반 (HTML/CSS 렌더링)
- **원리**: HWPX 요소를 HTML 요소로 매핑, CSS로 스타일링
- **장점**: 구현 빠름, 텍스트 선택/복사 자연스러움, 접근성 우수, 반응형 가능
- **단점**: 브라우저 렌더링 차이, 정확한 페이지 분리 어려움, 복잡한 레이아웃 한계
- **사례**: OnlyOffice (내부적으로 DOM + 자체 레이아웃), Etherpad
- **HWPX 적합도**: ⭐⭐⭐⭐⭐ — MVP에 최적. HWPX가 이미 XML이므로 HTML 매핑 자연스러움

### C. WebGL 기반
- **원리**: GPU 가속으로 문서 렌더링
- **장점**: 고성능, 복잡한 그래픽 처리
- **단점**: 텍스트 렌더링 복잡, 폰트 래스터라이징 직접 구현, 과도한 복잡성
- **HWPX 적합도**: ⭐ — 문서 뷰어에는 과도함. 제외

### D. iframe + 서버사이드 PDF 변환
- **원리**: 서버에서 HWPX → PDF 변환, 브라우저에서 PDF 표시
- **장점**: 정확한 렌더링 (LibreOffice 등 활용), 클라이언트 부담 없음
- **단점**: 서버 의존, 변환 지연, 편집 불가, 인프라 비용
- **사례**: Google Docs Viewer (외부 문서), Collabora Online
- **HWPX 적합도**: ⭐⭐⭐ — 빠른 프리뷰용으로는 좋지만, HanDoc의 목표(클라이언트 사이드)와 불일치

## 2. 기존 웹 문서 뷰어 분석

| 뷰어 | 렌더링 방식 | 서버 의존 | 오픈소스 | 비고 |
|------|-----------|----------|---------|------|
| **Google Docs** | Canvas 2D | Yes | No | 2021년 DOM→Canvas 전환. 자체 레이아웃 엔진 |
| **MS Office Online** | Canvas + DOM 혼합 | Yes | No | 서버에서 렌더링 지시, 클라이언트에서 표시 |
| **Hancom Docs** | 서버 렌더링 + 이미지/Canvas | Yes | No | HWP 네이티브 지원하지만 서버 필수 |
| **OnlyOffice** | Canvas + 자체 레이아웃 | Optional | **Yes (AGPL)** | 가장 참고할 만한 오픈소스. 자체 JS 레이아웃 엔진 |
| **Collabora Online** | 서버(LibreOffice)→타일 이미지 | Yes | **Yes (MPL)** | 서버에서 렌더링, 클라이언트는 타일 조합만 |

### 핵심 인사이트
- **대형 업체들은 모두 Canvas로 수렴** — 정확한 레이아웃 제어 때문
- **하지만 모두 수년간의 투자 결과** — MVP에 적용 불가
- **OnlyOffice가 가장 참고 가치 높음** — 오픈소스, Canvas 기반, 자체 레이아웃 엔진

## 3. HWPX 렌더링 고려사항

### 한글 텍스트 레이아웃
- **자간(letter-spacing)**: CSS `letter-spacing`으로 대응 가능
- **행간(line-height)**: CSS `line-height`로 대응, 단 HWPX의 행간 계산 방식(% 기준)에 주의
- **줄바꿈**: 한글은 글자 단위 줄바꿈 (`word-break: break-all`), 영문은 단어 단위 → CSS로 충분히 대응
- **양쪽 정렬**: `text-align: justify` + `text-justify: inter-character`

### 페이지 분리
- **Paginated**: 인쇄 레이아웃 재현. `height` 고정 + `overflow: hidden` + 페이지별 div
- **Scroll (연속)**: 웹 친화적. MVP에 적합. 페이지 구분선만 표시
- **추천**: MVP는 scroll, 나중에 paginated 옵션 추가

### 표 렌더링
- **셀 병합**: HTML `<table>` + `colspan`/`rowspan`으로 자연스럽게 대응
- **테두리**: CSS `border` 속성으로 매핑. HWPX 테두리 스타일(실선, 점선 등) → CSS border-style
- **셀 크기**: HWPX의 고정 너비/높이 → CSS width/height
- **난이도**: 중간. HTML 테이블이 꽤 잘 대응함

### 이미지 배치
- **인라인**: `<img>` inline → 간단
- **자리 차지(block)**: `display: block` + margin
- **본문 위(floating)**: `position: absolute` — 가장 복잡. 좌표 계산 필요
- **추천**: MVP에서는 인라인/블록만 지원, floating은 후순위

### 성능 (100+ 페이지)
- **가상 스크롤링**: 화면에 보이는 페이지만 렌더링 (react-window 패턴)
- **지연 로딩**: 이미지/표 등 무거운 요소는 viewport 진입 시 렌더링
- **Web Worker**: HWPX 파싱을 별도 스레드에서 수행
- **추천**: MVP에서는 전체 렌더링 (20페이지 이하 대상), 이후 가상 스크롤링 추가

## 4. 추천 접근법

### 🏆 DOM 기반 (HTML/CSS) + React 컴포넌트

#### 왜 DOM 기반인가?
1. **HWPX와 자연스러운 매핑**: HWPX는 XML → HTML도 마크업 → 구조적 유사성 높음
2. **HanDoc Level 1-3의 파서 재활용**: 이미 HWPX 파싱 인프라가 있음
3. **MVP 속도**: Canvas 레이아웃 엔진 구축 대비 5-10x 빠른 개발
4. **텍스트 선택/접근성**: 무료로 얻음
5. **점진적 개선 가능**: DOM → Canvas 전환은 나중에 가능, 역방향은 어려움

#### 아키텍처

```
HWPX (ZIP)
  ↓ (HanDoc Level 1-2: 파싱)
HwpxDocument (AST)
  ↓ (Level 4: 렌더링)
React Components
  ↓
HTML/CSS (DOM)
```

#### 컴포넌트 구조 (React)

```tsx
<HwpxViewer document={doc} mode="scroll">
  <Page pageNum={1}>
    <Paragraph style={paraStyle}>
      <TextRun style={charStyle}>텍스트</TextRun>
    </Paragraph>
    <Table rows={rows} />
    <Image src={blob} position={pos} />
  </Page>
</HwpxViewer>
```

#### 제공 형태
- **npm 패키지**: `@handoc/viewer` (React 컴포넌트)
- **독립 실행형**: 번들된 HTML (CDN 가능)
- **서버 의존**: 없음 (클라이언트 사이드 전용)

#### 로드맵
| 단계 | 내용 | 비고 |
|------|------|------|
| 4.1 | 기본 텍스트/문단 렌더링 | 스타일 매핑 |
| 4.2 | 표 렌더링 | colspan/rowspan |
| 4.3 | 이미지 (인라인/블록) | Blob URL |
| 4.4 | 페이지 분리 모드 | paginated 옵션 |
| 4.5 | 성능 최적화 | 가상 스크롤링 |
| 4.6 | 고급 레이아웃 | floating 이미지, 다단 |

### 서버 변환 대안 (빠른 프리뷰용)
MVP 이전에 "즉시 프리뷰"가 필요하면:
- HanDoc Level 3 (HWPX → DOCX) + LibreOffice → PDF → PDF.js
- 서버 필요하지만 렌더링 품질 보장

## 5. 결론

| 기준 | 선택 |
|------|------|
| **렌더링 방식** | DOM 기반 (HTML/CSS) |
| **프레임워크** | React 컴포넌트 (`@handoc/viewer`) |
| **서버 의존** | 없음 (클라이언트 전용) |
| **페이지 모드** | Scroll (기본) → Paginated (옵션) |
| **MVP 범위** | 텍스트 + 문단 스타일 + 표 + 인라인 이미지 |
| **장기 목표** | Canvas 기반 전환 검토 (필요시) |

> **핵심 원칙**: 완벽한 렌더링보다 빠른 MVP. DOM으로 시작해서 80%를 빠르게 커버하고, 나머지 20%는 점진적으로.
