# 个人博客设计文档

- **日期**：2026-09-21
- **站点地址**：https://lsc188zq.github.io
- **仓库**：https://github.com/lsc188zq/lsc188zq.github.io （公开，用户主页仓库）
- **本地目录**：`D:\Projects\MyBlog`

---

## 1. 目标与范围

搭建一个托管在 GitHub Pages 上的个人博客，同时容纳**技术笔记**和**个人杂谈**两类内容。

**要解决的问题**：

- 写文章要简单——打开一个 Markdown 文件就能写，不需要碰 HTML
- 两类内容气质不同（技术文严谨、随笔松弛），但读者只有一个人，不该被拆成两个站点
- 部署要自动化——`git push` 之后不用再做任何手工操作
- 零成本、零运维——没有服务器要管，不会因为进程挂了而宕机

**成功标准**：

1. 新增一篇文章 = 新建一个 `.md` 文件 + `git push`，全程不超过 2 分钟
2. 首页能按分类筛选，能按标签检索
3. 深色/浅色两套主题都完整可用
4. 全站自己的 JavaScript 累计不超过 ~50 行

---

## 2. 技术选型

**Astro 7**（当前版本 7.3.3，静态站点生成器）+ Node.js。

版本约束：Astro 7 要求 Node ≥ 22.12.0、npm ≥ 9.6.5。本机为 Node 22.13.0 / npm 10.9.2，满足。

选择理由：Astro 的核心模型是「构建时生成 HTML，浏览器拿到的是成品」。代码高亮、文章目录、标签页、阅读时长全部在构建时算好，浏览器不需要为这些跑任何 JavaScript。这直接决定了站点的加载速度上限——它不是一个「很快」的网站，它是一个**没有东西可以慢**的网站。

相比其他选项：

- **Hugo**：构建更快，但 Go template 语法对初学者调试成本过高
- **Next.js**：功能过剩，纯静态博客用它需要额外配置静态导出，概念负担大
- **手写 HTML**：每发一篇文章都要手工维护首页列表，文章一多就崩溃

**不使用任何 UI 框架**（React/Vue/Svelte）。整站只有少量原生 JS 岛屿，引入框架运行时是纯负担。

---

## 3. 信息架构：分类 + 标签

这是本设计里最需要理解的一个决定。

### 3.1 两层结构的理由

**分类（category）**和**标签（tag）**承担不同的职责，不能互相替代：

| | 分类 category | 标签 tag |
|---|---|---|
| 每篇数量 | 恰好 1 个 | 任意多个 |
| 取值范围 | 固定枚举，定义在 `content/config.ts` | **完全自由**，直接在 frontmatter 里写 |
| 用途 | 首页筛选栏、主导航 | 检索、归类、标签总览页 |
| 基数 | 6 个，稳定 | 会持续增长 |

**为什么不让标签直接驱动首页筛选栏**：标签是发散的。若某周集中写了三篇 `#装修`，筛选栏会突然多出一项，下个月又消失。筛选栏是导航，导航必须稳定可预期。分类是穷举的，天生适合当导航；标签是描述性的，适合当检索。

### 3.2 分类列表

固定 6 个，定义在 `src/content.config.ts` 的 Zod schema 里：

```
知识 / 技术 / 项目 / 书单 / 游记 / 杂谈
```

写错分类名（比如 `category: 编程`）会导致**构建失败并报错**，不会静默生成错误页面。这是刻意的——早报错比晚发现好。

分类为空时不显示在筛选栏上。筛选栏共 7 项（全部 + 6 分类），移动端横向可滑动。

### 3.3 标签规则

- 自由填写，不设白名单，不需要登记
- **防分裂机制**：`/tags` 标签总览页自动列出所有标签及其文章数。`astro (1)` 和 `Astro (5)` 并排出现时一眼可见，手动修正 Markdown 即可
- **构建时警告**：检测到仅大小写不同的标签对时，构建输出一行警告。**警告但不中断构建**，不阻塞部署
- 明确不做：标签白名单强制校验（对新手过于繁琐，收益低于摩擦）

---

## 4. 视觉设计系统

风格方向：**深色终端风**，但避开"纯黑 + 荧光绿"的廉价终端感。

### 4.1 关键约束：中文没有等宽字体

