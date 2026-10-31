/**
 * Performance stress test — the spec target: parse + check a document with
 * ~1000 paragraphs, ~200 citations and ~150 references within 10 s on a
 * normal desktop. The pipeline is deterministic pure JS, so Node timing is a
 * valid first measurement; the worker adds no algorithmic overhead.
 */
import { describe, expect, it } from "vitest";
import { analyzeDocx } from "../pipeline";
import { buildDocx, type TestDoc } from "../../testing/docx-builder";

function buildStressDoc(): Uint8Array {
  const paragraphs: TestDoc["paragraphs"] = [];
  const authors = ["张伟", "李娜", "Wang S", "Chen L", "刘洋", "Smith J", "Brown A", "王晓", "Davis M", "孙洁"];
  const journals = ["情报学报", "中国图书馆学报", "Journal of Information Science", "大学图书馆学报", "图书情报工作"];

  // 1000 body paragraphs; every 5th contains a citation (≈200 markers).
  for (let i = 0; i < 1000; i++) {
    if (i === 0) {
      paragraphs.push({ text: "大规模压力测试论文", heading: 1 });
      continue;
    }
    if (i % 5 === 0) {
      const n = ((i / 5) % 150) + 1;
      paragraphs.push({
        text: `第${i}段：已有研究对这一问题进行了系统探讨${n > 1 ? `[${n - 1}-${n}]` : `[${n}]`}，并提出了相应的分析框架与实证方法，涉及多个学科领域的交叉合作研究。`,
      });
    } else {
      paragraphs.push({
        text: `第${i}段：本段为填充正文，用于构造接近真实论文规模的压力样本。内容包含中文标点、English words、数字12345与符号“引号”的混合文本，用以检验解析器在长文档中的稳定性与性能表现。`,
      });
    }
  }

  // Reference section: 150 entries with mixed zh/en.
  paragraphs.push({ text: "参考文献", heading: 1 });
  for (let i = 1; i <= 150; i++) {
    const a = authors[i % authors.length]!;
    const j = journals[i % journals.length]!;
    const type = i % 3 === 0 ? "[J]" : i % 3 === 1 ? "[M]" : "[J/OL]";
    paragraphs.push({
      text: `[${i}] ${a}. 压力测试文献题名第${i}号${type}. ${j}, ${2020 - (i % 10)}, ${i % 40}(3): ${i}-${i + 9}.`,
    });
  }

  // A couple of tables for complexity.
  const tables: TestDoc["tables"] = [];
  for (let t = 0; t < 3; t++) {
    tables.push(
      Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 4 }, (_, c) => [{ text: `表${t}单元格(${r},${c})${r === 1 && c === 2 ? "[2]" : ""}` }])
      )
    );
  }

  return buildDocx({ paragraphs, tables });
}

describe("performance (stress sample)", () => {
  it("analyzes ~1000 paragraphs / ~200 citations / 150 refs within 10 s", () => {
    const bytes = buildStressDoc();
    const t0 = performance.now();
    const result = analyzeDocx(bytes, "stress.docx", { version: "2025" });
    const elapsed = performance.now() - t0;

    expect(result.stats.blockCount).toBeGreaterThan(1000);
    expect(result.stats.citationMarkerCount).toBeGreaterThanOrEqual(200);
    expect(result.stats.referenceCount).toBe(150);
    expect(elapsed).toBeLessThan(10_000);
    console.warn(`[perf] stress sample: blocks=${result.stats.blockCount} markers=${result.stats.citationMarkerCount} refs=${result.stats.referenceCount} time=${Math.round(elapsed)}ms`);
  });
});
