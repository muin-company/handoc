# Level 3 Pre-Research: PDF Export 엔진 조사

> 2026-02-20 | HanDoc HWPX → PDF 변환 엔진 선정

## 1. 엔진 비교표

| 엔진 | 한글 폰트 | 표 렌더링 | 이미지 | 레이아웃 정밀도 | 서버사이드 | 라이선스 | 언어 |
|------|----------|----------|--------|---------------|-----------|---------|------|
| **Puppeteer/Playwright** | ✅ 완벽 (시스템 폰트) | ✅ CSS table | ✅ | ✅ mm 단위 가능 | ✅ (headless) | Apache-2.0 | JS/TS |
| **WeasyPrint** | ✅ 완벽 (시스템 폰트) | ✅ CSS table | ✅ | ✅ mm 단위 가능 | ✅ | BSD | Python |
| **Typst** | ✅ 시스템 폰트 사용 | ✅ 자체 테이블 | ✅ | ✅ 매우 정밀 | ✅ CLI | Apache-2.0 | Rust CLI |
| **pdfkit** | ⚠️ 폰트 임베딩 필요 | ❌ 직접 구현 | ✅ | ✅ pt 단위 | ✅ | MIT | JS/TS |
| **pdf-lib** | ⚠️ 폰트 임베딩 필요 | ❌ 직접 구현 | ✅ | ✅ pt 단위 | ✅ | MIT | JS/TS |
| **jsPDF** | ⚠️ 폰트 임베딩 필요 | ⚠️ 플러그인 | ✅ | ⚠️ 제한적 | ✅ | MIT | JS/TS |

## 2. 각 엔진 상세 분석

### Puppeteer/Playwright (HTML → PDF)
- **장점**: CSS/HTML로 레이아웃 → 가장 풍부한 표현력. 시스템 폰트 자동 사용으로 한글 완벽. `@page` CSS로 mm 단위 여백 설정. 표는 HTML `<table>` 그대로.
- **단점**: Chromium 의존 (~200MB). 렌더링 속도가 가장 느림 (페이지당 수백ms). 페이지 브레이크 제어가 완벽하지 않을 수 있음.
- **한글 폰트**: 시스템에 설치된 폰트 자동 인식. 맑은 고딕, 바탕 등 별도 설정 불필요.

### WeasyPrint (HTML/CSS → PDF)
- **장점**: CSS Paged Media 스펙 잘 지원. Chromium 불필요 (경량). 표/여백/페이지 레이아웃 정밀 제어. Python이지만 CLI로 호출 가능.
- **단점**: Python 의존성. Node.js에서 child_process로 호출해야 함. CSS 일부 고급 기능 미지원 (flexbox 등).
- **한글 폰트**: fontconfig 기반으로 시스템 폰트 자동 사용.

### Typst (마크업 → PDF)
- **장점**: 매우 빠름. 정밀한 타이포그래피. 자체 마크업 언어로 표/이미지/레이아웃 완벽 제어. CLI 단일 바이너리.
- **단점**: 자체 마크업 언어 학습 필요. document-model → Typst 마크업 변환 레이어 필요. 생태계가 아직 성장 중.
- **한글 폰트**: 시스템 폰트 자동 탐색. CJK 지원 양호.

### pdfkit / pdf-lib (저수준 PDF 생성)
- **장점**: Node.js 네이티브. 경량. PDF 바이트 수준 제어.
- **단점**: **표 렌더링을 직접 구현해야 함** (셀 좌표 계산, 텍스트 줄바꿈 등). 한글 폰트 .ttf 파일을 직접 로드/임베딩. 복잡한 레이아웃일수록 코드량 폭증.
- **결론**: HWPX의 복잡한 레이아웃(표, 다단, 각주 등)에는 **비현실적**.

### jsPDF
- **장점**: 브라우저/서버 양쪽 동작.
- **단점**: 한글 폰트 지원 번거로움 (Base64 인코딩 필요). 표 플러그인(autoTable) 품질 제한적. 복잡한 문서에 부적합.
- **결론**: 간단한 PDF에만 적합. HWPX 변환에는 **부적합**.

## 3. HWPX → PDF 변환 전략

### 전략 비교

| 전략 | 경로 | 장점 | 단점 |
|------|------|------|------|
| **A. HTML 중간 단계** | HWPX → document-model → HTML/CSS → PDF | HTML 렌더링 재사용, 시각 확인 가능 | 2단계 변환, CSS 한계 |
| **B. Typst 중간 단계** | HWPX → document-model → Typst → PDF | 정밀 레이아웃, 빠름 | Typst 마크업 생성 복잡 |
| **C. 직접 PDF 생성** | HWPX → document-model → PDF (pdfkit 등) | 의존성 최소 | 구현 난이도 극단적 |

### 추천: **전략 A - Puppeteer/Playwright (HTML → PDF)**

**이유:**

1. **HanDoc이 이미 HTML 렌더링을 Level 2에서 구현할 가능성 높음** → HTML 생성 코드 재사용
2. **한글 폰트 문제 제로** — 시스템 폰트 자동 사용
3. **표 렌더링 품질** — HTML `<table>` + CSS는 가장 성숙한 표 렌더링 기술
4. **디버깅 용이** — HTML을 브라우저에서 열어서 확인 가능
5. **CSS `@page`로 여백/페이지 크기 정밀 제어**:
   ```css
   @page {
     size: A4;
     margin: 20mm 15mm 20mm 15mm;
   }
   ```
6. **Node.js 생태계 네이티브** — Playwright는 TypeScript 프로젝트에 자연스럽게 통합

**구현 흐름:**
```
HWPX → parse → document-model → HTML/CSS 생성 → Playwright page.pdf() → PDF
```

**Playwright 선택 이유 (vs Puppeteer):**
- Microsoft 지원, 더 활발한 개발
- `page.pdf()` API 동일
- 다중 브라우저 지원 (Chromium 기본)
- HanDoc이 테스트에도 Playwright 사용 가능

## 4. 한컴오피스 렌더링 유사도 달성

완벽한 1:1 재현은 **불가능** (한컴의 렌더링 엔진은 비공개). 목표는 **90% 유사도**:

- **폰트 매핑**: HWPX 폰트명 → 시스템 폰트 매핑 테이블 (맑은 고딕, 바탕, 돋움 등)
- **여백/페이지 설정**: HWPX의 `<hp:pageMargin>` → CSS `@page` margin 변환
- **표 스타일**: HWPX 테이블 속성 → CSS border/padding/width 매핑
- **줄간격**: HWPX `lineSpacing` → CSS `line-height` 변환 (한컴 단위 → CSS 단위)

## 5. 최종 추천

### 🏆 Playwright (HTML → PDF)

| 항목 | 값 |
|------|-----|
| 엔진 | Playwright + Chromium headless |
| 경로 | document-model → HTML/CSS → `page.pdf()` |
| 한글 | ✅ 시스템 폰트 자동 |
| 표 | ✅ HTML table + CSS |
| 레이아웃 | ✅ CSS @page (mm 단위) |
| 속도 | ⚠️ 느림 (허용 가능) |
| 의존성 | Chromium (~150MB, 서버 1회 설치) |
| 라이선스 | Apache-2.0 |

**대안 (속도 중요시):** WeasyPrint — Chromium 없이 경량 PDF 생성. Python 의존성이 괜찮다면 좋은 선택.

**대안 (정밀 레이아웃):** Typst — 가장 정밀하지만, 자체 마크업 변환 레이어 구축 비용이 큼.
