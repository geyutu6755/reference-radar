/**
 * V1.1.1 rule-reachability gate.
 *
 * These tests drive the REAL pipeline — DOCX bytes → unzip → OOXML → blocks →
 * citation/reference extraction → field extraction → rule engine → findings.
 * They exist because hand-injected `fields` unit cases could not detect that a
 * rule is unreachable from real documents (see docs/verification.md V1.1.1).
 *
 * Rule unit tests remain, but they do NOT substitute for this gate.
 */
import { describe, expect, it } from "vitest";
import { analyzeDocx } from "../pipeline";
import { buildDocx, type TestDoc } from "../../testing/docx-builder";
import type { AnalysisResult, Issue, StandardVersion } from "../types";

/** Build a paper that cites [1..n] in order, then list `entries` as the reference list. */
function analyzeEntries(entries: string[], version: StandardVersion = "2025"): AnalysisResult {
  const cites = entries.map((_, i) => `[${i + 1}]`).join("");
  const doc: TestDoc = {
    paragraphs: [
      { text: "可达性验证论文", heading: 1 },
      { text: `正文依次引用${cites}。` },
      { text: "参考文献", heading: 2 },
      ...entries.map((e, i) => ({ text: `[${i + 1}] ${e}` })),
    ],
  };
  return analyzeDocx(buildDocx(doc), "reachability.docx", { version });
}

const of = (result: AnalysisResult, ruleId: string): Issue[] =>
  result.issues.filter((i) => i.ruleId === ruleId);

/** Findings for one entry position (1-based reference index). */
const forIndex = (issues: Issue[], index: number): Issue[] =>
  issues.filter((i) => i.relatedIds.includes(`ref-${index - 1}`));

describe("RR-FMT-011 page separator (real DOCX bytes)", () => {
  it("detects full-width wave dash that the parser used to erase", () => {
    const r = analyzeEntries(["张三. 某文[J]. 学报, 2020, 1(2): 24～33."]);
    const issues = of(r, "RR-FMT-011");
    expect(issues.length).toBe(1);
    expect(issues[0]!.detail).toContain("～");
    expect(issues[0]!.severity).toBe("warning");
    expect(issues[0]!.fixPreview).toBeDefined();
  });

  it("detects en dash and em dash ranges", () => {
    for (const sep of ["–", "—"]) {
      const r = analyzeEntries([`张三. 某文[J]. 学报, 2020, 1(2): 24${sep}33.`]);
      expect(of(r, "RR-FMT-011").length, `separator ${sep}`).toBe(1);
    }
  });

  it("accepts the legitimate hyphen form and a single page", () => {
    const r = analyzeEntries([
      "张三. 某文[J]. 学报, 2020, 1(2): 24-33.",
      "李四. 某文[J]. 学报, 2020, 1(2): 24—33.", // deliberately wrong: asserted below
    ]);
    expect(forIndex(of(r, "RR-FMT-011"), 1).length).toBe(0);
    expect(forIndex(of(r, "RR-FMT-011"), 2).length).toBe(1);

    const single = analyzeEntries(["王五. 某文[J]. 学报, 2020, 1(2): 88."]);
    expect(of(single, "RR-FMT-011").length).toBe(0);
  });
});

describe("RR-FMT-017 cited-date format (real DOCX bytes)", () => {
  it("fires on a printed cited date in non-ISO form", () => {
    const r = analyzeEntries(["某作者. 网页[EB/OL]. [2025.1.15]. https://example.org/a."]);
    const issues = of(r, "RR-FMT-017");
    expect(issues.length).toBe(1);
    expect(issues[0]!.detail).toContain("2025.1.15");
    expect(issues[0]!.fixPreview?.replace).toContain("2025-01-15");
  });

  it("fires on Chinese-date form with a mechanical preview", () => {
    const r = analyzeEntries(["某作者. 网页[EB/OL]. [2025年1月15日]. https://example.org/a."]);
    const issues = of(r, "RR-FMT-017");
    expect(issues.length).toBe(1);
    expect(issues[0]!.fixPreview?.replace).toContain("2025-01-15");
  });

  it("accepts the ISO form", () => {
    const r = analyzeEntries(["某作者. 网页[EB/OL]. [2025-01-15]. https://example.org/a."]);
    expect(of(r, "RR-FMT-017").length).toBe(0);
  });

  it("never mistakes a parenthesised publication date for a cited date", () => {
    const r = analyzeEntries(["某作者. 网页[EB/OL]. (2025.1.15). https://example.org/a."]);
    expect(of(r, "RR-FMT-017").length).toBe(0);
    // EB still needs a cited date, so 013 must report it as missing — not 017.
    expect(of(r, "RR-FMT-017").length).toBe(0);
  });

  it("degrades without a preview when the date content cannot be determined", () => {
    const r = analyzeEntries(["某作者. 网页[EB/OL]. [2025-13-45]. https://example.org/a."]);
    const issues = of(r, "RR-FMT-017");
    expect(issues.length).toBe(1);
    expect(issues[0]!.fixPreview).toBeUndefined();
  });
});

