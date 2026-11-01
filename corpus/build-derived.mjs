
// Real-derived regression fixtures (v1.1): reference entries extracted from
// PUBLIC university thesis templates (北航教务处 2026-2027, 人大教务处) rebuilt
// as fresh minimal DOCX. Bibliographic entries are factual data; source
// attribution in docs/real-docx-validation.md. Built by corpus/build.mjs-style
// emitters (independent of src/testing).
import { zipSync, strToU8 } from "fflate";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (t, opts = {}) => {
  const pPr = opts.heading ? `<w:pPr><w:outlineLvl w:val="${opts.heading - 1}"/></w:pPr>` : "";
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
};
const CTYPES = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>';

function docx(paras) {
  return zipSync({
    "[Content_Types].xml": strToU8(CTYPES),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${paras.join("")}</w:body></w:document>`
    ),
  });
}

// Derived fixture A: the 15 GB/T 7714 official example entries as they appear
// in the 北航 template (compressed punctuation, PP/DS, broken URL, etc.)
const buaa = JSON.parse(process.env.__ENTRIES__).buaa;
const buaaDoc = docx([
  para("真实派生样本A（北航模板文献表）", { heading: 1 }),
  para("示例正文引用[2]与[3, 6-9]。"),
  para("参考文献", { heading: 1 }),
  ...buaa.map((t) => para(t)),
]);

// Derived fixture B: 人大 template entries (full-width punctuation, empty slots)
const ruc = JSON.parse(process.env.__ENTRIES__).ruc;
const rucDoc = docx([
  para("真实派生样本B（人大模板文献表）", { heading: 1 }),
  para("以下为模板占位文献表，正文无引用标记。"),
  para("参考文献", { heading: 1 }),
  ...ruc.map((t) => para(t)),
]);

mkdirSync(join(ROOT, "files"), { recursive: true });
writeFileSync(join(ROOT, "files", "R-D1-buaa-derived.docx"), buaaDoc);
writeFileSync(join(ROOT, "files", "R-D2-ruc-derived.docx"), rucDoc);
console.log("derived fixtures written");