等宽字体（monospace）是为拉丁字母设计的。中文字符在等宽字体中无对应字形，浏览器会 fallback 到另一套字体，导致中英混排时字宽、字重、基线全部不统一。

**因此：正文绝不使用等宽字体。** 等宽只用于代码块、日期、标签、导航 logo 等短文本。正文使用系统字体栈：

```css
font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
```

不加载中文 Web 字体（体积 2–4MB，对个人博客不划算）。

### 4.2 颜色令牌

深色为默认主题。

| 令牌 | 深色 | 浅色 | 用途 |
|---|---|---|---|
| `--bg` | `#0d1117` | `#ffffff` | 页面底色 |
| `--card` | `#161b22` | `#f6f8fa` | 卡片、代码块底色 |
| `--bd` | `#30363d` | `#d0d7de` | 描边、分隔线 |
| `--tx` | `#e6edf3` | `#1f2328` | 正文 |
| `--mu` | `#8b949e` | `#656d76` | 次要文字 |
| `--fa` | `#6e7681` | `#6e7781` | 最弱文字（日期、元信息） |
| `--ac` | `#58a6ff` | `#0969da` | 强调色（链接、标签、焦点） |
| `--chip` | `#21262d` | `#f6f8fa` | 悬停态、胶囊底色 |

深色底刻意**不用纯黑 `#000`**：纯黑配白字对比度接近 21:1，远超舒适区间，长时间阅读会刺眼。`#0d1117` 是经过大量实战检验的低饱和偏蓝深色。

### 4.3 排版尺度

| 元素 | 字号 | 行高 | 字重 |
|---|---|---|---|
| 文章标题 H1 | 26px | 1.45 | 700 |
| 正文 | 15–16px | 1.85 | 400 |
| H2 | 21px | 1.45 | 600 |
| H3 | 17px | 1.5 | 600 |
| 代码 | 12.5–13px | 1.75 | 400 |
| 元信息 | 11.5px | — | 400 |

正文行高 1.85 高于英文博客常用的 1.6——中文字形方正、字面率高，需要更大的行距才不显拥挤。

---

## 5. 页面清单

| 网址 | 文件 | 内容 |
|---|---|---|
| `/` | `src/pages/index.astro` | 文章时间线 + 分类筛选 + 标签云入口 |
| `/posts/<slug>` | `src/pages/posts/[...slug].astro` | 文章详情 |
| `/tags` | `src/pages/tags/index.astro` | 全部标签 + 各标签文章数 |
| `/tags/<tag>` | `src/pages/tags/[tag].astro` | 某标签下的文章列表 |
| `/about` | `src/pages/about.astro` | 关于页 |
| `/404` | `src/pages/404.astro` | 找不到页面 |

### 5.1 首页

```
导航（~/blog · 文章 标签 关于 · 主题切换）
分类筛选栏（全部 / 知识 / 技术 / 项目 / 书单 / 游记 / 杂谈）
状态行（共 N 篇 / 按标签 #x 筛选 · N 篇 · 清除）
文章卡片 × N
  日期(mono) │ 标题 + 摘要 + 标签(可点) + 分类标记
```

**不做分页**：全部文章卡片一次性渲染，筛选在浏览器完成。约 150 篇以上时首页体积会变得不可接受，届时改为按分类分页（Astro 内置 `paginate`，只需改 `index.astro` 一个文件）。

### 5.2 文章页

```
阅读进度条（顶部 2px，随滚动增长）
导航
← 返回文章列表
标题 H1
日期 · 分类 · 阅读时长（构建时按字数计算）
标签 ×N（可点，跳转到 /tags/<tag>）
────────────────────────
正文（段落 / H2 / H3 / 代码块 / 引用 / 列表 / 行内代码）
────────────────────────
← 上一篇        下一篇 →
giscus 评论区
```

右侧固定**本页目录**（TOC），窄屏时隐藏。

**没有**文章列表、推荐位、侧边栏广告——进入文章页后视线上只有这一篇文章。

### 5.3 URL 规则

**Markdown 文件名即 URL slug**，使用英文小写短横线：

```
src/content/blog/astro-build-performance.md
  → https://lsc188zq.github.io/posts/astro-build-performance
```

文章标题仍用中文（`title: 把博客构建时间从 40 秒压到 6 秒`）。中文文件名会导致 URL 出现 `%E6%8A%8A...` 形式的百分号编码，难以阅读和分享。

---

## 6. 内容模型