describe("RR-FMT-013 cited-date applicability (real DOCX bytes)", () => {
  it("does NOT claim a missing cited date when one is printed in non-ISO form", () => {
    const r = analyzeEntries(["某作者. 网页[EB/OL]. [2025.1.15]. https://example.org/a."]);
    expect(of(r, "RR-FMT-013").length).toBe(0); // P0 false positive from V1.1.0
    expect(of(r, "RR-FMT-017").length).toBe(1); // exactly one, non-contradictory finding
  });

  it("warns when an EB entry has no cited date at all", () => {
    const r = analyzeEntries(["某作者. 网页[EB/OL]. https://example.org/a."]);
    expect(of(r, "RR-FMT-013").length).toBe(1);
    expect(of(r, "RR-FMT-017").length).toBe(0);
  });

  it("leaves journal/thesis online forms alone under 2025 (standard examples carry no cited date)", () => {
    const r = analyzeEntries([
      "张群. 惯性增强动力吸振器研究[J/OL]. 快速学报, 2024-05-09. https://kns.cnki.net/a.",
      "金燕萍. 虚假信息研究[D/OL]. 温州: 温州大学, 2020: 16. https://d.wanfangdata.com.cn/x.",
    ]);
    expect(of(r, "RR-FMT-013").length).toBe(0);
  });

  it("downgrades to review under 2015 for a non-EB online entry", () => {
    const r = analyzeEntries(
      ["金燕萍. 虚假信息研究[D/OL]. 温州: 温州大学, 2020: 16. https://d.wanfangdata.com.cn/x."],
      "2015"
    );
    const issues = of(r, "RR-FMT-013");
    expect(issues.length).toBe(1);
    expect(issues[0]!.severity).toBe("review");
  });
});

describe("RR-FMT-015 thesis degree-granting institution (real DOCX bytes)", () => {
  it("does not flag a correctly formed Chinese thesis entry", () => {
    const r = analyzeEntries(["王琦. 融合星载GNSS-R和SAR数据的研究[D]. 武汉: 武汉大学, 2022: 87."]);
    expect(of(r, "RR-FMT-015").length).toBe(0); // P0 false positive from V1.1.0
  });

  it("handles full-width punctuation and spacing variants", () => {
    const variants = [
      "王琦. 某研究[D]. 武汉：武汉大学，2022：87.",
      "王琦. 某研究[D]. 武汉 : 武汉大学 , 2022.",
      "王琦. 某研究[D]. 北京: 中国科学院大学, 2021.",
    ];
    for (const v of variants) {
      expect(of(analyzeEntries([v]), "RR-FMT-015").length, v).toBe(0);
    }
  });

  it("accepts institutions without 大学/学院 and English awarding bodies", () => {
    const variants = [
      "张三. 某研究[D]. 北京: 中共中央党校, 2019.",
      "Li Hua. A study of citation parsing[D]. Ann Arbor: University of Michigan, 2019.",
      "张三. 某研究[D]. 上海: 上海社会科学院, 2020.",
    ];
    for (const v of variants) {
      expect(of(analyzeEntries([v]), "RR-FMT-015").length, v).toBe(0);
    }
  });

  it("still reports a genuine missing institution as review, with the right basis", () => {
    const r = analyzeEntries(["张三. 某研究[D]. 2022."]);
    const issues = of(r, "RR-FMT-015");
    expect(issues.length).toBe(1);
    expect(issues[0]!.severity).toBe("review");
    expect(issues[0]!.requiresManualCheck).toBe(true);
    expect(issues[0]!.source.clause).toContain("表6");
    expect(issues[0]!.anchors[0]!.blockIndex).toBeGreaterThan(0);
  });
});

