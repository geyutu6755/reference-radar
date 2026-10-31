// Inline minimal DOCX builder for live verification (same format as tests).
import { zipSync, strToU8 } from "fflate";
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (t, h) =>
  `<w:p>${h ? `<w:pPr><w:outlineLvl w:val="${h - 1}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const body = [
  para("线上验证论文", 1),
  para("引言引用[1]与[2]；结论引用缺失编号[9]。"),
  para("参考文献", 1),
  para("[1] 张三. 文献一[J]. 学报, 2020, 1(1): 1-9."),
  para("[2] 李四. 文献二[M]. 出版社, 2021."),
].join("");
export function buildDocx() {
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`),
  });
}