### 6.1 Frontmatter Schema

定义在 `src/content.config.ts`，使用 Content Layer API 的 `glob` loader + Zod schema：

```yaml
---
title: 把博客构建时间从 40 秒压到 6 秒      # 必填，字符串
date: 2026-09-18                          # 必填，日期
category: 技术                             # 必填，枚举（6 选 1）
tags: [Astro, 性能优化, 构建]               # 选填，字符串数组，默认 []
description: 一次构建优化的完整记录          # 选填，用于列表摘要与 SEO
draft: false                              # 选填，默认 false；true 则不发布
---
```

对应的集合定义：

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const CATEGORIES = ['知识', '技术', '项目', '书单', '游记', '杂谈'] as const;

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

注意 Zod 从 `astro/zod` 导入，不是从 `zod` 直接导入。

读取文章用 `getCollection('blog')`；渲染正文用 `render(post)`，它返回 `{ Content }` 组件。文章的 URL slug 是条目的 `id`，由 glob loader 从文件路径推导——`astro-build-performance.md` 对应 `id: astro-build-performance`，与第 5.3 节的 URL 规则一致。

**校验失败会导致构建失败**，这是刻意设计——frontmatter 写错时立刻知道，而不是上线后才发现某篇文章没出现。

### 6.2 目录结构

```
MyBlog/
├── .github/workflows/deploy.yml    # 推送后自动构建 + 部署
├── .gitignore                      # node_modules / dist / .astro / .superpowers
├── public/
│   └── images/                     # 文章配图
├── src/
│   ├── content/
│   │   └── blog/                   # 文章 Markdown，一篇一个文件
│   ├── content.config.ts           # 集合定义：glob loader + schema（分类枚举在此）
│   ├── pages/                      # 文件路径 = URL 路径
│   ├── layouts/
│   │   ├── BaseLayout.astro        # 全站骨架：<head>、主题变量、字体
│   │   └── PostLayout.astro        # 文章页骨架
│   ├── components/
│   │   ├── Header.astro
│   │   ├── ThemeToggle.astro
│   │   ├── CategoryFilter.astro
│   │   ├── PostCard.astro
│   │   ├── TableOfContents.astro
│   │   ├── Search.astro
│   │   └── Comments.astro
│   └── styles/
│       ├── global.css              # 颜色令牌 + 基础样式
│       └── prose.css               # 文章正文排版
├── astro.config.mjs
└── package.json
```

**内容与展示严格分离**：文章是纯数据（`src/content/blog/*.md`），展示是纯模板（`layouts/` + `components/`）。更换设计只需改模板，文章一个字都不用动。

---

## 7. 功能实现与 JavaScript 预算

| 功能 | 实现方式 | 浏览器 JS |
|---|---|---|
| 代码高亮 | Shiki，构建时染色 | **0** |
| 文章目录 / 阅读时长 / 标签页 | 构建时生成 | **0** |
| 深色模式 | CSS 变量 + `<head>` 内联脚本 | ~10 行（内联） |
| 分类筛选 | 原生 JS 切换 `display` | ~20 行 |
| 目录滚动高亮 | IntersectionObserver | ~15 行 |
| 搜索 | Pagefind，构建后索引 | ~30KB，**仅在打开搜索时加载** |
| 评论 | giscus iframe | 第三方，不计入本站包体 |

合计约 45 行自有 JavaScript。

### 7.1 深色模式的关键实现细节

必须在 `<head>` 中放置**内联的同步脚本**，在页面渲染前读取 `localStorage` 并设置 `data-theme` 属性。

若将这段逻辑放在外部文件或页面底部，浏览器会先按默认主题绘制一帧，再切换——用户每次刷新都会看到一次闪白（FOUC）。这是深色模式最常见的实现错误。

**初始主题：固定深色，不跟随系统偏好。**

这是一个刻意的选择。本站的视觉方向就是深色终端风，深色是设计意图的一部分而非一个偏好项；如果跟随 `prefers-color-scheme`，使用浅色系统的访客进来会看到完全不同的气质，设计意图落空。

用户手动切换后写入 `localStorage`，刷新时保持不变。若日后希望改为跟随系统，改动只限于 `<head>` 那 10 行脚本，不影响其他任何部分。

### 7.2 搜索

