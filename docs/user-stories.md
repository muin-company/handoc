# HanDoc — 사용자 시나리오 & 구체적 요구사항

> **버전:** 1.0 | 2026-02-20
> **목적:** "왜 만드는가"를 구체적 시나리오로 정의

---

## 시장이 실제로 사는 것 (시냅소프트 레퍼런스)

시냅소프트의 매출 구조에서 역으로 시장 수요를 추출:

| 제품 | 고객 | 해결하는 문제 |
|------|------|-------------|
| 문서필터 | 포털, 검색엔진, AI 기업 | HWP에서 텍스트 추출 (검색 인덱싱, RAG) |
| 문서뷰어 | 금융, 공공, 기업 그룹웨어 | 웹에서 HWP 열람 (다운로드 없이) |
| 에디터 | 기업 전자결재 | 웹에서 HWP 편집 |
| OCR | 공공, 금융 | 스캔 문서 텍스트화 |

**2025년 트렌드:** "RAG 기반 AI 필수 도구" — LLM이 HWP 내용을 이해하려면 텍스트 추출이 필수.

---

## 사용자 시나리오 (구체적)

### US-01: RAG 파이프라인에서 HWP 문서 처리
> **사용자:** AI/LLM 서비스 개발자
> **상황:** RAG 시스템을 구축 중. 고객이 업로드하는 문서 중 30%가 HWP/HWPX.
> **현재:** 시냅소프트 문서필터 연간 라이선스 (수천만원) 또는 HWP 무시.
> **HanDoc으로:** `npm install @handoc/hwpx-parser` → 서버에서 직접 텍스트 추출. 무료.

```typescript
// RAG 파이프라인에서 HWPX 처리
import { OpcPackage } from '@handoc/hwpx-core';
import { parseHwpx, extractAllText } from '@handoc/hwpx-parser';

async function processDocument(buffer: Uint8Array): Promise<string> {
  const pkg = await OpcPackage.open(buffer);
  const { document } = await parseHwpx(pkg);
  return extractAllText(document); // 전체 텍스트를 하나의 문자열로
}

// → LLM embedding → 벡터 DB → RAG 검색
```

**필요한 기능:**
- HWPX → 플레인 텍스트 추출 (FR-01)
- 표 데이터도 텍스트로 (행/열 구조 보존하거나 플랫하게)
- 이미지 alt text 또는 캡션 추출
- 메타데이터 (제목, 작성자, 날짜)

**수용 기준:** 한컴오피스 "텍스트로 저장" 결과와 90% 이상 일치

---

### US-02: 웹 서비스에서 HWPX 문서 미리보기
> **사용자:** SaaS 개발자 (문서 관리, 그룹웨어, LMS)
> **상황:** 사용자가 업로드한 HWPX를 웹에서 바로 보여줘야 함.
> **현재:** 시냅소프트 문서뷰어 임베드 (유료) 또는 "다운로드 받아서 보세요".
> **HanDoc으로:** HWPX → HTML 변환 → 웹에서 렌더링.

```typescript
// HWPX → 구조화된 HTML
import { parseHwpx } from '@handoc/hwpx-parser';
import { toHtml } from '@handoc/hwpx-renderer'; // Phase 2

const html = toHtml(document, { 
  includeStyles: true,  // 글꼴, 색상, 크기 반영
  includeTables: true,   // 표 구조 유지
  includeImages: true    // 이미지 인라인
});
```

**필요한 기능:**
- HWPX → 구조화된 데이터 (Phase 1: JSON/객체)
- HWPX → HTML (Phase 2: 렌더러)
- 스타일 정보 보존 (글꼴, 크기, 색상, 정렬)
- 표 구조 완전 보존
- 이미지 추출 + 인라인 포함

**수용 기준:** 원본 대비 레이아웃 유사도 80% 이상 (Phase 2)

---

### US-03: 프로그래밍으로 HWPX 보고서 생성
> **사용자:** 기업 내부 개발자, 공공기관 SI
> **상황:** 매월 정기 보고서를 HWPX로 제출해야 함. 데이터는 DB에 있음.
> **현재:** 한컴오피스 매크로 또는 수작업.
> **HanDoc으로:** DB 데이터 → HwpxBuilder → HWPX 파일 자동 생성.

