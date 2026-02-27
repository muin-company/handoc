# HanDoc Line Height Analysis (2026-02-27)

## 발견 사항

### 한/글의 줄 높이 계산 공식
```
lineHeight = fontSize × winEmRatio × lineSpacing%
```
- `winEmRatio` = (usWinAscent + usWinDescent) / unitsPerEm
- HCR Batang: (1070 + 230) / 1000 = **1.3**
- AppleMyungjo: OS/2 테이블 없음 (별도 계산 필요)

### 현재 HanDoc의 공식
```
lineHeight = fontSize × 1.03 × lineSpacing%
```

### 오차 (160% 줄간격, 10pt 기준)
| | 한/글 | HanDoc | 차이 |
|---|---|---|---|
| **공식** | 10 × 1.3 × 1.6 = 20.8pt | 10 × 1.03 × 1.6 = 16.48pt | -4.32pt (21%) |
| **40줄 기준** | 832pt 사용 | 659pt 사용 | -173pt (21%) |
| **A4 본문 영역** | ~780pt | ~780pt | - |
| **줄 수** | 37.5줄 | 47.3줄 | +26% |

### 결론
- HanDoc이 **한 페이지에 26% 더 많은 줄**을 넣고 있음
- 이것이 HWPX F등급의 **페이지 부족** (underflow)의 직접 원인
- 대형 문서(300+페이지)에서 -10% 페이지 손실 = 이 오차의 누적

## 왜 지금까지 발견 못 했나

1. Apple 폰트의 **넓은 글자 폭** 때문에 텍스트 wrapping이 더 많이 발생 → 줄 수 증가 → 줄 높이 부족 일부 상쇄
2. HCR 폰트로 바꿔도 한글 글자 폭 차이가 3%밖에 안 됨 → wrapping 차이 미미
3. `* 1.03`에서 `* 1.0`으로 바꿨을 때 **SSIM이 하락한 이유**: 줄 높이를 더 줄이면 텍스트가 더 조밀해져서 레퍼런스와의 시각적 유사도가 떨어짐 (텍스트 위치가 틀어짐)

## 해결 방안

### 방안 1: emRatio 1.3 적용
```typescript
return fontSize * (ps.lineSpacingValue / 100) * 1.3;
```
- 한/글과 동일한 줄 높이
- **위험**: 기존 대비 26% 줄 높이 증가 → 페이지 수 대폭 증가 → HWP 파일 상황 악화 가능
- **검증 필요**: 소수 파일 테스트 후 전체 비교

### 방안 2: 폰트별 emRatio 자동 계산
```typescript
const emRatio = (font.heightAtSize(1) / 1); // pdf-lib의 실제 메트릭 사용
return fontSize * emRatio * (ps.lineSpacingValue / 100);
```
- 폰트가 바뀌어도 자동 적응
- **가장 정확한 접근**

### 방안 3: HCR 폰트 전용 최적화
- HCR 폰트 감지 시: emRatio = 1.3
- Apple 폰트 시: emRatio = 1.03 (현재)
- 하지만 이중 로직은 유지보수 복잡

## 추천: 방안 2
폰트의 실제 height 메트릭을 사용하여 emRatio를 자동 계산. 폰트 독립적이며 가장 정확.
