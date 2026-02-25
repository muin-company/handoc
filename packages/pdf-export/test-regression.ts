import { readFileSync } from "fs";
import { generatePdf } from "./src/pdf-direct";
import { PDFDocument } from "pdf-lib";

async function main() {
  const tests: [string, number][] = [
    ["real-world/20260220/가곡.hwpx", 1],
    ["real-world/20260220/강강술래.hwpx", 1],
    ["real-world/20260220/참석자 사전 의견서.hwpx", 1],
    ["real-world/education/2025 역곡중 출결신고서 양식(간소화).hwpx", 1],
    ["real-world/education/2025학년도 2학기 2차 지필평가 출제 협의록( 00과).hwpx", 2],
    ["real-world/education/2025학년도 학부모의견서(생리결석, 일반).hwpx", 2],
    ["real-world/20260220/취약점_점검_및_침투테스트_동의서_사업자명.hwpx", 2],
    ["real-world/education/0. 역사과_2025학년도 2학기 교수학습 및 평가 운영 계획서 양식(3학년 역사 OOO).hwpx", 11],
  ];

  for (const [file, expected] of tests) {
    try {
      const buf = readFileSync("/Users/mj/handoc-fixtures/" + file);
      const pdf = await generatePdf(new Uint8Array(buf));
      const doc = await PDFDocument.load(pdf);
      const pages = doc.getPageCount();
      const ok = pages === expected ? "✓" : "✗";
      console.log(`${ok} ${file.split("/").pop()}: ${pages}/${expected}`);
    } catch (e: any) {
      console.log(`ERR ${file.split("/").pop()}: ${e.message.slice(0,80)}`);
    }
  }
}
main();
