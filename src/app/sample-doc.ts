/**
 * The built-in sample paper. It is generated as a real DOCX byte stream and
 * analyzed by the full engine — no canned results anywhere.
 */
import { buildDocx, type TestDoc } from "../testing/docx-builder";

const REF_ENTRIES = [
  "[1] 王明远, 刘晓峰. 深度学习在文献计量分析中的应用研究[J]. 情报学报, 2021, 40(3): 245-256.",
  "[2] 陈红, 张伟, 李国强. 基于引文网络的学术影响力评价方法[M]. 北京: 科学出版社, 2020: 88-102.",
  "[3] Smith J, Brown A. Citation analysis in digital libraries[J]. Journal of Information Science, 2022, 48(2): 155-170.",
  "[4] 赵雪梅. 数字人文视域下的参考文献规范研究[D]. 北京大学, 2023.",
  "[5] 国家市场监督管理总局. 信息与文献 参考文献著录规则: GB/T 7714—2015[S]. 北京: 中国标准出版社, 2015.",
  "[6] Johnson K. Open access and scholarly communication[EB/OL]. (2023-05-12)[2024-10-01]. https://example.org/open-access.",
  "[7] 李文博. 科研论文写作与投稿指南[M]. 2 版. 上海: 复旦大学出版社, 2019.",
];

export function buildSampleDocx(): Uint8Array {
  const doc: TestDoc = {
    paragraphs: [
      { text: "基于引文分析的学术论文质量评估研究", heading: 1 },
      { text: "摘要：学术论文的引文规范是学术质量的重要体现。本文提出一种自动化的引文一致性核查方法，并在真实论文集上进行了验证[1]。" },
      { text: "关键词：引文分析；参考文献；GB/T 7714；学术规范" },
      { text: "1 引言", heading: 2 },
      { text: "参考文献著录的规范性直接影响学术交流的效率[2]。近年来，随着数字图书馆的发展，英文文献的引文分析已形成成熟方法[3]，但中文论文的格式核查工具仍然缺乏。" },
      { text: "已有研究多集中于引文网络构建[1,3]，对著录格式细节的关注不足。学位论文中的规范性问题尤为突出[4]。" },
      { text: "2 研究方法", heading: 2 },
      { text: "2.1 数据来源", heading: 3 },
      { text: "本文选取某高校 2023 届博士学位论文 120 篇作为样本[2]，并参照国家标准的要求[5]进行标注。" },
      { text: "2.2 核查规则", heading: 3 },
      { text: "核查规则覆盖编号一致性、顺序编码、重复著录与类型标识等维度[1]。开放获取环境下的引用行为也有新特点[6]。" },
      { text: "3 结果与讨论", heading: 2 },
      { text: "分析表明，超过六成的样本存在至少一处编号问题；写作规范类著作对此有系统讨论[7]。上一章的数据来源方法[2]同样适用于本节。" },
      { text: "表1给出了主要错误类型的分布情况。", },
      { text: "4 结论", heading: 2 },
      { text: "本文提出的方法能够自动定位引文与参考文献之间的对应问题，为论文写作与审校提供支持[1,4]。" },
      { text: "参考文献", heading: 1 },
      ...REF_ENTRIES.map((text) => ({ text })),
    ],
    tables: [
      [
        [
          [{ text: "错误类型" }],
          [{ text: "数量" }],
          [{ text: "占比[3]" }],
        ],
        [
          [{ text: "编号缺失" }],
          [{ text: "37" }],
          [{ text: "31%" }],
        ],
        [
          [{ text: "格式问题" }],
          [{ text: "52" }],
          [{ text: "43%" }],
        ],
      ],
    ],
  };
  return buildDocx(doc);
}

export const SAMPLE_FILE_NAME = "示例论文-引文分析研究.docx";

/** Sample B: typical citation errors — missing reference, duplicate number, order violation. */
export function buildErrorSampleDocx(): Uint8Array {
  const doc: TestDoc = {
    paragraphs: [
      { text: "示例论文（含典型引文错误）", heading: 1 },
      { text: "本示例包含典型错误：正文引用了未列出的文献[3]，先引用[2]后引用[1]，且编号[2]重复著录。" },
      { text: "研究基础见文献[1]。" },
      { text: "参考文献", heading: 1 },
      { text: "[1] 王明远. 深度学习在文献计量分析中的应用研究[J]. 情报学报, 2021, 40(3): 245-256." },
      { text: "[2] 陈红. 基于引文网络的学术影响力评价方法[M]. 北京: 科学出版社, 2020: 88-102." },
      { text: "[2] 陈红. 基于引文网络的学术影响力评价方法[M]. 北京: 科学出版社, 2020: 88-102." },
    ],
  };
  return buildDocx(doc);
}

/** Sample C: fixable format issues — page separator, cited-date format (exercises fix preview). */
export function buildFormatSampleDocx(): Uint8Array {
  const doc: TestDoc = {
    paragraphs: [
      { text: "示例论文（含可自动规范化的格式问题）", heading: 1 },
      { text: "本示例的页码使用了全角波浪线，在线文献的引用日期格式不规范，均可一键预览修正[1][2]。" },
      { text: "参考文献", heading: 1 },
      { text: "[1] 刘晓峰. 某项方法研究[J]. 某学报, 2021, 15(2): 245～256." },
      { text: "[2] Johnson K. Open access and scholarly communication[EB/OL]. (2023-05-12)[2024.10.01]. https://example.org/open-access." },
    ],
  };
  return buildDocx(doc);
}

export const SAMPLE_ERROR_FILE_NAME = "示例论文-含典型引文错误.docx";
export const SAMPLE_FORMAT_FILE_NAME = "示例论文-含可规范格式问题.docx";
