# HanDoc 레이아웃 스펙 분석

> 한/글 (HWP 5.0) 공식 스펙 + hwp.js (Apache-2.0) 소스 분석 기반
> 작성일: 2026-02-28

---

## 단위 체계

| 자료형 | 크기 | 설명 |
|--------|------|------|
| **HWPUNIT** | 4 bytes (UINT32) | 1/7200 inch. 한/글의 기본 크기 단위 |
| **SHWPUNIT** | 4 bytes (INT32) | signed 1/7200 inch |
| **HWPUNIT16** | 2 bytes (INT16) | signed 1/7200 inch (16bit) |

**변환 공식:**
```
1 HWPUNIT = 1/7200 inch
1 pt = 7200/72 = 100 HWPUNIT
1 inch = 7200 HWPUNIT
hwpToPoint(v) = v / 100
hwpToInch(v) = v / 7200
```

---

## 1. 줄바꿈 규칙 (Line Breaking)

### 1.1 스펙 필드

**ParaShape (HWPTAG_PARA_SHAPE)** 속성1(표 44):

| bit | 필드 | 값 | 설명 |
|-----|------|-----|------|
| 5-6 | 줄 나눔 기준 (영어 단위) | 0=단어, 1=하이픈, 2=글자 | 영어 텍스트 줄바꿈 단위 |
| 7 | 줄 나눔 기준 (한글 단위) | 0=어절, 1=글자 | 한글 텍스트 줄바꿈 단위 |

**HWPX (ParaPr) 대응 필드:**
```xml
<hp:breakSetting breakLatinWord="WORD|HYPHEN|CHAR"
                 breakNonLatinWord="WORD|CHAR"
                 widowOrphan="true|false"
                 keepWithNext="true|false"
                 keepLines="true|false"
                 pageBreakBefore="true|false"
                 lineWrap="..." />
```

### 1.2 CJK 금칙처리 (Kinsoku)

한/글은 유니코드 UAX#14 Line Breaking Algorithm과 유사하지만 독자적 규칙을 적용:

**행두 금칙 문자 (줄 시작에 올 수 없는 문자):**
```
) ] } 〉 》 」 』 】 〕 〗 〙 〛
. , ; : ? ! ‼ ⁇ ⁈ ⁉
、 。 ， ．
ー ぁ ぃ ぅ ぇ ぉ っ ゃ ゅ ょ ゎ ゕ ゖ
ァ ィ ゥ ェ ォ ッ ャ ュ ョ ヮ ヵ ヶ
% ‰
```

**행말 금칙 문자 (줄 끝에 올 수 없는 문자):**
```
( [ { 〈 《 「 『 【 〔 〖 〘 〚
₩ $ \ #
```

### 1.3 한글 줄바꿈 규칙

- **어절 단위** (기본값): 공백/탭 위치에서만 줄바꿈
- **글자 단위**: CJK 문자 사이 어디서든 줄바꿈 가능 (금칙 문자 제외)
- CJK 문자는 기본적으로 **글자 단위** 줄바꿈 허용 (CSS의 `word-break: break-all`과 유사)
- 한글 조사와 어미는 앞 글자와 분리 가능 (어절 모드에서도)

### 1.4 구현 시 주의사항

1. 한/글의 금칙처리 목록은 유니코드 표준과 다름 — 한글 맞춤법 기반
2. `breakNonLatinWord="WORD"`(어절)에서도 CJK 전각 문자 사이는 줄바꿈 허용
3. 하이픈 모드는 한/글 내장 하이픈 사전 사용 — 외부 구현 시 근사값 사용 불가피
4. **외톨이줄 보호** (widow/orphan): 문단 첫 줄만 페이지 끝에 남거나, 마지막 줄만 다음 페이지에 가는 것을 방지

---

## 2. 자폭 축소 — 장평 (Condense / Ratio)

### 2.1 스펙 필드

**CharShape (HWPTAG_CHAR_SHAPE)** 표 33:

| 필드 | 자료형 | 설명 |
|------|--------|------|
| 언어별 장평 | UINT8 array[7] | 50%~200%, 언어별 (한글/영어/한자/일어/기타/기호/사용자) |
| 언어별 자간 | INT8 array[7] | -50%~50% |
| 언어별 상대 크기 | UINT8 array[7] | 10%~250% |