```typescript
// 월간 보고서 자동 생성
import { HwpxBuilder } from '@handoc/hwpx-writer';

const report = new HwpxBuilder('a4')
  .addParagraph('2026년 2월 월간 보고서', { bold: true, fontSize: 18, align: 'center' })
  .addParagraph('')
  .addParagraph('1. 매출 현황', { bold: true, fontSize: 14 })
  .addTable(data.length + 1, 4)
    .setHeaderRow(['항목', '목표', '실적', '달성률'])
    .setRows(data.map(d => [d.item, d.target, d.actual, d.rate]))
    .end()
  .addParagraph('')
  .addParagraph('2. 주요 이슈', { bold: true, fontSize: 14 })
  .addParagraph(issues.join('\n'));

const buffer = await report.toBuffer();
// → 이메일 첨부 또는 문서 시스템에 업로드
```

**필요한 기능:**
- 빌더 API (텍스트, 표, 스타일)
- 표 생성 (헤더 행, 데이터 행, 셀 병합)
- 기본 서식 (굵게, 기울임, 글꼴 크기, 정렬)
- 생성된 파일이 한컴오피스에서 정상 열림

**수용 기준:** 한컴오피스에서 열었을 때 내용 + 서식 정확

---

### US-04: HWPX 문서 내 개인정보 탐지
> **사용자:** 보안/컴플라이언스 담당자, 보안 솔루션 개발자
> **상황:** 기업 내 문서에서 주민번호, 전화번호, 계좌번호 등 개인정보 자동 탐지.
> **현재:** 시냅소프트 문서필터 + 정규식 매칭.
> **HanDoc으로:** 텍스트 추출 + 정규식 → 무료.

```typescript
const text = extractAllText(document);
const piiPatterns = [
  /\d{6}-[1-4]\d{6}/g,           // 주민번호
  /01[0-9]-\d{3,4}-\d{4}/g,      // 전화번호
  /\d{3}-\d{2}-\d{5}/g,          // 사업자번호
];
const findings = piiPatterns.flatMap(p => [...text.matchAll(p)]);
```

**필요한 기능:** US-01과 동일 (텍스트 추출)

---

### US-05: 자사 제품 (검시AI) — 학습 자료 HWP 처리
> **사용자:** 검시AI (무인기업 자사 제품)
> **상황:** 검정고시 기출문제, 학습 자료가 HWPX로 배포됨.
> **HanDoc으로:** HWPX 파일 업로드 → 문제/해설 추출 → AI 튜터에 입력.

```typescript
// 기출문제 HWPX → 구조화된 문제 데이터
const { document } = await parseHwpx(pkg);
const questions = extractQuestions(document); // 표에서 문제/보기/정답 추출
```

**필요한 기능:**
- 텍스트 추출
- 표 구조 파싱 (문제 번호, 보기, 정답이 표 형태로 되어 있음)
- 이미지 추출 (수학 문제의 그림)

---

## 우선순위 정리

시나리오별 필요 기능을 매핑하면:

| 기능 | US-01 RAG | US-02 뷰어 | US-03 쓰기 | US-04 PII | US-05 검시AI |
|------|-----------|-----------|-----------|-----------|-------------|
| 텍스트 추출 | ✅ 핵심 | ✅ | | ✅ 핵심 | ✅ 핵심 |
| 표 구조 파싱 | ✅ | ✅ | | ✅ | ✅ 핵심 |
| 스타일 정보 | | ✅ 핵심 | ✅ | | |
| 이미지 추출 | | ✅ | | | ✅ |
| 메타데이터 | ✅ | ✅ | | | |
| 문서 생성 | | | ✅ 핵심 | | |
| HTML 변환 | | ✅ 핵심 | | | |

**Phase 1 핵심 (가장 많은 시나리오가 필요로 하는 것):**
1. **텍스트 추출** — 4/5 시나리오
2. **표 구조 파싱** — 4/5 시나리오
3. **메타데이터** — 2/5 시나리오
4. **이미지 추출** — 2/5 시나리오
5. **문서 생성 (빌더)** — 1/5 시나리오

---

## 수정된 기능 요구사항

### FR-01: HWPX 텍스트 추출 (최우선)
HWPX 파일에서 모든 텍스트를 추출한다.

**입력:** HWPX 파일 (Uint8Array)
**출력:** 
- `extractAllText(doc)` → `string` (전체 텍스트, 줄바꿈으로 구분)
- `extractStructuredText(doc)` → `{ paragraphs: { text: string; style?: string }[] }[]` (섹션별 단락)

