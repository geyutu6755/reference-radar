# Public Beta Feedback Plan

How to collect real-user feedback for the v1.0.x public beta — executable,
measurable, and free of spam or fabricated adoption claims.

## Goals

1. Learn how the checker behaves on **real, natural papers** (the external
   corpus is synthetic; see `docs/external-validation.md` § Coverage limits).
2. Find parsing misses and false positives the synthetic corpus cannot cover.
3. Prioritize the roadmap (v1.1 author–year support, v1.2 scope) by demand.

## Channels

| Channel | Purpose | Action |
|---|---|---|
| GitHub Issues (templates: bug / rule source / usage question) | defect & accuracy reports | triaged weekly; label `corpus-candidate` when a reproducible sample arrives |
| GitHub Discussions (Q&A + Ideas) | usage questions & feature requests | enabled; answered in zh/en |
| Rule-source issue template | clause disputes with citations | feeds `docs/rule-coverage.md` updates |

## What we ask users to share

- The **ruleId + detail text** of any wrong finding (auto-copied in every report);
- A **minimal .docx fragment** that reproduces it (with private content removed);
- Browser and OS version.

We never ask users to submit papers themselves, and the app cannot upload them.

## Metrics we will track (honest ones only)

- Number of confirmed defect reports per release (issue labels);
- Corpus growth: every reproducible report becomes a new annotated corpus case
  (precision/recall re-measured per `docs/external-validation.md`);
- Median triage response time.

We do **not** publish download/user counts until there is a real measurement
source, and we do not send unsolicited promotion of any kind.

## 试用任务（公开测试参与者用 5 分钟完成的清单）

给不同角色的最小试用路径——完成其中一组并反馈即可，不需要提交论文全文：

**大学生 / 本科毕业论文**
1. 打开演示站，点"体验示例论文"，看完 4 类发现各代表什么；
2. 用"粘贴文本"贴入你论文的参考文献表（每行一条）；
3. 反馈：工具对你们学校要求格式的判断是否符合预期（Issue 模板"使用咨询"）。

**研究生 / 学位论文**
1. 上传你论文的**副本**（.docx，≤20 MB，本地处理不上传）；
2. 核对每一条"错误"和"待复核"：对/不对，为什么（引用条款）；
3. 反馈：贴出 1-2 条判断错误的**原文片段 + ruleId**（脱敏后提交，勿贴全文）。

**论文编辑 / 审校**
1. 用一篇近期处理的稿件副本测试三种文献类型（期刊/学位论文/电子资源）；
2. 对比工具结果与你的人工修改意见；
3. 反馈：哪些著录格式问题工具漏掉了（"规则来源与覆盖"模板，附条款依据更佳）。

### 提交脱敏示例的规范

- **欢迎**：去掉作者/导师/致谢等个人信息后的文献表片段、含问题标记的段落；
- **不要**：未经脱敏的全文、他人论文、含未发表数据的章节；
- 脱敏片段仅在**你明确同意**后纳入公开回归语料（Issue 模板中有 Yes/No 选择）；不同意不影响问题排查；
- 如需授权整篇测试文件但不公开，请在 issue 中说明，维护者会提供不公开的
  传递方式并仅本地使用。

## Weekly triage checklist (maintainer)

1. Review new issues; label (`bug`, `rules`, `corpus-candidate`, `ux`).
2. Convert reproducible parsing/accuracy reports into corpus cases with hand
   annotations; add regression tests.
3. Update `docs/rule-coverage.md` and this file when scope changes.
4. Close the loop: comment on the issue with the release that fixes it.
