/**
 * Golden sample suite — 18 hand-annotated documents.
 *
 * EXPECTATIONS BELOW ARE HAND-AUTHORED SPECIFICATIONS, written from the known
 * construction of each sample (what is deliberately right/wrong), NOT derived
 * from program output. The pipeline must match them. When they disagree, the
 * engine is wrong until proven otherwise.
 */
import { buildDocx, buildZip, type TestDoc } from "../../testing/docx-builder";
import { zipSync, strToU8 } from "fflate";
import type { StandardVersion } from "../types";

export interface GoldenExpectation {
  /** ruleIds expected to fire with severity error (exact set). */
  errors: string[];
  /** ruleIds expected to fire with severity warning. */
  warnings: string[];
  /** ruleIds expected to fire with severity review (at least these). */
  reviewsInclude?: string[];
  /** Max allowed info issues. */
  maxInfos?: number;
  /** Exact citation marker count (when meaningful). */
  citationMarkers?: number;
  /** Exact reference entry count (when meaningful). */
  referenceCount?: number;
  /** Missing-relation count (cited numbers without entry). */
  missingRelations?: number;
  /** Scope expectation. */
  referenceSectionDetected?: boolean;
}

export interface GoldenSample {
  id: string;
  title: string;
  versions: StandardVersion[];
  bytes: () => Uint8Array;
  expect: Record<StandardVersion, GoldenExpectation>;
  /** For raw-input error cases: expected error code thrown by analyzeDocx. */
  throwsCode?: string;
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function refList(entries: string[]): TestParagraphLite[] {
  return [{ text: "参考文献", heading: 1 }, ...entries.map((text) => ({ text }))];
}

type TestParagraphLite = TestDoc["paragraphs"][number];

const REFS_OK = [
  "[1] 张三. 中文论文方法研究[J]. 某学报, 2020, 15(2): 12-18.",
  "[2] 李四. 另一项研究[M]. 北京: 某出版社, 2019.",
  "[3] Smith J. An English study[J]. Journal of Science, 2021, 3(1): 5-14.",
];

/* ------------------------------------------------------------------ */
/* Samples 1–17                                                        */
/* ------------------------------------------------------------------ */

function sample(
  id: string,
  title: string,
  doc: TestDoc,
  expect: Partial<Record<StandardVersion, GoldenExpectation>> & { default?: GoldenExpectation },
  versions: StandardVersion[] = ["2015", "2025"]
): GoldenSample {
  const def =
    expect.default ??
    ({
      errors: [],
      warnings: [],
      maxInfos: 0,
    } as GoldenExpectation);
  const e2015 = expect["2015"] ?? def;
  const e2025 = expect["2025"] ?? def;
  return { id, title, versions, bytes: () => buildDocx(doc), expect: { "2015": e2015, "2025": e2025 } };
}

export const GOLDEN_SAMPLES: GoldenSample[] = [
  sample(
    "G01",
    "完全正确的中文论文",
    {
      paragraphs: [
        { text: "引言部分引用了文献[1]。" },
        { text: "方法部分引用了文献[2]，并采用英文研究[3]。" },
        ...refList(REFS_OK),
      ],
    },
    {
      default: { errors: [], warnings: [], maxInfos: 0, citationMarkers: 3, referenceCount: 3, missingRelations: 0, referenceSectionDetected: true },
    }
  ),
  sample(
    "G02",
    "缺少一个对应文献",
    {
      paragraphs: [
        { text: "引用了[1]与[2]，还引用了未列出的[3]。" },
        { text: "参考文献", heading: 1 },
        { text: REFS_OK[0]! },
        { text: REFS_OK[1]! },
      ],
    },
    {
      default: {
        errors: ["RR-CIT-001"],
        warnings: [],
        maxInfos: 0,
        citationMarkers: 3,
        referenceCount: 2,
        missingRelations: 1,
        referenceSectionDetected: true,
      },
    }
  ),
  sample(
    "G03",
    "文献编号重复",
    {
      paragraphs: [
        { text: "引用[1]、[2]与[3]。" },
        { text: "参考文献", heading: 1 },
        { text: REFS_OK[0]! },
        { text: REFS_OK[1]! },
        { text: "[2] 王五. 重复编号的文献[J]. 另一学报, 2022." },
        { text: "[3] 赵六. 第三篇[J]. 学报, 2023." },
      ],
    },
    {
      default: {
        errors: ["RR-REF-002"],
        warnings: [],
        maxInfos: 0,
        referenceCount: 4,
        referenceSectionDetected: true,
      },
    }
  ),
  sample(
    "G04",
    "首次引用顺序异常",
    {
      paragraphs: [
        { text: "第一段引用[1]。" },
        { text: "第二段先引用[3]，再引用[2]。" },
        { text: "参考文献", heading: 1 },
        ...REFS_OK.map((text) => ({ text })),
      ],
    },
    {
      default: { errors: ["RR-CIT-004"], warnings: [], maxInfos: 0, referenceCount: 3, referenceSectionDetected: true },
    }
  ),
  sample(
    "G05",
    "引用区间倒置",
    {
      paragraphs: [
        { text: "引用了[1]、[2]、[3]，以及一个倒置区间[5-2]。" },
        { text: "参考文献", heading: 1 },
        ...REFS_OK.map((text) => ({ text })),
      ],
    },
    {
      default: { errors: ["RR-CIT-006"], warnings: [], maxInfos: 0, referenceCount: 3, referenceSectionDetected: true },
    }
  ),
  sample(
    "G06",
    "同一文献被多次正确引用",
    {
      paragraphs: [
        { text: "首次引用[1]。" },
        { text: "再次引用[1]，并引用新文献[2]。" },
        { text: "第三次引用[1]与[2]。" },
        { text: "参考文献", heading: 1 },
        { text: REFS_OK[0]! },
        { text: REFS_OK[1]! },
      ],
    },
    {
      default: { errors: [], warnings: [], maxInfos: 0, citationMarkers: 5, referenceCount: 2, referenceSectionDetected: true },
    }
  ),
  sample(
    "G07",
    "多条引文混合标记",
    {
      paragraphs: [
        { text: "混合标记[1,2]与区间[2-3]，以及全角［1，3］。" },
        { text: "参考文献", heading: 1 },
        ...REFS_OK.map((text) => ({ text })),
      ],
    },
    {
      default: { errors: [], warnings: [], maxInfos: 0, citationMarkers: 3, referenceCount: 3, referenceSectionDetected: true },
    }
  ),
  sample(
    "G08",
    "中文和英文文献混合",
    {
      paragraphs: [
        { text: "中文研究[1]与英文研究[2][3]。" },
        { text: "参考文献", heading: 1 },
        ...REFS_OK.map((text) => ({ text })),
      ],
    },
    {
      default: { errors: [], warnings: [], maxInfos: 0, referenceCount: 3, referenceSectionDetected: true },
    }
  ),
  sample(
    "G09",
    "Word Run 拆分引文",
    {
      paragraphs: [
        { runs: [{ text: "研究基础[" }, { text: "1-" }, { text: "3]扎实。" }] },
        { text: "参考文献", heading: 1 },
        { text: REFS_OK[0]! },
        { text: REFS_OK[1]! },
        { text: REFS_OK[2]! },
      ],
    },
    {
      default: { errors: [], warnings: [], maxInfos: 0, citationMarkers: 1, referenceCount: 3, referenceSectionDetected: true },
    }
  ),
  sample(
    "G10",
    "表格中包含引用",
    {
      paragraphs: [
        { text: "正文引用[1]，见表格。" },
        { text: "参考文献", heading: 1 },
        { text: REFS_OK[0]! },
        { text: REFS_OK[1]! },
      ],
      // NOTE: builder emits tables after paragraphs; the region fix keeps
      // table cells analyzable even when they follow the reference list.
      tables: [[[[{ text: "方法A[2]" }], [{ text: "准确率较高" }]]]],
    },
    {
      default: { errors: [], warnings: [], maxInfos: 0, citationMarkers: 2, referenceCount: 2, referenceSectionDetected: true },
    }
  ),
  sample(
    "G11",
    "Word 自动编号的参考文献",
    {
      paragraphs: [
        { text: "正文引用[1]与[2]。" },
        { text: "参考文献", heading: 1 },
        { text: "张三. 自动编号文献一[J]. 学报, 2020.", numId: 5 },
        { text: "李四. 自动编号文献二[M]. 出版社, 2021.", numId: 5 },
      ],
      numbering: [
        { numId: 5, abstractId: 2, levels: [{ ilvl: 0, fmt: "decimal", text: "[%1]" }] },
      ],
    },
    {
      default: {
        errors: [],
        warnings: [],
        maxInfos: 0,
        citationMarkers: 2,
        referenceCount: 2,
        referenceSectionDetected: true,
      },
    }
  ),
  sample(
    "G12",
    "存在脚注与尾注",
    {
      paragraphs: [{ text: "正文引用[1]，另有脚注引用[2]。" }],
      footnotes: [[{ text: "脚注中的引用[2]。" }]],
      endnotes: [[{ text: "尾注内容[3]。" }]],
      },
    {
      default: {
        errors: [],
        warnings: ["RR-SCOPE-012"],
        maxInfos: 99,
        citationMarkers: 4,
        referenceCount: 0,
        referenceSectionDetected: false,
      },
    }
  ),
  sample(
    "G13",
    "存在 Zotero 字段",
    {
      paragraphs: [
        {
          field: { instr: "ADDIN ZOTERO_ITEM CSL_CITATION {\"citationID\":\"abc\",\"properties\":{}}", result: "[1]" },
        },
        { text: "正文讨论。" },
        { text: "参考文献", heading: 1 },
        { text: REFS_OK[0]! },
      ],
    },
    {
      default: { errors: [], warnings: [], maxInfos: 0, citationMarkers: 1, referenceCount: 1, referenceSectionDetected: true },
    }
  ),
  sample(
    "G14",
    "方括号非引文内容",
    {
      paragraphs: [
        { text: "矩阵 x=[1,2] 与区间 [0,1] 表示数值，研究见[1]。" },
        { text: "参考文献", heading: 1 },
        { text: REFS_OK[0]! },
        { text: REFS_OK[1]! },
      ],
    },
    {
      default: {
        errors: [],
        warnings: [],
        reviewsInclude: ["RR-SCOPE-013"],
        maxInfos: 1, // entry [2] uncited → info
        citationMarkers: 3, // [1,2] (review) + [0,1] (review) + [1]
        referenceCount: 2,
        referenceSectionDetected: true,
      },
    }
  ),
  sample(
    "G15",
    "无参考文献列表",
    {
      paragraphs: [{ text: "正文引用[1]但没有文献表。" }],
    },
    {
      default: {
        errors: [],
        warnings: ["RR-SCOPE-012"],
        maxInfos: 0,
        citationMarkers: 1,
        referenceCount: 0,
        referenceSectionDetected: false,
      },
    }
  ),
  sample(
    "G16",
    "2015 版类型代码差异（DS 在 2015 未定义）",
    {
      paragraphs: [
        { text: "使用了数据集[1]。" },
        { text: "参考文献", heading: 1 },
        { text: "[1] 某中心. 某数据集[DS/OL]. 某平台, 2024-01-01[2025-06-01]. https://example.com/ds. DOI: 10.1234/ds.001." },
      ],
    },
    {
      "2015": { errors: [], warnings: ["RR-FMT-008"], maxInfos: 0, referenceCount: 1 },
      "2025": { errors: [], warnings: [], maxInfos: 0, referenceCount: 1 },
    }
  ),
  sample(
    "G17",
    "2025 新增预印本类型（PP）",
    {
      paragraphs: [
        { text: "预印本研究[1]。" },
        { text: "参考文献", heading: 1 },
        { text: "[1] 王七. 某预印本论文[PP/OL]. 某预印本平台, 2025-03-01[2025-06-01]. https://example.org/pre/123." },
      ],
    },
    {
      "2015": { errors: [], warnings: ["RR-FMT-008"], maxInfos: 0, referenceCount: 1 },
      "2025": { errors: [], warnings: [], maxInfos: 0, referenceCount: 1 },
    },
    ["2015", "2025"]
  ),
];

/* ------------------------------------------------------------------ */
/* Sample 18: hostile / boundary inputs (raw byte-level)               */
/* ------------------------------------------------------------------ */

function zipBomb(): Uint8Array {
  // ~64 MB of zeros → ~64 KB compressed (ratio ~1000) — exceeds both the
  // per-entry cap and the ratio guard.
  const big = new Uint8Array(64 * 1024 * 1024);
  return zipSync({ "word/document.xml": big, "small.xml": strToU8("<x/>") });
}

function traversalZip(): Uint8Array {
  return zipSync({ "../evil.xml": strToU8("<x/>"), "word/document.xml": strToU8("<w/>") });
}

const GOLDEN_18: GoldenSample = {
  id: "G18",
  title: "超大文件、恶意输入及异常边界",
  versions: ["2015", "2025"],
  bytes: zipBomb,
  expect: {
    "2015": { errors: [], warnings: [] },
    "2025": { errors: [], warnings: [] },
  },
  throwsCode: "zip-bomb",
};

const GOLDEN_18B: GoldenSample = {
  id: "G18b",
  title: "路径穿越条目名",
  versions: ["2015", "2025"],
  bytes: traversalZip,
  expect: {
    "2015": { errors: [], warnings: [] },
    "2025": { errors: [], warnings: [] },
  },
  throwsCode: "bad-entry-name",
};

const GOLDEN_18C: GoldenSample = {
  id: "G18c",
  title: "损坏的 ZIP（非 ZIP 字节）",
  versions: ["2015", "2025"],
  bytes: () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
  expect: {
    "2015": { errors: [], warnings: [] },
    "2025": { errors: [], warnings: [] },
  },
  throwsCode: "not-docx",
};

const GOLDEN_18D: GoldenSample = {
  id: "G18d",
  title: "空文件",
  versions: ["2015", "2025"],
  bytes: () => new Uint8Array(0),
  expect: {
    "2015": { errors: [], warnings: [] },
    "2025": { errors: [], warnings: [] },
  },
  throwsCode: "empty-file",
};

const GOLDEN_18E: GoldenSample = {
  id: "G18e",
  title: "XML 结构损坏的 DOCX",
  versions: ["2015", "2025"],
  bytes: () => buildZip({ "word/document.xml": "<w:document><w:body><w:p></w:body></w:document>" }),
  expect: {
    "2015": { errors: [], warnings: [] },
    "2025": { errors: [], warnings: [] },
  },
  throwsCode: undefined as unknown as string, // throws generic Error, tested separately
};

export const HOSTILE_SAMPLES: GoldenSample[] = [GOLDEN_18, GOLDEN_18B, GOLDEN_18C, GOLDEN_18D, GOLDEN_18E];
