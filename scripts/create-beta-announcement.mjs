/**
 * Create the public-beta announcement discussion + seed a usage-metrics doc.
 * Run: node scripts/create-beta-announcement.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const token = (() => {
  const r = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf-8",
  });
  return /^password=(.+)$/m.exec(r.stdout)[1];
})();

const gh = async (url, body, method = "GET") => {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  return data;
};

// GraphQL is required for discussions
const gql = async (query, variables) => {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors).slice(0, 300));
  return data.data;
};

const owner = "geyutu6755";
const name = "reference-radar";

// 1. find the announcement category
const repoData = await gql(
  `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ id discussionCategories(first:10){ nodes{ id name } } } }`,
  { owner, name }
);
const repoId = repoData.repository.id;
const cats = repoData.repository.discussionCategories.nodes;
const ann = cats.find((c) => /announc/i.test(c.name)) ?? cats[0];
console.log("category:", ann.name);

// 2. create the beta announcement
const title = "📢 公开试用（第 1 轮）：用你的论文测一测引文雷达 · Public Beta Round 1";
const bodyText = `引文雷达 v1.1.2 已上线：https://geyutu6755.github.io/reference-radar/

**它做什么**：上传论文 DOCX（或粘贴文本），在浏览器本地检查引文编号与参考文献著录问题——缺失、重复、顺序、格式——每项结论都标注 GB/T 7714—2015/2025 条款依据。**论文不上传任何服务器。**

---

## 三种 5 分钟试用任务（选一个适合你的）

### 🎓 本科生
1. 打开网站，点「体验示例论文」；
2. 看懂四类发现：🔴 错误 / 🟠 警告 / 🟣 待复核 / ⚪ 提示；
3. 反馈：这套分类你能理解吗？

### 📚 研究生
1. 上传你论文的**副本**（≤20 MB，仅本地处理）；
2. 逐条核对「错误」与「待复核」：判断对不对？
3. 反馈：贴出 1–2 条判断有误的**片段 + 规则编号**（脱敏后）。

### ✏️ 编辑 / 审校
1. 用近期稿件副本测期刊 [J]、学位论文 [D]、电子资源 [EB/OL] 三类文献；
2. 对比工具结论与你的人工修改意见；
3. 反馈：哪些著录问题工具漏掉了（最好附条款依据）。

[选择反馈模板](https://github.com/geyutu6755/reference-radar/issues/new/choose) · [完整试用任务](https://github.com/geyutu6755/reference-radar/blob/main/docs/feedback.md) · [三分钟教程](https://github.com/geyutu6755/reference-radar/blob/main/docs/user-guide.md)

---

## 我们收集什么 / 不收集什么

- **不收集**：论文全文、个人信息、使用行为遥测（应用本身零上传，网络面板可验证）；
- **欢迎**：脱敏片段、错误截图、你的主观体验——提交在 Issue/Discussion 中的片段视为授权用于测试。

## 已知边界（如实说明）

- 仅支持顺序编码制（数字编号），著者-出版年制在 v1.2 路线图；
- 「有则必备」类缺项（如出版地）只能提示待复核，不能确定性判错；
- 真实文档样本仍少（3 份），自然论文准确率期待本轮融资。

---

*本轮试用为自愿参与，不设截止日期；反馈将逐条公开回应，并转化为回归测试用例。*`;

const created = await gql(
  `mutation($repoId:ID!,$catId:ID!,$title:String!,$body:String!){ createDiscussion(input:{repositoryId:$repoId,categoryId:$catId,title:$title,body:$body}){ discussion{ id url number } } }`,
  { repoId, catId: ann.id, title, body: bodyText }
);
const disc = created.createDiscussion.discussion;
console.log("discussion created:", disc.url, "| #", disc.number);

// 3. seed the metrics doc with zeroed, honest state
writeFileSync(
  "docs/beta-metrics.md",
  `# Public Beta Metrics (Round 1) — live document

真实试用指标记录。**本文件只记录实际发生的数据；空缺即表示尚未发生。**
最后更新：2026-11-06（试用公告发布日）。

## 参与情况

| 指标 | 数值 | 依据 |
|---|---|---|
| 公告发布 | 2026-11-06 | [Discussion #1](${disc.url}) |
| 自愿参与者 | **0**（公告刚发布） | — |
| 有效反馈数 | **0** | — |

## 反馈分类账

（每收到一条反馈，在此追加：日期 / 渠道 / 角色类别 / 摘要 / 处置）

*(暂无条目)*

## 指标定义（区分证据等级）

- **真实观察**：用户提交的可复现片段/截图 → 直接转为语料回归用例；
- **用户主观评价**：问卷式反馈（易懂性、耗时、是否愿意推荐）→ 原样记录，不外推；
- **开发者推测**：明确标注，不作为结论依据。

## 准确率说明

在自然论文样本 < 10 份之前，**不发布任何"总体准确率"数字**。
现有已验证指标仅限合成语料与 3 份真实模板文档
（见 docs/external-validation.md 与 docs/real-docx-validation.md）。
`
);
console.log("beta-metrics.md seeded");
process.exit(0);