**범위:**
- 단락 텍스트 ✅
- 표 안의 텍스트 ✅ (행/열 순서 보존)
- 머리말/꼬리말 텍스트 ✅
- 각주/미주 텍스트 ✅
- 메모 텍스트 ✅

**수용 기준:** 
- 한컴오피스 "텍스트로 저장" 결과와 텍스트 내용 90% 이상 일치
- python-hwpx 추출 결과와 100% 일치 (크로스 밸리데이션)
- 5개 테스트 픽스처 + 실제 한컴오피스 생성 파일 10종

### FR-02: HWPX 표 구조 추출
HWPX 파일에서 표 데이터를 구조화된 형태로 추출한다.

**입력:** HWPX 파일
**출력:** `extractTables(doc)` → `Table[]`
```typescript
interface Table {
  rows: TableRow[];
}
interface TableRow {
  cells: TableCell[];
}
interface TableCell {
  text: string;
  colSpan?: number;
  rowSpan?: number;
}
```

**수용 기준:** 
- 기본 표 (3×3) 정확 추출
- 셀 병합 표 구조 보존
- 표 안의 표 (중첩) — Phase 1에서는 미지원, 에러 없이 스킵

### FR-03: HWPX 메타데이터 추출
content.hpf에서 문서 메타데이터를 추출한다.

**출력:** `getMetadata(pkg)` → `{ title, creator, language, created, modified }`

### FR-04: HWPX 이미지 추출
BinData 디렉토리에서 임베디드 이미지를 추출한다.

**출력:** `extractImages(pkg)` → `{ name: string; format: string; data: Uint8Array }[]`

### FR-05: HWPX 문서 생성 (빌더 API)
프로그래밍으로 HWPX 문서를 생성한다.

**API:** HwpxBuilder (위 US-03 예시)

**수용 기준:** 한컴오피스에서 정상 열림

### FR-06: 라운드트립 보존
HWPX 읽기 → 쓰기 시 원본과 동일하다.

**수용 기준:** parse → write → parse 결과 동일

---

## 검증 전략 (FR-01 기준)

### Level 1: 크로스 밸리데이션 (자동, CI)
```
HWPX → python-hwpx → 텍스트 → expected.json
HWPX → HanDoc      → 텍스트 → actual.json
diff expected.json actual.json
```
- python-hwpx가 "기준선" (100% 정답은 아님)
- 5개 자체 픽스처 + 한컴오피스 생성 파일 10종

### Level 2: 한컴오피스 비교 (준자동)
1. 한컴오피스에서 파일 열기 → "텍스트로 저장" → 정답 텍스트
2. HanDoc 추출 텍스트와 diff
3. 일치율 90% 이상이면 PASS

### Level 3: 라운드트립 (자동)
```
원본 HWPX → HanDoc parse → HanDoc write → 새 HWPX
원본 HWPX vs 새 HWPX → 텍스트 동일
새 HWPX → 한컴오피스에서 열기 → 정상 열림 (수동)
```

---

## 첫 번째 데모 시나리오

**"HWPX에서 텍스트와 표를 뽑아서 LLM에 넣는다"**

```typescript
import { readFile } from 'fs/promises';
import { OpcPackage } from '@handoc/hwpx-core';
import { parseHwpx, extractAllText, extractTables } from '@handoc/hwpx-parser';

// 1. HWPX 파일 열기
const buffer = await readFile('보고서.hwpx');
const pkg = await OpcPackage.open(new Uint8Array(buffer));

// 2. 파싱
const { document, warnings } = await parseHwpx(pkg);
if (warnings.length) console.warn('Warnings:', warnings);

// 3. 텍스트 추출
const text = extractAllText(document);
console.log(text);

// 4. 표 추출
const tables = extractTables(document);
tables.forEach((table, i) => {
  console.log(`Table ${i + 1}:`);
  table.rows.forEach(row => {
    console.log(row.cells.map(c => c.text).join(' | '));
  });
});

// 5. 메타데이터
const meta = pkg.getMetadata();
console.log(`Title: ${meta.title}, Author: ${meta.creator}`);

// 6. LLM에 전달
const prompt = `다음 문서를 분석해주세요:\n\n${text}`;
```

이게 M1 끝났을 때 동작해야 하는 데모야.

---

*HanDoc — HWP 텍스트 추출이 핵심. 나머지는 그 위에 쌓는다.*
