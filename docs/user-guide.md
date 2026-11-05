# 新用户使用教程 · New User Guide

三分钟学会使用引文雷达。不需要编程知识，不需要注册，论文不会离开你的浏览器。

Three minutes to your first check. No coding, no sign-up, your paper never
leaves the browser.

---

## 中文教程

### 1. 打开工具

访问 **https://geyutu6755.github.io/reference-radar/**。
建议使用电脑端的 Chrome、Edge 或 Firefox 浏览器。

### 2. 选择标准版本（可选）

页面右上角下拉框选择学校要求的标准：

- **GB/T 7714—2025（现行）** — 2026 年 7 月 1 日起实施，多数 2026 年之后提交的论文适用；
- **GB/T 7714—2015** — 2026 年 7 月前提交、学校仍按旧版要求时使用。

不确定时先用 2025，也可以随时切换版本重新分析。

### 3. 三种开始方式（任选其一）

- **上传文件**：把 `.docx` 论文拖到页面中央的虚线框里，或点击选择文件（≤20 MB）；
- **体验示例论文**：点击按钮，用内置示例走一遍完整流程；
- **粘贴文本**：点击"粘贴文本检查"，把正文和参考文献粘贴进去（每行一个段落）。

### 4. 看懂检查结果

分析完成后进入工作台，右侧列出所有发现，按严重程度分四类：

| 类型 | 含义 | 该怎么办 |
|---|---|---|
| 🔴 错误 | 依据标准条款可确定的问题（如引用了不存在的编号） | 按建议修改 |
| 🟠 警告 | 有明确条款依据但可能存在特殊写法 | 核对后修改 |
| 🟣 待复核 | 存在歧义（如数学向量、数据表编号），工具不作判断 | 人工确认 |
| ⚪ 提示 | 不是错误（如"未在正文找到引用"的条目） | 按学校要求决定 |

点击任何一条问题，会**自动跳转到论文原文位置**并高亮；问题卡片底部显示
**检查依据**（标准版本 + 条款号 + 条款说明），可据此核对。

对于页码连接符、日期格式等**可以无歧义规范化**的问题，卡片中会出现
**"预览修改"**：并排显示修改前后的片段，点击"复制修改后条目"即可把改好的
整条文献复制到剪贴板，粘贴回论文即可。工具**只做机械性规范化，不会替你
编造缺失的作者、年份或页码**——缺失项一律以"待复核"或"警告"提示人工补充。

### 5. 关系图与导出

- **引文关系图**：切换到"引文关系图"标签，看到正文引用与文献表的连线，
  红色虚线表示缺失对应关系；点击节点高亮关联。
- **导出报告**：顶栏"导出 HTML 报告"（可离线打开）或"导出 PDF 报告"
  （首次使用需加载中文字体，约 10 MB，之后离线可用）。

### 6. 离线使用（可选）

浏览器菜单选择"安装应用"后，断网也能完成检查与 **HTML 报告导出**。

**离线 PDF 导出的前提**：PDF 所需的中文字体（约 10 MB）会在**联网状态下第一次
导出 PDF 时**缓存。因此请先联网成功导出一次 PDF，之后断网才能继续导出 PDF。
若在未缓存字体时离线导出，工具会明确提示（不会卡住），按提示联网导出一次即可。

另外请注意：离线能力依赖已安装的 PWA（Service Worker 接管页面）。如果安装
未完成或页面未被接管，刷新后离线将无法加载应用——这是既定边界，此时请恢复
网络后刷新。

### 7. 常见问题

- **检查结果显示"待复核"是错了吗？** 不是。待复核是工具不确定的地方，
  需要你人工确认，这正是为了避免把数学向量等误判成引用。
- **页码不是 Word 的页码？** 工具显示"第 N 段/块"位置，因为 DOCX 无法可靠
  还原分页。
- **支持 .doc 吗？** 不支持，请先用 Word 另存为 .docx。
- **论文会被上传吗？** 不会。全部解析在你的浏览器内存中完成，关闭页面即清除
  （可在浏览器网络面板验证）。

---

## English Guide

1. **Open** https://geyutu6755.github.io/reference-radar/ in Chrome, Edge or Firefox.
2. **Pick the standard** (top-right): GB/T 7714—2025 (current) or —2015. Switch
   any time; the analysis re-runs from the in-memory file.
3. **Start** one of three ways: drag a `.docx` onto the drop zone, click
   "体验示例论文" for the built-in sample, or paste text (one paragraph per line).
4. **Read the findings** — 🔴 errors (clause-backed), 🟠 warnings, 🟣 review
   (ambiguous, tool refuses to judge), ⚪ info. Clicking a finding jumps to the
   exact text and shows the **rule basis** (version + clause + summary).
5. **Graph & exports** — the graph tab shows citation↔reference links (red
   dashed = missing); export a standalone HTML report or a real PDF with
   selectable Chinese text (first export fetches the ~10 MB CJK font).
6. **Offline** — install via the browser menu; checking and HTML-report export
   keep working offline. **Offline PDF** additionally requires exporting the PDF
   once while online first (the ~10 MB CJK font is cached on that first export);
   the tool states this clearly if you attempt an offline PDF before that. Full
   offline capability requires the installed PWA (service-worker controlled page).

Feedback: [open an issue](https://github.com/geyutu6755/reference-radar/issues/new/choose) — see `docs/feedback.md` for what to include.

---

## 分享给同学/同事

如果你觉得有用，[`docs/promotion-materials.md`](promotion-materials.md) 里有
可直接复制的文案（按角色分类）与截图索引。反馈请走
[Issue 模板](https://github.com/geyutu6755/reference-radar/issues/new/choose)
或 [试用公告 Discussion](https://github.com/geyutu6755/reference-radar/discussions/3)。
