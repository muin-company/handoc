# Changelog

## [0.2.0] - 2026-02-21

### ✨ Added (Level 4 완성)

- **페이지 뷰 모드**: A4 크기 페이지 단위 표시 (`viewMode="page"`)
- **연속 스크롤 모드**: 페이지 구분 없이 연속 표시 (`viewMode="continuous"`)
- **줌 컨트롤**: 50%~200% 확대/축소 기능
  - `zoom` prop으로 외부 제어
  - `showZoomControls` prop으로 UI 표시
  - `onZoomChange` 콜백으로 줌 변경 감지
- **도형 렌더링**: shape RunChild를 SVG로 변환
  - line, rect, ellipse 지원
  - 기본 스타일 속성 (stroke, fill, width, height)
- **수식 렌더링**: equation RunChild 표시
  - 기본 텍스트 형식으로 렌더링
  - 향후 KaTeX/MathJax 통합 가능

### 🧪 Tests

- 도형 렌더링 테스트 추가 (line, rect, ellipse, unknown)
- 수식 렌더링 테스트 추가
- HanDocViewer 컴포넌트 테스트 추가
  - 페이지/연속 모드 테스트
  - 줌 컨트롤 테스트
  - 전체 26개 테스트 통과

### 📦 Dependencies

- @testing-library/react ^16.3.2
- @testing-library/jest-dom ^6.9.1
- @testing-library/user-event ^14.6.1
- jsdom ^28.1.0

## [0.1.0] - Initial Release

### Added

- 기본 HWPX 렌더링 (텍스트, 문단, 스타일)
- 표 (테이블) 렌더링
- 이미지 표시
- React 컴포넌트 기반 아키텍처
