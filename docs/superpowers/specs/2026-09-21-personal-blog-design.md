# 个人博客设计文档

- **日期**：2026-09-21
- **站点地址**：https://lsc188zq.github.io
- **仓库**：https://github.com/lsc188zq/lsc188zq.github.io （公开，用户主页仓库）
- **本地目录**：`D:\Projects\MyBlog`
- **内容来源**：`C:\Users\21004\Documents\Obsidian Vault`（私有 git 仓库）

---

## 1. 目标与范围

搭建一个托管在 GitHub Pages 上的个人博客，内容来自已有的 Obsidian 笔记库。

**内容实况**：库中主要是信息学竞赛（OI）算法笔记，另有竞赛游记、随笔、游戏开发记录、学习笔记。首次迁移发布 **36 篇**。

**要解决的问题**：

1. 在 Obsidian 里照常写作，发布不该改变写作习惯
2. 数学公式和 C++ 代码块必须正确渲染——这是内容的主体，不是配角
3. `git push` 之后不需要任何手工操作
4. 零成本、零运维

**成功标准**：

1. 新增一篇文章 = Obsidian 里加一行标记 + 跑一条命令 + `git push`
2. 公式（4 种写法）与代码块（含 300+ 行长代码）渲染正确
3. 深色/浅色两套主题都完整可用
4. 全站自有 JavaScript 不超过 ~60 行

---

## 2. 技术选型

**Astro 7**（当前 7.3.3，静态站点生成器）+ Node.js。

版本约束：Astro 7 要求 Node ≥ 22.12.0、npm ≥ 9.6.5。本机为 Node 22.13.0 / npm 10.9.2，满足。

**网络环境（2026-09-21 实测）**：

| 项 | 结果 |
|---|---|
| npm registry | 已配置国内镜像 `registry.npmmirror.com` |
| 元数据请求 | 四个核心包均 ~1.7s 返回 |
| 实际下载吞吐 | ≈ 240 KB/s（实测 1.5MB / 8s） |
| 影响 | `npm install` 首次安装预计 **10–20 分钟**，属一次性成本；后续增量安装很快 |
| 不走的通道 | Playwright 的浏览器内核从 `cdn.playwright.dev` 下载，**不受 npm 镜像覆盖**，故本方案不使用（见 12.1） |

Astro 的核心模型是「构建时生成 HTML」。代码高亮、数学公式渲染、文章目录、标签页、阅读时长全部在构建时算好，浏览器不需要为这些执行任何 JavaScript。

**不使用任何 UI 框架**（React/Vue/Svelte）。整站只有少量原生 JS 岛屿。

**不使用中文 Web 字体**（体积 2–4MB，个人博客不划算）。

---

## 3. 内容来源与同步机制

### 3.1 现状

| 项 | 值 |
|---|---|
| Obsidian 库位置 | `C:\Users\21004\Documents\Obsidian Vault` |
| 多设备同步 | 已配置 `obsidian-git` 插件 → 私有仓库 `github.com/lsc188zq/obsidian-vault` |
| 自动提交间隔 | 10 分钟（`autoSaveInterval`） |
| 自动拉取 | 启动时拉取 + 每 10 分钟（`autoPullOnBoot: true`, `autoPullInterval: 10`） |
| 冲突策略 | `syncMethod: merge`、`mergeStrategy: none`（不自动合并，冲突时停下等人工处理） |

**已知问题与对策**：`obsidian-git` 只在 Obsidian 进程运行时工作。本机自 2026-09-07 起未打开过 Obsidian，导致仓库长期未拉取。对策见 3.5。

### 3.2 发布模型：显式标记

**只有同时满足两个条件的文件会被同步到博客**：

1. 位于配置里的「发布目录白名单」内
2. frontmatter 中存在 `publish: true`

选择显式 opt-in（而非「白名单目录自动全发」）的理由：两种失败模式的代价不对称。

- 忘记加 `publish: true` → 文章没发布，**不痛**，发现了补上即可
- 如果反过来（默认发布、用 `publish: false` 排除）→ 忘记标记的草稿被**公开**，**很痛且不可逆**

同步脚本会打印「在白名单目录内但未标记，已跳过」的清单，避免第一种失败模式被长期忽略。

### 3.3 配置文件

路径写死在脚本里会导致换设备失效，因此抽到 `blog.config.json`：

