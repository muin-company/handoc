# HanDoc 보안 감사 보고서

**날짜:** 2026-02-24  
**대상:** HanDoc monorepo (`/Users/mj/handoc`)  
**심각도 등급:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 요약

| # | 항목 | 심각도 | 상태 |
|---|------|--------|------|
| 1 | ZIP 처리 (zip-slip) | 🟡 Medium | 경로 검증 없음 (fflate 자체는 안전하나 방어적 코딩 부재) |
| 2 | XML 파싱 (XXE / Billion Laughs) | 🔴 Critical | fast-xml-parser 알려진 취약점 + DOCTYPE 처리 미설정 |
| 3 | OLE2/CFB 파싱 | 🟢 Low | cfb 라이브러리 위임, 경계 검사 존재 |
| 4 | 사용자 입력 신뢰 | 🟡 Medium | 외부 파일 내용 무검증 신뢰 다수 |
| 5 | 의존성 취약점 | 🔴 Critical | fast-xml-parser 2건 (critical 1, high 1) |

---

## 1. ZIP 처리 보안 — Zip-Slip 취약점

**파일:** `packages/hwpx-core/src/opc-package.ts`

### 분석

```typescript
// opc-package.ts:22-27
static async open(input: Uint8Array): Promise<OpcPackage> {
    const unzipped = unzipSync(input);
    const parts = new Map<string, Uint8Array>();
    for (const [name, data] of Object.entries(unzipped)) {
      parts.set(name, data);   // ← 경로 검증 없이 그대로 저장
    }
```

**fflate의 `unzipSync`** 는 ZIP 엔트리 이름을 그대로 반환합니다. `../../../etc/passwd` 같은 경로 트래버설 이름이 포함된 악의적 ZIP을 처리할 수 있습니다.

### 현재 상태

- HanDoc은 ZIP 엔트리를 **메모리 내 Map**에만 저장하고 파일시스템에 직접 쓰지 않으므로, **전통적인 zip-slip (파일시스템 탈출)은 발생하지 않음**
- 그러나 `../` 가 포함된 키로 `getPart()` 접근 시 논리적 경로 혼동(path confusion) 가능성 존재

### 권장 조치

```typescript
// 방어 코드 추가
for (const [name, data] of Object.entries(unzipped)) {
  if (name.includes('..') || name.startsWith('/')) {
    continue; // 악의적 경로 스킵
  }
  parts.set(name, data);
}
```

**심각도: 🟡 Medium** — 파일시스템 쓰기 없어 실제 위험 낮으나, 방어적 코딩 권장

---

## 2. XML 파싱 보안 — XXE / Billion Laughs

**파일:** `packages/hwpx-parser/src/xml-utils.ts`

### 분석

```typescript
// xml-utils.ts:1-11
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  preserveOrder: false,
  trimValues: true,
  // ⚠️ processEntities 미설정 (기본값: true)
  // ⚠️ stopNodes 미설정
  // ⚠️ entityExpansionLimit 미설정 (v4.x에 없음)
});
```

### 취약점

1. **XXE (XML External Entity):** fast-xml-parser v4.x는 기본적으로 external entity를 처리하지 않으므로 전통적 XXE는 해당 없음. 그러나 **internal DOCTYPE entity 확장**은 처리됨.

2. **Billion Laughs (Entity Expansion DoS):**
   - `processEntities: true` (기본값)으로 내부 엔티티 확장이 활성화
   - fast-xml-parser v4.5.3에는 **엔티티 확장 제한이 없음**
   - 공격자가 악의적 HWPX 내 XML에 재귀적 엔티티 정의를 삽입하면 메모리 폭발/DoS 가능

3. **GHSA-jmr7-xgp7-cmfj (High):** DOCTYPE entity expansion 제한 없음 → DoS
4. **GHSA-m7jm-9gc2-mpf2 (Critical):** entity encoding bypass via regex injection

### 권장 조치

**즉시:** fast-xml-parser를 `>=5.3.6`으로 업그레이드

```bash
pnpm --filter @handoc/hwpx-parser add fast-xml-parser@^5.3.6
```

**추가 방어:**
```typescript
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  preserveOrder: false,
  trimValues: true,
  processEntities: false,        // 엔티티 확장 비활성화
  // v5.x에서는 entityExpansionLimit 설정 가능
});
```

**심각도: 🔴 Critical** — 알려진 CVE 2건, DoS 공격 가능

---

## 3. OLE2/CFB 파싱 — 버퍼 오버플로우

**파일:** `packages/hwp-reader/src/cfb-reader.ts`, `packages/hwp-reader/src/record-parser.ts`

### 분석

**cfb-reader.ts:**
```typescript
// cfb-reader.ts:15
const cfb = CFB.read(buffer, { type: 'array' });
```
- `cfb` (SheetJS) 라이브러리에 파싱 위임. 이 라이브러리는 내부적으로 경계 검사 수행.
- 현재 `pnpm audit`에서 cfb 관련 취약점 없음.

**record-parser.ts — 경계 검사 양호:**
```typescript
// record-parser.ts:49
while (offset + 4 <= stream.byteLength) {  // ✅ 헤더 읽기 전 경계 검사

// record-parser.ts:57-58
if (size === 0xfff) {
  if (offset + 4 > stream.byteLength) break;  // ✅ 확장 크기 경계 검사

// record-parser.ts:63
if (offset + size > stream.byteLength) break;  // ✅ 데이터 읽기 전 경계 검사
```