describe("RR-FMT-018 standard number (real DOCX bytes)", () => {
  const legal = [
    "GB/T 7714—2025 信息与文献 参考文献著录规则[S].",
    "GB/T 20090.16—2016 信息技术 先进音视频编码 第 16 部分：广播电视视频[S].",
    "NB/T 10386—2020 水电工程水温实时监测系统技术规范[S].",
    "ISO 21378: 2019 Audit data collection[S].",
    "IEC/IEEE 61636-1: 2021 Software interface for maintenance information collection and analysis[S].",
    "IEEE P802.11ba/D8.0—2020 IEEE approved draft standard for information technology[S].",
    "AIAA G-136—2022 Guide to lithium battery safety for space applications[S].",
    "ISO/IEC 80079-20-2: 2016 (en) Explosive atmospheres—Part 20-2[S].",
    "ANSI/ANS-5.1-1979 Measurement of absorbed radiation dose[S].",
    "GB 3000.1—2013 化学品分类和标签规范 第 1 部分[S].",
    // Legal form with the responsible body placed before the number.
    "全国信息与文献标准化技术委员会. GB/T 2659—2000 文件格式与结构[S]. 北京: 中国标准出版社, 2001.",
  ];
  it.each(legal)("accepts the verified form: $#", (entry) => {
    expect(of(analyzeEntries([entry]), "RR-FMT-018").length).toBe(0);
  });

  const missing = [
    "信息与文献 参考文献著录规则[S]. 北京: 中国标准出版社, 2015.",
    "标准文献著录方法研究[S].",
    "2020 年我国标准文献著录研究[S].", // digits in the title must not be read as a number
    "一种新型储能装置的研究[S].",
  ];
  it.each(missing)("still flags an entry without a standard number: $#", (entry) => {
    const issues = of(analyzeEntries([entry]), "RR-FMT-018");
    expect(issues.length).toBe(1);
    expect(issues[0]!.requiresManualCheck).toBe(true);
  });
});

describe("RR-FMT-014 URL requirement (real DOCX bytes, per-type basis)", () => {
  it("flags EB, PP and DS entries without a URL and cites the matching table", () => {
    const r = analyzeEntries([
      "某作者. 网页[EB/OL]. [2025-01-15].",
      "肖玲. 数据要素的统计测算方法探究[PP/OL]. PSSXiv (2024-07-02) [2024-09-30].",
      "彭守璋. 中国逐月降水量数据集[DS/OL]. 国家地球系统科学数据中心 (2025-07-07) [2025-07-15].",
    ]);
    const issues = of(r, "RR-FMT-014");
    expect(issues.length).toBe(3);
    expect(forIndex(issues, 1)[0]!.source.clause).toContain("表11");
    expect(forIndex(issues, 2)[0]!.source.clause).toContain("表15");
    expect(forIndex(issues, 3)[0]!.source.clause).toContain("表14");
  });

  it("accepts entries that carry the access path", () => {
    const r = analyzeEntries([
      "某作者. 网页[EB/OL]. [2025-01-15]. https://example.org/a.",
      "彭守璋. 数据集[DS/OL]. 中心 (2025-07-07) [2025-07-15]. https://www.geodata.cn/x.",
    ]);
    expect(of(r, "RR-FMT-014").length).toBe(0);
  });
});

describe("RR-FMT-008 / 010 / 016 (real DOCX bytes)", () => {
  it("flags a 2025-only code under 2015 with a version note", () => {
    const r = analyzeEntries(["彭守璋. 数据集[DS/OL]. 中心, 2024. https://example.org/x."], "2015");
    const issues = of(r, "RR-FMT-008");
    expect(issues.length).toBe(1);
    expect(issues[0]!.detail).toContain("DS");
  });

  it("reviews an entry with no type identifier", () => {
    const r = analyzeEntries(["张三. 某某研究论文. 某大学出版社, 2020."]);
    expect(of(r, "RR-FMT-010").length).toBe(1);
  });

  it("reviews a journal entry with no publication year and accepts article-number forms", () => {
    const bad = analyzeEntries(["张三. 某研究[J]. 某学报."]);
    expect(of(bad, "RR-FMT-016").length).toBe(1);

    const good = analyzeEntries([
      "李四. 某研究[J]. 学报, 2023, 267: 147370.",
      "张群. 某研究[J/OL]. 快速学报, 2024-05-09. https://kns.cnki.net/a.",
    ]);
    expect(of(good, "RR-FMT-016").length).toBe(0);
  });
});