```json
{
  "vaultPath": "C:/Users/21004/Documents/Obsidian Vault",
  "publishDirs": [
    "OI/算法",
    "OI/游记",
    "文集",
    "项目/游戏/三眼枪",
    "学习/深度学习"
  ],
  "categoryMap": {
    "OI/算法": "知识",
    "学习/深度学习": "知识",
    "项目/游戏/三眼枪": "项目",
    "OI/游记": "游记",
    "文集": "杂谈"
  },
  "defaultCategory": "杂谈"
}
```

换设备时只改 `vaultPath` 一行。

### 3.4 同步脚本 `scripts/sync-vault.mjs`

`npm run sync` 执行，流程：

```
读 blog.config.json
  ↓ 扫描发布目录下所有 .md
  ↓ 筛选：有 publish: true 的文件
  ↓ 逐篇转换（六项，见下）
  ↓ 写入 src/content/blog/<slug>.md
  ↓ 删除「源文件已取消标记 / 已删除」对应的旧副本
  ↓ 打印报告：新增 N 篇、更新 N 篇、删除 N 篇、跳过 N 篇
```

**七项转换：**

| # | 转换 | 说明 |
|---|---|---|
| 1 | 补齐 frontmatter | `title` 取自文件名（去扩展名）；`date` 取该文件的 **git 首次提交时间**（即创建时间，后续修改不会让日期跳动）；`category` 由 `categoryMap` 按目录映射；`tags` ~~保留原值或置空~~ **保留原值，原值为空时取正文开头的 Obsidian 标签行**（见第 7 项）；`description` 见下 |
| 2 | 公式语法归一 | `\(...\)` → `$...$`；`\[...\]` → `$$...$$` |
| 3 | 标题层级归一 | 找出文档中最浅标题层级 L，整体平移使 L 对齐到 H2 |
| 4 | **跳过代码块** | 转换 2 和 3 必须**先切出代码围栏区域，只处理正文，再拼回**。否则代码里的 `$` 和 `#` 会被误改 |
| 5 | 生成 slug | 文件名去扩展名 → 空格转 `-` → 去除 URL 特殊字符。保留中文 |
| 6 | 记录来源路径 | 写入 `sourcePath` 字段，用于反向查找与删除检测 |
| 7 | **剥离并采集标签行** | 正文开头连续的 Obsidian 标签行（`#DP #单调队列`）剥离出来作为 `tags`，该行不进正文。判据：整行按空白切分后**每个 token 都形如 `#` + 非空白非 `#`**，因此 `## 题目描述`（`#` 后有空格）与 `#include <iostream>` 都不会被误吃。无标签行时正文**逐字节不变**（同步的幂等依赖这条） |

> **第 7 项是 2026-09-27 追加的，附裁决记录。** 原表假设 vault 笔记带 YAML frontmatter，`tags` 直接读它。
> 实际勘察：36 篇候选笔记**一篇都没有 frontmatter**（原始字节查证：0/36 以 `---` 开头），其标签写在**正文首行**（26/36 篇），形如 `#单调队列 #DP`。
> 后果实测两点：该行经 Astro 渲染为 `<p>`（是**可见正文**，因 CommonMark 要求 `#` 后有空格才是标题），且**8/36 篇的卡片摘要就是标签串**（`extractDescription` 的跳过规则同样要求 `#` 后有空格）。
> 原先「标签全空」并不违反第 130 行，但会让 §4 定义的标签总览页与标签详情页**永远是空的**——T8 的产出成为死代码。
> **用户 2026-09-27 裁定：导入成 tags，并从正文去掉。** 据此增加第 7 项转换。

**`description` 的产生规则**（首页卡片需要摘要，但原文件里没有这个字段）：

1. 若原文 frontmatter 已有 `description` → **原样保留**（想手写就手写）
2. 否则 → 取正文中**第一个非标题、非代码块、非公式、非引用的段落**，剥离 Markdown 标记后截断到 80 字，超出加 `…`
3. 若整篇找不到合格段落（如纯代码文件）→ 留空，卡片上不显示摘要行，布局自动收拢

摘要只在首页列表和 SEO 里用，**不影响文章正文**。

**幂等性**：脚本可重复运行，结果一致。`src/content/blog/` 是完全派生的目录，永远不手工编辑。

### 3.5 Obsidian 同步的修复建议

