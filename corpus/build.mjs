/**
 * Independent corpus builder for external validation of Reference Radar.
 *
 * Deliberately INDEPENDENT from src/testing/docx-builder.ts: separate OOXML
 * emitters that mimic how real Word documents look (namespace-piled document
 * headers, eastAsia font hints, w:jc alignment, bookmarks, w:sectPr, real
 * footnoteReference anatomy, real field-code shapes). Nothing here is imported
 * from src/.
 *
 * Usage: node corpus/build.mjs   → writes corpus/files/<id>.docx
 */
import { zipSync, strToU8 } from "fflate";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

/* ---------------- XML emitters (independent style) ---------------- */

const NS =
  'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A run; opts: {bold, sup, italics}. Real-Word-ish rPr on every run. */
function run(text, opts = {}) {
  const rPr = [];
  rPr.push('<w:rFonts w:hint="eastAsia"/>');
  if (opts.bold) rPr.push("<w:b/>");
  if (opts.italics) rPr.push("<w:i/>");
  if (opts.sup) rPr.push('<w:vertAlign w:val="superscript"/>');
  return `<w:r><w:rPr>${rPr.join("")}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

/** Plain paragraph; opts: {heading, align, runs (string|array), bookmark} */
function para(content, opts = {}) {
  const pPr = [];
  if (opts.style) pPr.push(`<w:pStyle w:val="${opts.style}"/>`);
  if (opts.heading) pPr.push(`<w:outlineLvl w:val="${opts.heading - 1}"/>`);
  if (opts.align) pPr.push(`<w:jc w:val="${opts.align}"/>`);
  if (opts.num !== undefined) {
    pPr.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opts.num}"/></w:numPr>`);
  }
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  const marks = opts.bookmark ? `<w:bookmarkStart w:id="${opts.bookmark}" w:name="_GoBack${opts.bookmark}"/><w:bookmarkEnd w:id="${opts.bookmark}"/>` : "";
  const pieces = Array.isArray(content) ? content : [{ t: content }];
  const body =
    marks +
    pieces
      .map((p) => {
        if (p.fieldRef !== undefined) {
          // real footnote reference anatomy
          return `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${p.fieldRef}"/></w:r>`;
        }
        if (p.field) {
          // real field shape: begin / instrText / separate / result / end
          return (
            run("", {}) +
            `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
            `<w:r><w:instrText xml:space="preserve">${esc(p.field)}</w:instrText></w:r>` +
            `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
            run(p.fieldResult ?? "", {}) +
            `<w:r><w:fldChar w:fldCharType="end"/></w:r>`
          );
        }
        return run(p.t ?? "", p);
      })
      .join("");
  return `<w:p>${pPrXml}${body}</w:p>`;
}

function tc(cells) {
  return `<w:tr>${cells
    .map(
      (c) =>
        `<w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/></w:tcPr>${
          Array.isArray(c) ? c.join("") : para(c)
        }</w:tc>`
    )
    .join("")}</w:tr>`;
}

function table(rows) {
  return (
    `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="2800"/><w:gridCol w:w="2800"/><w:gridCol w:w="2800"/></w:tblGrid>` +
    rows.map(tc).join("") +
    `</w:tbl>` +
    para("", {})
  );
}

const CTYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

