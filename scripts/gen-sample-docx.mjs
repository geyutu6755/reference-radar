/**
 * Build a user-facing sample paper DOCX for the release assets.
 * Same content as src/app/sample-doc.ts — generated as a real DOCX file.
 */
import { zipSync, strToU8 } from "fflate";
import { writeFileSync } from "node:fs";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (t, opts = {}) => {
  const pPr = [];
  if (opts.heading) pPr.push(`<w:outlineLvl w:val="${opts.heading - 1}"/>`);
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  const runs = Array.isArray(t) ? t : [t];
  return `<w:p>${pPrXml}${runs.map((x) => `<w:r><w:t xml:space="preserve">${esc(x)}</w:t></w:r>`).join("")}</w:p>`;
};
const cell = (t) => `<w:tc><w:tcPr/>${para(t)}</w:tc>`;
const row = (cells) => `<w:tr>${cells.map(cell).join("")}</w:tr>`;
const table = (rows) => `<w:tbl><w:tblPr/><w:tblGrid/>${rows.map(row).join("")}</w:tbl>`;

const body = [
  para("基于引文分析的学术论文质量评估研究", { heading: 1 }),
  para("摘要：学术论文的引文规范是学术质量的重要体现。本文提出一种自动化的引文一致性核查方法，并在真实论文集上进行了验证[1]。"),
  para("关键词：引文分析；参考文献；GB/T 7714；学术规范"),
  para("1 引言", { heading: 2 }),
  para("参考文献著录的规范性直接影响学术交流的效率[2]。近年来，随着数字图书馆的发展，英文文献的引文分析已形成成熟方法[3]，但中文论文的格式核查工具仍然缺乏。"),
  para("已有研究多集中于引文网络构建[1,3]，对著录格式细节的关注不足。学位论文中的规范性问题尤为突出[4]。"),
  para("2 研究方法", { heading: 2 }),
  para("2.1 数据来源", { heading: 3 }),
  para("本文选取某高校 2023 届博士学位论文 120 篇作为样本[2]，并参照国家标准的要求[5]进行标注。"),
  para("2.2 核查规则", { heading: 3 }),
  para("核查规则覆盖编号一致性、顺序编码、重复著录与类型标识等维度[1]。开放获取环境下的引用行为也有新特点[6]。"),
  para("3 结果与讨论", { heading: 2 }),
  para("分析表明，超过六成的样本存在至少一处编号问题；写作规范类著作对此有系统讨论[7]。上一章的数据来源方法[2]同样适用于本节。"),
  para("4 结论", { heading: 2 }),
  para("本文提出的方法能够自动定位引文与参考文献之间的对应问题，为论文写作与审校提供支持[1,4]。"),
  para("参考文献", { heading: 1 }),
  para("[1] 王明远, 刘晓峰. 深度学习在文献计量分析中的应用研究[J]. 情报学报, 2021, 40(3): 245-256."),
  para("[2] 陈红, 张伟, 李国强. 基于引文网络的学术影响力评价方法[M]. 北京: 科学出版社, 2020: 88-102."),
  para("[3] Smith J, Brown A. Citation analysis in digital libraries[J]. Journal of Information Science, 2022, 48(2): 155-170."),
  para("[4] 赵雪梅. 数字人文视域下的参考文献规范研究[D]. 北京大学, 2023."),
  para("[5] 国家市场监督管理总局. 信息与文献 参考文献著录规则: GB/T 7714—2015[S]. 北京: 中国标准出版社, 2015."),
  para("[6] Johnson K. Open access and scholarly communication[EB/OL]. (2023-05-12)[2024-10-01]. https://example.org/open-access."),
  para("[7] 李文博. 科研论文写作与投稿指南[M]. 2 版. 上海: 复旦大学出版社, 2019."),
  table([
    [para("错误类型"), para("数量"), para("占比[3]")],
    [para("编号缺失"), para("37"), para("31%")],
    [para("格式问题"), para("52"), para("43%")],
  ]),
].join("");

const docx = zipSync({
  "[Content_Types].xml": strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'
  ),
  "word/document.xml": strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}</w:body></w:document>`
  ),
});
writeFileSync("release-assets/示例论文-引文分析研究.docx", docx);
console.log("docx asset written:", docx.length, "bytes");