| 目标 | 做法 |
|---|---|
| 打开 Obsidian 自动同步 | 已配置，保持即可 |
| 不开 Obsidian 也保持仓库最新 | 增加 Windows 计划任务，定时执行 `git -C "<vault>" pull --rebase`（可选，本次不实现） |
| 减少 commit 数量 | 将 `autoSaveInterval` 从 10 分钟调整为 30 分钟（可选） |

**多设备冲突处理**（用户需掌握的少数手工操作之一）：

```bash
cd "C:\Users\21004\Documents\Obsidian Vault"
git pull
# 找到 <<<<<<< ======= >>>>>>> 标记，保留需要的内容，删除标记
git add . && git commit -m "resolve conflict" && git push
```

根本的预防办法：避免在两台设备上同时编辑同一篇文章。

### 3.6 URL slug 决策

**保留中文 slug**，不做拼音转写。

理由：文件名中大量包含题号等拉丁字符（`P5665 CSP-S2019 划分`），自动转写对技术术语无意义且易出错；手工为 36 篇指定英文 slug 成本高而收益低。现代浏览器地址栏会解码显示中文，可读性可接受。

转换示例：

```
P5665 CSP-S2019 划分.md   →  /posts/P5665-CSP-S2019-划分
普通平衡树.md             →  /posts/普通平衡树
CSP-S 2024 游记.md        →  /posts/CSP-S-2024-游记
```

**已知代价**：分享到部分平台时链接会显示为百分号编码，较长。

**逃生舱**：frontmatter 支持可选 `slug` 字段，需要时可为单篇指定自定义 URL。

---

## 4. 信息架构：分类 + 标签

### 4.1 两层结构的理由

| | 分类 category | 标签 tag |
|---|---|---|
| 每篇数量 | 恰好 1 个 | 任意多个 |
| 取值范围 | 固定枚举，定义在 `src/content.config.ts` | **完全自由** |
| 用途 | 首页筛选栏、主导航 | 检索、标签总览页 |
| 基数 | 6 个，稳定 | 会持续增长 |

标签是发散的，不适合当导航（某周集中写某主题就会让筛选栏漂移）。分类是穷举的，天生适合做导航。

### 4.2 分类与内容映射

| 分类 | 内容来源 | 首次迁移篇数 |
|---|---|---|
| **知识** | `OI/算法/**`、`学习/深度学习` | 25 |
| **技术** | 预留（工程实践、踩坑） | 0 |
| **项目** | `项目/游戏/三眼枪` | 4 |
| **游记** | `OI/游记` | 4 |
| **杂谈** | `文集` | 3 |
| **书单** | 预留 | 0 |
| | | **36** |

分类名写错（如 `category: 编程`）会导致**构建失败并报错**。这是刻意的。

空分类不显示在筛选栏上。

### 4.3 标签规则

- 自由填写，无白名单，无需登记
- **防分裂**：`/tags` 总览页列出所有标签及文章数，`astro (1)` 与 `Astro (5)` 并排可见
- **构建时警告**：检测到仅大小写不同的标签对时输出警告，**不中断构建**
- 明确不做：标签白名单强制校验

---

## 5. 数学公式

**这是本次设计新增的核心需求。** 库中含 153 处 LaTeX 命令、14 处块级公式，分布于 24 个文件。

### 5.1 方案

| 组件 | 作用 |
|---|---|
| `remark-math` | 在 Markdown 解析阶段识别 `$...$` 与 `$$...$$` |
| `rehype-katex` | 在 HTML 生成阶段渲染为公式标记 |
| `katex` 的 CSS 与字体 | 提供排版样式 |

**渲染在构建时完成，浏览器 0 JavaScript。**

### 5.2 四种写法

库中混用了 4 种语法：

```
$x^2$                    行内，remark-math 原生支持
$$\sum_{i=1}^{n} a_i$$   块级，remark-math 原生支持
\(O(n \log n)\)          行内，原生不支持 → 由同步脚本转为 $...$
\[\binom{k}{n}\]         块级，原生不支持 → 由同步脚本转为 $$...$$
```

### 5.3 关键风险

**替换必须跳过代码块。** C++ 代码中可能出现 `$` 或 `\(`，全局正则替换会破坏代码。同步脚本必须先切分代码围栏区域。

**源数据存在错误。** 例如 `$$\]$$` 这类未正确闭合的公式（观察到至少一处）。脚本能修复常见模式，其余需人工。