function docx({ body, footnotes, numbering, styles }) {
  const files = {
    "[Content_Types].xml": strToU8(CTYPES),
    "_rels/.rels": strToU8(RELS),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${Array.isArray(body) ? body.join("") : body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`
    ),
  };
  if (footnotes) {
    files["word/footnotes.xml"] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes ${NS}>` +
        `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
        `<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>` +
        footnotes
          .map((paras, i) => `<w:footnote w:id="${i + 1}">${paras.map((p) => para(p)).join("")}</w:footnote>`)
          .join("") +
        `</w:footnotes>`
    );
  }
  if (numbering) {
    files["word/numbering.xml"] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${NS}>` +
        `<w:abstractNum w:abstractNumId="10">` +
        numbering.levels
          .map(
            (l) =>
              `<w:lvl w:ilvl="${l.ilvl}"><w:start w:val="1"/><w:numFmt w:val="${l.fmt}"/><w:lvlText w:val="${esc(l.text)}"/></w:lvl>`
          )
          .join("") +
        `</w:abstractNum>` +
        numbering.nums.map((n) => `<w:num w:numId="${n.numId}"><w:abstractNumId w:val="${n.abstractId}"/></w:num>`).join("") +
        `</w:numbering>`
    );
  }
  if (styles) {
    files["word/styles.xml"] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}>` +
        styles.map((s) => `<w:style w:type="paragraph" w:styleId="${s.id}"><w:name w:val="${esc(s.name)}"/></w:style>`).join("") +
        `</w:styles>`
    );
  }
  return zipSync(files);
}

/* ---------------- corpus samples ---------------- */

const samples = {};
const add = (id, bytes) => (samples[id] = bytes);

// C01 — 标准中文论文：全部正确（期刊/图书/学位论文/电子资源混合）
add(
  "C01",
  docx({
    body: [
      para("县域数字经济研究综述", { heading: 1, bookmark: 0 }),
      para("已有研究系统考察了数字经济对县域产业的影响[1]，并讨论了政策含义[2]。"),
      para("国际比较研究提供了方法参照[3]，学位论文层面的证据也在积累[4]。"),
      para("开放数据资源被广泛使用[5]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 刘守英. 数字经济与县域产业发展[J]. 中国农村经济, 2021, 38(4): 2-19."),
      para("[2] 王小华. 数字乡村建设的政策评估[M]. 北京: 社会科学文献出版社, 2022: 55-70."),
      para("[3] Chen M K. The economic effects of e-commerce[J]. American Economic Journal, 2021, 13(4): 355-380."),
      para("[4] 张丽. 县域数字化转型研究[D]. 中国人民大学, 2023."),
      para("[5] 国家统计局. 中国县域统计年鉴[DS/OL]. 北京: 中国统计出版社, 2024-06-01[2025-01-10]. https://example.org/yearbook."),
    ],
  })
);

// C02 — 缺失文献：正文引用 [5] 但列表只有 1–4
add(
  "C02",
  docx({
    body: [
      para("缺失文献样本", { heading: 1 }),
      para("前两项研究[1]与[2]奠定了基础，方法部分借鉴[3]，最新的综合评述见[5]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 研究一[J]. 学报, 2020, 1(1): 1-9."),
      para("[2] 乙. 研究二[M]. 出版社, 2021."),
      para("[3] 丙. 研究三[J]. 学报, 2022, 2(2): 10-18."),
      para("[4] 丁. 研究四[D]. 大学, 2023."),
    ],
  })
);

// C03 — 编号重复：[2] 两条不同条目
add(
  "C03",
  docx({
    body: [
      para("编号重复样本", { heading: 1 }),
      para("引用[1]与[2]，另见[3]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 文献一[J]. 学报, 2020."),
      para("[2] 乙. 文献二[M]. 出版社, 2021."),
      para("[2] 丙. 文献三[J]. 学报, 2022."),
      para("[3] 丁. 文献四[D]. 大学, 2023."),
    ],
  })
);

// C04 — 首次引用乱序：第一处引用是 [2]
add(
  "C04",
  docx({
    body: [
      para("首次引用乱序样本", { heading: 1 }),
      para("最早的工作[2]提出了框架，随后[1]做了扩展，最新进展见[3]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 扩展研究[J]. 学报, 2021."),
      para("[2] 乙. 原始框架[J]. 学报, 2020."),
      para("[3] 丙. 最新进展[J]. 学报, 2022."),
    ],
  })
);

// C05 — 倒置区间 [4-2]
add(
  "C05",
  docx({
    body: [
      para("区间异常样本", { heading: 1 }),
      para("相关研究见[1]、[2]、[3]，综述覆盖[4-2]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 文一[J]. 学, 2020."),
      para("[2] 乙. 文二[J]. 学, 2021."),
      para("[3] 丙. 文三[J]. 学, 2022."),
      para("[4] 丁. 文四[J]. 学, 2023."),
    ],
  })
);

// C06 — 完全重复著录（[2] 与 [3] 内容相同）
add(
  "C06",
  docx({
    body: [
      para("重复著录样本", { heading: 1 }),
      para("正文引用[1]、[2]与[3]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 唯一文献[J]. 学报, 2020."),
      para("[2] 乙. 同一篇论文题名[J]. 某学报, 2021, 5(2): 33-40."),
      para("[3] 乙. 同一篇论文题名[J]. 某学报, 2021, 5(2): 33-40."),
    ],
  })
);

// C07 — 未引用条目：[4] 列出但正文从未引用
add(
  "C07",
  docx({
    body: [
      para("未引用条目样本", { heading: 1 }),
      para("正文只引用了[1]、[2]与[3]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 文献一[J]. 学报, 2020."),
      para("[2] 乙. 文献二[J]. 学报, 2021."),
      para("[3] 丙. 文献三[J]. 学报, 2022."),
      para("[4] 丁. 从未被引用的文献[J]. 学报, 2023."),
    ],
  })
);

// C08 — Word 自动编号文献表（numbering.xml，编号渲染为 [n]）
add(
  "C08",
  docx({
    body: [
      para("自动编号文献表样本", { heading: 1 }),
      para("正文引用[1]与[2]。"),
      para("参考文献", { heading: 1 }),
      para("甲. 自动编号文献一[J]. 学报, 2020.", { num: 3 }),
      para("乙. 自动编号文献二[M]. 出版社, 2021.", { num: 3 }),
    ],
    numbering: { levels: [{ ilvl: 0, fmt: "decimal", text: "[%1]" }], nums: [{ numId: 3, abstractId: 10 }] },
  })
);

// C09 — 脚注中引用（真实 footnoteReference + 脚注内容含 [2]）
add(
  "C09",
  docx({
    body: [
      para("脚注引用样本", { heading: 1 }),
      para("正文引用[1]，作者在此处补充说明。", {}),
      [{ t: "正文补充说明" }, { fieldRef: 1 }],
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 文献一[J]. 学报, 2020."),
      para("[2] 乙. 文献二[J]. 学报, 2021."),
    ],
    footnotes: [["作者感谢匿名审稿人，方法细节见文献[2]。"]],
  })
);

// C10 — Zotero 域引用（真实域结构 + 显示文本 [1]）
add(
  "C10",
  docx({
    body: [
      para("Zotero 域引用样本", { heading: 1 }),
      para("文献管理器插入的引用如下。"),
      para([
        {
          field:
            ' ADDIN ZOTERO_ITEM CSL_CITATION {"citationID":"K2Ab","properties":{"formattedCitation":"[1]"}}',
          fieldResult: "[1]",
        },
      ]),
      para("讨论段落。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 文献一[J]. 学报, 2020."),
    ],
  })
);

// C11 — 表格：数据编号与真实引用混排
add(
  "C11",
  docx({
    body: [
      para("表格混排样本", { heading: 1 }),
      para("正文引用[1]，表内含数据与另一处引用。"),
      table([
        ["组别", "处理", "来源"],
        ["A", "快递进村", "文献[2]"],
        ["B", "无快递", "样本[1,2]"],
      ]),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 文献一[J]. 学报, 2020."),
      para("[2] 乙. 文献二[J]. 学报, 2021."),
    ],
  })
);

// C12 — 中文标点变体：全角括号、全角逗号、破折号区间
add(
  "C12",
  docx({
    body: [
      para("中文标点样本", { heading: 1 }),
      para("全角引用［1］与混合分隔［2，3—5］；半角紧凑[6,7]也出现。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 文一[J]. 学, 2020."),
      para("[2] 乙. 文二[J]. 学, 2021."),
      para("[3] 丙. 文三[J]. 学, 2022."),
      para("[4] 丁. 文四[J]. 学, 2023."),
      para("[5] 戊. 文五[J]. 学, 2024."),
      para("[6] 己. 文六[J]. 学, 2025."),
      para("[7] 庚. 文七[J]. 学, 2026."),
    ],
  })
);

// C13 — 非引文方括号：向量、矩阵、区间（期望全部不产生确定性错误）
add(
  "C13",
  docx({
    body: [
      para("非引文方括号样本", { heading: 1 }),
      para("状态向量 x=[1,2] 满足约束；矩阵 [0 1; 1 0] 为置换矩阵；取值范围为 [0,1] 区间；实验条件为温度 300[K]。"),
      para("唯一真实引用是[1]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 文献一[J]. 学报, 2020."),
      para("[2] 乙. 文献二[J]. 学报, 2021."),
    ],
  })
);

// C14 — 无参考文献章节
add(
  "C14",
  docx({
    body: [para("无文献表样本", { heading: 1 }), para("正文引用了[1]，但全文没有参考文献列表。")],
  })
);

// C15 — 损坏文件：完全不是 ZIP
add("C15", strToU8("this is not a zip archive at all, just plain text bytes 1234567890"));

// C16 — 多段落组成的一条文献（第二段无编号）
add(
  "C16",
  docx({
    body: [
      para("多段落条目样本", { heading: 1 }),
      para("正文引用[1]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 甲. 这是一条很长的文献题名，第一段著录了作者与题名，"),
      para("续行内容包含出版信息[J]. 学报, 2020, 1(1): 1-9."),
      para("[2] 乙. 普通条目[J]. 学报, 2021."),
    ],
  })
);

// C17 — 英文论文（References 标题，et al 风格）
add(
  "C17",
  docx({
    body: [
      para("E-commerce and rural income", { heading: 1 }),
      para("Prior studies document large effects[1] and heterogeneous gains[2-3]."),
      para("References", { heading: 1 }),
      para("[1] Couture V, Faber B. Connecting the countryside via e-commerce[J]. American Economic Review, 2021, 111(10): 3111-3158."),
      para("[2] Chen M K. The economic effects of e-commerce[J]. AEJ Policy, 2021, 13(4): 355-380."),
      para("[3] Luo R, et al. Mobile commerce in rural China[J]. World Development, 2019, 120: 105-118."),
    ],
  })
);

// C18 — 同页双题名：中文论文以 References 结尾
add(
  "C18",
  docx({
    body: [
      para("混合标题样本", { heading: 1 }),
      para("正文引用[1]与[2]。"),
      para("References", { heading: 1 }),
      para("[1] 王五. 中文文献[J]. 中国农村经济, 2020(3): 24-41."),
      para("[2] Smith J. English reference[J]. Nature, 2021, 592: 55-60."),
    ],
  })
);

// C19 — 高度相似条目（同作者同年仅页码不同 → 疑似重复）
add(
  "C19",
  docx({
    body: [
      para("疑似重复样本", { heading: 1 }),
      para("正文引用[1]与[2]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 张三. 农村电商增收效应研究[J]. 中国农村经济, 2020(3): 24-33."),
      para("[2] 张三. 农村电商增收效应研究[J]. 中国农村经济, 2020(3): 34-41."),
    ],
  })
);

// C20 — 类型代码版本差异：[DS/OL] 在 2015 未定义
add(
  "C20",
  docx({
    body: [
      para("版本差异样本", { heading: 1 }),
      para("研究使用了公开数据集[1]。"),
      para("参考文献", { heading: 1 }),
      para("[1] 某中心. 县域经济数据集[DS/OL]. 某平台, 2024-01-01[2025-03-01]. https://example.org/ds."),
    ],
  })
);

mkdirSync(join(ROOT, "files"), { recursive: true });
for (const [id, bytes] of Object.entries(samples)) {
  const out = join(ROOT, "files", `${id}.docx`);
  writeFileSync(out, bytes);
  console.log(`built ${id}.docx (${bytes.length} bytes)`);
}
console.log(`total: ${Object.keys(samples).length} corpus files`);
