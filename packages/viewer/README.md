# @handoc/viewer

React 컴포넌트 기반 HWPX 뷰어입니다. 브라우저에서 100% 클라이언트 사이드로 HWPX 문서를 렌더링합니다.

## 기능

✅ **기본 렌더링**
- 텍스트 및 문단 스타일 (폰트, 색상, 크기, 정렬)
- 표 (테이블) 렌더링
- 이미지 표시
- 페이지 레이아웃

✅ **Level 4 완성 기능** (2026-02-21)
- 📄 **페이지 뷰 모드**: A4 크기 페이지 단위로 표시
- 📜 **연속 스크롤 모드**: 페이지 구분 없이 연속 표시
- 🔍 **줌 컨트롤**: 50%~200% 확대/축소
- 🔷 **도형 렌더링**: line, rect, ellipse를 SVG로 렌더링
- 🔢 **수식 렌더링**: equation 요소 표시 (기본 텍스트 형식)

## 설치

```bash
pnpm add @handoc/viewer
```

## 사용법

### 기본 사용

```tsx
import { HanDocViewer } from '@handoc/viewer';
import '@handoc/viewer/dist/styles.css';

function App() {
  const [buffer, setBuffer] = useState<Uint8Array | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      setBuffer(new Uint8Array(arrayBuffer));
    }
  };

  return (
    <div>
      <input type="file" accept=".hwpx" onChange={handleFileSelect} />
      {buffer && <HanDocViewer buffer={buffer} />}
    </div>
  );
}
```

### 페이지 뷰 vs 연속 스크롤

```tsx
// 페이지 뷰 모드 (기본)
<HanDocViewer buffer={buffer} viewMode="page" />

// 연속 스크롤 모드
<HanDocViewer buffer={buffer} viewMode="continuous" />
```

### 줌 컨트롤

```tsx
// 줌 컨트롤 표시
<HanDocViewer 
  buffer={buffer} 
  showZoomControls 
/>

// 외부에서 줌 제어
const [zoom, setZoom] = useState(100);

<HanDocViewer 
  buffer={buffer} 
  zoom={zoom}
  onZoomChange={setZoom}
  showZoomControls
/>
```

### 전체 옵션

```tsx
<HanDocViewer
  buffer={buffer}              // HWPX 파일의 Uint8Array
  className="custom-viewer"    // 커스텀 CSS 클래스
  viewMode="page"              // 'page' | 'continuous'
  zoom={100}                   // 50~200 (퍼센트)
  showZoomControls={true}      // 줌 컨트롤 UI 표시
  onZoomChange={(z) => {...}}  // 줌 변경 콜백
/>
```

## API

### HanDocViewerProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `buffer` | `Uint8Array` | *required* | HWPX 파일의 바이너리 데이터 |
| `className` | `string` | `undefined` | 추가 CSS 클래스 |
| `viewMode` | `'page' \| 'continuous'` | `'page'` | 뷰 모드 |
| `zoom` | `number` | `100` | 줌 레벨 (50~200) |
| `showZoomControls` | `boolean` | `false` | 줌 컨트롤 UI 표시 여부 |
| `onZoomChange` | `(zoom: number) => void` | `undefined` | 줌 변경 시 콜백 |

## CSS 커스터마이징

```css
/* 페이지 배경 색상 */
.handoc-viewer {
  background: #f0f0f0;
}

/* 페이지 크기 조정 */
.handoc-page {
  width: 210mm;
  min-height: 297mm;
}

/* 연속 모드에서 페이지 구분선 */
.handoc-continuous .handoc-page {
  border-bottom: 2px dashed #999;
}

/* 줌 컨트롤 스타일 */
.handoc-controls {
  background: #fff;
  border-radius: 8px;
}
```

## 개발

```bash
# 빌드
pnpm build

# 테스트
pnpm test

# 개발 모드
pnpm dev
```

## 라이선스

MIT