### 5.4 公式检查脚本 `scripts/check-math.mjs`

`npm run check:math` 扫描全部文章，报告：

- 未配对的 `$` / `$$`
- 未配对的 `\(` / `\)`、`\[` / `\]`
- 疑似残留的 Obsidian 专有语法

输出形如 `src/content/blog/xxx.md:42  $$ 未闭合`，便于定点修复。**这是替代「人工翻 24 个文件」的关键工具。**

### 5.5 按需加载

KaTeX 的 CSS 与字体（约 300KB）**只注入到含公式的页面**。不含公式的文章页不受影响。`PostLayout.astro` 构建时检测正文是否含公式节点决定是否注入。

---

## 6. 代码块

库中含 57 组代码围栏，几乎全为 C++，单块最长 388 行。这是内容主体。
（**两个数字都是量整个 vault 得到的，不是站上的数字。** 站点经过两次下架后是 28 篇，
实测约 20 个代码块、单块最长 201 行——见 12.2 的验收项。）

| 需求 | 方案 | 代价 |
|---|---|---|
| 语法高亮 | Shiki（Astro 内置），深/浅双主题 | 0 JS |
| 行号 | CSS 计数器 | 0 JS |
| 超长代码折叠 | HTML `<details>` 原生元素 | **0 JS** |
| 长行不换行、横向滚动 | CSS `overflow-x: auto` | 0 JS |
| 复制按钮 | 少量原生 JS | ~15 行 |

**折叠阈值**：超过 40 行的代码块默认折叠，显示「展开全部（N 行）」。

选用 `<details>` 而非 JS 实现，是因为它是浏览器原生行为，零 JavaScript 开销，且键盘操作与屏幕阅读器天然支持。

---

## 7. 视觉设计系统

风格方向：**深色终端风**，避开"纯黑 + 荧光绿"的廉价终端感。

### 7.1 关键约束：中文没有等宽字体

等宽字体为拉丁字母设计，中文字符无对应字形会 fallback，导致中英混排时字宽、字重、基线不统一。

**正文绝不使用等宽字体。** 等宽只用于代码块、日期、标签、导航 logo。正文使用系统字体栈：

```css
font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
```

### 7.2 颜色令牌

深色为默认主题。

| 令牌 | 深色 | 浅色 | 用途 |
|---|---|---|---|
| `--bg` | `#0d1117` | `#ffffff` | 页面底色 |
| `--card` | `#161b22` | `#f6f8fa` | 卡片、代码块底色 |
| `--bd` | `#30363d` | `#d0d7de` | 描边、分隔线 |
| `--tx` | `#e6edf3` | `#1f2328` | 正文 |
| `--mu` | `#8b949e` | `#656d76` | 次要文字 |
| `--fa` | `#6e7681` | `#6e7781` | 最弱文字（日期、元信息） |
| `--ac` | `#58a6ff` | `#0969da` | 强调色 |
| `--chip` | `#21262d` | `#f6f8fa` | 悬停态、胶囊底色 |

深色底刻意**不用纯黑 `#000`**：纯黑配白字对比度接近 21:1，远超舒适区间，长时间阅读刺眼。

### 7.3 排版尺度

| 元素 | 字号 | 行高 | 字重 |
|---|---|---|---|
| 文章标题 H1 | 26px | 1.45 | 700 |
| 正文 | 15–16px | 1.85 | 400 |
| H2 | 21px | 1.45 | 600 |
| H3 | 17px | 1.5 | 600 |
| 代码 | 12.5–13px | 1.75 | 400 |
| 元信息 | 11.5px | — | 400 |

正文行高 1.85 高于英文博客常用的 1.6——中文字形方正、字面率高，需要更大行距。

---

## 8. 页面清单

| 网址 | 文件 | 内容 |
|---|---|---|
| `/` | `src/pages/index.astro` | 文章时间线 + 分类筛选 |
| `/posts/<slug>` | `src/pages/posts/[...slug].astro` | 文章详情 |
| `/tags` | `src/pages/tags/index.astro` | 全部标签 + 文章数 |
| `/tags/<tag>` | `src/pages/tags/[tag].astro` | 某标签下的文章列表 |
| `/about` | `src/pages/about.astro` | 关于页（**用户自行撰写，本设计只建路由与占位**） |
| `404` | `src/pages/404.astro` | 找不到页面 |

### 8.1 首页