Pagefind 在 `astro build` 之后运行，扫描生成的 HTML 文件建立索引。索引是静态文件，无需后端。搜索 UI 以 island 形式存在，索引文件在用户实际发起搜索时才加载，不影响首屏。

### 7.3 评论

giscus，基于仓库的 GitHub Discussions。需要：

1. 仓库为公开（已满足）
2. 在仓库 Settings → General → Features 中开启 **Discussions**
3. 在 https://giscus.app 安装 GitHub App 到该仓库，获取 `repo-id` 与 `category-id` 填入 `Comments.astro`

读者需有 GitHub 账号才能评论——这是 giscus 的固有代价，接受。

---

## 8. 部署

### 8.1 仓库配置

仓库为**用户主页仓库**（`lsc188zq.github.io`），因此 `astro.config.mjs` 中：

```js
site: 'https://lsc188zq.github.io'
```

**不需要设置 `base`**——用户主页仓库的站点根路径就是域名根路径。这是选择用户主页仓库省下的主要麻烦（项目页仓库需要处理 `base` 路径，外链与图片路径容易出错）。

### 8.2 流程

1. 代码在本地 `D:\Projects\MyBlog` 编写完成
2. **配置 Pages Source**：仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**
   - 建议在 push 之前做。若下拉框中暂时没有 "GitHub Actions" 选项，就先 push 一次让 workflow 文件出现在仓库里，再回来配置，然后手动重跑一次那条失败的 workflow
3. 用户执行 `git push` 到 `main` 分支
4. `.github/workflows/deploy.yml` 触发：`npm ci` → `npm run build` → 上传产物 → 部署到 Pages
5. 访问 https://lsc188zq.github.io

### 8.3 职责边界

- **本地代码编写**：由 Claude 完成
- **`git push`**：由用户执行（用户明确要求保留此步骤）
- **GitHub 网页端配置**（创建仓库已完成、开启 Discussions、配置 Pages Source、安装 giscus App）：由用户执行，Claude 提供分步指引

`gh` CLI 在本机未安装，Claude 无法代为操作 GitHub 账户。

---

## 9. 测试策略

**本项目不引入自动化测试框架。** 这是一个刻意的取舍，不是遗漏。

理由：静态博客没有业务逻辑、没有状态、没有并发。`npm run build` 成功本身就是最强的验证——Astro 的 Zod schema 校验会拦截所有 frontmatter 错误（分类填错、日期格式错、缺必填字段）。再加一层 Jest/Vitest 属于过度工程，维护成本高于收益。

验证手段：

1. `npm run build` 必须通过
2. `npm run check` 跑 Astro 官方类型检查
3. 启动 `npm run dev`，用浏览器**实际打开每一个页面**确认渲染正确，包括：
   - 首页分类筛选、标签点击筛选
   - 文章页目录滚动高亮、进度条
   - 深色/浅色切换，以及刷新后主题是否保持
   - 标签总览页、标签详情页
   - 移动端窄屏布局
   - 404 页面

**已知代价**：没有回归测试，未来修改样式可能静默破坏其他页面。对这个规模的项目，此代价可接受。

---

## 10. 明确不做的事

| 项目 | 决定 | 理由 |
|---|---|---|
| RSS 订阅 | **不做** | 用户明确拒绝 |
| 首页分页 | 不做 | 文章量小时无必要；超 150 篇再改 |
| 标签白名单校验 | 不做 | 对新手摩擦大于收益 |
| 中文 Web 字体 | 不做 | 2–4MB 体积不划算 |
| UI 框架（React 等） | 不做 | 静态博客无需框架运行时 |
| 自动化测试框架 | 不做 | 见第 9 节 |
| 自定义域名 | 暂不做 | 先用 `lsc188zq.github.io`，后续可加 |
| 站内数据统计 | 不做 | 用户未提出需求 |

---

## 11. 待办：需要用户执行的 GitHub 网页操作

按执行顺序：

1. ~~创建仓库 `lsc188zq.github.io`~~ ✅ 已完成
2. 首次 push 之后：仓库 **Settings → Pages → Source** 选择 **GitHub Actions**
3. 开启 **Settings → General → Features → Discussions**
4. 打开 https://giscus.app ，安装 GitHub App 到该仓库，获取 `data-repo-id` 与 `data-category-id`
5. 将上面两个 ID 填入 `src/components/Comments.astro`

第 3–5 步仅影响评论区，可在站点上线后再做。