**HWPX 대응:**
```xml
<hc:charPr>
  <hc:ratio hangul="100" latin="100" hanja="100" ... />
  <hc:spacing hangul="0" latin="0" hanja="0" ... />
  <hc:relSz hangul="100" latin="100" hanja="100" ... />
</hc:charPr>
```

### 2.2 계산 공식

```
실제 글자 폭 = 원본 글자 폭 × (장평 / 100)
```

- 장평 100% = 정상 폭
- 장평 80% = 가로로 20% 좁게 (세로는 변화 없음)
- 장평 120% = 가로로 20% 넓게

**hwp.js에서의 구현** (viewer.ts):
```typescript
const fontSize = fontBaseSize * (fontRatio[0] / 100)
```
주의: hwp.js는 `fontRatio`를 단순히 fontSize에 곱하지만, 실제로는 **가로 스케일링**이어야 함.

### 2.3 정확한 렌더링

장평은 **가로 방향만** 스케일하는 변환:
```
CSS: transform: scaleX(ratio / 100)
또는
canvas: ctx.scale(ratio / 100, 1.0)
```

PDF에서:
```
Tz (ratio) % — Text horizontal scaling operator
```

### 2.4 Condense (ParaPr의 condense)

ParaPr에도 `condense` 속성이 있음 — 이것은 문단 전체의 가로 축소율:
```
문단 전체 텍스트 폭 = 원래 폭 × (condense / 100)
```

이 값은 양쪽 정렬 시 줄의 텍스트를 줄 폭에 맞추기 위해 사용될 수 있음.

### 2.5 구현 시 주의사항

1. 장평은 **글자별 폭만** 변경, 높이는 유지
2. 언어별로 다른 장평 값 가능 — 한글 80%, 영어 100% 등
3. `fontBaseSize`는 HWP에서 **100배 값**으로 저장 (10pt → 1000). hwp.js: `fontBaseSize / 100`
4. 장평과 자간은 **독립적**으로 적용: `최종폭 = 글자폭 × (장평/100) + 자간값`

---

## 3. 행간 (Line Spacing)

### 3.1 스펙 필드

**ParaShape (HWPTAG_PARA_SHAPE)** 표 43:

| 필드 | 자료형 | 설명 |
|------|--------|------|
| 줄 간격 (구버전) | INT32 | 5.0.2.5 미만에서 사용 |
| 줄 간격 (신버전) | UINT32 | 5.0.2.5 이상에서 사용 |

**줄 간격 종류** (속성3, bit 0-4) 표 46:

| 값 | 종류 | 설명 |
|----|------|------|
| 0 | **글자에 따라 (percent)** | 글꼴 크기에 대한 비율 |
| 1 | **고정값 (fixed)** | HWPUNIT 절대값 |
| 2 | **여백만 지정 (betweenLines)** | 줄 사이 여백만 지정 |
| 3 | **최소 (atLeast)** | 최소 줄 높이 보장 |

**HWPX 대응:**
```xml
<hp:lineSpacing type="PERCENT|FIXED|BETWEEN_LINES|AT_LEAST"
                value="160" unit="hwpunit" />
```

### 3.2 계산 공식

#### Type 0: 글자에 따라 (Percent) — 기본값, 가장 흔함

```
줄 높이 = fontSize × emRatio × (lineSpacingValue / 100)
```

여기서:
- `fontSize` = 기준 크기 (pt)
- `emRatio` = 폰트의 em ratio = (usWinAscent + usWinDescent) / unitsPerEm
- `lineSpacingValue` = 줄간격 값 (예: 160 = 160%)

**emRatio 예시:**
| 폰트 | usWinAscent | usWinDescent | unitsPerEm | emRatio |
|-------|-------------|--------------|------------|---------|
| HCR Batang | 1070 | 230 | 1000 | **1.30** |
| 함초롬바탕 | 880 | 120 | 1000 | **1.00** |
| 맑은 고딕 | 2167 | 655 | 2048 | **1.38** |

**중요**: "글꼴에 어울리는 줄 높이" (속성1 bit 22) 플래그:
- **on** (기본): emRatio 사용 — 폰트 메트릭 기반
- **off**: emRatio를 1.0으로 취급 — `줄 높이 = fontSize × lineSpacingValue / 100`

#### Type 1: 고정값 (Fixed)

