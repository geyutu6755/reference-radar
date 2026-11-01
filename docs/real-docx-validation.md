# Real-Document Compatibility Study (v1.0.2)

真实论文文档兼容性研究 — separate from the synthetic corpus. Executed
2026-11-01 against the v1.0.2-candidate engine. **This is a recorded study, not
a CI gate** (the files are not redistributable; the test skips silently when
they are absent — `src/core/corpus/real-docx.test.ts`).

## Samples obtained (real documents, not synthetic)

| ID | Document | Source | License / usage conditions |
|---|---|---|---|
| R-01 | 北京航空航天大学《本科生毕业设计（论文）word模板（2026-2027学年）》.docx（270 KB，573 段） | [北航教务处通知页](https://jiaowu.buaa.edu.cn/info/1025/2101.htm)（官方公开发布，面向本校学生下载） | 高校官方模板，著作权归学校；仅本地作兼容性输入，**不随仓库分发** |
| R-02 | 中国人民大学《本科毕业论文模板》.docx（1.4 MB，143 段） | [人大教务处下载页](http://jiaowu.ruc.edu.cn/jsym/sjjx/wjxzsj/51e69d201bca44c7b91f494f8daaa6a9.htm)（官方公开下载） | 同上 |
| R-03 | GB/T 7714—2025 标准文本 DOCX（45 页转写，1402 段，含目录域、脚注、表格） | [GitHub: RunawayOrange/GB_T_7714-2025](https://github.com/RunawayOrange/GB_T_7714-2025)（社区转写，未附许可证） | 仅本地解析鲁棒性输入，不随仓库分发 |

未使用任何私人论文；未公开任何含个人信息的文件；所有样本保存在
`_research/real-docx/`（已 gitignore），不进入仓库与发布物。

## Hand annotations (derived from reading the extracted text, before running)

**R-01 (北航)** — 正文含 2 个真实标记（`[2]`、`[3, 6-9]`，示例正文与示例文献表
并不对应）；文献表 15 条，为 GB/T 7714 官方示例的压缩著录形态：无空格标点
（`2000:29.`）、`[M]//` 析出、期刊年份区间（`1957(1)-1990(4)`）、增刊
（`45(增刊1)`）、文章编号页码、专利 `[P]`/`[P/OL]`、含 CSTR 的 `[D/OL]`、报纸
`[N]`、标准 `[S/OL]`、数据集 `[DS/OL]`、预印本 `[PP/OL]`，以及一条**含空格的
破损 URL**。预期：顺序错误 ×1（首引为 [2]）；联机条目缺引用日期警告 ×4
（[6][10][11][13]）；未引用条目信息 ×9；2015 版下 DS/PP 代码另告 2 条。

**R-02 (人大)** — 正文**无**数字型引用标记（大量 `[此处键入正文]` 占位符与
单位注释 `安[培]`、`开[尔文]`、`摩[尔]`——全部不得误判为引用）；文献表 6 条，
其中 [4][5][6] 为**空占位条目**；含全角标点（`：`、`，`）、`．` 分隔、`——`
副题名、`（1）` 全角期号。预期：0 标记、6 条全部解析、全部未引用信息 ×6、
零确定性错误。

**R-03 (标准文本)** — 结构鲁棒性样本：解析不崩溃、块数 ≥150。

## Results

| Sample / version | blocks | markers | issues vs. annotation |
|---|---|---|---|
| R-01/2025 | 573 | 2/2, 无多余检出 | 全部一致（error/warning/info） |
| R-01/2015 | 573 | 2/2 | 全部一致（含 DS/PP 版本告警 ×2） |
| R-02/2025 | 143 | 0/0 | 全部一致（零误报） |
| R-02/2015 | 143 | 0/0 | 全部一致 |
| R-03/2025 | 1402 | —（结构样本） | 解析成功，blocks ≥ 150 ✓ |

Aggregate: marker **recall = 1.000**, **precision = 1.000**（4 annotated, 4
detected, 0 extra）over the two annotated samples. 引擎对真实 Word 模板的
压缩标点、全角符号、空占位条目、破损 URL、2025 新代码均按标注处理，无一例
确定性误报。

Notable real-world behaviors verified:
- 人大模板的单位注释 `安[培]`、`开[尔文]` 与占位符 `[此处键入正文]` 全部未被
  误判为引用（真实世界的方括号误报场景）。
- 北航模板中 4 条真实联机条目缺引用日期被新规则 RR-FMT-013 命中——在真实
  文档上验证了该规则的实际价值。
- 空占位条目（人大 [4][5][6]）被解析但不产生确定性错误（仅"未引用"提示）。

## 数量与限制（如实记录）

- **样本量：3 份真实文档（2 所高校模板 + 1 份标准文本）**。相对"真实论文"
  的多样性（不同学校、不同 Word 版本、不同学科著录习惯）而言规模很小，
  本阶段未能获得更多可合法下载的真实学位论文 DOCX：多数高校以 PDF 公开
  学位论文，Word 版模板多经百度网盘分发（无法程序化获取），GitHub 模板
  仓库主分支/Release 均无 .docx 资产。已尝试并失败的渠道：GitHub 模板仓库
  ×6（北航/广工/川大×2/华工/台交大）、西工大教务处页面（无直接附件）、
  北航下载接口首次请求（需会话，重试后成功）。
- 上述指标是**构造文档上的精确集合匹配**，不是对自然论文准确率的估计。
  自然文档的准确率评估依赖公开测试阶段用户提交的脱敏样本
  （见 `docs/feedback.md`），目标是在 v1.1 周期内把真实样本语料扩充到
  ≥20 份并按同一方法复测。
- 扫描版/图片型 DOCX（无文本层）未覆盖。