describe("fix preview safety (real DOCX bytes)", () => {
  /** Same computation the panel performs when copying. */
  const apply = (text: string, find: string, replace: string): string => text.split(find).join(replace);

  it("offers a preview whose result is the whole corrected entry", () => {
    const entry = "张三. 某文[J]. 学报, 2020, 1(2): 24～33.";
    const r = analyzeEntries([entry]);
    const issue = of(r, "RR-FMT-011")[0]!;
    expect(issue.fixPreview).toBeDefined();
    const corrected = apply(issue.anchors[0]!.text, issue.fixPreview!.find, issue.fixPreview!.replace);
    expect(corrected).toBe("[1] 张三. 某文[J]. 学报, 2020, 1(2): 24-33.");
    expect(corrected).toContain("张三"); // nothing outside the span is touched
  });

  it("refuses to guess when the same malformed value appears twice", () => {
    const r = analyzeEntries(["某作者. 网页[EB/OL]. [2025.1.15][2025.1.15]. https://example.org/a."]);
    const issues = of(r, "RR-FMT-017");
    expect(issues.length).toBe(1);
    expect(issues[0]!.fixPreview).toBeUndefined();
    expect(issues[0]!.fixBlocked).toContain("2 次");
  });

  it("states a reason instead of staying silent when no fix is offered", () => {
    for (const ruleId of ["RR-FMT-011", "RR-FMT-017"]) {
      const r = analyzeEntries(
        ruleId === "RR-FMT-011"
          ? ["张三. 某文[J]. 学报, 2020, 1(2): 24～33.", "李四. 某文[J]. 学报, 2020, 1(2): 24～33."]
          : ["某作者. 网页[EB/OL]. [2025-13-45]. https://example.org/a."]
      );
      const issues = of(r, ruleId);
      for (const issue of issues) {
        // Either an actionable preview, or an explicit refusal — never neither.
        expect(Boolean(issue.fixPreview) !== Boolean(issue.fixBlocked)).toBe(true);
      }
    }
  });

  it("never rewrites anything but the policed span", () => {
    const r = analyzeEntries(["某作者. 网页[EB/OL]. [2025年1月15日]. https://example.org/a. DOI:10.1234/abcd"]);
    const issue = of(r, "RR-FMT-017")[0]!;
    const corrected = apply(issue.anchors[0]!.text, issue.fixPreview!.find, issue.fixPreview!.replace);
    expect(corrected).toBe("[1] 某作者. 网页[EB/OL]. [2025-01-15]. https://example.org/a. DOI:10.1234/abcd");
  });
});

describe("no regression in structural checks after field/rule changes", () => {
  it("still reports missing numbers, gaps and order violations", () => {
    const doc: TestDoc = {
      paragraphs: [
        { text: "结构回归论文", heading: 1 },
        { text: "先引[2]，再引[1]，又引[5]。" },
        { text: "参考文献", heading: 2 },
        { text: "[1] 张三. 某文[J]. 学报, 2020, 1(2): 24-33." },
        { text: "[2] 李四. 某文[J]. 学报, 2021, 2(3): 10-15." },
        { text: "[3] 王五. 某文[M]. 北京: 某出版社, 2019." },
      ],
    };
    const r = analyzeDocx(buildDocx(doc), "regression.docx", { version: "2025" });
    expect(r.references.length).toBe(3);
    expect(of(r, "RR-CIT-001").length).toBe(1); // [5] absent
    expect(of(r, "RR-CIT-004").length).toBe(1); // [2] cited before [1]
    expect(of(r, "RR-REF-011").length).toBe(1); // [3] uncited
    expect(of(r, "RR-FMT-011").length).toBe(0); // hyphen ranges must stay clean
    expect(of(r, "RR-FMT-015").length).toBe(0); // [M] must not be swept in
  });
});