```
줄 높이 = lineSpacingValue (HWPUNIT) → pt로 변환: lineSpacingValue / 100
```

텍스트가 줄 높이보다 커도 잘리거나 겹침.

#### Type 2: 여백만 지정 (Between Lines)

```
줄 높이 = 텍스트 높이 + lineSpacingValue (HWPUNIT→pt)
```

줄 간의 빈 공간만 지정. 텍스트 높이는 해당 줄에서 가장 큰 글자의 높이.

#### Type 3: 최소 (AtLeast)

```
줄 높이 = max(lineSpacingValue (HWPUNIT→pt), 텍스트 높이)
```

lineSpacingValue보다 텍스트가 크면 텍스트에 맞춤.

### 3.3 HWP 파일의 PARA_LINE_SEG에 이미 계산된 값

HWP 파일의 `HWPTAG_PARA_LINE_SEG` (표 62)에는 **이미 한/글이 계산한 레이아웃 결과**가 저장됨:

| 필드 | 크기 | 설명 |
|------|------|------|
| start | UINT32 | 텍스트 시작 위치 |
| y | INT32 | 줄의 세로 위치 (HWPUNIT) |
| height | INT32 | 줄의 높이 (HWPUNIT) |
| textHeight | INT32 | 텍스트 부분의 높이 (HWPUNIT) |
| baseLineGap | INT32 | 세로 위치에서 baseline까지 거리 (HWPUNIT) |
| lineSpacing | INT32 | 줄간격 (HWPUNIT) |
| startByte | INT32 | 컬럼에서의 시작 위치 |
| width | INT32 | 세그먼트의 폭 (HWPUNIT) |

**핵심**: HWP(바이너리) 파일을 처리할 때는 이 값들을 직접 사용 가능. HWPX(XML)에서는 이 캐시가 없으므로 직접 계산해야 함.

### 3.4 구현 시 주의사항

1. **emRatio가 핵심** — 폰트마다 다른 값. OS/2 테이블의 usWinAscent/usWinDescent에서 가져와야 함
2. HanDoc의 기존 `* 1.03` 상수는 심각한 오차 (21%). 폰트별 emRatio 자동 계산 필요
3. **"글꼴에 어울리는 줄 높이" 플래그** 확인 필수 — off면 emRatio 무시
4. 같은 줄에 여러 크기의 글자가 있으면, 가장 큰 높이 기준
5. HWPX의 lineSpacing value가 HWPUNIT인지 %인지 type에 따라 다름
6. 구버전(5.0.2.5 미만)과 신버전의 줄간격 저장 위치가 다름 — 두 필드 모두 체크

---

## 4. 자간 (Character Spacing)

### 4.1 스펙 필드

**CharShape** 표 33:

| 필드 | 자료형 | 범위 | 설명 |
|------|--------|------|------|
| 언어별 자간 | INT8 array[7] | -50 ~ 50 | **퍼센트** 값 (% of fontSize) |

**HWPX:**
```xml
<hc:spacing hangul="-5" latin="0" ... />
```

### 4.2 계산 공식

```
추가 자간 = fontSize × (spacing / 100)
글자 간 거리 = 글자폭 + 추가 자간
```

예시:
- fontSize = 10pt, spacing = -5 → 추가 자간 = 10 × (-5/100) = -0.5pt
- fontSize = 10pt, spacing = 10 → 추가 자간 = 10 × (10/100) = 1.0pt

**주의**: HWP5 스펙에서 자간은 **INT8 (바이트)**로, 값 자체가 퍼센트. HWPUNIT이 아님.

### 4.3 HWPX에서의 자간

HWPX의 `<hc:spacing>` 값도 **퍼센트** (-50 ~ 50):
```
자간(pt) = fontSize(pt) × spacing / 100
```

### 4.4 구현 시 주의사항

1. 자간 값은 HWPUNIT이 **아니라** 퍼센트 — fontSize 기반 상대값
2. 언어별로 다른 자간 가능
3. 자간과 장평은 **독립적**: 장평은 글자 자체 폭 변경, 자간은 글자 사이 간격 추가
4. CSS 대응: `letter-spacing: ${fontSize * spacing / 100}pt`
5. 마지막 글자 뒤에는 자간 추가하지 않음 (줄의 마지막 글자)

---

## 5. 양쪽 정렬 (Justify)

