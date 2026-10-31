<div align="center">

# 引文雷达 · Reference Radar

**免费、开源、本地优先的学术论文引文与参考文献核查工具，围绕 GB/T 7714 国家标准构建。**

[在线演示](https://geyutu6755.github.io/reference-radar/) · [English](README.md) · [问题反馈](https://github.com/geyutu6755/reference-radar/issues)

*每项判断都标注标准条款，并定位到原文。*

</div>

---

![工作台](docs/screenshots/workbench.png)

上传论文 **.docx**，引文雷达完全在浏览器本地完成解析与核查——无服务器、无账号、无 API Key：

- 识别正文中的数字型引文（`[1]`、`[2-4]`、`[1，3]`、全角变体等）与文末参考文献表；
- 建立引文与文献的对应关系，找出**缺失、重复、跳号**；
- 检查顺序编码制下的**首次引用顺序**问题；
- 发现完全重复或高度相似的著录条目；
- 检查所选标准版本中不存在的文献类型标识代码；
- 数学数组、数据表等歧义方括号**不做自动判定**，进入待复核列表。

## 在线演示与离线应用

[演示站点](https://geyutu6755.github.io/reference-radar/)是完整的 PWA：通过浏览器菜单安装后**断网也能使用**——分析与报告导出均可用。论文不会离开浏览器标签页。

## 功能截图

| 首页 | 检查结果与依据 |
|---|---|
| ![首页](docs/screenshots/home.png) | ![检查依据](docs/screenshots/issue-basis.png) |

| 引文关系图 | 深色主题 |
|---|---|
| ![关系图](docs/screenshots/graph.png) | ![深色](docs/screenshots/graph-dark.png) |

## 检查范围（以及不检查什么）

每条规则按标准版本独立维护，均标注来源条款与核验状态（完整矩阵见 [`docs/rule-coverage.md`](docs/rule-coverage.md)）：

- **GB/T 7714—2025**（现行，2026-07-01 实施）——已实现 12 条规则；接受 2025 新增的 `DS`、`PP`、`MM` 等代码。
- **GB/T 7714—2015**（已被代替）——同一批结构性规则按 2015 版条款编号；2025 独有代码在该版本下会给出未定义提示。
- v1.0 **明确不检查**：著者-出版年制、2025 新增各文献类型的完整必备项核查、对整个标准的合规认证。"未被正文引用"只作为提示信息，不判定为违规。详见 [`docs/limitations.md`](docs/limitations.md)。

## 为什么是本地优先？

论文内容不是我们的数据。本项目没有后端：DOCX 在浏览器内存中解包解析，不做持久化，Service Worker 只缓存静态应用资源。你可以在浏览器的网络面板里直接验证这些说法——见 [`docs/privacy.md`](docs/privacy.md)。

## 快速开始

**直接使用：** 打开[演示站点](https://geyutu6755.github.io/reference-radar/)（或在本地运行），拖入 `.docx`，选择标准版本，开始分析。也可以点击"体验示例论文"——它运行的是真实引擎。

**本地开发：**

```bash
git clone https://github.com/geyutu6755/reference-radar.git
cd reference-radar
pnpm install
pnpm dev                    # 开发服务器
pnpm test                   # 单元 + 黄金样本 + 恶意输入 + 性能测试
pnpm exec playwright test   # E2E（Chromium/Firefox/WebKit，自动构建并启动预览）
pnpm build                  # 生产构建到 dist/
```

环境要求：Node 20+、pnpm 9+。所有命令的实际验证记录见 [`docs/testing.md`](docs/testing.md)。

## 技术架构

```
DOCX 字节 → 安全解包（fflate + 炸弹/路径防护）
          → OOXML 结构解析（preserveOrder；Run/域/修订/表格/脚注尾注）
          → 带字符级锚点的文档块 DocBlock[]
          → 引文与参考文献条目（含置信度）
          → 按版本选择的 GB/T 7714 规则引擎 → 问题列表
          → 工作台界面 / SVG 关系图 / HTML+PDF 报告
```

- React 19 + TypeScript 严格模式，自建设计系统（无 CSS 框架），Web Worker 分析管线
- PDF 导出内嵌 Noto Sans CJK SC 子集字体（SIL OFL），中文文本可选取
- 手写 Service Worker，预缓存清单由构建生成

## 参与贡献

欢迎 Issue 与 Pull Request——见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。新增规则必须引用来源条款并附测试用例；元测试运行器会执行每条规则声明的全部用例。

## 开源许可证

[MIT](LICENSE)——内嵌字体子集遵循 SIL Open Font License 1.1。