```
导航（~/blog · 文章 标签 关于 · 主题切换）
分类筛选栏（全部 / 知识 / 技术 / 项目 / 游记 / 杂谈 / 书单）
状态行（共 N 篇 / 按标签 #x 筛选 · N 篇 · 清除）
文章卡片 × N
  日期(mono) │ 标题 + 摘要 + 标签(可点) + 分类标记
```

**不做分页**：全部卡片一次性渲染，筛选在浏览器完成。约 150 篇以上时改为按分类分页（Astro 内置 `paginate`，只需改 `index.astro`）。

分类筛选栏共 7 项，移动端横向可滑动。

### 8.2 文章页

```
阅读进度条（顶部 2px）
导航
← 返回文章列表
标题 H1
日期 · 分类 · 阅读时长（构建时计算）
标签 ×N（可点）
────────────────────────
正文（段落 / H2 / H3 / 代码块 / 公式 / 引用 / 列表）
────────────────────────
← 上一篇        下一篇 →
giscus 评论区
```

右侧固定**本页目录**（TOC），窄屏隐藏。

**目录锚点需特殊处理**：库中存在公式写在标题里的情况（如 `## $\text{Part -1}$ 目录`）。锚点 id 需基于标题的纯文本（剥离公式源码）生成，避免产生含 `$` 和反斜杠的无效 id。

### 8.3 关于页

**不迁移 `简历/林尚灿.md` 的内容。** 该文件含手机号等个人信息，且用户明确表示将自行撰写关于页。本设计只创建路由和占位内容。

---

## 9. 内容模型

### 9.1 Frontmatter Schema

定义在 `src/content.config.ts`：

```yaml
---
title: P5665 CSP-S2019 划分        # 必填，同步脚本自动填充
date: 2025-01-15                  # 必填，同步脚本取自 git 提交时间
category: 知识                     # 必填，枚举（6 选 1）
tags: [DP, 单调队列优化, 斜率优化]   # 选填，默认 []
description: ...                  # 选填，用于列表摘要与 SEO
draft: false                      # 选填，默认 false
sourcePath: "OI/算法/DP/单调队列优化/P5665 CSP-S2019 划分.md"  # 同步脚本写入
slug: custom-url                  # 选填，覆盖默认 slug
---
```

### 9.2 集合定义

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const CATEGORIES = ['知识', '技术', '项目', '游记', '杂谈', '书单'] as const;

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    draft: z.boolean().default(false),
    sourcePath: z.string().optional(),
    slug: z.string().optional(),
  }),
});

