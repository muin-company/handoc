# HWPML 엘리먼트 카탈로그

> **출처:** 글 문서 파일 구조 3.0 / HWPML (revision 1.2:20141105)
> **Part II: HWPML 구조** (47페이지~)
> **작성일:** 2026-02-20

---

## 목차
- [기본 속성 값 (§2.2)](#기본-속성-값-22)
- [§3: 루트 엘리먼트](#3-루트-엘리먼트)
- [§4: 헤더 엘리먼트](#4-헤더-엘리먼트)
- [§5: 본문 엘리먼트](#5-본문-엘리먼트)
- [§6: 부가 정보 엘리먼트](#6-부가-정보-엘리먼트)
- [부록: HWPX 파일 대조 검증](#부록-hwpx-파일-대조-검증)

---

## 기본 속성 값 (§2.2)

스펙 전반에서 `[축약어]` 형태로 참조되는 기본 타입 정의.

### hwpunit
- 10 pt = 1000 hwpunit

### 글꼴 유형
| 축약어 | 설명 |
|---|---|
| `rep` | 대표 글꼴 |
| `ttf` | 트루타입 글꼴 |
| `hft` | 한글 전용 글꼴 |

### LineType1 (선 종류 1)
`Solid` | `Dash` | `Dot` | `DashDot` | `DashDotDot` | `LongDash` | `Circle` | `DoubleSlim` | `SlimThick` | `ThickSlim` | `SlimThickSlim` | `None`

### LineType2 (선 종류 2)
`Solid` | `Dash` | `Dot` | `DashDot` | `DashDotDot` | `LongDash` | `Circle` | `DoubleSlim` | `SlimThick` | `ThickSlim` | `SlimThickSlim`

### LineType3 (선 종류 3)
`Solid` | `Dot` | `Thick` | `Dash` | `DashDot` | `DashDotDot`

### LineWidth (선 두께)
`0.1mm` | `0.12mm` | `0.15mm` | `0.2mm` | `0.25mm` | `0.3mm` | `0.4mm` | `0.5mm` | `0.6mm` | `0.7mm` | `1.0mm` | `1.5mm` | `2.0mm` | `3.0mm` | `4.0mm` | `5.0mm`

### RGB-Color
RGB 값 (0x00bbggrr) 십진수 표현. rr=red, gg=green, bb=blue.

### NumberType1 (번호 모양 1)
`Digit` | `CircledDigit` | `RomanCapital` | `RomanSmall` | `LatinCapital` | `LatinSmall` | `CircledLatinCapital` | `CircledLatinSmall` | `HangulSyllable` | `CircledHangulSyllable` | `HangulJamo` | `CircledHangulJamo` | `HangulPhonetic` | `Ideograph` | `CircledIdeograph`

### NumberType2 (번호 모양 2)
NumberType1의 모든 값 + `DecagonCircle` | `DecagonCircleHanja` | `Symbol` | `UserChar`

### AlignmentType1 (정렬 방식 1)
`Justify` | `Left` | `Right` | `Center` | `Distribute` | `DistributeSpace`

### AlignmentType2 (정렬 방식 2)
`Left` | `Center` | `Right`

### ArrowType (화살표 모양)
`Normal` | `Arrow` | `Spear` | `ConcaveArrow` | `EmptyDiamond` | `EmptyCircle` | `EmptyBox` | `FilledDiamond` | `FilledCircle` | `FilledBox`

### ArrowSize (화살표 크기)
`SmallSmall` | `SmallMedium` | `SmallLarge` | `MediumSmall` | `MediumMedium` | `MediumLarge` | `LargeSmall` | `LargeMedium` | `LargeLarge`

### LangType (언어 종류)
`Hangul` | `Latin` | `Hanja` | `Japanese` | `Other` | `Symbol` | `User`

### HatchStyle (무늬 종류)
`Horizontal` | `Vertical` | `BackSlash` | `Slash` | `Cross` | `CrossDiagonal`

### InfillMode (채우기 유형)
`Tile` | `TileHorzTop` | `TileHorzBottom` | `TileVertLeft` | `TileVertRight` | `Total` | `Center` | `CenterTop` | `CenterBottom` | `LeftCenter` | `LeftTop` | `LeftBottom` | `RightCenter` | `RightTop` | `RightBottom` | `Zoom`

### LineWrapType
`Break` (일반 줄바꿈) | `Squeeze` (자간 조정) | `Keep` (폭 늘어남)

### TextWrapType
`Square` | `Tight` | `Through` | `TopAndBottom` | `BehindText` | `InFrontOfText`

### FieldType
`Clickhere` | `Hyperlink` | `Bookmark` | `Formula` | `Summery` | `UserInfo` | `Date` | `DocDate` | `Path` | `Crossref` | `Mailmerge` | `Memo` | `RevisionChange` | `RevisionSign` | `RevisionDelete` | `RevisionAttach` | `RevisionClipping` | `RevisionSawtooth` | `RevisionThinking` | `RevisionPraise` | `RevisionLine` | `RevisionSimpleChange` | `RevisionHyperlink` | `RevisionLineAttach` | `RevisionLineLink` | `RevisionLineTransfer` | `RevisionRightmove` | `RevisionLeftmove` | `RevisionTransfer` | `RevisionSplit`

---

## §3: 루트 엘리먼트

### HWPML
- **스펙 위치:** §3 (표 2)
- **부모:** (루트)
- **속성:**
  - `Version` (string) — HWPML 버전. 기본값 `2.8`
  - `SubVersion` (string) — 기본값 `8.0.0.0`
  - `Style2` (enum: `embed` | `export`) — 기본값 `embed`
- **자식 요소:** HEAD, BODY, TAIL

---

## §4: 헤더 엘리먼트

### HEAD
- **스펙 위치:** §4 (표 3)
- **부모:** HWPML
- **속성:**
  - `SecCnt` (정수, 0 이상) — 구역의 개수
- **자식 요소:** DOCSUMMARY, DOCSETTING, MAPPINGTABLE

### DOCSUMMARY
- **스펙 위치:** §4.1 (표 4)
- **부모:** HEAD
- **속성:** 없음
- **자식 요소:** TITLE, SUBJECT, AUTHOR, DATE, KEYWORDS, COMMENTS, FORBIDDENSTRING

### TITLE
- **스펙 위치:** §4.1 (표 5)
- **부모:** DOCSUMMARY
- **엘리먼트 값:** 문자열 (문서 제목)

### SUBJECT
- **스펙 위치:** §4.1 (표 6)
- **부모:** DOCSUMMARY
- **엘리먼트 값:** 문자열 (문서 주제)

### AUTHOR
- **스펙 위치:** §4.1 (표 7)
- **부모:** DOCSUMMARY
- **엘리먼트 값:** 문자열 (문서 저자)

### DATE
- **스펙 위치:** §4.1 (표 8)
- **부모:** DOCSUMMARY
- **엘리먼트 값:** 문자열 (작성 날짜)

### KEYWORDS
- **스펙 위치:** §4.1 (표 9)
- **부모:** DOCSUMMARY
- **엘리먼트 값:** 문자열 (키워드)

### COMMENTS
- **스펙 위치:** §4.1 (표 10)
- **부모:** DOCSUMMARY
- **엘리먼트 값:** 문자열 (기타 설명)

### FORBIDDENSTRING
- **스펙 위치:** §4.1 (표 11)
- **부모:** DOCSUMMARY
- **자식 요소:** FORBIDDEN

### FORBIDDEN
- **스펙 위치:** §4.1 (표 12)
- **부모:** FORBIDDENSTRING
- **엘리먼트 값:** 문자열
- **속성:**
  - `id` (문자열) — 한정자

---

### DOCSETTING
- **스펙 위치:** §4.2 (표 13)
- **부모:** HEAD
- **자식 요소:** BEGINNUMBER, CARETPOS

### BEGINNUMBER
- **스펙 위치:** §4.2 (표 14)
- **부모:** DOCSETTING
- **속성:**
  - `Page` (정수, 1 이상) — 페이지 시작 번호. 기본값 `1`
  - `Footnote` (정수, 1 이상) — 각주 시작 번호. 기본값 `1`
  - `Endnote` (정수, 1 이상) — 미주 시작 번호. 기본값 `1`
  - `Picture` (정수, 1 이상) — 그림 시작 번호. 기본값 `1`
  - `Table` (정수, 1 이상) — 표 시작 번호. 기본값 `1`
  - `Equation` (정수, 1 이상) — 수식 시작 번호. 기본값 `1`
  - `TotalPage` (정수, 1 이상) — 전체 페이지 수. 기본값 `1`

### CARETPOS
- **스펙 위치:** §4.2 (표 15)
- **부모:** DOCSETTING
- **속성:**
  - `List` (문자열) — 리스트 아이디. 기본값 `1`
  - `Para` (문자열) — 문단 아이디. 기본값 `1`
  - `Pos` (문자열) — 문단 내 글자단위 위치. 기본값 `1`

---

### MAPPINGTABLE
- **스펙 위치:** §4.3 (표 16)
- **부모:** HEAD
- **자식 요소:** BINDATALIST, FACENAMELIST, BORDERFILLLIST, CHARSHAPELIST, TABDEFLIST, NUMBERINGLIST, BULLETLIST, PARASHAPELIST, STYLELIST, MEMOSHAPELIST

---

### §4.3.1 문서 내 그림/OLE 정보

### BINDATALIST
- **스펙 위치:** §4.3.1 (표 17)
- **부모:** MAPPINGTABLE
- **속성:**
  - `Count` (정수, 0 이상) — BINITEM 갯수. 기본값 `0`
- **자식 요소:** BINITEM

### BINITEM
- **스펙 위치:** §4.3.1 (표 18)
- **부모:** BINDATALIST
- **속성:**
  - `Type` (enum: `Link` | `Embedding` | `Storage`) — 바이너리 유형
  - `APath` (문자열) — Type="Link"일 때 절대 경로
  - `RPath` (문자열) — Type="Link"일 때 상대 경로
  - `BinData` (문자열) — Type="Embedding"/"Storage"일 때 바이너리 아이디
  - `Format` (enum: `jpg` | `bmp` | `gif` | `ole`) — Type="Embedding"일 때 포맷

---

### §4.3.2 글꼴 정보

### FACENAMELIST
- **스펙 위치:** §4.3.2 (표 19)
- **부모:** MAPPINGTABLE
- **자식 요소:** FONTFACE

### FONTFACE
- **스펙 위치:** §4.3.2 (표 20)
- **부모:** FACENAMELIST
- **속성:**
  - `Lang` (enum: [LangType]) — 언어 종류
  - `Count` (정수, 0 이상) — 글꼴 갯수
- **자식 요소:** FONT

### FONT
- **스펙 위치:** §4.3.2 (표 21)
- **부모:** FONTFACE
- **속성:**
  - `Id` (정수, 0 이상) — 글꼴 아이디
  - `Type` (enum: `rep` | `ttf` | `hft`) — 글꼴 유형
  - `Name` (문자열) — 글꼴 이름
- **자식 요소:** SUBSTFONT, TYPEINFO

### SUBSTFONT
- **스펙 위치:** §4.3.2 (표 22)
- **부모:** FONT
- **속성:**
  - `Type` (enum: `rep` | `ttf` | `hft`) — 대체 글꼴 유형
  - `Name` (문자열) — 글꼴 이름

### TYPEINFO
- **스펙 위치:** §4.3.2 (표 23)
- **부모:** FONT
- **속성:**
  - `FamilyType` — 글꼴 계열
  - `SerifStyle` — 세리프 유형
  - `Weight` — 굵기
  - `Proportion` — 비례
  - `Contrast` — 대조
  - `StrokeVariation` — 스트로크 편차
  - `ArmStyle` — 자획유형
  - `Letterform` — 글자형
  - `Midline` — 중간선
  - `XHeight` — X-높이

---

### §4.3.3 테두리/배경/채우기 정보

### BORDERFILLLIST
- **스펙 위치:** §4.3.3 (표 24)
- **부모:** MAPPINGTABLE
- **속성:**
  - `Count` (정수, 0 이상) — 항목 갯수
- **자식 요소:** BORDERFILL

### BORDERFILL
- **스펙 위치:** §4.3.3 (표 25)
- **부모:** BORDERFILLLIST
- **속성:**
  - `Id` (정수, 1 이상) — 아이디
  - `ThreeD` (enum: `true` | `false`) — 3D효과. 기본값 `false`
  - `Shadow` (enum: `true` | `false`) — 그림자 효과. 기본값 `false`
  - `Slash` (enum: `0` | `2` | `3` | `6` | `7`) — Slash 대각선. 기본값 `0`
  - `BackSlash` (enum: `0` | `2` | `3` | `6` | `7`) — BackSlash 대각선. 기본값 `0`
  - `CrookedSlash` — 꺽어진 대각선. 기본값 `0`
  - `CounterSlash` — 기본값 `0`
  - `CounterBackSlash` — 기본값 `0`
  - `BreakCellSeparateLine` — 기본값 `0`
- **자식 요소:** LEFTBORDER, RIGHTBORDER, TOPBORDER, BOTTOMBORDER, DIAGONAL, FILLBRUSH

### LEFTBORDER / RIGHTBORDER / TOPBORDER / BOTTOMBORDER / DIAGONAL
- **스펙 위치:** §4.3.3 (표 26)
- **부모:** BORDERFILL
- **속성:**
  - `Type` (enum: [LineType1]) — 테두리선 종류. 기본값 `Solid`
  - `Width` (enum: [LineWidth]) — 테두리선 굵기. 기본값 `0.12mm`
  - `Color` ([RGB-Color]) — 테두리선 색상. 기본값 `0`

### FILLBRUSH
- **스펙 위치:** §4.3.3 (표 27)
- **부모:** BORDERFILL
- **자식 요소:** WINDOWBRUSH, GRADATION, IMAGEBRUSH

### WINDOWBRUSH
- **스펙 위치:** §4.3.3 (표 28)
- **부모:** FILLBRUSH
- **속성:**
  - `FaceColor` ([RGB-Color]) — 면색
  - `HatchColor` ([RGB-Color]) — 무늬색
  - `HatchStyle` (enum: [HatchStyle]) — 무늬종류
  - `Alpha` — 투명도

### GRADATION
- **스펙 위치:** §4.3.3 (표 29)
- **부모:** FILLBRUSH
- **속성:**
  - `Type` (enum: `Linear` | `Radial` | `Conical` | `Square`) — 유형
  - `Angle` — 기울임. 기본값 `90`
  - `CenterX` — 가로중심. 기본값 `0`
  - `CenterY` — 세로중심. 기본값 `0`
  - `Step` — 번짐 정도. 기본값 `50`
  - `ColorNum` — 색수. 기본값 `2`
  - `StepCenter` (0~100) — 번짐 중심. 기본값 `50`
  - `Alpha` — 투명도
- **자식 요소:** COLOR

### COLOR
- **스펙 위치:** §4.3.3 (표 30)
- **부모:** GRADATION
- **속성:**
  - `Value` ([RGB-Color]) — 색

### IMAGEBRUSH
- **스펙 위치:** §4.3.3 (표 31)
- **부모:** FILLBRUSH
- **속성:**
  - `Mode` (enum: [InfillMode]) — 채우기 유형. 기본값 `Tile`
- **자식 요소:** IMAGE

### IMAGE
- **스펙 위치:** §4.3.3 (표 32)
- **부모:** IMAGEBRUSH
- **속성:**
  - `Bright` — 밝기. 기본값 `0`
  - `Contrast` — 명암. 기본값 `0`
  - `Effect` (enum: `RealPic` | `GrayScale` | `BlackWhite`) — 그림 효과
  - `BinItem` — BINITEM 아이디 참조값
  - `Alpha` — 투명도

---

### §4.3.4 글자 모양 정보

### CHARSHAPELIST
- **스펙 위치:** §4.3.4 (표 33)
- **부모:** MAPPINGTABLE
- **속성:**
  - `Count` (정수, 0 이상) — 항목 갯수
- **자식 요소:** CHARSHAPE

### CHARSHAPE
- **스펙 위치:** §4.3.4 (표 34)
- **부모:** CHARSHAPELIST
- **속성:**
  - `Id` (정수, 0 이상) — 아이디
  - `Height` ([hwpunit]) — 글자 크기. 기본값 `1000`
  - `TextColor` ([RGB-Color]) — 글자색. 기본값 `0`
  - `ShadeColor` ([RGB-Color]) — 음영색. 기본값 `4294967295`
  - `UseFontSpace` (boolean) — 글꼴에 어울리는 빈칸. 기본값 `false`
  - `UseKerning` (boolean) — 커닝. 기본값 `false`
  - `SymMark` — 강조점 종류. 기본값 `0`
  - `BorderFillId` — 글자테두리
- **자식 요소:** FONTID, RATIO, CHARSPACING, RELSIZE, CHAROFFSET, ITALIC, BOLD, UNDERLINE, OUTLINE, SHADOW, EMBOSS, ENGRAVE, SUPERSCRIPT, SUBSCRIPT

### FONTID
- **스펙 위치:** §4.3.4 (표 35)
- **부모:** CHARSHAPE
- **속성:** `Hangul`, `Latin`, `Hanja`, `Japanese`, `Other`, `Symbol`, `User` — 각 언어별 FONT 아이디 참조

### RATIO
- **스펙 위치:** §4.3.4 (표 36)
- **부모:** CHARSHAPE
- **속성:** `Hangul`, `Latin`, `Hanja`, `Japanese`, `Other`, `Symbol`, `User` — 각 언어별 장평 (50%~200%). 기본값 `100`

### CHARSPACING
- **스펙 위치:** §4.3.4 (표 37)
- **부모:** CHARSHAPE
- **속성:** `Hangul`, `Latin`, `Hanja`, `Japanese`, `Other`, `Symbol`, `User` — 각 언어별 자간 (-50%~50%). 기본값 `0`

### RELSIZE
- **스펙 위치:** §4.3.4 (표 38)
- **부모:** CHARSHAPE
- **속성:** `Hangul`, `Latin`, `Hanja`, `Japanese`, `Other`, `Symbol`, `User` — 각 언어별 상대크기 (10%~250%). 기본값 `100`

### CHAROFFSET
- **스펙 위치:** §4.3.4 (표 39)
- **부모:** CHARSHAPE
- **속성:** `Hangul`, `Latin`, `Hanja`, `Japanese`, `Other`, `Symbol`, `User` — 각 언어별 글자위치 (-100%~100%). 기본값 `0`

### ITALIC
- **스펙 위치:** §4.3.4 (표 40)
- **부모:** CHARSHAPE
- **설명:** 기울임 (빈 요소)

### BOLD
- **스펙 위치:** §4.3.4 (표 41)
- **부모:** CHARSHAPE
- **설명:** 진하게 (빈 요소)

### UNDERLINE
- **스펙 위치:** §4.3.4 (표 42)
- **부모:** CHARSHAPE
- **속성:**
  - `Type` (enum: `Bottom` | `Center` | `Top`) — 밑줄 종류. 기본값 `Bottom`
  - `Shape` (enum: [LineType2]) — 밑줄 모양. 기본값 `Solid`
  - `Color` ([RGB-Color]) — 밑줄 색. 기본값 `0`

### STRIKEOUT
- **스펙 위치:** §4.3.4 (표 43)
- **부모:** CHARSHAPE
- **속성:**
  - `Type` (enum: `None` | `Continuous`) — 취소선 종류. 기본값 `Continuous`
  - `Shape` (enum: [LineType2]) — 모양. 기본값 `Solid`
  - `Color` ([RGB-Color]) — 색. 기본값 `0`

### OUTLINE
- **스펙 위치:** §4.3.4 (표 44)
- **부모:** CHARSHAPE
- **속성:**
  - `Type` (enum: [LineType3]) — 외곽선 종류. 기본값 `Solid`

### SHADOW
- **스펙 위치:** §4.3.4 (표 45)
- **부모:** CHARSHAPE, DRAWINGOBJECT, TEXTARTSHAPE
- **속성:**
  - `Type` (enum: `Drop` | `Cont`) — 그림자 종류
  - `Color` ([RGB-Color]) — 그림자 색
  - `OffsetX` (-100%~100%) — 간격 X. 기본값 `10`
  - `OffsetY` (-100%~100%) — 간격 Y. 기본값 `10`
  - `Alpha` — 투명도

### EMBOSS
- **스펙 위치:** §4.3.4 (표 46)
- **부모:** CHARSHAPE
- **설명:** 양각 (빈 요소)

### ENGRAVE
- **스펙 위치:** §4.3.4 (표 47)
- **부모:** CHARSHAPE
- **설명:** 음각 (빈 요소)

### SUPERSCRIPT
- **스펙 위치:** §4.3.4 (표 48)
- **부모:** CHARSHAPE
- **설명:** 위 첨자 (빈 요소)

### SUBSCRIPT
- **스펙 위치:** §4.3.4 (표 49)
- **부모:** CHARSHAPE
- **설명:** 아래 첨자 (빈 요소)

---

### §4.3.5 탭 정보

### TABDEFLIST
- **스펙 위치:** §4.3.5 (표 50)
- **부모:** MAPPINGTABLE
- **속성:**
  - `Count` (정수, 0 이상) — 탭 정의 개수
- **자식 요소:** TABDEF

### TABDEF
- **스펙 위치:** §4.3.5 (표 51)
- **부모:** TABDEFLIST
- **속성:**
  - `Id` (정수, 0 이상) — 아이디
  - `AutoTabLeft` (boolean) — 왼쪽 자동탭. 기본값 `false`
  - `AutoTabRight` (boolean) — 오른쪽 자동탭. 기본값 `false`
- **자식 요소:** TABITEM

### TABITEM
- **스펙 위치:** §4.3.5 (표 52)
- **부모:** TABDEF
- **속성:**
  - `Pos` ([hwpunit]) — 탭 위치
  - `Type` (enum: `Left` | `Right` | `Center` | `Decimal`) — 종류. 기본값 `Left`
  - `Leader` (enum: [LineType2]) — 채움 종류. 기본값 `Solid`

---

### §4.3.5 (계속) 번호 문단 모양

### NUMBERINGLIST
- **스펙 위치:** §4.3.5 (표 53)
- **부모:** MAPPINGTABLE
- **속성:**
  - `Count` (정수, 0 이상) — 개수
- **자식 요소:** NUMBERING

### NUMBERING
- **스펙 위치:** §4.3.5 (표 54)
- **부모:** NUMBERINGLIST
- **속성:**
  - `Id` (정수, 1 이상) — 아이디
  - `Start` (정수) — 시작 번호. 기본값 `1`
- **자식 요소:** PARAHEAD

### PARAHEAD
- **스펙 위치:** §4.3.5 (표 55)
- **부모:** NUMBERING, BULLET
- **엘리먼트 값:** 문단 머리 문자열 포맷 (`^n`, `^N`, `^레벨번호` 등 제어코드)
- **속성:**
  - `Level` (1~7) — 수준
  - `Alignment` (enum: `Left` | `Center` | `Right`) — 정렬. 기본값 `Left`
  - `UseInstWidth` (boolean) — 번호 너비를 실제 문자열에 따를지. 기본값 `true`
  - `AutoIndent` (boolean) — 자동 내어쓰기. 기본값 `true`
  - `WidthAdjust` ([hwpunit]) — 너비 보정값. 기본값 `0`
  - `TextOffsetType` (enum: `percent` | `hwpunit`) — 본문과의 거리 단위. 기본값 `percent`
  - `TextOffset` — 본문과의 거리. 기본값 `50`
  - `NumFormat` (enum: [NumberType1]) — 번호 포맷. 기본값 `Digit`
  - `CharShape` — 글자 모양 아이디 참조

---

### §4.3.6 글머리표 정보

### BULLETLIST
- **스펙 위치:** §4.3.6 (표 56)
- **부모:** MAPPINGTABLE
- **속성:**
  - `Count` (정수, 0 이상) — 개수
- **자식 요소:** BULLET

### BULLET
- **스펙 위치:** §4.3.6 (표 57)
- **부모:** BULLETLIST
- **속성:**
  - `Id` (정수, 1 이상) — 아이디
  - `Char` — 글머리표 문자
  - `Image` (boolean) — 기본값 `false`
- **자식 요소:** PARAHEAD

---

### §4.3.7 문단 모양 정보

### PARASHAPELIST
- **스펙 위치:** §4.3.7 (표 58)
- **부모:** MAPPINGTABLE
- **속성:**
  - `Count` (정수, 0 이상) — 문단 모양 개수
- **자식 요소:** PARASHAPE

### PARASHAPE
- **스펙 위치:** §4.3.7 (표 59)
- **부모:** PARASHAPELIST
- **속성:**
  - `Id` (정수, 0 이상) — 아이디
  - `Align` (enum: [AlignmentType1]) — 정렬. 기본값 `Justify`
  - `VerAlign` (enum: `Baseline` | `Top` | `Center` | `Bottom`) — 세로정렬. 기본값 `Baseline`
  - `HeadingType` (enum: `None` | `Outline` | `Number` | `Bullet`) — 문단 머리 모양. 기본값 `None`
  - `Heading` — 번호/글머리표 아이디 참조
  - `Level` (0~6) — 단계. 기본값 `0`
  - `TabDef` — 탭정의 아이디 참조
  - `BreakLatinWord` (enum: `KeepWord` | `Hyphenation` | `BreakWord`) — 라틴 문자 줄나눔. 기본값 `KeepWord`
  - `BreakNonLatinWord` (boolean) — 비라틴 줄나눔. `true`=글자, `false`=어절. 기본값 `true`
  - `Condense` (0%~75%) — 공백 최소값. 기본값 `0`
  - `WidowOrphan` (boolean) — 외톨이줄 보호. 기본값 `false`
  - `KeepWithNext` (boolean) — 다음 문단과 함께. 기본값 `false`
  - `KeepLines` (boolean) — 문단 보호. 기본값 `false`
  - `PageBreakBefore` (boolean) — 문단 앞 쪽나눔. 기본값 `false`
  - `FontLineHeight` (boolean) — 글꼴에 어울리는 줄높이. 기본값 `false`
  - `SnapToGrid` (boolean) — 줄격자 사용. 기본값 `true`
  - `LineWrap` (enum: [LineWrapType]) — 한줄 입력. 기본값 `Break`
  - `AutoSpaceEAsianEng` (boolean) — 한글/영어 간격 자동. 기본값 `true`
  - `AutoSpaceEAsianNum` (boolean) — 한글/숫자 간격 자동. 기본값 `true`
- **자식 요소:** PARAMARGIN, PARABORDER

### PARAMARGIN
- **스펙 위치:** §4.3.7 (표 60)
- **부모:** PARASHAPE
- **속성:**
  - `Indent` (hwpunit 또는 글자수) — 들여쓰기/내어쓰기. 기본값 `0`
  - `Left` (hwpunit 또는 글자수) — 왼쪽 여백. 기본값 `0`
  - `Right` (hwpunit 또는 글자수) — 오른쪽 여백. 기본값 `0`
  - `Prev` (hwpunit 또는 글자수) — 문단 간격 위. 기본값 `0`
  - `Next` (hwpunit 또는 글자수) — 문단 간격 아래. 기본값 `0`
  - `LineSpacingType` (enum: `Percent` | `Fixed` | `BetweenLines` | `AtLeast`) — 줄 간격 종류. 기본값 `Percent`
  - `LineSpacing` — 줄 간격 값. 기본값 `160`

### PARABORDER
- **스펙 위치:** §4.3.7 (표 61)
- **부모:** PARASHAPE
- **속성:**
  - `BorderFill` — BORDERFILL 아이디 참조
  - `OffsetLeft` ([hwpunit]) — 왼쪽 간격
  - `OffsetRight` ([hwpunit]) — 오른쪽 간격
  - `OffsetTop` ([hwpunit]) — 위쪽 간격
  - `OffsetBottom` ([hwpunit]) — 아래쪽 간격
  - `Connect` (boolean) — 연결 여부. 기본값 `false`
  - `IgnoreMargin` (boolean) — 여백 무시. 기본값 `false`

---

### §4.3.8 스타일 정보

### STYLELIST
- **스펙 위치:** §4.3.8 (표 62)
- **부모:** MAPPINGTABLE
- **속성:**
  - `Count` (정수, 0 이상) — 스타일 갯수
- **자식 요소:** STYLE

### STYLE
- **스펙 위치:** §4.3.8 (표 63)
- **부모:** STYLELIST
- **속성:**
  - `Id` — 스타일 아이디
  - `Type` (enum: `Para` | `Char`) — 종류. 기본값 `Para`
  - `Name` (문자열) — 로컬 스타일 이름
  - `EngName` (문자열) — 영문 스타일 이름
  - `ParaShape` — PARASHAPE 아이디 참조 (문단 스타일 필수)
  - `CharShape` — CHARSHAPE 아이디 참조 (글자 스타일 필수)
  - `NextStyle` — 다음 스타일 아이디 참조
  - `LangId` — 언어 아이디
  - `LockForm` — 양식모드 보호

---

### §4.3.9 메모 정보

### MEMOSHAPELIST
- **스펙 위치:** §4.3.9 (표 64)
- **부모:** MAPPINGTABLE
- **속성:**
  - `Count` (정수, 0 이상) — 메모 개수
- **자식 요소:** MEMO

### MEMO
- **스펙 위치:** §4.3.9 (표 65)
- **부모:** MEMOSHAPELIST
- **속성:**
  - `Id` — 메모 아이디
  - `Width` — 기본값 `0`
  - `LineType` — 선 종류
  - `LineColor` ([RGB-Color]) — 선 색
  - `FillColor` ([RGB-Color]) — 메모 색
  - `ActiveColor` ([RGB-Color]) — 활성화 색
  - `MemoType` — 메모 타입

---

## §5: 본문 엘리먼트

### BODY
- **스펙 위치:** §5 (표 66)
- **부모:** HWPML
- **자식 요소:** SECTION

### SECTION
- **스펙 위치:** §5 (표 67)
- **부모:** BODY
- **속성:**
  - `Id` — 구역 아이디
- **자식 요소:** P

### P
- **스펙 위치:** §5 (표 68)
- **부모:** SECTION
- **속성:**
  - `ParaShape` — PARASHAPE 아이디 참조
  - `Style` — STYLE 아이디 참조
  - `InstId` — 개요 문단일 경우 고유 아이디
  - `PageBreak` (boolean) — 쪽 나눔. 기본값 `false`
  - `ColumnBreak` (boolean) — 단 나눔. 기본값 `false`
- **자식 요소:** TEXT

### TEXT
- **스펙 위치:** §5 (표 69)
- **부모:** P
- **속성:**
  - `CharShape` — CHARSHAPE 아이디 참조
- **자식 요소:** SECDEF, COLDEF, TABLE, PICTURE, CONTAINER, OLE, EQUATION, TEXTART, LINE, RECTANGLE, ELLIPSE, ARC, POLYGON, CURVE, CONNECTLINE, UNKNOWNOBJECT, FIELDBEGIN, FIELDEND, BOOKMARK, HEADER, FOOTER, FOOTNOTE, ENDNOTE, AUTONUM, NEWNUM, PAGENUMCTRL, PAGEHIDING, PAGENUM, INDEXMARK, COMPOSE, DUTMAL, HIDDENCOMMENT, BUTTON, RADIOBUTTON, CHECKBUTTON, COMBOBOX, EDIT, LISTBOX, SCROLLBAR

---

### §5.1 글자 엘리먼트

### CHAR
- **스펙 위치:** §5.1 (표 70)
- **부모:** TEXT
- **속성:**
  - `Style` — 스타일 아이디 참조
- **자식 요소:** 문자열, TAB, LINEBREAK, HYPEN, NBSPACE, FWSPACE, TITLEMARK, MARKPENBEGIN, MARKPENEND

### MARKPENBEGIN
- **스펙 위치:** §5.1 (표 71)
- **부모:** CHAR
- **속성:**
  - `Color` ([RGB-Color]) — 형광펜 색

### MARKPENEND
- **스펙 위치:** §5.1 (표 72)
- **부모:** CHAR
- **설명:** 형광펜 끝 (빈 요소)

### TITLEMARK
- **스펙 위치:** §5.1 (표 73)
- **부모:** CHAR
- **속성:**
  - `Ignore` (boolean) — 차례 만들기 무시

### TAB
- **스펙 위치:** §5.1 (표 74)
- **부모:** CHAR (빈 요소)

### LINEBREAK
- **스펙 위치:** §5.1 (표 75)
- **부모:** CHAR (빈 요소)

### HYPEN
- **스펙 위치:** §5.1 (표 76)
- **부모:** CHAR (빈 요소)

### NBSPACE
- **스펙 위치:** §5.1 (표 77)
- **부모:** CHAR (빈 요소)

### FWSPACE
- **스펙 위치:** §5.1 (표 78)
- **부모:** CHAR (빈 요소)

---

### §5.2 구역 정의

### SECDEF
- **스펙 위치:** §5.2 (표 79)
- **부모:** TEXT
- **속성:**
  - `TextDirection` (enum: `0` | `1`) — 텍스트 방향 (0=가로, 1=세로). 기본값 `0`
  - `SpaceColumns` ([hwpunit]) — 단 사이 간격
  - `TabStop` ([hwpunit] 또는 글자수) — 기본 탭 간격. 기본값 `8000`
  - `OutlineShape` — NUMBERING 아이디 참조
  - `LineGrid` — 세로 줄맞춤 (0=off, 1~n=간격). 기본값 `0`
  - `CharGrid` — 가로 줄맞춤 (0=off, 1~n=간격). 기본값 `0`
  - `FirstBorder` (boolean) — 첫쪽에만 테두리. 기본값 `false`
  - `FirstFill` (boolean) — 첫쪽에만 배경. 기본값 `false`
  - `ExtMasterpageCount` — 확장 바탕쪽 수
  - `MemoShapeId` — 메모 모양 아이디
  - `TextVerticalWidthHead` — 기본값 `0`
- **자식 요소:** PARAMETERSET, STARTNUMBER, HIDE, PAGEDEF, FOOTNOTESHAPE, ENDNOTESHAPE, PAGEBORDERFILL, MASTERPAGE, EXT_MASTERPAGE

### PARAMETERSET
- **스펙 위치:** §5.2 (표 80)
- **부모:** SECDEF, ITEM, COLDEF, SHAPECOMPONENT, FORMOBJECT
- **속성:**
  - `SetId` — Parameter Set 아이디
  - `Count` (정수, 0 이상) — Item 개수
- **자식 요소:** ITEM

### PARAMETERARRAY
- **스펙 위치:** §5.2 (표 81)
- **부모:** ITEM
- **속성:**
  - `Count` (정수, 0 이상) — Item 개수
- **자식 요소:** ITEM

### ITEM
- **스펙 위치:** §5.2 (표 82)
- **부모:** PARAMETERSET, PARAMETERARRAY
- **엘리먼트 값:** 문자열, PARAMETERSET, PARAMETERARRAY
- **속성:**
  - `ItemId` — Item 아이디
  - `Type` (enum: `Bstr` | `Integer` | `Set` | `Array` | `BinData`) — 종류

### STARTNUMBER
- **스펙 위치:** §5.2.1 (표 83)
- **부모:** SECDEF
- **속성:**
  - `PageStartsOn` (enum: `Both` | `Even` | `Odd`) — 페이지 번호 옵션. 기본값 `Both`
  - `Page` (정수) — 쪽 시작 번호. 기본값 `0`
  - `Figure` (정수) — 그림 시작 번호. 기본값 `0`
  - `Table` (정수) — 표 시작 번호. 기본값 `0`
  - `Equation` (정수) — 수식 시작 번호. 기본값 `0`

### HIDE
- **스펙 위치:** §5.2.2 (표 84)
- **부모:** SECDEF
- **속성:**
  - `Header` (boolean) — 머리말 감추기. 기본값 `false`
  - `Footer` (boolean) — 꼬리말 감추기. 기본값 `false`
  - `MasterPage` (boolean) — 바탕쪽 감추기. 기본값 `false`
  - `Border` (boolean) — 테두리 감추기. 기본값 `false`
  - `Fill` (boolean) — 배경 감추기. 기본값 `false`
  - `PageNumPos` (boolean) — 쪽번호 감추기. 기본값 `false`
  - `EmptyLine` (boolean) — 빈줄 감추기. 기본값 `false`

### PAGEDEF
- **스펙 위치:** §5.2.3 (표 85)
- **부모:** SECDEF
- **속성:**
  - `Landscape` (enum: `0` | `1`) — 용지 방향 (0=좁게, 1=넓게). 기본값 `0`
  - `Width` ([hwpunit]) — 용지 가로 크기. 기본값 `59528`
  - `Height` ([hwpunit]) — 용지 세로 크기. 기본값 `84188`
  - `GutterType` (enum: `LeftOnly` | `LeftRight` | `TopBottom`) — 제책 방법. 기본값 `LeftOnly`
- **자식 요소:** PAGEMARGIN

### PAGEMARGIN
- **스펙 위치:** §5.2.3 (표 86)
- **부모:** PAGEDEF
- **속성:**
  - `Left` ([hwpunit]) — 왼쪽 여백. 기본값 `8504`
  - `Right` ([hwpunit]) — 오른쪽 여백. 기본값 `8504`
  - `Top` ([hwpunit]) — 위 여백. 기본값 `5668`
  - `Bottom` ([hwpunit]) — 아래 여백. 기본값 `4252`
  - `Header` ([hwpunit]) — 머리말 여백. 기본값 `4252`
  - `Footer` ([hwpunit]) — 꼬리말 여백. 기본값 `4252`
  - `Gutter` ([hwpunit]) — 제본 여백. 기본값 `0`

### FOOTNOTESHAPE / ENDNOTESHAPE
- **스펙 위치:** §5.2.4 (표 87)
- **부모:** SECDEF
- **자식 요소:** AUTONUMFORMAT, NOTELINE, NOTESPACING, NOTENUMBERING, NOTEPLACEMENT

### AUTONUMFORMAT
- **스펙 위치:** §5.2.4 (표 88)
- **부모:** FOOTNOTESHAPE, ENDNOTESHAPE
- **속성:**
  - `Type` (enum: [NumberType2]) — 번호 모양. 기본값 `Digit`
  - `UserChar` — 사용자 기호
  - `PrefixChar` — 앞 장식 문자
  - `SuffixChar` — 뒤 장식 문자. 기본값 `)`
  - `Superscript` (boolean) — 윗첨자. 기본값 `false`

### NOTELINE
- **스펙 위치:** §5.2.4 (표 89)
- **부모:** FOOTNOTESHAPE, ENDNOTESHAPE
- **속성:**
  - `Length` — 구분선 길이 (0/5cm/2cm/Column/3/Column/사용자 지정)
  - `Type` (enum: [LineType1]) — 종류. 기본값 `Solid`
  - `Width` (enum: [LineWidth]) — 굵기. 기본값 `0.12mm`
  - `Color` ([RGB-Color]) — 색

### NOTESPACING
- **스펙 위치:** §5.2.4 (표 90)
- **부모:** FOOTNOTESHAPE, ENDNOTESHAPE
- **속성:**
  - `AboveLine` ([hwpunit]) — 구분선 위 여백. 기본값 `567`
  - `BelowLine` ([hwpunit]) — 구분선 아래 여백. 기본값 `567`
  - `BetweenNotes` ([hwpunit]) — 주석 사이 여백. 기본값 `850`

### NOTENUMBERING
- **스펙 위치:** §5.2.4 (표 91)
- **부모:** FOOTNOTESHAPE, ENDNOTESHAPE
- **속성:**
  - `Type` (enum: `Continuous` | `OnSection` | `OnPage`) — 번호 매기기. 기본값 `Continuous`
  - `NewNumber` (정수, 1 이상) — 시작 번호. 기본값 `1`

### NOTEPLACEMENT
- **스펙 위치:** §5.2.4 (표 92)
- **부모:** FOOTNOTESHAPE, ENDNOTESHAPE
- **속성:**
  - `Place` — 위치
    - 각주: `EachColumn` | `MergedColumn` | `RightMostColumn`. 기본값 `EachColumn`
    - 미주: `EndOfDocument` | `EndOfSection`. 기본값 `EndOfDocument`
  - `BeneathText` (boolean) — 텍스트에 이어 출력. 기본값 `false`

### PAGEBORDERFILL
- **스펙 위치:** §5.2.5 (표 93)
- **부모:** SECDEF
- **속성:**
  - `Type` (enum: `Both` | `Even` | `Odd`) — 종류. 기본값 `Both`
  - `BorderFill` — BORDERFILL 아이디 참조
  - `TextBorder` (boolean) — `true`=본문 기준, `false`=종이 기준. 기본값 `false`
  - `HeaderInside` (boolean) — 머리말 포함. 기본값 `false`
  - `FooterInside` (boolean) — 꼬리말 포함. 기본값 `false`
  - `FillArea` (enum: `Paper` | `Page` | `Border`) — 채울 영역. 기본값 `Paper`
- **자식 요소:** PAGEOFFSET

### PAGEOFFSET
- **스펙 위치:** §5.2.5 (표 94)
- **부모:** PAGEBORDERFILL
- **속성:**
  - `Left` ([hwpunit]) — 기본값 `1417`
  - `Right` ([hwpunit]) — 기본값 `1417`
  - `Top` ([hwpunit]) — 기본값 `1417`
  - `Bottom` ([hwpunit]) — 기본값 `1417`

### MASTERPAGE
- **스펙 위치:** §5.2.6 (표 95)
- **부모:** SECDEF
- **속성:**
  - `Type` (enum: `Both` | `Even` | `Odd`) — 기본값 `Both`
  - `TextWidth` — 텍스트 영역 폭
  - `TextHeight` — 텍스트 영역 높이
  - `HasTextRef` (boolean) — 기본값 `false`
  - `HasNumRef` (boolean) — 기본값 `false`
- **자식 요소:** PARALIST

### PARALIST
- **스펙 위치:** §5.2.6 (표 96)
- **부모:** MASTERPAGE, EXT_MASTERPAGE, CELL, DRAWTEXT, CAPTION, HEADER, FOOTER, FOOTNOTE, ENDNOTE, HIDDENCOMMENT
- **속성:**
  - `TextDirection` (enum: `0` | `1`) — 기본값 `0`
  - `LineWrap` (enum: [LineWrapType]) — 기본값 `Break`
  - `VertAlign` (enum: `Top` | `Center` | `Bottom`) — 기본값 `Top`
  - `LinkListID` — 링크 리스트 아이디
  - `LinkListIDNext` — 다음 링크 리스트 아이디
- **자식 요소:** P

### EXT_MASTERPAGE
- **스펙 위치:** §5.2.7 (표 97)
- **부모:** SECDEF
- **속성:**
  - `Type` (enum: `LastPage` | `OptionalPage`) — 종류
  - `PageNumber` (정수, 1 이상) — Type="OptionalPage"일 때 쪽 번호
  - `PageDuplicate` (boolean) — 겹침
  - `PageFront` (boolean) — 앞으로 보내기
- **자식 요소:** PARALIST

---

### §5.3 단 정의

### COLDEF
- **스펙 위치:** §5.3 (표 98)
- **부모:** TEXT
- **속성:**
  - `Type` (enum: `Newspaper` | `BalancedNewspaper` | `Parallel`) — 기본값 `Newspaper`
  - `Count` (1~255) — 단 개수. 기본값 `1`
  - `Layout` (enum: `Left` | `Right` | `Mirror`) — 기본값 `Left`
  - `SameSize` (boolean) — 단 너비 동일. 기본값 `false`
  - `SameGap` ([hwpunit]) — 단 간격. 기본값 `0`
- **자식 요소:** PARAMETERSET, COLUMNLINE, COLUMNTABLE

### COLUMNLINE
- **스펙 위치:** §5.3 (표 99)
- **부모:** COLDEF
- **속성:**
  - `Type` (enum: [LineType1]) — 종류. 기본값 `Solid`
  - `Width` (enum: [LineWidth]) — 굵기. 기본값 `0.12mm`
  - `Color` ([RGB-Color]) — 색

### COLUMNTABLE
- **스펙 위치:** §5.3 (표 100)
- **부모:** COLDEF
- **자식 요소:** COLUMN

### COLUMN
- **스펙 위치:** §5.3 (표 101)
- **부모:** COLUMNTABLE
- **속성:**
  - `Width` ([hwpunit]) — 단 폭
  - `Gap` ([hwpunit]) — 단 간격

---

### §5.4 표

### TABLE
- **스펙 위치:** §5.4 (표 102)
- **부모:** TEXT
- **속성:**
  - `PageBreak` (enum: `Table` | `Cell` | `None`) — 페이지 나누기. 기본값 `Cell`
  - `RepeatHeader` (boolean) — 제목행 반복. 기본값 `true`
  - `RowCount` — 행 수
  - `ColCount` — 열 수
  - `CellSpacing` ([hwpunit]) — 셀 간격. 기본값 `0`
  - `BorderFill` — BORDERFILL 아이디 참조
- **자식 요소:** SHAPEOBJECT, INSIDEMARGIN, CELLZONELIST, ROW

### SHAPEOBJECT
- **스펙 위치:** §5.4 (표 103)
- **부모:** TABLE, PICTURE, LINE, RECTANGLE, ELLIPSE, ARC, POLYGON, CURVE, OLE, EQUATION
- **속성:**
  - `InstId` — 문서내 고유 아이디
  - `ZOrder` — z-order
  - `NumberingType` (enum: `None` | `Figure` | `Table` | `Equation`) — 번호 범주. 기본값 `None`
  - `TextWrap` (enum: [TextWrapType]) — 텍스트 흐름
  - `TextFlow` (enum: `BothSides` | `LeftOnly` | `RightOnly` | `LargestOnly`) — 텍스트 배치. 기본값 `BothSides`
  - `Lock` (boolean) — 선택 가능. 기본값 `false`
- **자식 요소:** SIZE, POSITION, OUTSIDEMARGIN, CAPTION, SHAPECOMMENT

### SIZE
- **스펙 위치:** §5.4 (표 104)
- **부모:** SHAPEOBJECT
- **속성:**
  - `Width` ([hwpunit]) — 폭
  - `Height` ([hwpunit]) — 높이
  - `WidthRelTo` (enum: `Paper` | `Page` | `Column` | `Para` | `Absolute`) — 폭 기준. 기본값 `Absolute`
  - `HeightRelTo` (enum: `Paper` | `Page` | `Absolute`) — 높이 기준. 기본값 `Absolute`
  - `Protect` (boolean) — 크기 보호. 기본값 `false`

### POSITION
- **스펙 위치:** §5.4 (표 105)
- **부모:** SHAPEOBJECT
- **속성:**
  - `TreatAsChar` (boolean) — 글자처럼 취급. 기본값 `false`
  - `AffectLSpacing` (boolean) — 줄 간격 영향
  - `VertRelTo` (enum: `Paper` | `Page` | `Para`) — 세로 기준
  - `VertAlign` (enum: `Top` | `Center` | `Bottom` | `Inside` | `Outside`) — 세로 배열
  - `HorzRelTo` (enum: `Paper` | `Page` | `Column` | `Para`) — 가로 기준
  - `HorzAlign` (enum: `Left` | `Center` | `Right` | `Inside` | `Outside`) — 가로 배열
  - `VertOffset` ([hwpunit]) — 세로 오프셋. 기본값 `0`
  - `HorzOffset` ([hwpunit]) — 가로 오프셋. 기본값 `0`
  - `FlowWithText` (boolean) — 본문 영역 제한. 기본값 `false`
  - `AllowOverlap` (boolean) — 겹침 허용. 기본값 `false`
  - `HoldAnchorAndSO` (boolean) — 개체와 조판부호 같은 쪽. 기본값 `false`

### OUTSIDEMARGIN
- **스펙 위치:** §5.4 (표 106)
- **부모:** SHAPEOBJECT
- **속성:**
  - `Left` ([hwpunit]) — 왼쪽 여백
  - `Right` ([hwpunit]) — 오른쪽 여백
  - `Top` ([hwpunit]) — 위쪽 여백
  - `Bottom` ([hwpunit]) — 아래쪽 여백
  - (기본값은 개체 유형마다 다름: TABLE=283, PICTURE=0, EQUATION=56)

### CAPTION
- **스펙 위치:** §5.4 (표 107)
- **부모:** SHAPEOBJECT
- **속성:**
  - `Side` (enum: `Left` | `Right` | `Top` | `Bottom`) — 방향. 기본값 `Left`
  - `FullSize` (boolean) — 캡션 폭에 마진 포함. 기본값 `false`
  - `Width` — 캡션 폭 (세로 방향)
  - `Gap` — 캡션과 틀 간격. 기본값 `850`
  - `LastWidth` — 텍스트 최대 길이
- **자식 요소:** PARALIST

### SHAPECOMMENT
- **스펙 위치:** §5.4 (표 108)
- **부모:** SHAPEOBJECT
- **엘리먼트 값:** 문자열 (주석)

### INSIDEMARGIN
- **스펙 위치:** §5.4 (표 109)
- **부모:** TABLE, PICTURE
- **속성:**
  - `Left` ([hwpunit]) — 왼쪽 여백 (TABLE=141, PICTURE=0)
  - `Right` ([hwpunit])
  - `Top` ([hwpunit])
  - `Bottom` ([hwpunit])

### CELLZONELIST
- **스펙 위치:** §5.4 (표 110)
- **부모:** TABLE
- **속성:**
  - `Count` (정수, 0 이상) — 개수
- **자식 요소:** CELLZONE

### CELLZONE
- **스펙 위치:** §5.4 (표 111)
- **부모:** CELLZONELIST
- **속성:**
  - `StartRowAddr`, `StartColAddr`, `EndRowAddr`, `EndColAddr` — 셀존 주소
  - `BorderFill` — 테두리/배경 아이디

### ROW
- **스펙 위치:** §5.4 (표 112)
- **부모:** TABLE
- **자식 요소:** CELL

### CELL
- **스펙 위치:** §5.4 (표 113)
- **부모:** ROW
- **속성:**
  - `Name` — 셀 필드 이름
  - `ColAddr` — 열 주소 (0부터)
  - `RowAddr` — 행 주소 (0부터)
  - `ColSpan` — 열 병합. 기본값 `1`
  - `RowSpan` — 행 병합. 기본값 `1`
  - `Width` ([hwpunit]) — 셀 폭
  - `Height` ([hwpunit]) — 셀 높이
  - `Header` (boolean) — 제목 셀. 기본값 `false`
  - `HasMargin` (boolean) — 독자적 마진. 기본값 `false`
  - `Protect` (boolean) — 편집 잠금. 기본값 `false`
  - `Editable` (boolean) — 읽기전용에서도 수정. 기본값 `false`
  - `Dirty` (boolean) — 수정 여부. 기본값 `false`
  - `BorderFill` — BORDERFILL 아이디 참조
- **자식 요소:** CELLMARGIN, PARALIST

### CELLMARGIN
- **스펙 위치:** §5.4 (표 114)
- **부모:** CELL
- **속성:**
  - `Left`, `Right`, `Top`, `Bottom` ([hwpunit]) — 기본값 `0`

---

### §5.5 그림

### PICTURE
- **스펙 위치:** §5.5 (표 115)
- **부모:** TEXT
- **속성:**
  - `Reverse` (boolean) — 기본값 `false`
- **자식 요소:** SHAPEOBJECT, SHAPECOMPONENT, LINESHAPE, IMAGERECT, IMAGECLIP, EFFECTS, INSIDEMARGIN, IMAGE

### SHAPECOMPONENT
- **스펙 위치:** §5.5 (표 116)
- **부모:** PICTURE, DRAWINGOBJECT
- **속성:**
  - `HRef` — 하이퍼링크
  - `XPos` ([hwpunit]) — 그룹 내 X 오프셋. 기본값 `0`
  - `YPos` ([hwpunit]) — 그룹 내 Y 오프셋. 기본값 `0`
  - `GroupLevel` — 그룹 횟수. 기본값 `0`
  - `OriWidth`, `OriHeight` ([hwpunit]) — 최초 크기
  - `CurWidth`, `CurHeight` ([hwpunit]) — 현재 크기
  - `HorzFlip` (boolean) — 좌우 뒤집기. 기본값 `false`
  - `VertFlip` (boolean) — 상하 뒤집기. 기본값 `false`
  - `InstID` — 인스턴스 아이디
- **자식 요소:** PARAMETERSET, ROTATIONINFO, RENDERINGINFO

### ROTATIONINFO
- **스펙 위치:** §5.5 (표 117)
- **부모:** SHAPECOMPONENT
- **속성:**
  - `Angle` — 회전각. 기본값 `0`
  - `CenterX` — 회전 중심 X
  - `CenterY` — 회전 중심 Y

### RENDERINGINFO
- **스펙 위치:** §5.5 (표 118)
- **부모:** SHAPECOMPONENT
- **자식 요소:** TRANSMATRIX, SCAMATRIX, ROTMATRIX

### TRANSMATRIX / SCAMATRIX / ROTMATRIX
- **스펙 위치:** §5.5 (표 119)
- **부모:** RENDERINGINFO
- **속성:** `E1`~`E6` — 9×9 행렬 요소 (E7~E9는 0,0,1 고정)

### LINESHAPE
- **스펙 위치:** §5.5 (표 120)
- **부모:** PICTURE, DRAWINGOBJECT, OLE
- **속성:**
  - `Color` ([RGB-Color]) — 선 색상
  - `Width` ([hwpunit]) — 선 굵기
  - `Style` (enum: [LineType1]) — 종류. 기본값 `Solid`
  - `EndCap` (enum: `Round` | `Flat`) — 선 끝 모양. 기본값 `Flat`
  - `HeadStyle` (enum: [ArrowType]) — 화살표 시작. 기본값 `Normal`
  - `TailStyle` (enum: [ArrowType]) — 화살표 끝. 기본값 `Normal`
  - `HeadSize` (enum: [ArrowSize]) — 화살표 시작 크기. 기본값 `SmallSmall`
  - `TailSize` (enum: [ArrowSize]) — 화살표 끝 크기. 기본값 `SmallSmall`
  - `OutlineStyle` (enum: `Normal` | `Outer` | `Inner`) — 기본값 `Normal`
  - `Alpha` — 투명도

### IMAGERECT
- **스펙 위치:** §5.5 (표 121)
- **부모:** PICTURE
- **속성:** `X0`, `Y0`, `X1`, `Y1`, `X2`, `Y2` — 이미지 테두리 사각형 좌표

### IMAGECLIP
- **스펙 위치:** §5.5 (표 122)
- **부모:** PICTURE
- **속성:** `Left`, `Top`, `Right`, `Bottom` — 자르기 사각형

### EFFECTS
- **스펙 위치:** §5.5 (표 123)
- **부모:** PICTURE
- **자식 요소:** SHADOWEFFECT, GLOW, SOFTEDGE, REFLECTION

### SHADOWEFFECT
- **스펙 위치:** §5.5 (표 124)
- **부모:** EFFECTS
- **속성:** `Style`, `Alpha`, `Radius`, `Direction`, `Distance`, `AlignStyle`, `SkewX`, `SkewY`, `ScaleX`, `ScaleY`, `RotationStyle`
- **자식 요소:** EFFECTSCOLOR

### GLOW
- **스펙 위치:** §5.5 (표 125)
- **부모:** EFFECTS
- **속성:** `Alpha`, `Radius`
- **자식 요소:** EFFECTSCOLOR

### SOFTEDGE
- **스펙 위치:** §5.5 (표 126)
- **부모:** EFFECTS
- **속성:** `Radius`

### REFLECTION
- **스펙 위치:** §5.5 (표 127)
- **부모:** EFFECTS
- **속성:** `AlignStyle`, `Radius`, `Direction`, `Distance`, `SkewX`, `SkewY`, `ScaleX`, `ScaleY`, `RotationStyle`, `StartAlpha`, `StartPos`, `EndAlpha`, `EndPos`, `FadeDirection`

### EFFECTSCOLOR
- **스펙 위치:** §5.5 (표 128)
- **부모:** SHADOWEFFECT, GLOW
- **속성:** `Type`, `SchemeIndex`, `SystemIndex`, `PresetIndex`, `ColorR`~`ColorB`, `ColorC`~`ColorK`, `ColorSCR`~`ColorSCB`, `ColorH`, `ColorS`, `ColorL`
- **자식 요소:** COLOREFFECT

### COLOREFFECT
- **스펙 위치:** §5.5 (표 129)
- **부모:** EFFECTSCOLOR
- **속성:** `Type`, `Value`

---

### §5.6 그리기 개체

### DRAWINGOBJECT
- **스펙 위치:** §5.6 (표 130)
- **부모:** LINE, RECTANGLE, ELLIPSE, ARC, POLYGON, CURVE
- **자식 요소:** SHAPECOMPONENT, LINESHAPE, FILLBRUSH, DRAWTEXT, SHADOW

### DRAWTEXT
- **스펙 위치:** §5.6 (표 131)
- **부모:** DRAWINGOBJECT
- **속성:**
  - `LastWidth` — 텍스트 최대 폭
  - `Name` — 글상자 이름
  - `Editable` (boolean) — 편집 가능. 기본값 `false`
- **자식 요소:** TEXTMARGIN, PARALIST

### TEXTMARGIN
- **스펙 위치:** §5.6 (표 132)
- **부모:** DRAWTEXT
- **속성:**
  - `Left`, `Right`, `Top`, `Bottom` ([hwpunit]) — 기본값 `238`

### LINE
- **스펙 위치:** §5.6.1 (표 133)
- **부모:** TEXT
- **속성:**
  - `StartX`, `StartY`, `EndX`, `EndY` ([hwpunit]) — 좌표
  - `IsReverseHV` (boolean) — 방향 보정 플래그. 기본값 `false`
- **자식 요소:** SHAPEOBJECT, DRAWINGOBJECT

### RECTANGLE
- **스펙 위치:** §5.6.2 (표 134)
- **부모:** TEXT
- **속성:**
  - `Ratio` — 모서리 곡률 (%) (0=직각, 20=둥근, 50=반원)
  - `X0`~`Y2` — 사각형 좌표
- **자식 요소:** SHAPEOBJECT, DRAWINGOBJECT

### ELLIPSE
- **스펙 위치:** §5.6.3 (표 135)
- **부모:** TEXT
- **속성:**
  - `IntervalDirty` (boolean) — 기본값 `false`
  - `HasArcProperty` (boolean) — 호 변환 여부. 기본값 `false`
  - `ArcType` (enum: `Normal` | `Pie` | `Chord`) — 기본값 `Normal`
  - `CenterX`, `CenterY` — 중심
  - `Axis1X`, `Axis1Y`, `Axis2X`, `Axis2Y` — 축
  - `Start1X`~`End2Y` — 호 좌표
- **자식 요소:** SHAPEOBJECT, DRAWINGOBJECT

### ARC
- **스펙 위치:** §5.6.4 (표 136)
- **부모:** TEXT
- **속성:**
  - `Type` (enum: `Normal` | `Pie` | `Chord`) — 기본값 `Normal`
  - `CenterX`, `CenterY`, `Axis1X`, `Axis1Y`, `Axis2X`, `Axis2Y` — 좌표
- **자식 요소:** SHAPEOBJECT, DRAWINGOBJECT

### POLYGON
- **스펙 위치:** §5.6.5 (표 137)
- **부모:** TEXT
- **자식 요소:** SHAPEOBJECT, DRAWINGOBJECT, POINT

### POINT
- **스펙 위치:** §5.6.5 (표 138)
- **부모:** POLYGON, OUTLINEDATA
- **속성:** `X`, `Y` — 좌표

### CURVE
- **스펙 위치:** §5.6.6 (표 139)
- **부모:** TEXT
- **자식 요소:** SHAPEOBJECT, DRAWINGOBJECT, SEGMENT

### SEGMENT
- **스펙 위치:** §5.6.6 (표 140)
- **부모:** CURVE
- **속성:**
  - `Type` (enum: `Line` | `Curve`) — 기본값 `Curve`
  - `X1`, `Y1`, `X2`, `Y2` — 좌표

### CONNECTLINE
- **스펙 위치:** §5.6.7 (표 141)
- **부모:** TEXT
- **속성:** `Type`, `StartX`, `StartY`, `EndX`, `EndY`, `StartSubjectID`, `StartSubjectIndex`, `EndSubjectID`, `EndSubjectIndex`
- **자식 요소:** SHAPEOBJECT, DRAWINGOBJECT

### UNKNOWNOBJECT
- **스펙 위치:** §5.7 (표 142)
- **부모:** TEXT
- **속성:**
  - `Ctrlid` — ID
  - `X0`~`Y3` — master 좌표
- **자식 요소:** SHAPEOBJECT, DRAWINGOBJECT

---

### §5.8 양식 객체

### FORMOBJECT
- **스펙 위치:** §5.8 (표 143)
- **부모:** BUTTON, RADIOBUTTON, CHECKBUTTON, COMBOBOX, EDIT, LISTBOX, SCROLLBAR
- **속성:**
  - `Name` — 이름
  - `ForeColor` — 전경색
  - `BackColor` — 배경색
  - `GroupName` — 그룹 이름
  - `TabStop` (boolean) — 탭키 머무름. 기본값 `true`
  - `TapOrder` (boolean) — 탭 이동 순서. 기본값 `true`
  - `Enabled` — 활성화. 기본값 `0`
  - `BorderType` — 경계선 종류
  - `DrawFrame` (boolean) — 기본값 `true`
  - `Printable` (boolean) — 출력. 기본값 `true`
- **자식 요소:** PARAMETERSET, FORMCHARSHAPE, BUTTONSET

### FORMCHARSHAPE
- **스펙 위치:** §5.8 (표 144)
- **부모:** FORMOBJECT
- **속성:**
  - `CharShape` — 글자 모양. 기본값 `0`
  - `FollowContext` (boolean) — 기본값 `false`
  - `AutoSize` (boolean) — 자동 크기. 기본값 `false`
  - `WordWrap` (boolean) — 줄 내림. 기본값 `false`

### BUTTONSET
- **스펙 위치:** §5.8 (표 145)
- **부모:** FORMOBJECT
- **속성:** `Caption`, `Value`, `RadioGroupName`, `TriState`, `BackStyle`

### BUTTON
- **스펙 위치:** §5.8 (표 146)
- **부모:** TEXT
- **자식 요소:** SHAPEOBJECT, FORMOBJECT

### RADIOBUTTON
- **스펙 위치:** §5.8.1 (표 147)
- **부모:** TEXT
- **자식 요소:** SHAPEOBJECT, FORMOBJECT

### CHECKBUTTON
- **스펙 위치:** §5.8.2 (표 148)
- **부모:** TEXT
- **자식 요소:** SHAPEOBJECT, FORMOBJECT

### COMBOBOX
- **스펙 위치:** §5.8.3 (표 149)
- **부모:** TEXT
- **속성:** `ListBoxRows`, `ListBoxWidth`, `Text`, `EditEnable`
- **자식 요소:** SHAPEOBJECT, FORMOBJECT

### EDIT
- **스펙 위치:** §5.8.4 (표 150)
- **부모:** TEXT
- **속성:** `MultiLine`, `PasswordChar`, `MaxLength`, `ScrollBars`, `TabKeyBehavior`, `Number`, `ReadOnly` (boolean), `AlignText`
- **자식 요소:** SHAPEOBJECT, FORMOBJECT, EDITTEXT

### EDITTEXT
- **스펙 위치:** §5.8.4 (표 151)
- **부모:** EDIT
- **엘리먼트 값:** 문자열

### LISTBOX
- **스펙 위치:** §5.8.5 (표 152)
- **부모:** TEXT
- **속성:** `Text`, `ItemHeight`, `TopIndex`
- **자식 요소:** SHAPEOBJECT, FORMOBJECT

### SCROLLBAR
- **스펙 위치:** §5.8.6 (표 153)
- **부모:** TEXT
- **속성:** `Delay`, `LargeChange`, `SmallChange`, `Min`, `Max`, `Page`, `Value`, `Type`
- **자식 요소:** SHAPEOBJECT, FORMOBJECT

---

### §5.9 묶음 객체

### CONTAINER
- **스펙 위치:** §5.9 (표 154)
- **부모:** TEXT
- **자식 요소:** SHAPEOBJECT, SHAPECOMPONENT, CONTAINER, LINE, RECTANGLE, ELLIPSE, ARC, POLYGON, CURVE, CONNECTLINE, PICTURE, OLE

---

### §5.10 OLE 객체

### OLE
- **스펙 위치:** §5.10 (표 155)
- **부모:** TEXT
- **속성:**
  - `ObjectType` (enum: `Unknown` | `Embedded` | `Link` | `Static` | `Equation`) — 종류
  - `ExtentX`, `ExtentY` — 크기
  - `BinItem` — 바이너리 참조
  - `DrawAspect` (enum: `Content` | `ThumbNail` | `Icon` | `DocPrint`)
  - `HasMoniker` (boolean) — 기본값 `false`
  - `EqBaseLine` (boolean) — 기본값 `false`
- **자식 요소:** SHAPEOBJECT, SHAPECOMPONENT, LINESHAPE

---

### §5.11 한글 97 수식

### EQUATION
- **스펙 위치:** §5.11 (표 156)
- **부모:** TEXT
- **속성:**
  - `LineMode` (boolean) — `true`=줄 단위, `false`=글자 단위. 기본값 `false`
  - `BaseUnit` ([hwpunit]) — 수식 글자 크기. 기본값 `1000`
  - `TextColor` ([RGB-Color]) — 글자 색. 기본값 `0`
  - `BaseLine` — 베이스라인
  - `Version` — 버전
- **자식 요소:** SHAPEOBJECT, SCRIPT

### SCRIPT
- **스펙 위치:** §5.11 (표 157)
- **부모:** EQUATION
- **엘리먼트 값:** 수식 스크립트 문자열

---

### §5.12 글맵시

### TEXTART
- **스펙 위치:** §5.12 (표 158)
- **부모:** TEXT
- **속성:**
  - `Text` — 내용
  - `X0`~`Y3` — master 좌표
- **자식 요소:** TEXTARTSHAPE, OUTLINEDATA

### TEXTARTSHAPE
- **스펙 위치:** §5.12 (표 159)
- **부모:** TEXTART
- **속성:**
  - `FontName` — 폰트 이름
  - `FontStyle` — 기본값 `Regular`
  - `FontType` (enum: `ttf` | `htf`) — 기본값 `ttf`
  - `TextShape` (0~39) — 기본값 `0`
  - `LineSpacing` (50~500) — 기본값 `120`
  - `CharSpacing` (50~500) — 기본값 `100`
  - `Align` (enum: `Left` | `Right` | `Center` | `Full` | `Table`) — 기본값 `Left`
- **자식 요소:** SHADOW

### OUTLINEDATA
- **스펙 위치:** §5.12 (표 160)
- **부모:** TEXTART
- **속성:**
  - `Count` (정수, 0 이상) — 포인트 개수
- **자식 요소:** POINT

---

### §5.13 필드 시작/끝

### FIELDBEGIN
- **스펙 위치:** §5.13 (표 161)
- **부모:** TEXT
- **속성:**
  - `Type` (enum: [FieldType]) — 필드 종류
  - `Name` — 필드 이름
  - `InstId` — 인스턴스 아이디
  - `Editable` (boolean) — 수정 가능. 기본값 `true`
  - `Dirty` (boolean) — 수정됨. 기본값 `false`
  - `Property` — 기타 속성
  - `Command` — 명령 문자열

### FIELDEND
- **스펙 위치:** §5.14 (표 162)
- **부모:** TEXT
- **속성:**
  - `Type` (enum: [FieldType]) — 필드 종류
  - `Editable` (boolean) — 기본값 `true`
  - `Property` — 기타 속성

### BOOKMARK
- **스펙 위치:** §5.15 (표 163)
- **부모:** TEXT
- **속성:**
  - `Name` — 책갈피 이름

---

### §5.16~5.25 기타 본문 엘리먼트

### HEADER / FOOTER
- **스펙 위치:** §5.16 (표 164)
- **부모:** TEXT
- **속성:**
  - `ApplyPageType` (enum: `Both` | `Even` | `Odd`) — 기본값 `Both`
  - `SeriesNum` — 구역내 일련번호
- **자식 요소:** PARALIST

### FOOTNOTE / ENDNOTE
- **스펙 위치:** §5.17 (표 165)
- **부모:** TEXT
- **자식 요소:** PARALIST

### AUTONUM / NEWNUM
- **스펙 위치:** §5.18 (표 166)
- **부모:** TEXT
- **속성:**
  - `Number` — 번호. 기본값 `1`
  - `NumberType` (enum: `Page` | `Footnote` | `Endnote` | `Figure` | `Table` | `Equation` | `TotalPage`) — 종류

### PAGENUMCTRL
- **스펙 위치:** §5.19 (표 167)
- **부모:** TEXT
- **속성:**
  - `PageStartsOn` (enum: `Both` | `Even` | `Odd`) — 기본값 `Both`

### PAGEHIDING
- **스펙 위치:** §5.20 (표 168)
- **부모:** TEXT
- **속성:**
  - `HideHeader`, `HideFooter`, `HideMasterPage`, `HideBorder`, `HideFill`, `HidePageNum` (모두 boolean, 기본값 `false`)

### PAGENUM
- **스펙 위치:** §5.21 (표 169)
- **부모:** TEXT
- **속성:**
  - `Pos` (enum: `None` | `TopLeft` | `TopCenter` | `TopRight` | `BottomLeft` | `BottomCenter` | `BottomRight` | `OutsideTop` | `OutsideBottom` | `InsideTop` | `InsideBottom`) — 기본값 `TopLeft`
  - `FormatType` (enum: [NumberType1]) — 기본값 `Digit`
  - `SideChar` — 줄 표. 기본값 `-`

### INDEXMARK
- **스펙 위치:** §5.22 (표 170)
- **부모:** TEXT
- **자식 요소:** KEYFIRST, KEYSECOND

### KEYFIRST
- **스펙 위치:** §5.22 (표 171)
- **부모:** INDEXMARK
- **엘리먼트 값:** 키워드 문자열

### KEYSECOND
- **스펙 위치:** §5.22 (표 172)
- **부모:** INDEXMARK
- **엘리먼트 값:** 키워드 문자열

### COMPOSE
- **스펙 위치:** §5.23 (표 173)
- **부모:** TEXT
- **속성:** `CircleType`, `CharSize`, `ComposeType`, `CharShapeSize`
- **자식 요소:** COMPCHARSHAPE

### COMPCHARSHAPE
- **스펙 위치:** §5.23 (표 174)
- **부모:** COMPOSE
- **속성:** `ShapeID` — 글자 모양 식별자

### DUTMAL
- **스펙 위치:** §5.24 (표 175)
- **부모:** TEXT
- **속성:**
  - `PosType` (enum: `Top` | `Bottom`) — 기본값 `Top`
  - `SizeRatio` — 크기 비율
  - `Option` — 옵션
  - `StyleNo` — 스타일 번호
  - `Align` (enum: [AlignmentType1]) — 기본값 `Center`
- **자식 요소:** MAINTEXT, SUBTEXT

### MAINTEXT
- **스펙 위치:** §5.24 (표 176)
- **부모:** DUTMAL
- **엘리먼트 값:** 본말 내용

### SUBTEXT
- **스펙 위치:** §5.24 (표 177)
- **부모:** DUTMAL
- **엘리먼트 값:** 덧말 내용

### HIDDENCOMMENT
- **스펙 위치:** §5.25 (표 178)
- **부모:** TEXT
- **자식 요소:** PARALIST

---

## §6: 부가 정보 엘리먼트

### TAIL
- **스펙 위치:** §6 (표 179)
- **부모:** HWPML
- **자식 요소:** BINDATASTORAGE, SCRIPTCODE, XMLTEMPLATE

### BINDATASTORAGE
- **스펙 위치:** §6 (표 180)
- **부모:** TAIL
- **자식 요소:** BINDATA

### BINDATA
- **스펙 위치:** §6 (표 181)
- **부모:** BINDATASTORAGE
- **엘리먼트 값:** 바이너리 데이터 (Base64)
- **속성:**
  - `Id` (문자열) — 아이디
  - `Size` — 크기
  - `Encoding` — 인코딩. 기본값 `Base64`
  - `Compress` (boolean) — 압축. 기본값 `true`

### SCRIPTCODE
- **스펙 위치:** §6 (표 182)
- **부모:** TAIL
- **속성:**
  - `Type` — 종류. 기본값 `JScript`
  - `Version` — 버전
- **자식 요소:** SCRIPTHEADER, SCRIPTSOURCE, PRESCRIPT, POSTSCRIPT

### SCRIPTHEADER
- **스펙 위치:** §6 (표 183)
- **부모:** SCRIPTCODE
- **엘리먼트 값:** 문자열

### SCRIPTSOURCE
- **스펙 위치:** §6 (표 184)
- **부모:** SCRIPTCODE
- **엘리먼트 값:** 문자열

### PRESCRIPT / POSTSCRIPT
- **스펙 위치:** §6 (표 185)
- **부모:** SCRIPTCODE
- **속성:**
  - `Count` (정수, 0 이상) — 함수 개수
- **자식 요소:** SCRIPTFUNCTION

### SCRIPTFUNCTION
- **스펙 위치:** §6 (표 186)
- **부모:** PRESCRIPT, POSTSCRIPT
- **엘리먼트 값:** 문자열

### XMLTEMPLATE
- **스펙 위치:** §6 (표 187)
- **부모:** TAIL
- **자식 요소:** SCHEMA, INSTANCE

### SCHEMA
- **스펙 위치:** §6 (표 188)
- **부모:** XMLTEMPLATE
- **엘리먼트 값:** 문자열

### INSTANCE
- **스펙 위치:** §6 (표 189)
- **부모:** XMLTEMPLATE
- **엘리먼트 값:** 문자열

---

### 부록: HEAD 하위 추가 엘리먼트

### COMPATIBLEDOCUMENT
- **스펙 위치:** (표 190)
- **부모:** HEAD
- **속성:**
  - `TargetProgram` (enum: `None` | `Hwp70` | `Word`) — 기본값 `None`
- **자식 요소:** LAYOUTCOMPATIBILITY

### LAYOUTCOMPATIBILITY
- **스펙 위치:** (표 191)
- **부모:** COMPATIBLEDOCUMENT
- **속성:** 37개 boolean 플래그 (모두 기본값 `false`):
  `ApplyFontWeightToBold`, `UseInnerUnderline`, `FixedUnderlineWidth`, `DoNotApplyStrikeout`, `UseLowercaseStrikeout`, `ExtendLineheightToOffset`, `TreatQuotationAsLatin`, `DoNotAlignWhitespaceOnRight`, `DoNotAdjustWordInJustify`, `BaseCharUnitOnEAsian`, `BaseCharUnitOfIndentOnFirstChar`, `AdjustLineheightToFont`, `AdjustBaselineInFixedLinespacing`, `ExcludeOverlappingParaSpacing`, `ApplyNextspacingOfLastPara`, `ApplyAtLeastToPercent100Pct`, `DoNotApplyAutoSpaceEAsianEng`, `DoNotApplyAutoSpaceEAsianNum`, `AdjustParaBorderfillToSpacing`, `ConnectParaBorderfillOfEqualBorder`, `AdjustParaBorderOffsetWithBorder`, `ExtendLineheightToParaBorderOffset`, `ApplyParaBorderToOutside`, `BaseLinespacingOnLinegrid`, `ApplyCharSpacingToCharGrid`, `DoNotApplyGridInHeaderfooter`, `ExtendHeaderfooterToBody`, `AdjustEndnotePositionToFootnote`, `DoNotApplyImageEffect`, `DoNotApplyShapeComment`, `DoNotAdjustEmptyAnchorLine`, `OverlapBothAllowOverlap`, `DoNotApplyVertOffsetOfForward`, `ExtendVertLimitToPageMargins`, `DoNotHoldAnchorOfTable`, `DoNotFormattingAtBeneathAnchor`, `DoNotApplyExtensionCharCompose`

---

## 부록: HWPX 파일 대조 검증

테스트 파일: `/Users/mj/clawd/research/test-hwpx.hwpx` (ZIP)

### 파일 구조
```
Contents/content.hpf
Contents/header.xml
Contents/section0.xml
META-INF/container.rdf
META-INF/container.xml
META-INF/manifest.xml
Preview/PrvImage.png
Preview/PrvText.txt
mimetype
settings.xml
version.xml
```

### ⚠️ 중요: HWPML 스펙 vs HWPX 실제 차이

HWPML 스펙(이 문서)은 **단일 XML 형식** (`HWPML > HEAD > BODY > TAIL`)을 기술한다.
HWPX는 이를 **OPF 패키징 구조**로 분리하여 네임스페이스 기반으로 재구성한 형식이다.

### HWPX 네임스페이스 (스펙에 없음, 실제 파일에서 확인)
| 접두사 | URI | 역할 |
|---|---|---|
| `hh` | `http://www.hancom.co.kr/hwpml/2011/head` | 헤더 |
| `hc` | `http://www.hancom.co.kr/hwpml/2011/core` | 공통 |
| `hp` | `http://www.hancom.co.kr/hwpml/2011/paragraph` | 문단 |
| `hp10` | `http://www.hancom.co.kr/hwpml/2016/paragraph` | 문단 (2016) |
| `hs` | `http://www.hancom.co.kr/hwpml/2011/section` | 섹션 |
| `ha` | `http://www.hancom.co.kr/hwpml/2011/app` | 앱 |
| `hm` | `http://www.hancom.co.kr/hwpml/2011/master-page` | 바탕쪽 |
| `hhs` | `http://www.hancom.co.kr/hwpml/2011/history` | 이력 |
| `hwpunitchar` | `http://www.hancom.co.kr/hwpml/2016/HwpUnitChar` | 단위 |

### header.xml: HWPML 스펙 요소 ↔ HWPX 매핑

| HWPML 스펙 요소 | HWPX 실제 요소 | 비고 |
|---|---|---|
| `HEAD` | `hh:head` | 루트, camelCase화 |
| `BEGINNUMBER` | `hh:beginNum` | 속성명도 camelCase: `page`, `footnote` 등 |
| `MAPPINGTABLE` → `FACENAMELIST` | `hh:refList` → `hh:fontfaces` | 이름 변경 |
| `FONTFACE` | `hh:fontface` | `lang` 속성: `HANGUL`, `LATIN` 등 |
| `FONT` | `hh:font` | `id`, `face`(=Name), `type`, `isEmbedded` |
| `TYPEINFO` | `hh:typeInfo` | 동일 속성, camelCase |
| `BORDERFILLLIST` | `hh:borderFills` | `itemCnt` (=Count) |
| `BORDERFILL` | `hh:borderFill` | `id`, `threeD`, `shadow`, `centerLine`, `breakCellSeparateLine` |
| `LEFTBORDER` 등 | `hh:leftBorder` 등 | 동일 |
| `FILLBRUSH` | `hc:fillBrush` | `hc` 네임스페이스 |
| `WINDOWBRUSH` | `hc:winBrush` | `faceColor`, `hatchColor`, `alpha` |
| `CHARSHAPELIST` | `hh:charProperties` | `itemCnt` |
| `CHARSHAPE` | `hh:charPr` | `id`, `height`, `textColor`, `shadeColor` 등 |
| `FONTID` | `hh:fontRef` | `hangul`, `latin` 등 |
| `RATIO` | `hh:ratio` | 동일 |
| `CHARSPACING` | `hh:spacing` | 동일 |
| `RELSIZE` | `hh:relSz` | 동일 |
| `CHAROFFSET` | `hh:offset` | 동일 |
| `UNDERLINE` | `hh:underline` | 동일 |
| `STRIKEOUT` | `hh:strikeout` | `shape`(=Type 변경?) |
| `OUTLINE` | `hh:outline` | 동일 |
| `SHADOW` | `hh:shadow` | 동일 |
| `TABDEFLIST` | `hh:tabProperties` | `itemCnt` |
| `TABDEF` | `hh:tabPr` | `id`, `autoTabLeft`, `autoTabRight` |
| `NUMBERINGLIST` | `hh:numberings` | `itemCnt` |
| `NUMBERING` | `hh:numbering` | `id`, `start` |
| `PARAHEAD` | `hh:paraHead` | 동일 속성 camelCase |
| `PARASHAPELIST` | `hh:paraProperties` | `itemCnt` |
| `PARASHAPE` | `hh:paraPr` | 속성 camelCase |
| `PARAMARGIN` | `hh:margin` (내부에 `hc:intent`, `hc:left` 등) | **구조 변경** |
| `PARABORDER` | `hh:border` | `borderFillIDRef` |
| `STYLELIST` | `hh:styles` | `itemCnt` |
| `STYLE` | `hh:style` | `id`, `type`, `name`, `engName`, `paraPrIDRef`, `charPrIDRef` 등 |
| `COMPATIBLEDOCUMENT` | `hh:compatibleDocument` | `targetProgram` |
| `LAYOUTCOMPATIBILITY` | `hh:layoutCompatibility` | 동일 |

### section0.xml: HWPML 스펙 요소 ↔ HWPX 매핑

| HWPML 스펙 요소 | HWPX 실제 요소 | 비고 |
|---|---|---|
| `SECTION` | `hs:sec` (ns0:sec) | 루트 |
| `P` | `hp:p` (ns1:p) | `id`, `paraPrIDRef`, `styleIDRef`, `pageBreak`, `columnBreak`, `merged` |
| `TEXT` | `hp:run` | **이름 변경**: TEXT → run, `charPrIDRef` |
| `SECDEF` | `hp:secPr` | 속성 camelCase |
| `STARTNUMBER` | `hp:startNum` | 동일 |
| `HIDE` | `hp:visibility` | **이름 변경** |
| `PAGEDEF` | `hp:pagePr` | `landscape`=`WIDELY`, `width`, `height` |
| `PAGEMARGIN` | `hp:margin` | `header`, `footer`, `gutter`, `left`, `right`, `top`, `bottom` |
| `FOOTNOTESHAPE` | `hp:footNotePr` | 이름 변경 |
| `ENDNOTESHAPE` | `hp:endNotePr` | 이름 변경 |
| `AUTONUMFORMAT` | `hp:autoNumFormat` | 동일 |
| `NOTELINE` | `hp:noteLine` | 동일 |
| `NOTESPACING` | `hp:noteSpacing` | 동일 |
| `NOTENUMBERING` | `hp:numbering` | 이름 변경 |
| `NOTEPLACEMENT` | `hp:placement` | 이름 변경 |
| `PAGEBORDERFILL` | `hp:pageBorderFill` | 동일 |
| `PAGEOFFSET` | `hp:offset` | 이름 변경 |
| `COLDEF` | `hp:colPr` (hp:ctrl 내부) | **구조 변경** |
| 문자열 내용 | `hp:t` | `TEXT` 안 글자 → `hp:t` |
| `CHAR` → 여러 종류 | `hp:run` | HWPX에서는 run 단위 |
| `LINEBREAK` 등 | `hp:linesegarray` / `hp:lineseg` | 줄 세그먼트 정보 (스펙에 직접 없음) |

### HWPX에서 발견되었으나 HWPML 스펙에 없는 요소/속성

| 요소/속성 | 위치 | 설명 |
|---|---|---|
| `hh:head/@version` | header.xml | 값 `1.5` (HWPML Version과 별도) |
| `hh:head/@secCnt` | header.xml | camelCase 버전 |
| `hh:font/@isEmbedded` | header.xml | 글꼴 내장 여부 |
| `hh:font/@face` | header.xml | `Name` 대신 `face` 사용 |
| `hh:borderFill/@centerLine` | header.xml | 스펙에 없는 속성 |
| `hh:slash`, `hh:backSlash` | header.xml | BORDERFILL 속성이 자식 요소로 분리 |
| `hh:charPr/@symMark` | header.xml | enum 값 `NONE` (스펙은 숫자) |
| `hh:charPr/@borderFillIDRef` | header.xml | `BorderFillId`의 IDRef 형태 |
| `hh:align` | header.xml (paraPr 내) | PARASHAPE의 Align이 자식 요소로 분리 |
| `hh:heading` | header.xml (paraPr 내) | HeadingType이 자식 요소로 분리 |
| `hh:breakSetting` | header.xml (paraPr 내) | 줄나눔 설정이 자식 요소로 분리 |
| `hh:autoSpacing` | header.xml (paraPr 내) | 자동 간격이 자식 요소로 분리 |
| `hh:lineSpacing` | header.xml (paraPr 내) | 줄간격이 자식 요소로 분리 |
| `hp:switch` / `hp:case` / `hp:default` | header.xml | 조건부 호환성 분기 (네임스페이스 기반) |
| `hh:docOption` | header.xml | 문서 옵션 |
| `hh:linkinfo` | header.xml | 연결 정보 |
| `hh:metaTag` | header.xml | JSON 메타데이터 |
| `hh:trackchageConfig` | header.xml | 변경 추적 설정 |
| `hp:p/@merged` | section0.xml | 병합 여부 |
| `hp:secPr/@id` | section0.xml | 빈 문자열 |
| `hp:secPr/@textVerticalWidthHead` | section0.xml | 스펙 속성과 동일 |
| `hp:secPr/@masterPageCnt` | section0.xml | 스펙에 없음 |
| `hp:grid` | section0.xml | LineGrid/CharGrid가 자식 요소로 분리 |
| `hp:lineNumberShape` | section0.xml | 줄번호 모양 (스펙에 없음) |
| `hp:linesegarray` / `hp:lineseg` | section0.xml | 줄 세그먼트 배열 (레이아웃 정보) |
| `hp:ctrl` | section0.xml | 컨트롤 래퍼 요소 |
| `hp:colPr` | section0.xml | COLDEF의 HWPX 버전 |
| 단위 속성: `unit="HWPUNIT"` | header.xml (margin 등) | HWPX에서 명시적 단위 속성 추가 |
| `hc:intent`, `hc:left` 등 | header.xml (margin 내) | PARAMARGIN 속성이 자식 요소로 분리 |

---

## 통계 요약

- **HWPML 스펙 정의 엘리먼트:** 약 130개 (표 2~191)
- **기본 속성 값 타입:** 18종
- **HWPX 검증 결과:** 대부분의 요소는 스펙과 1:1 대응하나, HWPX에서는:
  1. 요소명이 **camelCase로 변환** (HEAD→head, CHARSHAPE→charPr 등)
  2. 일부 속성이 **자식 요소로 분리** (Align→`hh:align`, Slash→`hh:slash`)
  3. **네임스페이스 분리** (hh/hc/hp/hs 등)
  4. **조건부 분기** (`hp:switch`/`hp:case`) 메커니즘 추가
  5. `hp:run`(=TEXT), `hp:t`(텍스트), `hp:lineseg` 등 새 요소 추가