**hwp-reader.ts — 디컴프레션:**
```typescript
// hwp-reader.ts:101-111
function decompressIfNeeded(data: Uint8Array, compressed: boolean): Uint8Array {
  try {
    return new Uint8Array(inflateRawSync(data));  // node:zlib 사용
  } catch {
    try {
      return new Uint8Array(inflateSync(data));
    } catch {
      return data;  // ⚠️ 디컴프레션 실패 시 원본 반환 (조용한 실패)
    }
  }
}
```

### 잠재 위험

- **Decompression bomb:** zlib inflate에 크기 제한 없음. 악의적 HWP가 작은 압축 데이터로 수 GB를 생성할 수 있음 (`hwp-reader.ts:101-111`)
- `record-parser.ts:59`에서 `size`가 uint32 최대값(~4GB)일 수 있으나, `stream.slice`가 실제 바이트 범위로 제한되므로 크래시는 방지됨

### 권장 조치

```typescript
// 디컴프레션 크기 제한 추가
const MAX_DECOMPRESSED = 100 * 1024 * 1024; // 100MB
const result = inflateRawSync(data, { maxOutputLength: MAX_DECOMPRESSED });
```

**심각도: 🟢 Low** (경계 검사 양호, decompression bomb은 🟡 Medium)

---

## 4. 사용자 입력 신뢰 — 무검증 파싱

### 4.1 파일 시그니처 검증 부재

**파일:** `packages/hwp-reader/src/hwp-reader.ts:118`

```typescript
export function readHwp(buffer: Uint8Array): HwpDocument {
  const cfb = openCfb(buffer);  // ← 버퍼가 유효한 CFB인지 사전 검증 없음
```

CFB 파싱은 `cfb` 라이브러리가 처리하지만, 파일 헤더 시그니처를 미리 확인하면 잘못된 입력에 대한 에러 메시지가 더 명확해짐.

### 4.2 XML 내용 무검증 신뢰

**파일:** `packages/hwpx-parser/src/handoc.ts:89-98`

```typescript
get sections(): Section[] {
  const paths = this.pkg.getSectionPaths()
    .filter((p) => p.toLowerCase().endsWith('.xml'));
  this._sections = paths.map((p) => {
    const fullPath = p.startsWith('Contents/') ? p : `Contents/${p}`;
    const xml = this.pkg.getPartAsText(fullPath);  // ← manifest에서 온 경로를 신뢰
    return parseSection(xml, this._warnings);
  });
```

- manifest(`content.hpf`)의 `href` 값을 검증 없이 파트 경로로 사용
- 악의적 manifest가 `../../` 경로를 포함할 수 있음 (메모리 내이므로 실제 파일시스템 위험은 없으나 논리 오류 가능)

### 4.3 이미지 데이터 무검증

**파일:** `packages/hwpx-parser/src/image-extractor.ts`

- ZIP에서 추출한 바이너리 데이터를 이미지로 그대로 반환
- 이미지 매직 바이트 검증 없음
- 브라우저/뷰어에서 사용 시 악성 파일 주입 가능

### 4.4 숫자 파싱 안전성 — 양호

```typescript
// xml-utils.ts:55-58 ✅ 안전한 정수 파싱
export function parseIntSafe(val: string | undefined, defaultVal = 0): number {
  const n = Number.parseInt(val, 10);
  return Number.isNaN(n) ? defaultVal : n;
}
```

### 권장 조치

1. ZIP 엔트리 경로에 `..` 포함 여부 검사 (§1과 동일)
2. manifest href에 대한 화이트리스트 패턴 검증
3. 이미지 반환 시 MIME 타입 / 매직 바이트 검증 옵션 제공
4. `readHwp()`에 입력 크기 상한 검사 추가

**심각도: 🟡 Medium** — 라이브러리 특성상 메모리 내 처리로 실제 위험 제한적

---

## 5. 의존성 취약점 — `pnpm audit` 결과

```
2 vulnerabilities found
Severity: 1 high | 1 critical
```

| 심각도 | 패키지 | 버전 | 취약점 | 패치 버전 | Advisory |
|--------|--------|------|--------|-----------|----------|
| 🔴 Critical | fast-xml-parser | 4.5.3 | Entity encoding bypass via regex injection in DOCTYPE | ≥5.3.5 | [GHSA-m7jm-9gc2-mpf2](https://github.com/advisories/GHSA-m7jm-9gc2-mpf2) |
| 🟠 High | fast-xml-parser | 4.5.3 | DoS through entity expansion in DOCTYPE (no expansion limit) | ≥5.3.6 | [GHSA-jmr7-xgp7-cmfj](https://github.com/advisories/GHSA-jmr7-xgp7-cmfj) |

**영향 범위:** 16개 경로 (`@handoc/hwpx-parser` → `fast-xml-parser@4.5.3`)

### 즉시 조치

```bash
pnpm --filter @handoc/hwpx-parser add fast-xml-parser@^5.3.6
```

> ⚠️ fast-xml-parser v5.x는 API 변경이 있을 수 있으므로, 업그레이드 후 테스트 필수

---

## 종합 권장 사항 (우선순위순)

| 우선순위 | 조치 | 관련 항목 |
|----------|------|-----------|
| **P0** | fast-xml-parser를 5.3.6+로 업그레이드 | §2, §5 |
| **P0** | XMLParser에 `processEntities: false` 설정 | §2 |
| **P1** | ZIP 엔트리 경로 트래버설 검사 추가 | §1, §4.2 |
| **P1** | zlib inflate에 `maxOutputLength` 제한 추가 | §3 |
| **P2** | 이미지 매직 바이트 검증 | §4.3 |
| **P2** | 입력 버퍼 크기 상한 검사 | §4.4 |

---

*Generated by security audit subagent, 2026-02-24*