export const collections = { blog };
```

Zod 从 `astro/zod` 导入，不是从 `zod` 直接导入。

读取文章用 `getCollection('blog')`；渲染正文用 `render(post)`，返回 `{ Content }`。文章 URL slug 取条目的 `id`（由 glob loader 从文件路径推导）。

**校验失败会导致构建失败**——frontmatter 写错时立刻知道。

### 9.3 目录结构

```
MyBlog/
├── .github/workflows/deploy.yml    # 推送后自动构建 + 部署
├── .gitignore
├── blog.config.json                # vault 路径、发布目录、分类映射
├── public/images/                  # 文章配图
├── scripts/
│   ├── sync-vault.mjs              # Obsidian → 博客内容同步
│   └── check-math.mjs              # 公式语法检查
├── src/
│   ├── content/blog/               # 【派生目录】同步产物，永不手工编辑
│   ├── content.config.ts           # 集合定义 + 分类枚举
│   ├── pages/                      # 文件路径 = URL 路径
│   ├── layouts/
│   │   ├── BaseLayout.astro        # 全站骨架、主题变量
│   │   └── PostLayout.astro        # 文章页骨架（含 KaTeX 按需注入）
│   ├── components/
│   │   ├── Header.astro            # ThemeToggle.astro
│   │   ├── CategoryFilter.astro    # PostCard.astro
│   │   ├── TableOfContents.astro   # Search.astro
│   │   ├── CodeBlock.astro         # 行号、折叠、复制按钮
│   │   └── Comments.astro          # giscus
│   └── styles/
│       ├── global.css              # 颜色令牌
│       └── prose.css               # 正文排版 + 公式 + 代码块样式
├── astro.config.mjs
└── package.json
```

---

## 10. 功能实现与 JavaScript 预算

| 功能 | 实现方式 | 浏览器 JS |
|---|---|---|
| 代码高亮 | Shiki，构建时染色 | **0** |
| 数学公式 | KaTeX，构建时渲染 | **0** |
| 文章目录 / 阅读时长 / 标签页 | 构建时生成 | **0** |
| 代码块折叠 | `<details>` 原生元素 | **0** |
| 代码行号 | CSS 计数器 | **0** |
| 深色模式 | CSS 变量 + `<head>` 内联脚本 | ~10 行 |
| 分类筛选 | 原生 JS 切换 `display` | ~20 行 |
| 目录滚动高亮 | IntersectionObserver | ~15 行 |
| 代码复制按钮 | 原生 JS | ~15 行 |
| 搜索 | Pagefind，构建后索引 | ~30KB，**仅打开搜索时加载** |
| 评论 | giscus iframe | 第三方，不计入包体 |

**自有 JavaScript 合计约 60 行。**

### 10.1 深色模式的关键实现细节

必须在 `<head>` 中放置**内联同步脚本**，在页面渲染前设置 `data-theme`。若放在外部文件或页面底部，浏览器会先按默认主题绘制一帧再切换，用户每次刷新都看到闪白（FOUC）。

**初始主题：固定深色，不跟随系统偏好。**

这是刻意选择：深色终端风是设计意图的一部分，不是偏好项。若跟随 `prefers-color-scheme`，浅色系统访客看到的是完全不同的气质。

用户手动切换后写入 `localStorage`，刷新保持。若日后改为跟随系统，改动只限于 `<head>` 那 10 行脚本。

### 10.2 搜索

Pagefind 在 `astro build` 之后运行，扫描生成的 HTML 建立索引。索引是静态文件，无需后端。索引在用户发起搜索时才加载，不影响首屏。

### 10.3 评论

giscus，基于仓库的 GitHub Discussions。需要：

1. 仓库公开（已满足）
2. 开启 **Settings → General → Features → Discussions**
3. 在 https://giscus.app 安装 GitHub App，获取 `repo-id` 与 `category-id`
4. 填入 `src/components/Comments.astro`

读者需 GitHub 账号才能评论——giscus 的固有代价，接受。

---

## 11. 部署

### 11.1 仓库配置

用户主页仓库（`lsc188zq.github.io`），因此：

```js
site: 'https://lsc188zq.github.io'
```

**不需要 `base`**——用户主页仓库的站点根路径即域名根路径。

### 11.2 流程

1. 代码在本地 `D:\Projects\MyBlog` 编写完成
2. **配置 Pages Source**：仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**
   - 建议在 push 前做。若下拉中没有该选项，先 push 一次让 workflow 文件出现，再回来配置，然后重跑失败的 workflow
3. 用户执行 `git push` 到 `main`
4. `.github/workflows/deploy.yml` 触发：`npm ci` → `npm run build` → 上传产物 → 部署
5. 访问 https://lsc188zq.github.io

### 11.3 日常发布流程

```
① 在 Obsidian 里写
② frontmatter 加一行 publish: true
③ 终端：npm run sync
④ 终端：git add . && git commit -m "post: <标题>"
⑤ 终端：git push
```

### 11.4 职责边界

- **本地代码编写、同步脚本运行**：Claude 可完成
- **`git push`**：用户执行
- **GitHub 网页端配置**（Pages Source、Discussions、giscus App）：用户执行，Claude 提供分步指引

`gh` CLI 本机未安装，Claude 无法代为操作 GitHub 账户。

---

## 12. 测试与验证策略

**本项目不引入自动化测试框架。** 这是刻意取舍：静态博客无业务逻辑、无状态、无并发，`npm run build` 成功本身即最强验证。

**但本项目引入了两种自动化验证工具**，它们检查的是本项目特有的高风险环节：

| 命令 | 检查什么 | 为什么需要 |
|---|---|---|
| `npm run build` | 构建是否通过；frontmatter schema 校验 | 拦截分类填错、日期格式错、必填缺失 |
| `npm run check` | Astro 官方类型检查 | 拦截模板与组件类型错误 |
| `npm run check:math` | 公式配对、残留 Obsidian 语法 | **本项目的最大风险点**，见 5.3 |
| Playwright 截图 | 实际渲染结果 | 见下 |

### 12.1 视觉验证（Playwright）

**已验证可用（2026-09-21 实测）**：Playwright 驱动**系统自带的 Edge**（`chromium.launch({ channel: 'msedge' })`）截图成功，Claude 能读取并判读截图内容。

**不用 `playwright install` 下载内核。** 实测该下载在 `cdn.playwright.dev` 超时失败（30s timeout），且 Windows 11 自带 Edge，下载 Chrome 内核既不可靠也无必要。当前方案零下载、零额外磁盘占用。

Claude 因此能自主发现：颜色错误、布局错位、深色模式未生效、代码块溢出、公式渲染失败。

截图覆盖页面：首页、文章页（含公式的、含超长代码的）、标签总览页、标签详情页、404。深浅两套主题各截一次。同时可点击元素、读取 DOM，验证交互是否真的生效。

用户仍需做最终确认——**自动化截图能发现"坏掉"，但发现不了"不好看"**。

**运维教训**（已犯过一次）：跑安装类命令时不要接 `| tail` 之类的管道，管道会让退出码变成最后一个命令的退出码，导致下载失败却报 exit 0。

### 12.2 迁移验收清单

首次迁移后需逐项确认：

- [ ] 36 篇文章全部生成
- [ ] 每篇的标题、日期、分类正确
- [ ] 公式全部渲染（无 `$` 裸露在页面上）
- [ ] 最长的代码块正常折叠与展开（实测已发布 28 篇里最长的是 201 行，`树套树`；
      阈值 40 行，摘要显示「展开全部（201 行）」。）
- [ ] 目录锚点可点击、滚动高亮跟随
- [ ] 深浅主题切换正常，刷新后保持
- [ ] 分类筛选与标签筛选正常
- [ ] 移动端窄屏布局无错位
- [ ] 搜索可返回结果
- [ ] giscus 评论区可加载

### 12.3 已知代价

没有回归测试，未来修改样式可能静默破坏其他页面。对本项目规模，此代价可接受。

---

## 13. 明确不做的事

| 项目 | 决定 | 理由 |
|---|---|---|
| RSS 订阅 | **不做** | 用户明确拒绝 |
| 首页分页 | 不做 | 文章量小时无必要；超 150 篇再改 |
| 标签白名单校验 | 不做 | 摩擦大于收益 |
| 中文 Web 字体 | 不做 | 2–4MB 体积不划算 |
| UI 框架 | 不做 | 静态博客无需框架运行时 |
| 自动化测试框架 | 不做 | 见第 12 节 |
| 拼音转写 slug | 不做 | 技术术语转写无意义，见 3.6 |
| 关于页内容 | 不做 | **用户自行撰写** |
| `简历/林尚灿.md` 迁移 | **不做** | 含个人信息，且用户明确排除 |
| 自定义域名 | 暂不做 | 后续可加 |
| 站内数据统计 | 不做 | 无此需求 |
| `OI/资料`、`OI/出题`、`OI/每日总结`、`日志`、`回答.md`、`学习/光纤传感` 发布 | **不做** | 用户明确排除 |
| 自动清理 git 历史 | 不做 | 凭证文件从未进入 git 历史，无需清理 |

---

## 14. 安全：已处理的凭证问题

迁移调查中发现 Obsidian 库内有两个凭证文件：

- `OI/资料/api key.md`
- `OI/资料/github 恢复码.md`

**核查结果**：两者均**未被 git 跟踪**，被 vault 的 `.gitignore`（规则 `*API Key*`、`*恢复码*`）正确排除，git 历史中出现 **0 次**。**从未泄露，无需轮换密钥。**

用户确认已在别处备份后，两文件已于 2026-09-21 从库中删除。

**遗留提示**：GitHub 恢复码存放在 GitHub 仓库中（即使被 gitignore）存在逻辑上的循环依赖——若失去账号访问权，恢复码本身也在该账号内。建议将此类凭证迁移至本地密码管理器（Bitwarden / KeePassXC）。

---

## 15. 待办：需要用户执行的 GitHub 网页操作

按执行顺序：

1. ~~创建仓库 `lsc188zq.github.io`~~ ✅ 已完成
2. **配置 Pages Source**：Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**
3. 撰写关于页内容（`src/pages/about.astro`）
4. 开启 **Settings → General → Features → Discussions**（仅评论功能需要）
5. 打开 https://giscus.app 安装 GitHub App，获取 `data-repo-id` 与 `data-category-id`
6. 将上述两个 ID 填入 `src/components/Comments.astro`

第 4–6 步仅影响评论区，可在站点上线后再做。