### 5.1 스펙 필드

**ParaShape** 속성1 bit 2-4:

| 값 | 정렬 방식 | 설명 |
|----|-----------|------|
| 0 | **양쪽 정렬 (justify)** | 마지막 줄 제외, 양쪽 맞춤 |
| 1 | 왼쪽 정렬 | |
| 2 | 오른쪽 정렬 | |
| 3 | 가운데 정렬 | |
| 4 | **배분 정렬 (distribute)** | 마지막 줄 포함, 균등 분배 |
| 5 | **나눔 정렬** | 글자 단위 균등 분배 |

### 5.2 양쪽 정렬 (Justify) 알고리즘

한/글의 양쪽 정렬은 다음 순서로 여분 공간을 분배:

#### Step 1: 여분 공간 계산
```
extraSpace = lineWidth - sumOfGlyphWidths - sumOfBaseSpaces
```

#### Step 2: 공백 우선 분배

여분 공간을 **공백 문자**에 우선 분배:
```
각 공백 추가폭 = extraSpace / numberOfSpaces
```

한/글은 공백 문자에만 여분을 분배하고, CJK 문자 사이 자간은 변경하지 않음.

#### Step 3: 공백이 부족한 경우

CJK 텍스트처럼 공백이 거의 없는 경우:
- 모든 글자 사이에 균등하게 분배
- `추가 자간 = extraSpace / (charCount - 1)`

### 5.3 배분 정렬 (Distribute)

마지막 줄을 포함하여 모든 줄을 양쪽 맞춤:
```
모든 줄: 글자 간격을 균등 분배하여 lineWidth에 맞춤
```

### 5.4 나눔 정렬

글자 단위로 균등 분배 — 모든 글자가 동일한 간격:
```
글자간 거리 = lineWidth / charCount  (대략적)
```

### 5.5 공백 최소값

속성1 bit 9-15: **공백 최소값** (0% ~ 75%)
- 양쪽 정렬 시 공백이 이 비율 이하로 줄어들지 않도록 보호
- 예: 50% → 공백이 원래 폭의 50% 이하로 축소되지 않음

### 5.6 구현 시 주의사항

1. **한/글은 공백 기반** — CSS의 `text-align: justify`와 유사하지만, CJK 텍스트에서는 글자 간 분배도 수행
2. 마지막 줄은 양쪽 정렬하지 않음 (배분 정렬 제외)
3. **자동 간격 조절** (속성2 bit 4-5): 한글-영어, 한글-숫자 사이에 자동으로 약간의 여백 추가
4. CSS `text-align: justify` + `text-align-last: left`로 근사 구현 가능
5. 배분 정렬: `text-align-last: justify`
6. 정확한 구현은 글자별 위치 계산 필요 (PDF 직접 렌더링 시)

---

## 요약: HanDoc 구현 체크리스트

### 긴급 수정 (줄 높이 오차)
- [ ] 폰트별 emRatio 자동 계산 (`(usWinAscent + usWinDescent) / unitsPerEm`)
- [ ] lineSpacing type별 분기 처리 (percent/fixed/betweenLines/atLeast)
- [ ] "글꼴에 어울리는 줄 높이" 플래그 확인

### 텍스트 폭 정확도
- [ ] 장평 (ratio) 적용: 가로 스케일링
- [ ] 자간 (spacing) 적용: `fontSize × spacing / 100`
- [ ] 언어별 다른 장평/자간 처리

### 줄바꿈
- [ ] CJK 금칙처리 구현
- [ ] breakLatinWord / breakNonLatinWord 설정 반영
- [ ] widow/orphan 보호

### 정렬
- [ ] justify / distribute / 나눔 정렬 구분
- [ ] 공백 최소값 적용
- [ ] 자동 간격 조절 (한글-영어 사이)

---

## 참고 자료

- **HWP 5.0 스펙** (r1.3, 2018-11-08): `docs/specs/hwp5-spec-r1.3.pdf`
- **HWPML 스펙** (r1.2): `docs/specs/hwpml-spec-r1.2.pdf`
- **hwp.js** (Apache-2.0, hahnlee): 파서/뷰어 참조 구현
- **KS X 6101:2011** (OWPML): 국가표준 마크업 언어 스펙
- **LINE-HEIGHT-ANALYSIS.md**: emRatio 분석 및 오차 측정 결과
