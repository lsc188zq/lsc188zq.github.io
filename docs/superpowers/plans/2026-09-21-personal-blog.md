# 个人博客实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个托管在 GitHub Pages 的 Astro 静态博客，内容从 Obsidian 笔记库同步，支持数学公式、代码高亮、深色/浅色主题、标签检索与评论。

**Architecture:** Astro 静态站点生成器。所有内容在构建时渲染为 HTML，浏览器侧只保留约 60 行原生 JS 处理主题切换、分类筛选、目录高亮、代码复制。内容来源是独立的 Obsidian vault，由 `scripts/sync-vault.mjs` 做格式转换后写入 `src/content/blog/`（派生目录，永不手工编辑）。

**Tech Stack:** Astro 7.3.3 · Node 22.13.0 · remark-math + rehype-katex · Shiki · Pagefind · giscus · gray-matter · Playwright（驱动系统 Edge 截图）

**Spec:** `docs/superpowers/specs/2026-09-21-personal-blog-design.md`

## Global Constraints

- **Astro 版本**：7.3.3（不是 5）。配置文件是 `src/content.config.ts`，不是 `src/content/config.ts`。
- **Zod 导入路径**：`import { z } from 'astro/zod'`，不是从 `zod` 直接导入。
- **Content Layer API**：用 `glob()` loader；渲染用 `render(post)` 返回 `{ Content, headings }`；条目标识用 `post.id`。
- **Node 版本下限**：≥ 22.12.0（Astro 7 要求）。本机 22.13.0。
- **npm registry**：`https://registry.npmmirror.com`（已配置）。**不要修改它。**
- **`@astrojs/markdown-remark` 必须在 dependencies 里**（`^7.3.1`）。Astro 7 的默认 Markdown 处理器换成了 Rust 的 Sätteri；一旦 `markdown.remarkPlugins`/`rehypePlugins` 非空，就必须有 unified 处理器，也就是这个包。它被 astro 声明为 **optional peer**（`peerDependenciesMeta.optional = true`），npm **不会**自动装，缺失时 `npm run build` 直接报错。T1 已装入，后续任务不要再动它。
- **禁止 `npm run build` 之外的构建方式**；不要引入 UI 框架（React/Vue/Svelte）。
- **浏览器的获取方式**：一律用 **`playwright-core`**（项目依赖）+ `chromium.launch({ channel: 'msedge' })` 驱动**系统自带的 Edge**。
  - **禁止** `playwright install`：浏览器内核从 `cdn.playwright.dev` 下载，本机实测超时失败，且不受 npm 镜像覆盖。
  - **禁止**依赖全局安装的 `playwright`：Node 的 ESM 解析不到全局包，裸导入会报 `ERR_MODULE_NOT_FOUND`（已实测确认）。
  - `playwright-core` **不下载任何浏览器**，安装仅 1 个包、约 2 秒，且能正常驱动系统 Edge（已实测确认）。
- **分类枚举固定为 6 个**：`知识`、`技术`、`项目`、`书单`、`游记`、`杂谈`。写错必须让构建失败。
- **颜色令牌**：深色为主题默认值，**不跟随系统偏好**。
- **正文禁用等宽字体**（中文无等宽字形，会 fallback 导致中英混排字形不统一，字宽对不齐）。**这条的射程是「正文」，不是「全站」**——元信息、标签、分类芯片这类**微文案可以用等宽**（`.meta`、`.cat`、`.pn-lbl`、`.back`、`.tag`、`.page-sub`、`.cloud-item` 都是有意为之，属于深夜终端风的一部分）。代码块、日期、logo 当然也用等宽。
  - **射程写准的理由**：T6 评审报过一次 F4（中文微文案用等宽），根因是原句写成了「等宽**只**用于代码块、日期、标签、logo」这个正面白名单——它把 T5 已经落地并通过评审的做法（`PostCard` 的分类芯片）判成了违规。**照旧写法，T8 与 T12 会把同一条当新发现再报两遍。** 故改为对正文的否定式。
  - **已知代价**（用户可见但极轻，随时可改回）：中文回退字形与 Consolas 字宽不一致，`.meta`（`2026-01-01 知识 约 1 分钟`）那一行的数字与汉字不是一个节奏。
- **自有 JavaScript 总量上限 ~90 行 / 3 KB**（内联 + 打包，不含第三方的 Pagefind 与 giscus）。
  - 设计文档第 10 节的「~60 行」是**动手前的估算**（深色模式 ~10、分类筛选 ~20、目录高亮 ~15、代码复制 ~15）。落地后有三处超出，且超出的部分都是**必须的**，不是膨胀：
    - 深色模式 10 → ~26：多了 `localStorage` 异常兜底（读、写各一处）与 `aria-label` 随状态更新。
    - 目录高亮 15 → ~18。
    - 代码复制 15 → ~25：设计文档把「超长折叠」记为 0 行（`<details>` 是原生元素），但**折叠的判定与包裹仍然需要 JS**——Markdown 里作者写的是普通围栏代码块，构建产物里根本没有 `<details>`，得靠脚本数 `.line` 再包一层。
  - **判据是体积不是行数**：自有 JS 超过 3 KB 才算失控，行数只作参考。这条是**对设计文档的已知偏离**，不是重新定义约束。
- **`src/content/blog/` 是派生目录**，由同步脚本生成，**任何任务都不得手工编辑其中内容**。
  - **唯一例外：`_sample.md` 是手工编写的测试夹具**（T2 创建、T7 追加一个长代码块）。它不是同步脚本产生的，因此不受上一条约束——**T7 的 Step 4 追加内容是允许的**，别把它当成违反约束。它在 **T11 被显式 `rm` 删除**，不会进入发布产物。除它之外，该目录下任何文件都不得手工编辑。
- **绝不迁移 `简历/林尚灿.md`**：含手机号等个人信息。关于页由用户自行撰写。
- **发布白名单目录**：`OI/算法`、`OI/游记`、`文集`、`项目/游戏/三眼枪`、`学习/深度学习`。其余目录一律不发布。
- **命令不得接管道**：`cmd | tail` 会让退出码变成 `tail` 的退出码，掩盖失败。直接运行命令，需要截断时用重定向。
- **每条验证都必须有判别力**：它要能真的失败。
  - **负路径测试尤其危险。** 凡是「异常时应当……」「缺失时应当……」「没找到时应当……」这类断言，**必须带一个证明负路径确实被走到的标记**（计数器、打点、写回一个可读回的值），否则「兜底生效」和「根本没走到那条路」的输出会**逐字相同**，测试全绿而什么也没证明。
  - 同理，**断言的落点要尽量靠近用户可见的结果**（计算样式、截图、构建产物的字节），而不是内部状态的痕迹（属性、类名、DOM 数量）——后者可以在用户什么都看不到的情况下全部通过。
  - **本项目已经在这上面栽过六次**，且**六次里有五次是计划文本自己写的探针**：
    1. T4 的首帧探针**证不了**它名义上要证的 FOUC；
    2. T4 修复轮的「localStorage 抛异常」测试，在注入根本没生效时照样全绿；
    3. T5 的筛选探针会报假通过（`hidden` 属性被作者样式盖掉，卡片一张没少而探针全绿）；
    4. T5 的筛选探针**改了落点却没改判别力**——点全库唯一的分类，`可见卡片: 1` 同时对应三种情况；改成只点 0 篇分类后，**又把「点有文章的分类必须为 1」那条覆盖删了**，于是把 `data-category` 改成 `"知识 "`（尾随空格）能全绿而全站分类皆空（**评审者用变异测试实证复现**）；
    5. T6 的滚动高亮断言 `on[0]===all[0]`：观察器完全死掉时 `on` 为空、`on[0]` 是 `undefined`，**打印出的那一行与正常工作时逐字节相同**——而初稿旁边还写着「这条断言一次盖住两种」，**那句自我保证是错的**；
    6. T8 的标签页探针：过滤条件漏掉分类时，页面照样生成、标题照样对、**篇数也照样是 1**（全库只此一篇），全绿。
  - 第 6 条形状不同，单独记：前五条是**取值**问题（坏掉时输出一样），第 6 条是**射程**问题（断言测的页面和要防的缺陷不在同一处）。**修完一个缺陷要回头问：验它的那条断言，测的是不是同一个东西？**
  - 于是派发任何人之前，对每条断言只问一句：**「把这条坏法注进去，它会红吗？」** 答不上来的断言不算验证，只算装饰。**负路径、双向筛选、边界值尤其要问。**
- **提交信息用中文**，格式 `<type>: <描述>`。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `blog.config.json` | vault 路径、发布目录白名单、目录→分类映射 |
| `astro.config.mjs` | Astro 配置、Markdown 管线、Shiki 双主题 |
| `src/content.config.ts` | 内容集合 schema、分类枚举 |
| `src/content/blog/*.md` | **派生**：同步脚本产物 |
| `src/styles/global.css` | 颜色令牌、重置、排版基线 |
| `src/styles/prose.css` | 正文排版、公式、代码块、引用、列表 |
| `src/layouts/BaseLayout.astro` | 全站 HTML 骨架、head、主题注入 |
| `src/layouts/PostLayout.astro` | 文章页骨架、KaTeX 按需注入 |
| `src/components/Header.astro` | 导航栏 |
| `src/components/ThemeToggle.astro` | 主题切换按钮 |
| `src/components/PostCard.astro` | 首页文章卡片 |
| `src/components/CategoryFilter.astro` | 分类筛选栏 + 筛选脚本 |
| `src/components/TableOfContents.astro` | 目录 + 滚动高亮脚本 |
| `src/components/Search.astro` | Pagefind 搜索框 |
| `src/components/Comments.astro` | giscus 评论区 |
| `src/pages/index.astro` | 首页 |
| `src/pages/posts/[...slug].astro` | 文章页 |
| `src/pages/tags/index.astro` | 标签总览 |
| `src/pages/tags/[tag].astro` | 标签详情 |
| `src/pages/about.astro` | 关于页（占位，用户自行撰写） |
| `src/pages/404.astro` | 404 |
| `scripts/lib/transform.mjs` | **纯函数**：段落切分、公式归一、标题平移、slug、摘要 |
| `scripts/lib/vault.mjs` | 扫描 vault、读 frontmatter、取 git 首次提交时间 |
| `scripts/sync-vault.mjs` | 同步 CLI（I/O + 报告） |
| `scripts/check-math.mjs` | 公式配对检查 |
| `scripts/shot.mjs` | 开发工具：驱动系统 Edge 截图 |
| `test/*.test.mjs` | 同步脚本纯函数的单元测试 |
| `.github/workflows/deploy.yml` | 推送后构建并部署 |

---

## Task 1: 脚手架与构建基线

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`（追加）, `scripts/shot.mjs`, `src/pages/index.astro`

**Interfaces:**
- Consumes: 无
- Produces: 可运行的 Astro 项目；`npm run build` 产出 `dist/`；`node scripts/shot.mjs <url> <out.png>` 截图工具供后续所有视觉任务使用

- [ ] **Step 1: 初始化 package.json**

创建 `package.json`：

```json
{
  "name": "myblog",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "sync": "node scripts/sync-vault.mjs",
    "check:math": "node scripts/check-math.mjs",
    "test": "node --test test/"
  },
  "dependencies": {
    "astro": "^7.3.3",
    "gray-matter": "^4.0.3",
    "katex": "^0.16.11",
    "rehype-katex": "^7.0.1",
    "remark-math": "^6.0.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "pagefind": "^1.5.2",
    "playwright-core": "^1.56.0",
    "typescript": "^5.6.3"
  }
}
```

> `katex` 版本写 `^0.16.11` 而非 npm 上的 0.18.7——0.18 是预发布线，与 `rehype-katex` 7.x 的 peer 范围不匹配。安装时若 npm 报 peer 冲突，保持 `^0.16.11` 并加 `--legacy-peer-deps` 前先确认报错内容。

- [ ] **Step 2: 安装依赖**

```bash
npm install
```

预期：耗时 10–20 分钟（镜像吞吐约 240 KB/s），最终出现 `added N packages`。若失败，记录完整错误后停止，不要反复重试。

- [ ] **Step 3: 创建 Astro 配置**

创建 `astro.config.mjs`：

```js
import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://lsc188zq.github.io',
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      wrap: false,
    },
  },
});
```

`defaultColor: false` 让 Shiki 不写死内联颜色，改为输出 `--shiki-light` / `--shiki-dark` 两组 CSS 变量，由 CSS 按当前主题选用。这是深色模式代码块能切换的前提。

- [ ] **Step 4: 创建 tsconfig**

创建 `tsconfig.json`：

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 5: 创建占位首页**

创建 `src/pages/index.astro`：

```astro
---
---
<!DOCTYPE html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>构建基线</title></head>
  <body><h1>构建基线</h1></body>
</html>
```

- [ ] **Step 6: 追加 .gitignore**

在 `.gitignore` 末尾追加（保留原有内容）：

```
# 截图产物
.shots/

# 部署
dist/
```

- [ ] **Step 7: 创建截图工具**

创建 `scripts/shot.mjs`：

```js
// 开发工具：用系统 Edge 给页面截图，供人工与 Claude 检查渲染结果。
// 用法: node scripts/shot.mjs <url> <输出名> [light|dark]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const [url, name, theme = 'dark'] = process.argv.slice(2);
if (!url || !name) {
  console.error('用法: node scripts/shot.mjs <url> <输出名> [light|dark]');
  process.exit(1);
}

const outDir = path.resolve('.shots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({
  viewport: { width: 1100, height: 900 },
  deviceScaleFactor: 2,
});

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });
await page.evaluate(t => localStorage.setItem('theme', t), theme);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);

const file = path.join(outDir, `${name}-${theme}.png`);
await page.screenshot({ path: file, fullPage: true });
await browser.close();

console.log(`截图: ${file}`);
if (errors.length) {
  console.log('页面错误:');
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}
```

用 `playwright-core` 而非 `playwright`。两者的 API 完全一致，区别只在：`playwright` 会在安装时下载浏览器内核（本机必失败），`playwright-core` 不会。

**不要**改成导入全局安装的 `playwright`——Node 的 ESM 解析不到全局包，`import 'playwright'` 会报 `ERR_MODULE_NOT_FOUND`（已实测确认，不是猜测）。

- [ ] **Step 8: 验证构建**

```bash
npm run build
```

预期：`dist/index.html` 生成，退出码 0。

- [ ] **Step 9: 验证截图工具**

```bash
npm run preview
```

另开一个终端：

```bash
node scripts/shot.mjs http://localhost:4321 smoke dark
```

预期：打印 `截图: ...\.shots\smoke-dark.png`，无「页面错误」段落。打开该 PNG 确认能看到「构建基线」字样。

- [ ] **Step 10: 提交**

```bash
git add -A
git commit -m "chore: Astro 项目脚手架与截图工具"
```

---

## Task 2: 内容集合与 Markdown 渲染管线

**Files:**
- Create: `src/content.config.ts`
- Create: `src/constants.ts`（Step 1；无依赖的普通模块，供组件安全导入分类枚举）
- Create: `src/content/blog/_sample.md`（临时样例，Task 10 删除）

**Interfaces:**
- Consumes: Task 1 的 `astro.config.mjs`（已启用 remark-math / rehype-katex / Shiki）
- Produces:
  - `CATEGORIES: readonly ['知识','技术','项目','书单','游记','杂谈']`，从 `src/constants.ts` 具名导出
  - 集合名 `blog`，条目字段：`title: string`、`date: Date`、`category: CATEGORIES[number]`、`tags: string[]`、`description?: string`、`draft: boolean`、`sourcePath?: string`、`slug?: string`

- [ ] **Step 1: 创建分类枚举常量**

创建 `src/constants.ts`：

```ts
export const CATEGORIES = ['知识', '技术', '项目', '书单', '游记', '杂谈'] as const;
```

**为什么单独一个文件**：`content.config.ts` 依赖 `astro:content`、`astro/loaders` 这些虚拟模块，从普通组件里 import 它不一定能解析。把枚举放在无依赖的普通模块里，两边都能安全引用。

- [ ] **Step 2: 创建集合定义**

创建 `src/content.config.ts`：

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIES } from './constants';

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

文件名必须是 `src/content.config.ts`。Astro 5 起从 `src/content/config.ts` 改到了这里，放错位置集合不会被注册，`getCollection` 会返回空数组且**不报错**——这是最隐蔽的失败模式。

- [ ] **Step 3: 创建样例文章**

创建 `src/content/blog/_sample.md`。这篇刻意包含全部高风险元素：4 种公式写法、超长代码块、含 `$` 和 `#` 的代码、四级标题。

````markdown
---
title: 渲染管线自检样例
date: 2026-01-01
category: 知识
tags: [测试, 公式]
description: 用于验证公式与代码块渲染的样例文章
---

## 行内公式

行内用美元符号：$O(n \log n)$，以及转义圆括号写法：\(a^2 + b^2 = c^2\)。

## 块级公式

$$
\sum_{i=1}^{n} a_i x^i = 0
$$

方括号写法：

\[
\binom{n}{k} = \frac{n!}{k!(n-k)!}
\]

## 代码块里的危险字符

下面这段代码含 `$` 和 `#`，同步脚本**绝不能**改动它：

```cpp
#include <bits/stdc++.h>
// 价格 $100 和 #define 都不该被当成公式或标题
#define MAXN 100005
int main() {
    long long sum = 0;  // $sum$
    return 0;
}
```

## 标题层级

### 三级标题

#### 四级标题

### 另一个三级标题
````

- [ ] **Step 4: 创建临时渲染页**

创建 `src/pages/posts/[...slug].astro`：

```astro
---
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content, headings } = await render(post);
---
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>{post.data.title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  </head>
  <body>
    <h1>{post.data.title}</h1>
    <p>分类：{post.data.category} · 标签：{post.data.tags.join(', ')}</p>
    <p>标题数：{headings.length}</p>
    <article><Content /></article>
  </body>
</html>
```

> 这里用 CDN 引 KaTeX 样式只是为了本任务快速验证渲染管线。Task 6 会改为本地依赖 + 按需注入，届时删除这个 `<link>`。

- [ ] **Step 5: 构建并验证集合被识别**

```bash
npm run build
```

预期：构建成功。检查产物：

```bash
ls dist/posts/
```

预期：出现 `_sample/index.html`（或 `_sample.html`）。**若目录为空，说明 `src/content.config.ts` 位置或文件名不对**，回到 Step 2 检查。

- [ ] **Step 6: 截图验证渲染**

```bash
npm run preview
```

另开终端：

```bash
node scripts/shot.mjs "http://localhost:4321/posts/_sample" sample dark
```

打开 `.shots/sample-dark.png`，逐项确认：

1. `$O(n \log n)$` 渲染成数学符号，页面上看不到裸露的 `$`。
   **同一段里 `\(a^2 + b^2 = c^2\)` 此时会原样显示成文本——这是正确的，不是缺陷。** `remark-math` 底层是 `micromark-extension-math`，定界符**只有 `$`**（源码文档块里是 `$a$` / `\$a$`，唯一选项 `singleDollarTextMath`），它不认识 `\(...\)`。`\(...\)` 是由同步脚本的 `normalizeMath` 在迁移时改写成 `$...$` 的（Task 9–10），而本样例是**手工创建、不经过同步脚本**的。**不要为了让这一条"通过"去改 `astro.config.mjs` 或删掉样例里的 `\(...\)`。** 保留它的价值在于：它同时是一个反向对照，证明管线不会把不认识的定界符悄悄吞掉。Task 10 完成后回来复查。
2. 只有 `$$...$$` 会居中独立成行；**`\[...\]` 同上，此阶段原样显示为文本，原因与第 1 条完全一致。** 用 `.katex-display` 计数应得 **1**。
3. C++ 代码块**此时不会着色**，token 颜色仍是继承来的黑色——**这也是正确的**。`defaultColor: false` 下 Shiki 只输出 `--shiki-light` / `--shiki-dark` 两组 CSS 变量、不写 `color`；把变量映射到 `color` 的那段 CSS 在 **Task 7 Step 1**。本任务只需验证 **Shiki 确实产出了这两组变量**（即 `defaultColor: false` 生效），真正的着色验证在 Task 7 Step 6。
4. 代码块里 `$100`、`#define`、`$sum$` **原样显示**，没有被吃掉。
5. 页面顶部显示「标题数：7」（样例里是 **4 个 `##`、2 个 `###`、1 个 `####`**：行内公式 / 块级公式 / 代码块里的危险字符 / 标题层级 / 三级标题 / 四级标题 / 另一个三级标题）。数不对就是 `headings` 没拿到，别改断言去迁就实际值——先查为什么

第 1、2、3 条的"不符"是**本阶段的预期状态**，已由控制器核实并裁决（见 SDD 台账 Ruling 6）。除这三条外任何一项不符，先停下修好再继续——后面的任务都建立在这条管线上。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: 内容集合定义与 Markdown 渲染管线"
```

---

## Task 3: 设计令牌与全局样式

**Files:**
- Create: `src/styles/global.css`, `src/styles/prose.css`
- Modify: `src/pages/posts/[...slug].astro`（引入样式）

**Interfaces:**
- Consumes: Task 2 的页面
- Produces: CSS 变量 `--bg --card --bd --tx --mu --fa --ac --chip`，定义在 `:root`（浅色）与 `html[data-theme="dark"]`（深色）；`prose.css` 提供 `.prose` 容器下的正文排版

- [ ] **Step 1: 创建颜色令牌**

创建 `src/styles/global.css`：

```css
/* 浅色为 :root 默认，深色由 html[data-theme="dark"] 覆盖。
   实际初始主题由 BaseLayout 的内联脚本设置为 dark（见 Task 4）。 */
:root {
  --bg: #ffffff;
  --card: #f6f8fa;
  --bd: #d0d7de;
  --tx: #1f2328;
  --mu: #656d76;
  --fa: #6e7781;
  --ac: #0969da;
  --chip: #f6f8fa;

  --sans: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  --mono: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;

  --maxw: 720px;
}

html[data-theme="dark"] {
  --bg: #0d1117;
  --card: #161b22;
  --bd: #30363d;
  --tx: #e6edf3;
  --mu: #8b949e;
  --fa: #6e7681;
  --ac: #58a6ff;
  --chip: #21262d;
}

* { box-sizing: border-box; }

html {
  background: var(--bg);
  color: var(--tx);
  font-family: var(--sans);
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--tx);
  transition: background .22s, color .22s;
}

a { color: var(--ac); text-decoration: none; }
a:hover { text-decoration: underline; }

::selection { background: var(--chip); }
```

深色底刻意用 `#0d1117` 而非纯黑 `#000`——纯黑配白字对比度接近 21:1，长时间阅读刺眼。

- [ ] **Step 2: 创建正文排版样式**

创建 `src/styles/prose.css`：

```css
.prose {
  font-size: 15px;
  line-height: 1.85;   /* 中文行高需高于英文常用的 1.6 */
  color: var(--tx);
}

.prose p { margin: 0 0 18px; }

.prose h2 {
  font-size: 21px;
  font-weight: 600;
  line-height: 1.45;
  margin: 32px 0 14px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--bd);
  scroll-margin-top: 80px;   /* 锚点跳转时不被头部遮挡 */
}

.prose h3 {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
  margin: 24px 0 10px;
  scroll-margin-top: 80px;
}

.prose h4 {
  font-size: 15px;
  font-weight: 600;
  margin: 20px 0 8px;
  scroll-margin-top: 80px;
}

.prose ul, .prose ol { margin: 0 0 18px; padding-left: 24px; }
.prose li { margin: 0 0 8px; }

.prose blockquote {
  border-left: 3px solid var(--ac);
  background: var(--chip);
  padding: 12px 16px;
  margin: 0 0 20px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--mu);
  border-radius: 0 6px 6px 0;
}

.prose blockquote p:last-child { margin-bottom: 0; }

.prose img { max-width: 100%; height: auto; border-radius: 6px; }

.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 20px;
  font-size: 13.5px;
}

.prose th, .prose td {
  border: 1px solid var(--bd);
  padding: 8px 12px;
  text-align: left;
}

.prose th { background: var(--chip); font-weight: 600; }

.prose code {
  font-family: var(--mono);
  font-size: 12.5px;
  background: var(--chip);
  border: 1px solid var(--bd);
  border-radius: 4px;
  padding: 1px 5px;
}

.prose a { text-decoration: underline; text-underline-offset: 2px; }

/* 块级公式横向溢出时可滚动，避免撑破布局 */
.prose .katex-display {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
}
```

- [ ] **Step 3: 引入样式并验证**

修改 `src/pages/posts/[...slug].astro`，在 **frontmatter** 中用 import 引入样式（不是 `<link>` 标签）：

```astro
import '../../styles/global.css';
import '../../styles/prose.css';
```

**注意是 `../../styles/`，不是 `../styles/`。** 本文件在 `src/pages/posts/`，比 `src/layouts/` 深一层，要退两级才到 `src/`。写成 `../styles/` 会解析到不存在的 `src/pages/styles/`，构建时 Vite 解析失败。

（其余任务里出现的 `../styles/` 是正确的，不要一律改成 `../../`：`BaseLayout.astro` 和 `PostLayout.astro` 在 `src/layouts/`，`about.astro` 在 `src/pages/`，它们退一级就够。判断依据是**文件自身的层数**，不是抄哪一处。）

**必须用 import，不能用 `<link href="/src/styles/...">`。** `src/` 下的文件由 Vite 处理，`<link>` 指向的原始路径在构建产物里不存在，生产环境下会 404 —— 而开发模式下可能看起来正常，是最容易蒙混过关的一类错误。

并给 `<article>` 加上 `class="prose"`：

```astro
    <article class="prose"><Content /></article>
```

- [ ] **Step 4: 构建并截图（浅色＝默认态）**

```bash
npm run build
```

```bash
npm run preview
```

另开终端：

```bash
node scripts/shot.mjs "http://localhost:4321/posts/_sample" prose light
```

预期：`.shots/prose-light.png` 为浅色背景深色文字，标题 `##` 下方有分隔线。

**注意：`shot.mjs` 的第三个参数（`light`/`dark`）在本任务中不生效。** 它的机制是写 `localStorage` 后刷新页面，而读这个值的脚本要到 **Task 4** 才存在。此刻 `<html>` 上没有 `data-theme` 属性，页面一律走 `:root` 的浅色令牌——**传 `dark` 也只会得到浅色图**。这里传 `light` 只为让截图文件名与内容相符。

- [ ] **Step 5: 验证深色主题令牌**

临时把 `src/pages/posts/[...slug].astro` 的 `<html>` 标签改为 `<html lang="zh-CN" data-theme="dark">`（这是本阶段唯一能真正触发深色令牌的手段），重新构建并截图：

```bash
node scripts/shot.mjs "http://localhost:4321/posts/_sample" prose dark
```

预期：`.shots/prose-dark.png` 为深色背景浅色文字，且背景应是 `#0d1117` 而非纯黑。**关键交叉检查：这张图必须与 Step 4 的浅色图明显不同。** 两图若一模一样，说明 `html[data-theme="dark"]` 那段令牌没生效，先修好再继续。

**确认后必须把 `data-theme="dark"` 删掉**（Task 4 会用脚本动态设置）。忘了删的后果不只是"多一个属性"——全站会被钉死在深色，而且 Task 4 做主题切换时会看起来"不生效"，届时很难定位。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: 设计令牌与正文排版样式"
```

---

## Task 4: 站点骨架与主题切换

**Files:**
- Create: `src/layouts/BaseLayout.astro`, `src/components/Header.astro`, `src/components/ThemeToggle.astro`
- Modify: `src/pages/posts/[...slug].astro`（改用 BaseLayout）

**Interfaces:**
- Consumes: Task 3 的 `global.css`
- Produces: `BaseLayout.astro` 接受 props `{ title: string; description?: string }` 并渲染 `<slot />`

- [ ] **Step 1: 创建主题切换按钮**

创建 `src/components/ThemeToggle.astro`：

```astro
<button id="theme-toggle" class="theme-toggle" type="button" aria-label="切换到浅色">☀</button>

<style>
  .theme-toggle {
    cursor: pointer;
    color: var(--ac);
    font-size: 15px;
    line-height: 1;
    padding: 3px 7px;
    border-radius: 6px;
    border: 1px solid var(--bd);
    background: transparent;
    font-family: var(--sans);
  }
  .theme-toggle:hover { background: var(--chip); }
</style>

<script>
  const KEY = 'theme';
  const btn = document.getElementById('theme-toggle');

  function sync() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (btn) {
      btn.textContent = dark ? '☀' : '☾';
      // aria-label 必须跟着状态走。只写死一个"切换主题"的话，
      // 屏幕阅读器用户永远只知道"这里有个按钮"，不知道当前是什么主题、
      // 按下去会变成什么——而视力正常的用户看得见 ☀/☾ 的切换。
      btn.setAttribute('aria-label', dark ? '切换到浅色' : '切换到深色');
    }
  }

  btn?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    // localStorage 在部分隐私设置/沙箱环境下写入也会抛异常。
    // 不兜住的话，主题在视觉上已经切了，但 sync() 永远执行不到，
    // 图标和 aria-label 会停在旧状态。
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
    sync();
  });

  sync();
</script>
```

- [ ] **Step 2: 创建导航栏**

创建 `src/components/Header.astro`：

```astro
---
import ThemeToggle from './ThemeToggle.astro';
---
<header class="hdr">
  <a class="hdr-logo" href="/"><span class="caret">~/</span>blog</a>
  <nav class="hdr-nav">
    <a href="/">文章</a>
    <a href="/tags">标签</a>
    <a href="/about">关于</a>
    <ThemeToggle />
  </nav>
</header>

<style>
  .hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 26px;
    border-bottom: 1px solid var(--bd);
    max-width: 1100px;
    margin: 0 auto;
  }
  .hdr-logo {
    font-family: var(--mono);
    font-weight: 600;
    font-size: 14px;
    color: var(--tx);
  }
  .hdr-logo:hover { text-decoration: none; }
  .caret { color: var(--ac); }
  .hdr-nav {
    display: flex;
    align-items: center;
    gap: 18px;
    font-size: 13px;
  }
  .hdr-nav a { color: var(--mu); }
  .hdr-nav a:hover { color: var(--tx); text-decoration: none; }
  @media (max-width: 600px) {
    .hdr { padding: 12px 16px; }
    .hdr-nav { gap: 12px; }
  }
</style>
```

- [ ] **Step 3: 创建站点骨架**

创建 `src/layouts/BaseLayout.astro`：

```astro
---
import Header from '../components/Header.astro';
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}

const { title, description = '个人博客' } = Astro.props;
---
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <!--
      必须在 <head> 内联同步执行。放到外部文件或页面底部会导致浏览器
      先按默认主题绘制一帧再切换，用户每次刷新都会看到闪白（FOUC）。
    -->
    <script is:inline>
      (function () {
        var t = 'dark';
        // localStorage 在部分隐私设置/沙箱环境下读取会直接抛异常。
        // 不兜住的话整个 IIFE 在 setAttribute 之前就中断了，
        // 这些用户每次加载都落到 :root 的浅色 token 上——
        // 与"初始主题固定为深色"的意图相反。
        try {
          t = localStorage.getItem('theme') || 'dark';
        } catch (e) {}
        document.documentElement.setAttribute('data-theme', t);
      })();
    </script>
  </head>
  <body>
    <Header />
    <main class="shell">
      <slot />
    </main>
  </body>
</html>

<style>
  .shell {
    max-width: 1100px;
    margin: 0 auto;
    padding: 26px;
  }
  @media (max-width: 600px) {
    .shell { padding: 16px; }
  }
</style>
```

初始主题**固定为深色**，不读 `prefers-color-scheme`。深色终端风是设计意图的一部分，若跟随系统，浅色系统访客看到的是完全不同的气质。

- [ ] **Step 4: 让文章页使用骨架**

把 `src/pages/posts/[...slug].astro` 整体替换为：

```astro
---
import { getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import '../../styles/prose.css';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---
<BaseLayout title={post.data.title} description={post.data.description}>
  <h1>{post.data.title}</h1>
  <p>分类：{post.data.category} · 标签：{post.data.tags.join(', ')}</p>
  <article class="prose"><Content /></article>
</BaseLayout>
```

注意：Task 2 Step 3 里那个临时引入的 KaTeX CDN `<link>` 在这里被删掉了，公式样式暂时失效。Task 6 会用本地依赖重新接上。**这是预期的中间状态**，不要在本任务里顺手修。

- [ ] **Step 5: 构建并验证主题切换**

```bash
npm run build
```

```bash
npm run preview
```

另开终端：

```bash
node scripts/shot.mjs "http://localhost:4321/posts/_sample" theme dark
```

```bash
node scripts/shot.mjs "http://localhost:4321/posts/_sample" theme light
```

预期：两张图背景色明显不同（`#0d1117` 深蓝黑 vs `#ffffff` 纯白），导航栏在两张图中都存在，主题按钮图标不同。

- [ ] **Step 6: 验证无闪白**

用 Playwright 检查首帧就是深色（而不是先浅后深）：

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();await p.goto('http://localhost:4321/posts/_sample');const c=await p.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor);console.log('首帧背景:',c);await b.close();})"
```

预期：输出 `首帧背景: rgb(13, 17, 23)`。若是 `rgb(255, 255, 255)`，说明内联脚本没生效或位置不对。

**这条探针只能证明一半，别把它当 FOUC 的证明。** `page.goto` 默认等到 `load` 事件才返回，而 `<script type="module">`（Astro 对**非** `is:inline` 的脚本的默认处理）是 defer 的，同样在 `load` 之前就跑完了。也就是说：**有人把 `is:inline` 去掉、或者把脚本挪到 `<body>` 末尾，这条探针照样打印 `rgb(13,17,23)`。** 它能证明的只是"深色是默认值、没读 `prefers-color-scheme`"，证明不了"脚本是同步内联在 `<head>` 里的"。

真正能证明 FOUC 性质的是**构建产物**：`dist/` 里该页面的 `<head>` 内应当有一个**无 `src`、无 `type="module"`** 的 `<script>`，且在 `<body>` 之前。这条是权威判据，探针是辅助。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: 站点骨架、导航栏与主题切换"
```

---

## Task 5: 首页（时间线 + 分类筛选）

**Files:**
- Create: `src/components/PostCard.astro`, `src/components/CategoryFilter.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `CATEGORIES`（Task 2）、`BaseLayout`（Task 4）
- Produces: 发布文章列表（排除 `draft: true`），按日期倒序

- [ ] **Step 1: 创建文章卡片**

创建 `src/components/PostCard.astro`：

```astro
---
interface Props {
  id: string;
  title: string;
  date: Date;
  category: string;
  tags: string[];
  description?: string;
}

const { id, title, date, category, tags, description } = Astro.props;
const iso = date.toISOString().slice(0, 10);
---
<article class="card" data-category={category} data-tags={tags.join(' ')}>
  <div class="card-date">{iso}</div>
  <div class="card-body">
    <h2 class="card-title"><a href={`/posts/${id}`}>{title}</a></h2>
    {description && <p class="card-desc">{description}</p>}
    <div class="card-foot">
      {tags.map((t) => <a class="card-tag" href={`/tags/${encodeURIComponent(t)}`}>#{t}</a>)}
      <a class="card-cat" href={`/tags/${encodeURIComponent(category)}`}>{category}</a>
    </div>
  </div>
</article>

<style>
  .card {
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: 20px;
    padding: 18px 0;
    border-bottom: 1px solid var(--bd);
  }
  .card-date {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--fa);
    padding-top: 4px;
  }
  .card-title { font-size: 17px; font-weight: 600; margin: 0 0 6px; line-height: 1.5; }
  .card-title a { color: var(--tx); }
  .card-title a:hover { color: var(--ac); text-decoration: none; }
  .card-desc { font-size: 13.5px; line-height: 1.7; color: var(--mu); margin: 0 0 10px; }
  .card-foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .card-tag {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ac);
    padding: 2px 7px;
    border-radius: 5px;
  }
  .card-tag:hover { background: var(--chip); text-decoration: none; }
  .card-cat {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--mu);
    border: 1px solid var(--bd);
    padding: 1px 7px;
    border-radius: 4px;
  }
  .card-cat:hover { color: var(--tx); text-decoration: none; }
  /*
    hidden 属性靠 UA 样式表的 [hidden]{display:none} 生效，而 UA 规则属于
    "呈现性提示"，优先级低于作者样式——上面的 .card{display:grid} 会把它盖掉。
    结果是卡片属性设上了 hidden、DOM 查询也数得对，但**画面上一张都没少**。
    .card[hidden] 特异性(0,2,0)高于 .card(0,1,0)，这一条必须留着。
    已实测确认：少了它，getComputedStyle(el).display 仍返回 "grid"。
  */
  .card[hidden] { display: none; }
  @media (max-width: 600px) {
    .card { grid-template-columns: 1fr; gap: 6px; }
  }
</style>
```

- [ ] **Step 2: 创建分类筛选栏**

创建 `src/components/CategoryFilter.astro`：

```astro
---
import { CATEGORIES } from '../constants';
---
<div class="cfilter" id="cfilter">
  <button class="cf-btn is-on" data-cat="__all__" type="button">全部</button>
  {CATEGORIES.map((c) => <button class="cf-btn" data-cat={c} type="button">{c}</button>)}
</div>

<style>
  .cfilter {
    display: flex;
    gap: 8px;
    padding: 18px 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .cfilter::-webkit-scrollbar { display: none; }
  .cf-btn {
    flex: 0 0 auto;
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--mu);
    background: transparent;
    border: 1px solid var(--bd);
    border-radius: 6px;
    padding: 4px 12px;
    cursor: pointer;
    transition: color .15s, border-color .15s, background .15s;
  }
  .cf-btn:hover { color: var(--tx); }
  .cf-btn.is-on { color: var(--ac); border-color: var(--ac); background: var(--chip); }
</style>

<script>
  const bar = document.getElementById('cfilter');
  const cards = Array.from(document.querySelectorAll('.card'));
  const status = document.getElementById('list-status');

  bar?.addEventListener('click', (e) => {
    const btn = e.target.closest('.cf-btn');
    if (!btn) return;
    const cat = btn.dataset.cat;

    bar.querySelectorAll('.cf-btn').forEach((b) => b.classList.toggle('is-on', b === btn));

    let shown = 0;
    for (const c of cards) {
      const ok = cat === '__all__' || c.dataset.category === cat;
      c.hidden = !ok;
      if (ok) shown++;
    }
    if (status) status.textContent = cat === '__all__' ? `共 ${shown} 篇` : `${cat} · ${shown} 篇`;
  });
</script>
```

筛选栏渲染全部 6 个分类，**包括当前 0 篇的**。这是刻意的：分类是固定枚举，筛选栏的宽度与顺序不应该随内容多寡抖动。空分类点进去显示「共 0 篇」是正确的反馈，不是错误。

- [ ] **Step 3: 创建首页**

把 `src/pages/index.astro` 整体替换为：

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import PostCard from '../components/PostCard.astro';
import CategoryFilter from '../components/CategoryFilter.astro';

const posts = (await getCollection('blog', ({ data }) => !data.draft))
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
---
<BaseLayout title="文章">
  <CategoryFilter />
  <p class="status" id="list-status">共 {posts.length} 篇</p>
  <div id="list">
    {posts.map((p) => (
      <PostCard
        id={p.id}
        title={p.data.title}
        date={p.data.date}
        category={p.data.category}
        tags={p.data.tags}
        description={p.data.description}
      />
    ))}
  </div>
</BaseLayout>

<style>
  .status {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--fa);
    margin: 0 0 6px;
  }
</style>
```

- [ ] **Step 4: 构建并验证筛选**

```bash
npm run build
```

```bash
npm run preview
```

另开终端：

```bash
node scripts/shot.mjs "http://localhost:4321/" home dark
```

打开 `.shots/home-dark.png`，确认：卡片日期在左、标题在右、标签是蓝色 `#xxx`、`知识` 分类标记有边框。

- [ ] **Step 5: 验证筛选真的生效**

**点三个分类，三种状态都要看**：

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();await p.goto('http://localhost:4321/');const vis=async()=>await p.\$\$eval('.card',ns=>ns.filter(n=>getComputedStyle(n).display!=='none').length);const st=async()=>await p.textContent('#list-status');console.log('卡片上的 data-category:',JSON.stringify(await p.\$\$eval('.card',ns=>ns.map(n=>n.dataset.category))));const click=async c=>{await p.click('.cf-btn[data-cat=\"'+c+'\"]');await p.waitForTimeout(200);console.log(c,'-> 可见卡片:',await vis(),'| 状态行:',await st());};await click('知识');await p.screenshot({path:'.shots/home-filtered.png',fullPage:true});await click('技术');await p.screenshot({path:'.shots/home-filtered-empty.png',fullPage:true});await click('__all__');await b.close();})"
```

预期：

```
卡片上的 data-category: ["知识"]
知识     -> 可见卡片: 1 | 状态行: 知识 · 1 篇
技术     -> 可见卡片: 0 | 状态行: 技术 · 0 篇
__all__  -> 可见卡片: 1 | 状态行: 共 1 篇
```

**四条输出各自在守什么——少一条就有一个坏法能全绿溜过去**：

| 输出 | 它排掉的坏法 |
|---|---|
| `data-category: ["知识"]` | 卡片属性与 `CATEGORIES` 里的字符串对不上（**尾随空格、全半角括号**）。这是本项目明令警惕的坑，而它**打印出来**才看得见 |
| `知识 -> 1` | 分类**匹配逻辑**坏了（比如恒不相等）——点有文章的分类却一篇都出不来 |
| `技术 -> 0` | **隐藏没有真的生效**：`hidden` 属性设上了、DOM 查询数得对，但 `.card{display:grid}` 盖住了 UA 规则，**画面上卡片一张没少**（Ruling 9 那个假通过） |
| `__all__ -> 1` | **过度隐藏**：筛选一跑就把卡片全藏了、点「全部」也回不来 |

**这四条不是凑数，是两次实战补出来的。** 最初只点「知识」——但全库此刻唯一的文章**就是**「知识」，`可见卡片: 1` 同时对应「匹配正常」「筛选压根没跑」「隐藏没生效」，**它排不掉它本该防的坏法**。改成只点「技术」后，`知识 -> 1` 那条又被丢了：**评审者用变异测试证明**，把产物里的 `data-category="知识"` 改成 `"知识 "`（一个尾随空格），探针 6/6 全绿、退出码 0，而同一份产物里点「知识」得到 `可见卡片: 0`——**全库唯一的文章在任何分类下都不可达**。所以四条一起写，缺一不可。

（**这是本项目第四次栽在同一件事上**：探针的输出在坏掉时和好着时一模一样。前三次是 T5 的 `:not([hidden])` 计数、T4 的首帧探针、T4 的异常注入测试。已提为全局约束。）

**探针为什么数的是"计算样式"而不是 `:not([hidden])` 的个数**：`hidden` 属性的 `display:none` 来自 UA 样式表，属"呈现性提示"，优先级低于作者样式。`PostCard` 里的 `.card{display:grid}` 会把它盖掉——属性设上了、`:not([hidden])` 也数得对，**但卡片一张都没从画面上消失**。已实测确认。用 `getComputedStyle(...)!=='none'` 数，才是"用户真的看得见几张"。所以 `PostCard` 里那条 `.card[hidden]{display:none}` 是功能的一部分，不是可选的样式糖。

**并且必须目视确认这两张截图**：`home-filtered-empty.png` 里**卡片区一张不剩**（连分隔线都不该有），`home-filtered.png` 里**只剩 1 张**。这条不能只靠 DOM 探针——上面那个假通过的坑，探针本身就是帮凶。

**出问题时先看哪一行（这里曾经写反过，评审者指出来了）**：若 `知识 -> 可见卡片: 1` 不成立，**第一嫌疑**是 `PostCard` 的 `data-category` 与 `CATEGORIES` 里的字符串对不上（中文，多一个空格、用了全角括号都会对不上）。**不要去看「技术」那一行**——`data-category` 拼错时，「技术」的可见数**恰好也是 0**，它碰巧通过，**看上去一切正常**。判断依据是探针第一行打印的 `卡片上的 data-category:`，它直接把实际字符串摊开；`知识 -> 1` 是这条链路的**功能性**断言，两者一起才关得住。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: 首页时间线与分类筛选"
```

---

## Task 6: 文章页（目录、阅读时长、上下篇、公式）

**Files:**
- Create: `src/layouts/PostLayout.astro`, `src/components/TableOfContents.astro`
- Modify: `src/pages/posts/[...slug].astro`

**Interfaces:**
- Consumes: `BaseLayout`（Task 4）、`render()` 返回的 `headings`
- Produces: `PostLayout.astro` props `{ post, headings, prev, next }`

- [ ] **Step 1: 创建目录组件**

创建 `src/components/TableOfContents.astro`：

```astro
---
interface Heading {
  depth: number;
  slug: string;
  text: string;
}

interface Props {
  headings: Heading[];
}

const { headings } = Astro.props;
// 只收录 h2 / h3，避免目录过长
const toc = headings.filter((h) => h.depth === 2 || h.depth === 3);
---
{toc.length > 0 && (
  <aside class="toc" id="toc">
    <div class="toc-title">本页目录</div>
    {toc.map((h) => (
      <a class:list={['toc-link', { 'toc-h3': h.depth === 3 }]} data-target={h.slug} href={`#${h.slug}`}>{h.text}</a>
    ))}
  </aside>
)}

<style>
  .toc {
    position: sticky;
    top: 24px;
    align-self: start;
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    padding-top: 6px;
  }
  .toc-title {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: .12em;
    color: var(--fa);
    margin-bottom: 12px;
    text-transform: uppercase;
  }
  .toc-link {
    display: block;
    font-size: 12px;
    line-height: 1.6;
    color: var(--mu);
    padding: 4px 0 4px 10px;
    border-left: 2px solid var(--bd);
    transition: color .15s, border-color .15s;
  }
  .toc-link:hover { color: var(--tx); text-decoration: none; }
  .toc-link.on { color: var(--ac); border-color: var(--ac); font-weight: 600; }
  .toc-h3 { padding-left: 22px; }
  @media (max-width: 900px) { .toc { display: none; } }
</style>

<script>
  const links = Array.from(document.querySelectorAll('.toc-link'));

  // 缓存每个标题的**文档绝对位置**。getBoundingClientRect().top + scrollY 与当前
  // 滚动位置无关，所以只需在加载和 resize 时各算一次——scroll 回调里就不读布局了。
  let tops = [];
  const measure = () => {
    tops = links.map((l) => {
      const el = document.getElementById(l.dataset.target);
      return el ? el.getBoundingClientRect().top + scrollY : Infinity;
    });
  };

  const LINE = 0.3; // 参考线取视口高度的 30%

  const sync = () => {
    const y = scrollY + innerHeight * LINE;
    // 「滚到底」必须**同时**满足「还能滚」和「确实滚到了底」。
    // 只写 scrollY + innerHeight >= scrollHeight - 2 的话，当文章总高不超过视口时
    // 它**恒为真**——读者明明在一篇短随笔的顶部，目录却点亮最后一节，
    // 与他实际所在的位置不符。这和上面那条"末尾够不到参考线"是同一类缺陷，只是方向相反。
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    const atBottom = maxScroll > 0 && scrollY >= maxScroll - 2;
    // 滚到底时，末尾几节的标题因为**无处可滚**，永远到不了参考线——没有这一条，
    // 目录里最后几节永远高亮不了，点它们的链接也毫无反应。
    // 已实测：点「另一个三级标题」跳到底部后，原实现的高亮项是空数组。
    let idx = atBottom ? links.length - 1 : 0;
    if (!atBottom) {
      for (let i = 0; i < tops.length; i++) if (tops[i] <= y) idx = i;
    }
    links.forEach((l, i) => l.classList.toggle('on', i === idx));
  };

  measure();
  sync();
  addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', () => { measure(); sync(); });
</script>
```

**为什么不用 `IntersectionObserver`**：初版是 `rootMargin: '0px 0px -70% 0px'` + IntersectionObserver，**已实测有真实缺陷，而且是用户直接看得见的**（T6 实施者发现，控制器独立复现后裁定返工）：

- 观察带是「视口顶部 30%」。**页面滚到底时，最后几节的标题因为无处可滚，永远进不了这条带。**
- 样例文章的实测几何：页面 **1155** / 视口 400 / 最大滚动 **755**；6 个标题的文档位置是 267 / 378 / 612 / **935** / **996** / **1093**；带底 = 755 + 400×0.3 = **875** —— **最后三个标题永远够不到 875**。
- 后果两条：
  1. **点目录里「另一个三级标题」跳到底部，目录一项都不亮**（实测 `高亮: []`）；
  2. 阶梯滚到底，读者已经在最后三节，目录却停在第四节「代码块里的危险字符」（实测如此）。
- 还有第三条隐患：高亮是**黏的**——只在 `isIntersecting` 为真时才切换，标题离开观察带时不清除。所以"高亮项"和"读到的位置"可以差好几节。

改成「**参考线 + 滚到底兜底**」：参考线仍在视口 30% 处（保持原设计意图），但滚到底时直接点亮最后一项。实测新逻辑单调推进、每一项都能点亮：

```
scrollY   0  -> 行内公式
scrollY 360  -> 块级公式
scrollY 500  -> 代码块里的危险字符
scrollY 755  -> 另一个三级标题     ← 原实现这里高亮为空
```

- [ ] **Step 2: 创建文章页骨架**

创建 `src/layouts/PostLayout.astro`：

```astro
---
import BaseLayout from './BaseLayout.astro';
import TableOfContents from '../components/TableOfContents.astro';
import '../styles/prose.css';

interface Props {
  post: {
    id: string;
    data: {
      title: string;
      date: Date;
      category: string;
      tags: string[];
      description?: string;
    };
    body?: string;
  };
  headings: { depth: number; slug: string; text: string }[];
  prev?: { id: string; title: string };
  next?: { id: string; title: string };
}

const { post, headings, prev, next } = Astro.props;
const iso = post.data.date.toISOString().slice(0, 10);

// 中文按 400 字/分钟估算；英文单词按 200 词/分钟。
// 简化处理：统计非空白字符数，除以 400，最少 1 分钟。
const text = (post.body ?? '')
  .replace(/```[\s\S]*?```/g, '')   // 代码块不计入阅读时长
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '');
const charCount = text.replace(/\s/g, '').length;
const minutes = Math.max(1, Math.round(charCount / 400));
---
<BaseLayout title={post.data.title} description={post.data.description}>
  <div class="post-grid">
    <article>
      <a class="back" href="/">← 返回文章列表</a>
      <h1 class="title">{post.data.title}</h1>
      <div class="meta">
        <span>{iso}</span>
        <span class="cat">{post.data.category}</span>
        <span>约 {minutes} 分钟</span>
      </div>
      {post.data.tags.length > 0 && (
        <div class="tags">
          {post.data.tags.map((t) => <a class="tag" href={`/tags/${encodeURIComponent(t)}`}>#{t}</a>)}
        </div>
      )}
      <div class="prose"><slot /></div>
      {(prev || next) && (
        <nav class="pn">
          {prev ? <a class="pn-item" href={`/posts/${prev.id}`}><span class="pn-lbl">← 上一篇</span><span class="pn-ttl">{prev.title}</span></a> : <span />}
          {next ? <a class="pn-item" href={`/posts/${next.id}`}><span class="pn-lbl">下一篇 →</span><span class="pn-ttl">{next.title}</span></a> : <span />}
        </nav>
      )}
    </article>
    <TableOfContents headings={headings} />
  </div>
</BaseLayout>

<style>
  .post-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 168px;
    gap: 30px;
  }
  .back {
    display: inline-block;
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--mu);
    margin-bottom: 18px;
  }
  .title { font-size: 26px; line-height: 1.45; margin: 0 0 12px; font-weight: 700; letter-spacing: -0.01em; }
  .meta {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--fa);
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 14px;
  }
  .cat { border: 1px solid var(--bd); padding: 1px 7px; border-radius: 4px; color: var(--mu); }
  .tags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 26px; padding-bottom: 20px; border-bottom: 1px solid var(--bd); }
  .tag { font-family: var(--mono); font-size: 11px; color: var(--ac); padding: 2px 7px; border-radius: 5px; }
  .tag:hover { background: var(--chip); text-decoration: none; }
  .pn { display: flex; gap: 12px; margin-top: 34px; padding-top: 20px; border-top: 1px solid var(--bd); }
  .pn-item {
    flex: 1;
    display: block;
    border: 1px solid var(--bd);
    border-radius: 9px;
    padding: 11px 14px;
    background: var(--chip);
  }
  .pn-item:hover { border-color: var(--ac); text-decoration: none; }
  .pn-lbl { display: block; font-family: var(--mono); font-size: 10px; color: var(--fa); margin-bottom: 5px; }
  .pn-ttl { font-size: 13px; font-weight: 600; line-height: 1.5; color: var(--tx); }
  @media (max-width: 900px) {
    .post-grid { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 3: 接入文章页路由**

把 `src/pages/posts/[...slug].astro` 整体替换为：

```astro
---
import { getCollection, render } from 'astro:content';
import PostLayout from '../../layouts/PostLayout.astro';

export async function getStaticPaths() {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => a.data.date.getTime() - b.data.date.getTime());

  return posts.map((post, i) => ({
    params: { slug: post.id },
    props: {
      // 必须传原始的 collection entry 对象，不能拆成 { id, data, body } 再传。
      // render() 需要完整的 entry，拆开会报错。
      post,
      prev: posts[i - 1] ? { id: posts[i - 1].id, title: posts[i - 1].data.title } : undefined,
      next: posts[i + 1] ? { id: posts[i + 1].id, title: posts[i + 1].data.title } : undefined,
    },
  }));
}

const { post, prev, next } = Astro.props;
const { Content, headings } = await render(post);
---
<PostLayout post={post} headings={headings} prev={prev} next={next}>
  <Content />
</PostLayout>
```

`post.body` 是 Content Layer API 在 glob loader 下保留的原始 Markdown 正文。若为 `undefined`，阅读时长会算成 1 分钟——**这属于可接受降级**，不要为此改动 schema。

- [ ] **Step 4: 接入 KaTeX 样式（本地依赖 + 按需注入）**

在 `src/layouts/PostLayout.astro` 的 frontmatter 顶部（`import BaseLayout` 之前）加入：

```js
import katexCss from 'katex/dist/katex.min.css?url';
```

**判定条件：检查原始正文里有没有 `$` 公式标记。** 不要用 `headings` 判断——公式绝大多数在正文里而不在标题里，用标题判断会漏掉几乎所有文章，而且 `post` 上**不存在** `hasMath` 这个字段。

在 `PostLayout.astro` 的 frontmatter 里加：

```js
const body = post.body ?? '';
// 先去掉代码块，避免代码里的 $ 造成误判（样例里就有一段含 $100 和 $sum$ 的 C++）
const bodyNoCode = body.replace(/```[\s\S]*?```/g, '');
const hasMath = /\$[^$\n]+\$|\$\$[\s\S]+?\$\$/.test(bodyNoCode);
```

然后在 `<BaseLayout>` 标签内、`<div class="post-grid">` 之前加入：

```astro
{hasMath && <link rel="stylesheet" href={katexCss} />}
```

（`<link rel="stylesheet">` 在 `<body>` 内是合法的——`stylesheet` 属于 HTML 规范里的 "body-ok" link 类型，浏览器会正常加载。）

- [ ] **Step 5: 构建并验证**

```bash
npm run build
```

```bash
npm run preview
```

另开终端：

```bash
node scripts/shot.mjs "http://localhost:4321/posts/_sample" post dark
```

打开 `.shots/post-dark.png`，逐项确认：

1. 标题下方显示 `2026-01-01`、`知识`、`约 N 分钟`
2. 标签是 `#测试` `#公式`
3. **右侧有目录**，列出 6 项：「行内公式」「块级公式」「代码块里的危险字符」「标题层级」「三级标题」「另一个三级标题」。**「四级标题」不应该出现**——目录组件只收录 `depth === 2` 和 `depth === 3`（`TableOfContents` 里的过滤条件）。若你看到 7 项含四级标题，说明过滤没生效；若少了几项，说明 `headings` 没拿到
4. 公式渲染为数学符号（KaTeX 样式已加载）
5. 「行内公式」「块级公式」等标题在目录里可点击

**本任务验证不到的一项：上一页/下一页。** 此时全库只有 `_sample.md` 一篇文章，`prev` 和 `next` 都是 `undefined`，`.pn` 那一段根本不会渲染。这是**预期**，不是缺陷。上下篇要等 **Task 11** 迁移完 36 篇才有内容可验——已记入台账，届时补验（含首篇无「上一篇」、末篇无「下一篇」两个边界）。

- [ ] **Step 6: 验证目录滚动高亮**

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage({viewport:{width:1100,height:400}});await p.goto('http://localhost:4321/posts/_sample');const H=()=>Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);const m=await p.evaluate(()=>({sh:Math.max(document.body.scrollHeight,document.documentElement.scrollHeight),vh:window.innerHeight}));console.log('页面高:',m.sh,'| 视口高:',m.vh,'| 能滚动:',m.sh>m.vh+50);await p.evaluate(()=>window.scrollTo(0,Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)));await p.waitForTimeout(600);const all=await p.\$\$eval('.toc-link',n=>n.map(x=>x.textContent));const on=await p.\$\$eval('.toc-link.on',n=>n.map(x=>x.textContent));console.log('目录全部:',all,'(共',all.length,'项)');console.log('滚到底时高亮的目录项:',on,'(共',on.length,'项)');console.log('滚动高亮正常:',on.length===1&&all.length>0&&on[0]!==all[0]);await b.close();})"
```

预期：`能滚动: true`；`目录全部` **6 项**；`滚到底时高亮的目录项` **恰好 1 项**，且**不是第一项**；`滚动高亮正常: true`。

**三个刻意的设计，别改**：
- **视口高度写死 400**（不是 800）。实测（1100 宽 / **T6 版两栏布局**，即本任务完成后的实际布局）：页面高 **1155**，最大滚动 **755**；800 高的视口只剩 **355** 的滚动范围。800 不是滚不动，但**滚动范围太小**——"滚到底"和"刚滚一点"在 400 视口下差得足够远，高亮位置的判断才有信息量。
  （注：T4 版布局量到的是 1120 / 720。本任务的两栏网格把正文列压窄了，行数变多，所以页面变高。**别照着 1120 去核对**。）
- **先打印 `能滚动`**。若它输出 `false`，说明这条验证此刻**无意义**，要在报告里如实写"页面不够长，滚动高亮未能验证"，**不要当成通过**。
- **必须是「直接跳到底」而不是「阶梯滚到底」**。这不是省事，是**这条探针唯一有判别力的写法**：原实现（IntersectionObserver + 顶部 30% 观察带）在**阶梯滚动时表现是对的**，只有**直接跳到底**才会暴露"最后三节永远进不了观察带"这个缺陷（实测：阶梯滚到底高亮 `代码块里的危险字符`，直接跳到底高亮 `[]`）。改成阶梯滚动会让这条探针**变绿而缺陷仍在**——本项目第七次遇到「探针在坏掉时和好着时输出一样」。判断依据仍然是那句话：**把坏法注进去，它会红吗？** 这里"坏法"就是原实现，答案是「只有直接跳才会红」。

**再补一条：视口比页面还高时，不能点亮最后一项。**

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage({viewport:{width:1100,height:1300}});await p.goto('http://localhost:4321/posts/_sample');const h=await p.evaluate(()=>Math.max(document.body.scrollHeight,document.documentElement.scrollHeight));const all=await p.\$\$eval('.toc-link',n=>n.map(x=>x.textContent));const on=await p.\$\$eval('.toc-link.on',n=>n.map(x=>x.textContent));console.log('页面高:',h,'| 视口高: 1300 | 能滚动:',h>1302);console.log('高亮项:',on);console.log('高亮的是不是最后一项:',on[0]===all[all.length-1]);await b.close();})"
```

预期：`页面高: 1300 | 视口高: 1300 | 能滚动: false`；`高亮项: [ '块级公式' ]`；`高亮的是不是最后一项: false`。

**`页面高` 会打印 1300 而不是 1155，这不是笔误。** `scrollHeight` 是「内容高度」与「视口高度」的**较大者**——内容只有 1155，视口 1300，所以它读出来是 1300。**别去把它"修正"成 1155**，也别据此认为探针跑错了页面。（内容真实高度 1155 这个数在 Step 6 上面那条 400 视口的探针里是有意义的；这里没有。）

**这条守的是"滚到底兜底"自己的反面**：如果兜底条件写成 `scrollY + innerHeight >= scrollHeight - 2`，那么**文章总高不超过视口时它恒为真**——读者在短随笔的**顶部**，目录却点亮**最后一节**。**这与本步上面裁掉的那个缺陷是同一类**（目录指的位置和读者实际位置不符），只是方向相反。

**这条有判别力，且已实测确认**：改之前跑，输出是 `高亮项: [ '另一个三级标题' ] | 高亮的是不是最后一项: true` —— **红**。改之后才是上面那个预期值。

（正确值恰好是 `块级公式` 而不是 `行内公式`：参考线在 1300×0.3 = **390**，标题位置是 267 / 378 / 612 / …，390 之上的最后一个正是 378 的「块级公式」。**别把它"修正"成 `行内公式`**——那说明你把参考线理解成了视口顶部。）

**为什么断言长这样、而不是分成两条**：目录高亮最容易的坏法有**三种**——① 观察器没工作，谁都不高亮；② 忘了把其它项的高亮摘掉，于是**永远高亮第一项**；③ 写成"叠加"而不是"切换"，**越滚高亮越多**。

- 只写 `on[0]===all[0]`（本任务初稿就是这写的，还配了一句"这条断言一次盖住两种"）**三种都盖不住**。① 让 `on` 为空数组，`on[0]` 是 `undefined`，`undefined===all[0]` 为 `false`——**打印出来的那一行和正常工作时一模一样**。初稿那句自我保证是错的，而错的自我保证比没写更糟：它会让人放心不去看。
- 合成一个布尔值后三种坏法全部让它红：`on.length===1` 拦住 ① 和 ③，`on[0]!==all[0]` 拦住 ②。
- 末尾的 `all.length>0` 是防"目录压根没渲染"。此时 `all` 和 `on` 都为空，`undefined!==undefined` 恰好也是 `false`，**不加也拦得住——但那是巧合不是推理**，所以显式写上。

（**这已经是本项目第五次栽在"探针在坏掉时和好着时输出一样"上**：T5 的 `:not([hidden])` 计数、T4 的首帧探针、T4 的异常注入、T5 的筛选探针（Ruling 16/17）、以及这条。四次里有三次是**我自己写的**。派发前逐条问「把坏法注进去，它会红吗」。）

- [ ] **Step 7: 验证公式样式按需加载**

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();await p.goto('http://localhost:4321/posts/_sample');const has=await p.\$\$eval('link[href*=katex]',n=>n.length);const cls=await p.\$\$eval('.katex',n=>n.length);console.log('katex样式链接:',has,'| .katex元素:',cls);await b.close();})"
```

预期：`katex样式链接: 1 | .katex元素: 2`。

**为什么是 2 不是 4**：样例里虽然有 4 种公式写法，但 `remark-math` 只认 `$` 定界符——`$O(n \log n)$` 和 `$$...$$` 会渲染（各产生 1 个 `.katex`），而 `\(...\)` 和 `\[...\]` 原样显示为文本、**不产生 `.katex` 元素**。这与 Task 2 的裁决（Ruling 6）是同一件事。看到 2 是正确的；看到 4 反而说明管线以某种方式渲染了它不该认的定界符。

顺带：这条预期**不能**用「公式有没有显示出来」来判断，因为只有 2 个会显示——这正是这个数字的意义。Task 10 完成后，`\(...\)` / `\[...\]` 会由同步脚本归一成 `$` 形式，届时（在真实文章上）应变成 4。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat: 文章页目录、阅读时长、上下篇与公式样式"
```

---

## Task 7: 代码块增强

**Files:**
- Create: `src/components/CodeEnhance.astro`
- Modify: `src/layouts/PostLayout.astro`（引入组件）、`src/styles/prose.css`（代码块样式）

**Interfaces:**
- Consumes: Shiki 输出的 `.astro-code` 元素（Task 1 的 `astro.config.mjs` 配置）
- Produces: 行号、超长代码折叠（>40 行）、复制按钮

- [ ] **Step 1: 追加代码块样式**

在 `src/styles/prose.css` 末尾追加：

```css
/* ---------- 代码块 ---------- */

.prose pre {
  position: relative;
  background: var(--card) !important;
  border: 1px solid var(--bd);
  border-radius: 8px;
  padding: 13px 15px;
  margin: 0 0 20px;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.75;
  white-space: pre;
}

.prose pre code {
  background: none;
  border: 0;
  padding: 0;
  font-size: inherit;
  counter-reset: line;
}

/* 行号：用 CSS 计数器，零 JavaScript */
.prose pre code .line::before {
  counter-increment: line;
  content: counter(line);
  display: inline-block;
  width: 2.2em;
  margin-right: 1.2em;
  text-align: right;
  color: var(--fa);
  opacity: .55;
  user-select: none;
}

/*
  Shiki 双主题：defaultColor:false 让每个 token 带上 --shiki-light / --shiki-dark
  两组变量，这里按当前主题选用。
*/
html[data-theme="dark"] .prose pre code span {
  color: var(--shiki-dark) !important;
}
html[data-theme="light"] .prose pre code span {
  color: var(--shiki-light) !important;
}

/* 超长代码折叠：原生 <details>，零 JavaScript */
.prose details.code-fold {
  margin: 0 0 20px;
  border: 1px solid var(--bd);
  border-radius: 8px;
  background: var(--card);
}
.prose details.code-fold > summary {
  cursor: pointer;
  padding: 9px 15px;
  font-family: var(--mono);
  font-size: 11.5px;
  color: var(--ac);
  user-select: none;
}
.prose details.code-fold > summary:hover { background: var(--chip); }
.prose details.code-fold[open] > summary { border-bottom: 1px solid var(--bd); }
.prose details.code-fold pre { margin: 0; border: 0; border-radius: 0; }

/* 复制按钮 */
.prose .copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--mu);
  background: var(--chip);
  border: 1px solid var(--bd);
  border-radius: 5px;
  padding: 3px 8px;
  cursor: pointer;
  opacity: 0;
  transition: opacity .15s, color .15s;
}
.prose pre:hover .copy-btn { opacity: 1; }
.prose .copy-btn:hover { color: var(--ac); }
.prose .copy-btn:focus-visible { opacity: 1; }
```

- [ ] **Step 2: 创建代码块增强组件**

创建 `src/components/CodeEnhance.astro`：

```astro
<script>
  const FOLD_THRESHOLD = 40;

  function enhance() {
    document.querySelectorAll('.prose pre').forEach((pre) => {
      if (pre.dataset.enhanced) return;
      pre.dataset.enhanced = '1';

      const code = pre.querySelector('code');
      const lineCount = code ? code.querySelectorAll('.line').length : 0;

      // 过长则折叠。用原生 <details> 而非 JS，零脚本开销且键盘可操作。
      if (lineCount > FOLD_THRESHOLD && !pre.closest('details')) {
        const details = document.createElement('details');
        details.className = 'code-fold';
        const summary = document.createElement('summary');
        summary.textContent = `展开全部（${lineCount} 行）`;
        pre.parentNode.insertBefore(details, pre);
        details.appendChild(summary);
        details.appendChild(pre);
      }

      // 复制按钮
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = '复制';
      btn.addEventListener('click', async () => {
        const text = code ? code.textContent : pre.textContent;
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = '已复制';
        } catch {
          btn.textContent = '复制失败';
        }
        setTimeout(() => { btn.textContent = '复制'; }, 1500);
      });
      pre.appendChild(btn);

      // 折叠时按钮被藏在 details 内，复制按钮跟着一起隐藏是可接受的
    });
  }

  enhance();
</script>
```

- [ ] **Step 3: 引入组件**

在 `src/layouts/PostLayout.astro` 中，在 `</BaseLayout>` 之前（即组件树末尾）加入：

```astro
<CodeEnhance />
```

并在 frontmatter 中 import：

```js
import CodeEnhance from '../components/CodeEnhance.astro';
```

- [ ] **Step 4: 构造长代码测试样例**

在 `src/content/blog/_sample.md` 末尾追加一个超过 40 行的代码块（用于验证折叠）：

````markdown
## 超长代码折叠测试

```cpp
#include <bits/stdc++.h>
using namespace std;

const int MAXN = 100005;
int n, m;
long long a[MAXN], tree[MAXN];

inline int lowbit(int x) {
    return x & (-x);
}

void update(int i, long long delta) {
    while (i <= n) {
        tree[i] += delta;
        i += lowbit(i);
    }
}

long long query(int i) {
    long long sum = 0;
    while (i > 0) {
        sum += tree[i];
        i -= lowbit(i);
    }
    return sum;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    cin >> n >> m;
    for (int i = 1; i <= n; i++) {
        cin >> a[i];
        update(i, a[i]);
    }

    while (m--) {
        int op, x, y;
        cin >> op >> x >> y;
        if (op == 1) {
            update(x, y);
        } else {
            cout << query(y) - query(x - 1) << '\n';
        }
    }

    return 0;
}
```
````

> 上面这段是**树状数组**实现，真实行数 **49 行**，超过 40 行阈值。注意里面含 `#include`、`#define` 风格的写法与 `'\n'` 转义——它们同时也在检验公式归一的「跳过代码块」是否正确。
>
> 若构建后没触发折叠，检查 `CodeEnhance.astro` 里统计的是 `.line` 元素数量（Shiki 生成），不是源码行数。

- [ ] **Step 5: 构建并验证折叠与行号**

```bash
npm run build
```

```bash
npm run preview
```

另开终端：

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage({viewport:{width:1100,height:900}});await p.goto('http://localhost:4321/posts/_sample');const f=await p.\$\$eval('details.code-fold',n=>n.length);const s=await p.\$\$eval('details.code-fold > summary',n=>n.map(x=>x.textContent));console.log('折叠块:',f,'|',s);const ln=await p.evaluate(()=>{const el=document.querySelector('.prose pre code .line');if(!el)return {found:false};const before=getComputedStyle(el,'::before');const code=getComputedStyle(el.parentElement);return {found:true,content:before.content,counterIncrement:before.counterIncrement,counterReset:code.counterReset,lineCount:el.parentElement.querySelectorAll('.line').length};});console.log('行号 ::before:',JSON.stringify(ln));await b.close();})"
```

预期：`折叠块: 1 | ['展开全部（N 行）']`，**N 必须 ≥ 49**；再加一行

```
行号 ::before: {"found":true,"content":"counter(line)","counterIncrement":"line 1","counterReset":"line 0","lineCount":49}
```

三个判据：

- **`N ≥ 49`，不是 `N ≥ 41`。** 那个代码块本身就是 **49 行**（Step 4 的 `#include` 到最后的 `}`，数一遍就是 49），渲染出来的 `.line` 只可能 **≥ 49**（末尾空行可能多出一个）。写 `≥ 41` 的话，**一个只渲染出 41 行的截断代码块照样通过**——而阈值是 40，41 也满足 `> 40`，折叠块数还是 1，**前两条断言全都看不出来**。下界必须贴着实际行数写。
- **`found` 必须是 `true`**：说明 Shiki 真的产出了 `.line` 元素。`false` 就说明行号方案的前提不成立（此时 `折叠块:` 多半也会是 0 或 1 以外的值）。
- **`content` 必须含 `counter(line)`、`counterIncrement` 必须含 `line`、`counterReset` 必须含 `line`——三条缺一不可**：这才是「行号真的会渲染出数字」的完整证据。行号是纯 CSS 计数器生成的，**不在 DOM 里**，所以它坏掉时**页面上什么都不会显示，而 `折叠块:`、`复制按钮数`、以及除 Step 6 那张人眼截图之外的一切断言全都是绿的**。截图那张是人眼看的，这条是自动的。三条各排掉一种坏法：

  | 判据 | 排掉的坏法 | 只看另外两条会漏掉什么 |
  |---|---|---|
  | `content` 含 `counter(line)` | `.prose pre code .line::before` 整条规则没匹配上（`content` 变成 `none`） | — |
  | `counterReset` 含 `line` | `code` 上的 `counter-reset: line` 漏写 | 计数器不归零，行号从上一块接着数 |
  | `counterIncrement` 含 `line` | `::before` 上的 `counter-increment: line` 漏写 | **计数器恒为 0，每一行都显示 `0`**——`content` 和 `counterReset` **两条都照样是绿的** |

  最后一行是本条补丁的重点：**光看 `content` 的字符串值证明不了里面有数字**，`counterIncrement` 才是那个字面量。
  - 不要断言它们精确相等：Chromium 把 `counter-reset: line` 报成 `line 0`、把 `counter-increment: line` 报成 `line 1`（**已实测**）。判据是**含 `line`**，不是等于。

**已由控制器实测**（在一个独立临时页面上跑的，不依赖本仓库构建）：规则生效时三条读数为 `content:"counter(line)"` / `counterIncrement:"line 1"` / `counterReset:"line 0"`；把 `content` 抹成 `none` 后 `content` 读 `"none"`。判据有判别力。页面截图确认渲染出 `1 / 2 / 3`。

- [ ] **Step 6: 截图确认行号与主题配色**

```bash
node scripts/shot.mjs "http://localhost:4321/posts/_sample" code dark
node scripts/shot.mjs "http://localhost:4321/posts/_sample" code light
```

预期：两张图中代码块左侧都有**灰色行号**，且**语法高亮颜色明显不同**（深色是 github-dark 配色，浅色是 github-light）。若两图颜色相同，说明 `defaultColor: false` 没生效或 `prose.css` 里那段 `--shiki-*` 规则写错了。

- [ ] **Step 7: 验证复制按钮（本任务此前唯一没有验证的交付物）**

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();await p.addInitScript(()=>{window.__copied=null;if(navigator.clipboard)navigator.clipboard.writeText=async t=>{window.__copied=t;};});await p.goto('http://localhost:4321/posts/_sample');const n=await p.\$\$eval('.copy-btn',x=>x.length);await p.locator('.copy-btn').first().click();await p.waitForTimeout(150);const r=await p.evaluate(()=>({copied:window.__copied,label:document.querySelector('.copy-btn').textContent}));console.log('复制按钮数:',n,'| 按钮文字:',r.label,'| 复制到字符数:',r.copied?r.copied.length:null);console.log('首行:',JSON.stringify((r.copied||'').split(String.fromCharCode(10))[0]));console.log('首行是否以数字开头(即混进了行号):',/^(\\s*)\\d/.test(r.copied||''));await p.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('denied');};});await p.locator('.copy-btn').first().click();await p.waitForTimeout(150);console.log('写剪贴板抛错后按钮文字:',await p.textContent('.copy-btn'));await b.close();})"
```

预期：`复制按钮数: 2`（两个代码块各一个）｜`按钮文字: 已复制`｜`复制到字符数` 大于 0｜`首行` 是 `"#include <bits/stdc++.h>"`｜`首行是否以数字开头(即混进了行号): false`｜**`写剪贴板抛错后按钮文字: 复制失败`**。

**最后那条守的是「失败分支」，而前面几条一条都守不住它。** 前面把 `navigator.clipboard.writeText` 换成了**永远成功**的桩，所以 `catch` 那条路**从头到尾没被执行过**——把 `catch` 整个删掉、或者里面写成 `btn.textContent = '已复制'`，**上面五条断言逐字节不变**。

- 这条分支不是装饰：剪贴板 API 在**非安全上下文**（`http://` 非 localhost）、**用户拒绝权限**、**页面失焦**时都会抛错，而博客是 `https://lsc188zq.github.io`，**用户从 http 链接跳进来或浏览器策略收紧时就会走到这里**。
- 做法：把桩换成一个**抛错的**桩，再点一次同一个按钮。150 ms 足够 `await` 失败并落到 `catch`——注意上面那个 `setTimeout(…, 1500)` 会把文字复位成 `复制`，所以这两次点击必须在前一次点击的 1500 ms 之内完成，探针的时序已经保证（累计约 350 ms）。
- 这条同时验证了**按钮被点过一次之后仍然可点**。

**为什么这条不能省。** 行号是纯 CSS 计数器（`content: counter(line)`）生成的，**不是 DOM 文本**，所以 `code.textContent` 天然不含行号——但这恰恰是最容易被后人改坏的地方：哪天有人把行号改成真实的 DOM 元素，复制出来的每一行前面就会多一个数字，**而这种回归在截图里完全看不出来**（截图里两者长得一模一样）。这条探针一次验证三件事：按钮存在、点击真的调用了剪贴板、复制内容不含行号。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat: 代码块增强（行号、超长折叠、复制按钮）"
```

---

## Task 8: 标签页

**Files:**
- Create: `src/pages/tags/index.astro`, `src/pages/tags/[tag].astro`

**Interfaces:**
- Consumes: `getCollection('blog')`、`PostCard`（Task 5）、`BaseLayout`（Task 4）
- Produces: `/tags` 总览、`/tags/<tag>` 详情

- [ ] **Step 1: 创建标签总览页**

创建 `src/pages/tags/index.astro`：

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

const posts = await getCollection('blog', ({ data }) => !data.draft);

const counts = new Map();
for (const p of posts) {
  for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
}
// 按出现次数倒序，次数相同按名称排序，保证构建结果稳定
const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'));

// 构建期警告：仅大小写不同的标签会造成分裂。只警告，不中断构建。
const lower = new Map();
for (const [t] of tags) {
  const k = t.toLowerCase();
  if (!lower.has(k)) lower.set(k, []);
  lower.get(k).push(t);
}
for (const [, group] of lower) {
  if (group.length > 1) console.warn(`[tags] 疑似重复标签（仅大小写不同）: ${group.join(' / ')}`);
}
---
<BaseLayout title="标签">
  <h1 class="page-title">标签</h1>
  <p class="page-sub">共 {tags.length} 个标签 · {posts.length} 篇文章</p>
  <div class="tag-cloud">
    {tags.map(([t, n]) => (
      <a class="cloud-item" href={`/tags/${encodeURIComponent(t)}`}>
        <span class="cloud-name">#{t}</span>
        <span class="cloud-count">{n}</span>
      </a>
    ))}
  </div>
</BaseLayout>

<style>
  .page-title { font-size: 24px; font-weight: 700; margin: 0 0 8px; }
  .page-sub { font-family: var(--mono); font-size: 11.5px; color: var(--fa); margin: 0 0 24px; }
  .tag-cloud { display: flex; flex-wrap: wrap; gap: 10px; }
  .cloud-item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--bd);
    border-radius: 7px;
    padding: 6px 12px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--tx);
  }
  .cloud-item:hover { border-color: var(--ac); text-decoration: none; }
  .cloud-count { color: var(--fa); font-size: 10.5px; }
</style>
```

- [ ] **Step 2: 创建标签详情页**

创建 `src/pages/tags/[tag].astro`：

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PostCard from '../../components/PostCard.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  // 这个路由同时服务于「标签」和「分类」两类链接。
  //
  // 首页卡片的分类芯片（PostCard 里的 .card-cat）指向 /tags/<分类名>，
  // 但 category 和 tags 是 schema 里两个互不相干的字段——只收 tags 的话，
  // **每一张卡片上的分类芯片都会 404**，而且 T13 之前还没有 404 页面兜着。
  // 所以这里取两者的并集。
  const names = [...new Set(posts.flatMap((p) => [...p.data.tags, p.data.category]))];
  return names.map((tag) => ({ params: { tag } }));
}

const { tag } = Astro.params;
// 同理，命中条件是「是标签」或「是分类」。两者同名时并集已去重，不会重复渲染。
//
// 注：Astro.params.tag 在类型上是 string | undefined。这里不需要处理 undefined
// ——getStaticPaths 生成的每个路径都带 tag。编辑器里的 TS 报错就是它，
// npm run build 不跑类型检查，不会因此失败。
const posts = (await getCollection('blog', ({ data }) => !data.draft))
  .filter((p) => p.data.tags.includes(tag) || p.data.category === tag)
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
---
<BaseLayout title={`#${tag}`}>
  <h1 class="page-title">#{tag}</h1>
  <p class="page-sub"><a href="/tags">← 全部标签</a> · {posts.length} 篇</p>
  <div>
    {posts.map((p) => (
      <PostCard
        id={p.id}
        title={p.data.title}
        date={p.data.date}
        category={p.data.category}
        tags={p.data.tags}
        description={p.data.description}
      />
    ))}
  </div>
</BaseLayout>

<style>
  .page-title { font-size: 24px; font-weight: 700; margin: 0 0 8px; font-family: var(--mono); }
  .page-sub { font-family: var(--mono); font-size: 11.5px; color: var(--fa); margin: 0 0 24px; }
</style>
```

标签含中文与特殊字符，`getStaticPaths` 返回的 `params.tag` 用原始字符串即可，Astro 会在生成路径时编码。**不要**在这里手动 `encodeURIComponent`，否则会产生双重编码（`%25E6%25B5%258B%25E8%25AF%2595`）。

- [ ] **Step 3: 构建并验证**

```bash
npm run build
```

```bash
npm run preview
```

另开终端：

```bash
node scripts/shot.mjs "http://localhost:4321/tags" tags dark
```

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();await p.goto('http://localhost:4321/tags');const items=await p.\$\$eval('.cloud-item',ns=>ns.map(n=>({href:n.getAttribute('href'),name:n.querySelector('.cloud-name').textContent})));console.log('标签数:',items.length);for(const i of items)console.log('  ',i.name,'->',i.href);console.log('出现双重编码(%25):',items.some(i=>i.href.includes('%25')));await p.click('.cloud-item');await p.waitForTimeout(300);console.log('跳转后 URL:',p.url());console.log('跳转后标题:',await p.textContent('.page-title'));console.log('标题与第一个标签一致:',(await p.textContent('.page-title'))===items[0].name);for(const n of ['测试','公式','知识']){await p.goto('http://localhost:4321/tags/'+encodeURIComponent(n));await p.waitForTimeout(200);console.log('页 /tags/'+n+' -> 卡片数:',await p.\$\$eval('.card',x=>x.length),'| 标题:',await p.textContent('.page-title'));}await b.close();})"
```

预期：`标签数: 2`；两个 `href` 都是**单次百分号编码**（形如 `/tags/%E6%B5%8B%E8%AF%95`）；`出现双重编码(%25): false`；`标题与第一个标签一致: true`；末尾三行**全部是 1**：

```
页 /tags/测试 -> 卡片数: 1 | 标题: #测试
页 /tags/公式 -> 卡片数: 1 | 标题: #公式
页 /tags/知识 -> 卡片数: 1 | 标题: #知识
```

**末尾三行不是凑数，而且必须是「三行」而不是「一行」。** 守的是 Step 2 里那段注释说的事（`getStaticPaths` 与 filter 都必须取「标签 ∪ 分类」的并集），而前面几条全都守不住它。过滤条件有两个半边，`/tags/<名字>` 这个路由由**同一个模板**同时服务标签和分类：

| 坏法 | 知识页（分类半边） | 测试页（标签半边） | 前几条断言 |
|---|---|---|---|
| 漏 `\|\| p.data.category === tag` | **0 篇** ← 抓住 | 1 篇 | 全绿，守不住 |
| 漏 `\|\| p.data.tags.includes(tag)` | 1 篇 | **0 篇** ← 抓住 | 全绿，守不住 |

- 两种坏法下页面**照样渲染出来**（`getStaticPaths` 已经生成了路径），标题也**照样**是 `#知识` / `#测试`——所以 `标题与第一个标签一致: true` **两种都通过**；
- **而这两种缺陷在别的标签页上完全看不出来**：全库只有 1 篇文章，标签「测试」页、标签「公式」页、分类「知识」页的篇数都是 1，**数字一样，坏掉与好着时输出相同**（第五次那个坑的变体）；
- **只查「知识」一行是不够的**——那正是漏掉标签半边时唯一仍然读 1 的行。**两个半边各需要一行自己的证据**，所以三行缺一不可：`知识` 守分类半边，`测试`/`公式` 守标签半边（两个都写上是因为它们同为 1 篇，哪一个被漏掉都该现形）。
- 判别力的来源：读数是 **1 才是对的**；任何一行出现 **0**，就说明它对应的那个半边被漏了。

**为什么不写死「第一个一定是 `#测试`」**：标签云按「出现次数倒序、同次数按 `localeCompare(zh)`」排。样例的两个标签都是 1 篇，谁在前**取决于 Node 的 ICU 中文排序**（按拼音 测 cè 在 公 gōng 之前）——这条依赖是真的，但它不是本任务要验的东西，写死了会变成一个和 ICU 版本绑定的脆断言。真正要验的是**「没有被双重编码」**（`%25` 不出现）和**「点进去的标题和点的那一项对得上」**，这两条与排序无关。

- [ ] **Step 4: 验证分类芯片不会 404（本任务修的就是这个）**

首页每张卡片的分类芯片都指向 `/tags/<分类名>`，而分类是**另一个字段**。若 `getStaticPaths` 只收标签，这些链接**全部 404**——T13 之前连 404 页面都没有。

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();await p.goto('http://localhost:4321/');const href=await p.getAttribute('.card-cat','href');console.log('分类芯片链接:',href);const r=await p.goto('http://localhost:4321'+href);console.log('状态码:',r.status());console.log('页面标题:',await p.textContent('.page-title'));await b.close();})"
```

预期：`分类芯片链接: /tags/%E7%9F%A5%E8%AF%86`（即 `知识`）；`状态码: 200`（**不是 404**）；`页面标题: #知识`。

**若状态码是 404**，就是 `getStaticPaths` 里没并入 `p.data.category`——这正是本步要拦的回归。

（**服务端解码这条已经排除掉了，不用怀疑它。** 控制器实测过：把 `dist/tags/知识/index.html` 放进去后用 `astro preview` 请求，`/tags/%E7%9F%A5%E8%AF%86`、`/tags/%E7%9F%A5%E8%AF%86/`、`/tags/知识` 三种写法**都返回 200**。所以这里的 404 只可能是页面没被生成。）

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 标签总览页与标签详情页"
```

---

## Task 9: 同步脚本 —— 纯函数层

> **本任务偏离规范第 12 节**（该节声明不写自动化测试）。理由：同步脚本是纯数据转换逻辑，错误会**静默产出错误内容**而非报错。使用 Node 内置的 `node --test`，**不引入任何新依赖**。

**Files:**
- Create: `scripts/lib/transform.mjs`, `test/transform.test.mjs`

**Interfaces:**
- Consumes: 无（纯函数，不碰文件系统）
- Produces: 以下具名导出，供 Task 10 使用
  - `splitSegments(md: string): { type: 'text'|'code'; content: string }[]`
  - `mapText(md: string, fn: (text: string) => string): string`
  - `normalizeMath(md: string): string`
  - `normalizeHeadings(md: string): string`
  - `makeSlug(filename: string): string`
  - `extractDescription(md: string, max?: number): string`

- [ ] **Step 1: 写段落切分的失败测试**

创建 `test/transform.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitSegments,
  mapText,
  normalizeMath,
  normalizeHeadings,
  makeSlug,
  extractDescription,
} from '../scripts/lib/transform.mjs';

test('splitSegments 把代码围栏切出来', () => {
  const md = ['正文一', '```cpp', 'int x = 1;', '```', '正文二'].join('\n');
  const segs = splitSegments(md);
  assert.equal(segs.length, 3);
  assert.equal(segs[0].type, 'text');
  assert.equal(segs[1].type, 'code');
  assert.equal(segs[2].type, 'text');
  assert.ok(segs[1].content.includes('int x = 1;'));
});

test('splitSegments 处理未闭合的围栏', () => {
  const md = ['正文', '```cpp', 'int x = 1;'].join('\n');
  const segs = splitSegments(md);
  assert.equal(segs[1].type, 'code');
});

test('splitSegments 支持波浪号围栏', () => {
  const md = ['~~~', 'a', '~~~'].join('\n');
  const segs = splitSegments(md);
  assert.equal(segs[0].type, 'code');
});

test('mapText 只改正文不动代码', () => {
  const md = ['$a$', '```', '$b$', '```'].join('\n');
  const out = mapText(md, (t) => t.replaceAll('$', '@'));
  assert.ok(out.includes('@a@'));
  assert.ok(out.includes('$b$'), '代码块里的 $ 必须原样保留');
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test test/
```

预期：FAIL，报 `Cannot find module '../scripts/lib/transform.mjs'`。

- [ ] **Step 3: 实现段落切分**

创建 `scripts/lib/transform.mjs`：

```js
// 同步脚本的纯函数层：不碰文件系统、不依赖 git，便于单元测试。

/**
 * 把 Markdown 切成正文段与代码段。
 * 代码段原样保留，后续所有文本改写都必须经由 mapText 绕过它们——
 * C++ 代码里出现的 $ 、# 、\( 都不是公式或标题，改写会破坏代码。
 */
export function splitSegments(md) {
  const lines = md.split('\n');
  const segs = [];
  let buf = [];
  let inFence = false;
  let fenceChar = '';

  const fenceMatch = (line) => line.match(/^\s*(`{3,}|~{3,})/);

  for (const line of lines) {
    const m = fenceMatch(line);

    if (!inFence && m) {
      if (buf.length) {
        segs.push({ type: 'text', content: buf.join('\n') });
        buf = [];
      }
      inFence = true;
      fenceChar = m[1][0];
      buf.push(line);
      continue;
    }

    if (inFence) {
      buf.push(line);
      // 闭合围栏必须与开启围栏同种字符
      if (m && m[1][0] === fenceChar) {
        segs.push({ type: 'code', content: buf.join('\n') });
        buf = [];
        inFence = false;
      }
      continue;
    }

    buf.push(line);
  }

  if (buf.length) {
    segs.push({ type: inFence ? 'code' : 'text', content: buf.join('\n') });
  }
  return segs;
}

/** 只对正文段应用 fn，代码段原样保留。 */
export function mapText(md, fn) {
  return splitSegments(md)
    .map((s) => (s.type === 'text' ? fn(s.content) : s.content))
    .join('\n');
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
node --test test/
```

预期：4 个测试全部 PASS。

- [ ] **Step 5: 写公式归一的失败测试**

在 `test/transform.test.mjs` 末尾追加：

```js
test('normalizeMath 把 \\[...\\] 转成 $$...$$', () => {
  const out = normalizeMath('\\[a+b\\]');
  assert.equal(out.replace(/\n/g, ''), '$$a+b$$');
});

test('normalizeMath 把 \\(...\\) 转成 $...$', () => {
  const out = normalizeMath('前 \\(x^2\\) 后');
  assert.equal(out, '前 $x^2$ 后');
});

test('normalizeMath 不动代码块里的转义括号', () => {
  const md = ['```cpp', '// \\(not math\\)', '```'].join('\n');
  assert.equal(normalizeMath(md), md);
});

test('normalizeMath 保留已正确的美元符号写法', () => {
  assert.equal(normalizeMath('$a$ 与 $$b$$'), '$a$ 与 $$b$$');
});
```

- [ ] **Step 6: 实现公式归一**

在 `scripts/lib/transform.mjs` 末尾追加：

```js
/**
 * 把 Obsidian 常见的 \\(...\\) 与 \\[...\\] 归一到 remark-math 支持的 $ 写法。
 * remark-math 只认 $ 与 $$，另外两种写法不会被渲染，页面上会露出原始源码。
 */
export function normalizeMath(md) {
  return mapText(md, (text) =>
    text
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `$$${body}$$`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body}$`)
  );
}
```

用替换函数而非替换字符串，是为了避开 `$` 在替换串里是特殊字符（`$&`、`$1`）的问题。

- [ ] **Step 7: 运行测试**

```bash
node --test test/
```

预期：8 个测试全部 PASS。

- [ ] **Step 8: 写标题平移的失败测试**

在 `test/transform.test.mjs` 末尾追加：

```js
test('normalizeHeadings 对以 ## 开头的文档不做改动', () => {
  const md = ['## 一', '### 二'].join('\n');
  assert.equal(normalizeHeadings(md), md);
});

test('normalizeHeadings 把以 ### 开头的文档整体上提一级', () => {
  const md = ['### 一', '#### 二'].join('\n');
  assert.equal(normalizeHeadings(md), ['## 一', '### 二'].join('\n'));
});

test('normalizeHeadings 把以 # 开头的文档整体下移一级', () => {
  const md = ['# 一', '## 二'].join('\n');
  assert.equal(normalizeHeadings(md), ['## 一', '### 二'].join('\n'));
});

test('normalizeHeadings 不把标题降到 H6 以下', () => {
  const md = ['###### 一', '##### 二'].join('\n');
  const out = normalizeHeadings(md);
  assert.ok(out.split('\n').every((l) => !/^#{7,}/.test(l)));
});

test('normalizeHeadings 不改代码块里的井号', () => {
  const md = ['## 标题', '```cpp', '#define MAXN 10', '```'].join('\n');
  assert.equal(normalizeHeadings(md), md);
});

test('normalizeHeadings 的平移量按整篇算，不按代码块切开的段落各算各的', () => {
  const md = ['### 题目描述', '', '```cpp', 'int x;', '```', '', '#### 细节'].join('\n');
  const out = normalizeHeadings(md);
  assert.equal(out, ['## 题目描述', '', '```cpp', 'int x;', '```', '', '### 细节'].join('\n'));
});
```

- [ ] **Step 9: 实现标题平移**

在 `scripts/lib/transform.mjs` 末尾追加：

```js
/**
 * 把文档标题层级整体平移到「最浅标题 = H2」。
 * 博客的 H1 由 frontmatter 的 title 提供，正文里再来一个 H1 会破坏大纲。
 * 平移而非「一律上提一级」，是因为不同文档的起始层级不一致。
 */
export function normalizeHeadings(md) {
  const segs = splitSegments(md);

  // 平移量必须**按整篇**算。这里不能走 mapText —— 它是按段落回调的，
  // 而代码块会把文档切成好几段，每段各算一次 min 就会得到**各不相同**的 shift：
  // 「### 描述」+代码+「#### 细节」两段分别平移后都落到 H2，**相对层级被抹平**。
  // 已实测：该输入下 mapText 版输出 `## 描述` 与 `## 细节`，`### 细节` 丢失。
  // 博客的目录是按标题层级画的大纲，层级被抹平等于目录结构是错的。
  const levels = [];
  for (const seg of segs) {
    if (seg.type !== 'text') continue;
    for (const line of seg.content.split('\n')) {
      const m = line.match(/^(#{1,6})\s/);
      if (m) levels.push(m[1].length);
    }
  }
  if (levels.length === 0) return md;

  const shift = 2 - Math.min(...levels);
  if (shift === 0) return md;

  return segs
    .map((seg) =>
      seg.type === 'text'
        ? seg.content
            .split('\n')
            .map((line) => {
              const m = line.match(/^(#{1,6})(\s.*)$/);
              if (!m) return line;
              const lv = Math.min(6, Math.max(1, m[1].length + shift));
              return '#'.repeat(lv) + m[2];
            })
            .join('\n')
        : seg.content
    )
    .join('\n');
}
```

`splitSegments` 已经把代码段摘出来了，所以这里不必再判断围栏——但**必须先切段、再统算 min、最后回填**，顺序反了就是我刚说的那个缺陷。

（级别被 clamp 到 1~6：若一篇文档横跨 6 个以上层级，最深的几级会被压到一起。**已知且接受**——这种事在真实笔记里没出现过，且压缩只影响大纲最深处。）

- [ ] **Step 10: 运行测试**

```bash
node --test test/
```

预期：14 个测试全部 PASS。

- [ ] **Step 11: 写 slug 与摘要的失败测试**

在 `test/transform.test.mjs` 末尾追加：

```js
test('makeSlug 保留中文', () => {
  assert.equal(makeSlug('普通平衡树.md'), '普通平衡树');
});

test('makeSlug 把空格转成连字符', () => {
  assert.equal(makeSlug('P5665 CSP-S2019 划分.md'), 'P5665-CSP-S2019-划分');
});

test('makeSlug 去掉 URL 里有歧义的字符', () => {
  assert.equal(makeSlug('a#b?c%d.md'), 'abcd');
});

test('makeSlug 不产生连续或首尾连字符', () => {
  assert.equal(makeSlug('  a   b  .md'), 'a-b');
});

test('extractDescription 跳过标题与代码块取第一段正文', () => {
  const md = ['## 标题', '', '```cpp', 'int x;', '```', '', '这是第一段真正的正文内容，足够长。'].join('\n');
  assert.equal(extractDescription(md), '这是第一段真正的正文内容，足够长。');
});

test('extractDescription 剥离行内标记', () => {
  const md = '这里有 **粗体** 和 [链接](http://x) 以及 `代码`，够长了。';
  assert.equal(extractDescription(md), '这里有 粗体 和 链接 以及 代码，够长了。');
});

test('extractDescription 超长时截断加省略号', () => {
  const md = '啊'.repeat(200);
  const out = extractDescription(md, 80);
  assert.equal(out.length, 81);
  assert.ok(out.endsWith('…'));
});

test('extractDescription 找不到合格段落时返回空串', () => {
  assert.equal(extractDescription('```cpp\nint x;\n```'), '');
});

test('端到端：真实笔记形状的输入', () => {
  const md = [
    '### 题目描述',
    '',
    '给定 \\(n\\) 个数，求区间和。',
    '',
    '```cpp',
    '// 复杂度 \\(O(n \\log n)\\)',
    '#define int long long',
    'int main() { return 0; }',
    '```',
    '',
    '### 思路',
    '',
    '用树状数组维护前缀和。',
  ].join('\n');

  const out = normalizeHeadings(normalizeMath(md));

  assert.ok(out.startsWith('## 题目描述'), '标题应上提一级');
  assert.ok(out.includes('给定 $n$ 个数'), '行内公式应转换');
  assert.ok(out.includes('// 复杂度 \\(O(n \\log n)\\)'), '代码块内容必须原样保留');
  assert.ok(out.includes('#define int long long'), '#define 必须原样保留');
  assert.ok(out.includes('## 思路'), '第二个标题也应上提');
  assert.equal(extractDescription(out), '给定 n 个数，求区间和。');
});
```

最后一个用例是本任务最有价值的测试：它同时检验了公式归一、标题平移、**代码块跳过**三件事的相互作用，而这正是同步脚本最容易出错的地方。`#define` 和代码注释里的 `\(` 如果被改写，说明 `mapText` 的分段逻辑有漏洞。

- [ ] **Step 12: 实现 slug 与摘要**

在 `scripts/lib/transform.mjs` 末尾追加：

```js
/**
 * 文件名 → URL slug。保留中文：文件名里大量是题号混中文（P5665、CSP-S2019），
 * 自动拼音转写对这类字符串只会产出无意义的垃圾，也不可读。
 * 需要英文 URL 时，在 frontmatter 里写 slug: 字段覆盖。
 */
export function makeSlug(filename) {
  return filename
    .replace(/\.md$/i, '')
    .trim()
    .replace(/\s+/g, '-')
    // URL 中有歧义的字符（# 会被当成锚点，? 会被当成查询串）+ 文件系统非法字符
    .replace(/[\p{Cc}<>:"/\\|?*#%]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 取正文第一个合格段落作为摘要，供首页卡片与 SEO 使用。
 * 标题、代码块、引用、列表、表格、图片、块级公式都不算合格段落。
 */
export function extractDescription(md, max = 80) {
  const segs = splitSegments(md);

  for (const seg of segs) {
    if (seg.type !== 'text') continue;

    for (const raw of seg.content.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (/^#{1,6}\s/.test(line)) continue;
      if (/^>/.test(line)) continue;
      if (/^[-*+]\s/.test(line)) continue;
      if (/^\d+\.\s/.test(line)) continue;
      if (/^\|/.test(line)) continue;
      if (/^!\[/.test(line)) continue;
      if (/^\$\$/.test(line)) continue;

      const plain = line
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        // 公式：只去掉 $ 定界符与 LaTeX 命令，保留内容。
        // 整段删掉会留下「给定  个数」这样的双空格残迹，卡片上很难看。
        .replace(/\$+/g, '')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[*_`~]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (plain.length < 10) continue;
      return plain.length > max ? plain.slice(0, max) + '…' : plain;
    }
  }
  return '';
}
```

- [ ] **Step 13: 运行全部测试**

```bash
node --test test/
```

预期：23 个测试全部 PASS。

> **这套测试的验证状况（如实记录）**：计划编写阶段把**原始**实现跑通过一遍（22 个用例）。**但那个实现里 `normalizeHeadings` 是错的**——它经由 `mapText` 逐段落计算平移量，代码块把文档切开后每段各算各的 `shift`，相对层级会被抹平（详见 Step 9 的注释）。
>
> 控制器已把它改成「先切段、按整篇统算 min、再回填」，并新增第 14 个用例专门守这个缺陷。**新实现已在全部 23 个用例上重跑通过，且新用例在旧实现上确认失败（两个方向都实测过）**。上面那个 `extractDescription` 的实现与其它函数均未改动。
>
> 因此若你执行时看到失败，**大概率是实现被改动过，而不是测试本身有问题**。

- [ ] **Step 14: 提交**

```bash
git add -A
git commit -m "feat: 同步脚本纯函数层与单元测试"
```

---

## Task 10: 同步脚本 —— CLI 与文件 I/O

**Files:**
- Create: `blog.config.json`, `scripts/lib/vault.mjs`, `scripts/sync-vault.mjs`

**Interfaces:**
- Consumes: Task 9 的 `transform.mjs` 全部导出
- Produces: `npm run sync` 命令；`src/content/blog/*.md` 由脚本生成

- [ ] **Step 1: 创建配置文件**

创建 `blog.config.json`：

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

换设备时只需改 `vaultPath` 一行。

- [ ] **Step 2: 创建 vault 读取层**

创建 `scripts/lib/vault.mjs`：

```js
// 与文件系统和 git 打交道的部分。纯转换逻辑在 transform.mjs，那里才是测试重点。
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** 递归列出目录下所有 .md 文件，返回相对 vaultPath 的 POSIX 风格路径。 */
export async function listMarkdown(vaultPath, relDir) {
  const abs = path.join(vaultPath, relDir);
  const out = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // 目录不存在，跳过
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue;
        await walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        out.push(path.relative(vaultPath, full).split(path.sep).join('/'));
      }
    }
  }

  await walk(abs);
  return out;
}

/**
 * 取文件在 git 中的首次提交日期（YYYY-MM-DD）。
 * 用首次而非最后一次：否则改个错别字，文章的发布时间就会跳到今天。
 */
export function gitFirstCommitDate(vaultPath, relPath) {
  try {
    const out = execFileSync(
      'git',
      ['-C', vaultPath, 'log', '--diff-filter=A', '--follow', '--format=%ad', '--date=short', '--', relPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const lines = out.trim().split('\n').filter(Boolean);
    // git log 默认新→旧，最后一行是最早的
    return lines.length > 0 ? lines[lines.length - 1] : null;
  } catch {
    return null;
  }
}

/** 兜底：文件系统修改时间。git 不可用或文件未提交时使用。 */
export async function fileMtimeDate(fullPath) {
  const st = await fs.stat(fullPath);
  return st.mtime.toISOString().slice(0, 10);
}
```

- [ ] **Step 3: 创建同步 CLI**

创建 `scripts/sync-vault.mjs`：

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { normalizeMath, normalizeHeadings, makeSlug, extractDescription } from './lib/transform.mjs';
import { listMarkdown, gitFirstCommitDate, fileMtimeDate } from './lib/vault.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'content', 'blog');

const config = JSON.parse(await fs.readFile(path.join(ROOT, 'blog.config.json'), 'utf8'));
const vaultPath = config.vaultPath;

/** 由目录路径推断分类：取匹配得最深的那条映射。 */
function categoryFor(relPath) {
  const parts = relPath.split('/');
  let best = null;
  let bestLen = -1;
  for (const [dir, cat] of Object.entries(config.categoryMap)) {
    const d = dir.split('/');
    if (d.length > bestLen && d.every((seg, i) => parts[i] === seg)) {
      best = cat;
      bestLen = d.length;
    }
  }
  return best ?? config.defaultCategory;
}

function buildFrontmatter(data) {
  const lines = ['---'];
  lines.push(`title: ${JSON.stringify(data.title)}`);
  lines.push(`date: ${data.date}`);
  lines.push(`category: ${data.category}`);
  lines.push(`tags: ${JSON.stringify(data.tags)}`);
  if (data.description) lines.push(`description: ${JSON.stringify(data.description)}`);
  lines.push(`sourcePath: ${JSON.stringify(data.sourcePath)}`);
  if (data.slug) lines.push(`slug: ${JSON.stringify(data.slug)}`);
  lines.push('---');
  return lines.join('\n');
}

// ---- 扫描 ----

const candidates = [];
for (const dir of config.publishDirs) {
  for (const rel of await listMarkdown(vaultPath, dir)) {
    candidates.push(rel);
  }
}

const published = [];
const skipped = [];

for (const rel of candidates) {
  const full = path.join(vaultPath, rel);
  const raw = await fs.readFile(full, 'utf8');
  let parsed;
  try {
    parsed = matter(raw);
  } catch (e) {
    console.warn(`[跳过] frontmatter 解析失败: ${rel} — ${e.message}`);
    continue;
  }

  if (parsed.data.publish !== true) {
    skipped.push(rel);
    continue;
  }

  const body = normalizeHeadings(normalizeMath(parsed.content));

  const filename = path.basename(rel);
  const title = parsed.data.title ?? filename.replace(/\.md$/i, '');
  const slug = parsed.data.slug ?? makeSlug(filename);
  const date =
    (await gitFirstCommitDate(vaultPath, rel)) ??
    parsed.data.date ??
    (await fileMtimeDate(full));

  published.push({
    rel,
    slug,
    frontmatter: buildFrontmatter({
      title,
      date,
      category: parsed.data.category ?? categoryFor(rel),
      tags: parsed.data.tags ?? [],
      description: parsed.data.description ?? extractDescription(body),
      sourcePath: rel,
      slug: parsed.data.slug,
    }),
    body,
  });
}

// ---- slug 冲突检测 ----

// 不同目录下的同名文件会产出同一个 slug（slug 只取文件名），后写的那篇会
// **静默覆盖**先写的那篇——等于凭空丢一篇文章，而且没有任何报错。
// 只警告不中断：一次小冲突不该挡住整次同步；警告至少让人当场看见。
const bySlug = new Map();
const collisions = [];
for (const p of published) {
  const prev = bySlug.get(p.slug);
  if (prev) {
    collisions.push(`${p.slug}: ${prev} ↔ ${p.rel}`);
    console.warn(`[警告] slug 冲突: "${p.slug}" ← ${prev} 与 ${p.rel}，后者会覆盖前者`);
  } else bySlug.set(p.slug, p.rel);
}

// ---- 写入 ----

await fs.mkdir(OUT_DIR, { recursive: true });

const existing = await fs.readdir(OUT_DIR).catch(() => []);
const wanted = new Set(published.map((p) => `${p.slug}.md`));

let added = 0;
let updated = 0;

for (const p of published) {
  const target = path.join(OUT_DIR, `${p.slug}.md`);
  const content = `${p.frontmatter}\n\n${p.body}\n`;
  const prev = await fs.readFile(target, 'utf8').catch(() => null);
  if (prev === content) continue;
  await fs.writeFile(target, content, 'utf8');
  if (prev === null) added++;
  else updated++;
}

// 源文件取消标记或已删除 → 清理旧副本
//
// 但有一条硬前提：本轮扫描真的读到了东西。
// listMarkdown 对读不到的目录是**静默跳过**的（vault.mjs 的 catch 里直接 return），
// 所以 vaultPath 写错、换设备忘了改、目录被改名，都会让 candidates 变成空数组，
// 于是 wanted 也空——清理循环就会把 src/content/blog/ 下所有非下划线文件判为多余并删掉。
// 此时删掉的不是「用户取消发布的文章」，而是**全部已生成的文章**。
// 这个状态和「一篇都没标记」在日志上几乎一样，区别只在后果。
// 空扫描一律不清理：宁可留下过期的副本，也不要在一无所获的一轮里删东西。
const removed = [];
if (candidates.length === 0) {
  console.log(`\n[已跳过清理] vault 目录不存在或白名单目录全空: ${vaultPath}`);
  console.log('  检查 blog.config.json 里的 vaultPath 与磁盘上的实际路径是否逐字符一致。');
} else {
  for (const f of existing) {
    if (!f.endsWith('.md')) continue;
    if (f.startsWith('_')) continue; // 下划线开头是手工样例，不动
    if (!wanted.has(f)) {
      await fs.rm(path.join(OUT_DIR, f));
      removed.push(f);
    }
  }
}

// ---- 报告 ----

console.log(`\n同步完成 (vault: ${vaultPath})`);
console.log(`  发布目录候选: ${candidates.length} 篇`);
console.log(`  已标记发布:   ${published.length} 篇  (新增 ${added} / 更新 ${updated})`);
console.log(`  已删除:       ${removed.length} 篇`);
removed.forEach((f) => console.log(`    - ${f}`));
if (collisions.length > 0) {
  console.log(`  !! slug 冲突: ${collisions.length} 处（后者已覆盖前者，等于丢文章）`);
  collisions.forEach((c) => console.log(`    ! ${c}`));
}

if (skipped.length > 0) {
  console.log(`\n  未标记 publish: true 而跳过: ${skipped.length} 篇`);
  skipped.slice(0, 20).forEach((f) => console.log(`    · ${f}`));
  if (skipped.length > 20) console.log(`    … 另有 ${skipped.length - 20} 篇`);
}
```

`skip` 清单必须打印——发布模型是显式 opt-in，如果不同时列出「在白名单目录里但没标记」的文件，忘记标记会成为一种长期静默的失败。

- [ ] **Step 4: 验证脚本能跑通（此时应为 0 篇）**

**先记下博客内容目录当前的样子——这一步不能省，理由见下。**

```bash
ls -1 src/content/blog/
```

```bash
npm run sync
```

```bash
ls -1 src/content/blog/
```

预期：输出「已标记发布: 0 篇」，随后列出所有未标记的文件；且**两次 `ls` 的输出逐字节相同**，其中包含 `_sample.md`。


**这个「临界状态」还有第二条到达路径，而且更危险。** `vaultPath` 写错时 `listMarkdown` 是**静默跳过**的（`vault.mjs` 里 `catch { return; }`），`candidates` 同样是空数组、`wanted` 同样空——但这一次目录里躺着的是**已经生成好的全部文章**，清理循环会把它们一次删光。所以 Step 3 的清理循环里加了一道守卫：**`candidates.length === 0` 时整段清理跳过，并打印 `[已跳过清理]`**。两条守卫各挡一个场景，**不能互相替代**：

| 守卫 | 挡住的场景 |
|---|---|
| `if (f.startsWith('_')) continue;` | vault **读得到**、但一篇都没标记（就是上面这个场景）——保住 `_sample.md` |
| `if (candidates.length === 0) { … } else { … }` | vault **读不到**（路径写错 / 目录改名）——保住全部已生成文章 |

本轮 `candidates` 是 36（vault 读得到），所以走的是 `else` 分支，第一条守卫才是保 `_sample.md` 的那条。换过 `vaultPath` 之后第一次 `npm run sync`，务必确认日志里**没有** `[已跳过清理]`。
**为什么必须对比前后两次 `ls`。** 这个脚本里有一段**会删文件**的清理逻辑：发布目录里不再出现的 slug，对应的副本会被 `fs.rm` 删掉。此刻 vault 里一篇都没标记，所以 `published` 是空的、`wanted` 是**空集合**——清理循环正好处于「把目录里所有 `.md` 都判为多余」的临界状态，**唯一挡住它的是那行 `if (f.startsWith('_')) continue;`**。

- 只断言「已标记发布: 0 篇」**完全看不出这件事**：日志逐字一样，而 `_sample.md` 已经没了——T5/T6/T7/T8 的**全部夹具**都挂在它身上，后面的任务会在莫名其妙的报错里空转很久。
- 这是本项目里**唯一一处破坏性操作**，跑之前先记快照是唯一能发现它的办法。
- 若两次 `ls` 不同（尤其是少了 `_sample.md`），去查 `sync-vault.mjs` 清理循环里那行下划线守卫。

若输出 `[已跳过清理] vault 目录不存在或白名单目录全空`，检查 `blog.config.json` 里的 `vaultPath` 与磁盘上的实际路径是否逐字符一致。**这条提示必须存在**：没有它的话，这条路径上的失败是**完全静默**的——`listMarkdown` 只是 `catch { return; }`，而「一篇都没扫描到」和「一篇都没标记」在日志上长得几乎一样，前者却会让清理循环删光 `src/content/blog/` 下所有非下划线文件。

- [ ] **Step 5: 验证脚本可重复执行（**这一步不验证幂等性**，见下）**

```bash
npm run build
npm run sync
```

预期：第二次 `npm run sync` 输出「新增 0 / 更新 0」。

**为什么这一步不能叫「验证幂等性」——它证明不了。** 此刻 `published` 是空集，所以「新增 0 / 更新 0」**在脚本写坏了的时候也照样成立**：一个从来没写入过任何文件的脚本，第二次运行时当然还是新增 0。这是一条**没有判别力的断言**。

它在这里唯一的作用是：确认脚本能重复执行、不报错、不抛异常。

**真正的幂等性（第二次运行不改动任何已生成文件）与「清理逻辑真的会删」这两件事，都只有在有已发布文章之后才测得出来**，已作为 T11 的 Step 5 落实在那里——**不要因为这里写着「新增 0 / 更新 0」就以为已经验过了。**

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: 同步脚本 CLI 与配置文件"
```

---

## Task 11: 首次迁移 36 篇

**Files:**
- Create: `scripts/check-math.mjs`
- Delete: `src/content/blog/_sample.md`
- Modify: Obsidian vault 中 36 个文件的 frontmatter（加 `publish: true`）

**Interfaces:**
- Consumes: Task 10 的 `npm run sync`
- Produces: `src/content/blog/` 中的 36 篇真实文章

- [ ] **Step 1: 创建公式检查脚本**

创建 `scripts/check-math.mjs`：

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { splitSegments } from './lib/transform.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'src', 'content', 'blog');

const files = (await fs.readdir(DIR).catch(() => []))
  .filter((f) => f.endsWith('.md') && !f.startsWith('_'));

const problems = [];

for (const f of files) {
  const raw = await fs.readFile(path.join(DIR, f), 'utf8');

  // 去掉 frontmatter
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
  const segs = splitSegments(body);

  let lineNo = 0;
  for (const seg of segs) {
    const startLine = lineNo;
    const n = seg.content.split('\n').length;
    lineNo += n;

    if (seg.type === 'code') continue;

    seg.content.split('\n').forEach((line, i) => {
      const at = startLine + i + 1;
      const dollars = (line.match(/(?<!\\)\$/g) ?? []).length;
      if (dollars % 2 !== 0) {
        problems.push(`${f}:${at}  行内 $ 数量为奇数（${dollars} 个）— ${line.trim().slice(0, 60)}`);
      }
      if (/\\\(/.test(line) && !/\\\)/.test(line)) {
        problems.push(`${f}:${at}  \\( 未闭合 — ${line.trim().slice(0, 60)}`);
      }
      if (/\\\[/.test(line) && !/\\\]/.test(line)) {
        problems.push(`${f}:${at}  \\[ 未闭合 — ${line.trim().slice(0, 60)}`);
      }
    });
  }

  // 检查残留的 Obsidian 专有语法
  if (/```ad-|^>\s*\[!/.test(body)) {
    problems.push(`${f}  含 Obsidian callout / admonition 语法，博客不渲染`);
  }
}

if (problems.length === 0) {
  console.log(`公式检查通过：${files.length} 篇，未发现问题。`);
  process.exit(0);
}

console.log(`公式检查发现 ${problems.length} 处问题：\n`);
problems.forEach((p) => console.log('  ' + p));
console.log('\n这些是源文件里的写法问题，需要在 Obsidian 里修正后重新 npm run sync。');
process.exit(1);
```

- [ ] **Step 2: 在 vault 里标记要发布的文件**

在 Obsidian 中打开下列路径下的 36 个文件，在**文件最开头**加入 frontmatter：

```yaml
---
publish: true
---
```

对应目录与数量：

| 目录 | 篇数 |
|---|---|
| `OI/算法/` 及其子目录 | 24 |
| `OI/游记/` | 4 |
| `文集/` | 3 |
| `项目/游戏/三眼枪/` | 4 |
| `学习/深度学习.md` | 1 |

**明确不标记的目录**：`OI/资料`、`OI/出题`、`OI/每日总结`、`任务/`、`docs/`、`日志/`、`简历/`、`回答.md`、`学习/光纤传感`。这些不在 `publishDirs` 白名单里，即使误加 `publish: true` 也不会被同步——**这是白名单和标记双重把关的意义**。

> 若某个文件已有 frontmatter，把 `publish: true` 加进去即可，不要新开一个 `---` 块。

- [ ] **Step 3: 删除样例文章**

```bash
rm src/content/blog/_sample.md
```

- [ ] **Step 4: 执行同步**

```bash
npm run sync
```

预期：`已标记发布: 36 篇 (新增 36 / 更新 0)`。

若数量不符，看输出的「未标记 publish: true 而跳过」清单，找出漏标的文件。

- [ ] **Step 5: 验证幂等性与清理路径（这两条在 T10 阶段做不到，只能在这里做）**

现在有 36 个真实文件了，两条**在 T10 时无法验证**的行为才测得出来。

**5a. 幂等性：第二次运行必须一个字节都不改。**

```bash
find src/content/blog -name '*.md' | sort | xargs sha256sum > /tmp/probe-before.txt
npm run sync
find src/content/blog -name '*.md' | sort | xargs sha256sum > /tmp/probe-after.txt
diff /tmp/probe-before.txt /tmp/probe-after.txt && echo '幂等：36 个文件逐字节未变'
```

预期：打印 `幂等：36 个文件逐字节未变`（`diff` 无输出、退出码 0），且 `npm run sync` 报 `新增 0 / 更新 0`。

**这条和 T10 Step 5 的区别就是它存在的理由**：T10 时 `published` 是空集，「新增 0 / 更新 0」**在脚本彻底坏掉时也照样成立**。现在有 36 个真实文件，**只有真的判定了「内容没变就不写」才会是 0**。`sha256sum` 那一层更严——它连「改写了但字节相同」都不放过。

**5b. 清理路径确实会删，而且只删该删的。**

这一步**故意制造一次「取消发布」**。确定性挑选目标，不靠人眼：

```bash
SLUG=$(ls -1 src/content/blog/*.md | sort | head -1 | xargs -n1 basename | sed 's/\.md$//')
SRC=$(grep -m1 '^sourcePath:' "src/content/blog/$SLUG.md" | sed 's/^sourcePath: *"//; s/"$//')
echo "目标 slug: $SLUG"
echo "vault 源文件: $SRC"
```

**去改 vault 里那个 `$SRC`**，把 `publish: true` 改成 `publish: false`，然后：

```bash
npm run sync
echo "剩余文章数: $(ls -1 src/content/blog/*.md | wc -l)"        # 应为 35
test -f "src/content/blog/$SLUG.md" && echo '!! 该篇没被删掉' || echo '清理生效：该篇已移除'
```

预期：`已删除: 1 篇`；文章数 **35**；打印 `清理生效：该篇已移除`。

**最后把 `$SRC` 改回 `publish: true` 并重跑 `npm run sync`**，确认文章数回到 **36**，且该篇的 `sha256sum` 与 `/tmp/probe-before.txt` 里那一行**逐字符相同**（位置相同、哈希相同）。

**为什么这条不能省。** 这是全项目**唯一一处破坏性操作**，而且到这一步为止**从没被执行过**：

- 一次都没跑过的删除代码，和一段注释没有区别。它可能**永远不删**（`wanted` 的比较写反、`existing` 取在了写入之后、slug 算错导致集合对不上），也可能**删过头**。
- **它删的不只是仓库里的文件**：发布模型是显式 opt-in，一篇笔记取消标记后如果副本还留在站点上，那是**私有内容继续公开可见**——不是排版问题，是内容泄露。这个项目的源 vault 里有不该公开的东西。
- 先看 `sourcePath` 再动手，是为了确保改的是 **vault 里那个源文件**，而不是博客仓库里的副本。改错副本会在下次同步时被直接覆盖回来，**你会以为测试通过了**。

- [ ] **Step 6: 运行公式检查**

```bash
npm run check:math
```

预期：理想情况下「公式检查通过」。**更可能的情况是列出若干问题**——这些是源文件里真实存在的写法错误（例如孤立未闭合的 `$$`）。逐条回到 Obsidian 修正，然后重跑 `npm run sync` 与 `npm run check:math`，直到通过。

- [ ] **Step 7: 构建并检查是否有 schema 错误**

```bash
npm run build
```

预期：构建成功。若报 `category` 校验失败，说明某个文件的目录没有匹配到 `categoryMap`，检查 `blog.config.json` 的目录拼写。

- [ ] **Step 8: 截图抽查三篇**

```bash
npm run preview
```

另开终端，用实际生成的 slug 替换下面的占位：

```bash
node scripts/shot.mjs "http://localhost:4321/" real-home dark
```

从首页截图里挑三篇不同分类的文章，逐一截图并检查：

1. 一篇算法笔记（应含公式和代码块）
2. 一篇游记（应主要是段落）
3. 一篇项目记录

对每篇确认：标题正确、日期不是今天、分类正确、公式渲染、代码块有行号和高亮。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat: 首次迁移 36 篇文章并加入公式检查脚本"
```

---

## Task 12: 搜索与评论

**Files:**
- Create: `src/components/Search.astro`, `src/components/Comments.astro`
- Modify: `package.json`（build 脚本追加 pagefind）、`src/layouts/BaseLayout.astro`（引入搜索）、`src/layouts/PostLayout.astro`（引入评论 + 给 `<article>` 加 `data-pagefind-body`）

**Interfaces:**
- Consumes: Task 11 生成的真实文章
- Produces: `/pagefind/` 索引、搜索框、giscus 评论区

- [ ] **Step 1: 创建搜索组件**

创建 `src/components/Search.astro`：

```astro
<div class="search" id="search">
  <input
    id="search-input"
    class="search-input"
    type="search"
    placeholder="搜索文章…"
    autocomplete="off"
  />
  <div class="search-results" id="search-results" hidden></div>
</div>

<style>
  .search { position: relative; margin-bottom: 20px; }
  .search-input {
    width: 100%;
    font-family: var(--sans);
    font-size: 14px;
    color: var(--tx);
    background: var(--card);
    border: 1px solid var(--bd);
    border-radius: 8px;
    padding: 9px 13px;
  }
  .search-input:focus { outline: none; border-color: var(--ac); }
  .search-results {
    position: absolute;
    z-index: 20;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    background: var(--card);
    border: 1px solid var(--bd);
    border-radius: 8px;
    max-height: 380px;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .28);
  }
  .sr-item { display: block; padding: 11px 14px; border-bottom: 1px solid var(--bd); }
  .sr-item:last-child { border-bottom: 0; }
  .sr-item:hover { background: var(--chip); text-decoration: none; }
  .sr-title { font-size: 13.5px; font-weight: 600; color: var(--tx); margin-bottom: 4px; }
  .sr-excerpt { font-size: 12px; line-height: 1.65; color: var(--mu); }
  .sr-excerpt mark { background: transparent; color: var(--ac); font-weight: 600; }
  .sr-empty { padding: 14px; font-size: 12.5px; color: var(--fa); }
</style>

<script>
  const input = document.getElementById('search-input');
  const panel = document.getElementById('search-results');

  // Pagefind 索引只在用户真正开始搜索时才加载，不影响首屏。
  let pagefind = null;

  async function ensure() {
    if (!pagefind) {
      // 构建期这个文件还不存在——pagefind 是在 astro build **跑完之后**才生成它的。
      // @vite-ignore 让 Vite 别去解析这个路径，原样留给运行时按站点根路径去取。
      pagefind = await import(/* @vite-ignore */ '/pagefind/pagefind.js');
      await pagefind.options({ excerptLength: 30 });
    }
    return pagefind;
  }

  let timer = null;

  input?.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    timer = setTimeout(async () => {
      if (q.length < 2) {
        panel.hidden = true;
        return;
      }
      const pf = await ensure();
      const res = await pf.search(q);
      const items = await Promise.all(res.results.slice(0, 8).map((r) => r.data()));

      panel.innerHTML = items.length
        ? items.map((d) => `<a class="sr-item" href="${d.url}"><div class="sr-title">${d.meta.title ?? d.url}</div><div class="sr-excerpt">${d.excerpt}</div></a>`).join('')
        : '<div class="sr-empty">没有找到匹配的文章</div>';
      panel.hidden = false;
    }, 180);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search')) panel.hidden = true;
  });
</script>
```

`/pagefind/pagefind.js` 是构建后由 Pagefind 生成的静态文件，**在 `npm run dev` 下不存在**，因此搜索只在 `build` + `preview` 后可测。

- [ ] **Step 2: 接入搜索并配置构建流程**

在 `src/pages/index.astro` 中，于 `<CategoryFilter />` 之前加入：

```astro
  <Search />
```

并在 frontmatter 中 import：

```js
import Search from '../components/Search.astro';
```

修改 `package.json` 的 build 脚本，让 Pagefind 在 Astro 构建后建立索引：

```json
"build": "astro build && pagefind --site dist",
```

Pagefind 会扫描 `dist/` 里的 HTML，把索引写入 `dist/pagefind/`。

**必须显式圈定索引范围，别信「默认只收正文」。** Pagefind 官方文档原文是
*"By default, Pagefind starts indexing from your `<body>` element."* —— 默认根是
`<body>`，**不是** `<main>`，**也不是** `<article>`。而本站的 `<main class="shell">`
（`BaseLayout.astro:39`）包住的不只是正文：首页/标签页/归档页的**卡片列表**、
文章页的**目录**、**上一篇/下一篇**、**评论占位文案**，全都落在里面。

不圈的后果：搜一个词，`/`、`/tags/知识`、`/archive` 的卡片列表**各自成为一条结果**
并且排在文章前面；搜「giscus」会命中**全部**文章页（评论占位文案里就有这个词）。

所以给 `src/layouts/PostLayout.astro` 的 `<article>` 加上 `data-pagefind-body`：

```astro
    <article data-pagefind-body>
```

文档原文正是推荐这个做法：*"if you tag your blog post layout with `data-pagefind-body`,
other pages like your homepage will no longer appear in search results. **This is
usually what you want.**"* 目录、上下篇、评论占位都是 `<article>` 的**兄弟节点**，
自动被排除，不需要再逐个加 `data-pagefind-ignore`。

**代价（知情接受）**：首页、标签页、关于页从此不出现在搜索结果里。哪天想让关于页可搜，
给它也加一个 `data-pagefind-body` 即可。

- [ ] **Step 3: 验证搜索**

```bash
npm run build
```

```bash
npm run preview
```

另开终端：

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));await p.goto('http://localhost:4321/');const title=(await p.textContent('.card-title')).trim();const q=title.slice(0,4);await p.fill('#search-input',q);await p.waitForTimeout(2000);const paths=await p.\$\$eval('.sr-item',xs=>xs.map(x=>new URL(x.href).pathname));console.log('查询词:',q,'| 结果数:',paths.length);console.log('结果路径:',JSON.stringify(paths));console.log('全部是文章页:',paths.length>0&&paths.every(u=>u.startsWith('/posts/')));console.log('页面错误:',errs.length?errs:'无');await p.screenshot({path:'.shots/search.png'});await b.close();})"
```

预期：`结果数` > 0、**`全部是文章页: true`**、`页面错误: 无`。

- **`全部是文章页` 才是能分辨配置对错的那一条。** 忘了给 `<article>` 加 `data-pagefind-body`
  时，`结果路径` 里会出现 `/`、`/tags/...`、`/archive`，它变 `false`；而 `结果数` 那一条
  **配错时一样为真**——首页和各标签页的卡片列表本身就够凑出一个正数。
  **只断言 `结果数 > 0` 等于没断言。**
- 查询词是从首页第一张卡的标题里**现取**的前 4 个字，不写死。写死（比如 `'动态规划'`）
  就会引入一个没人验证过的依赖：「那 36 篇里到底有没有这个词」。
- 若 `结果数: 0`，先看打印出来的 `查询词` 是不是不足 2 个字（输入框在 `q.length < 2` 时
  直接不搜）；再看 `dist/pagefind/` 目录是否存在。不存在说明 `pagefind` 没装好或 build 脚本没生效。

- [ ] **Step 4: 创建评论组件**

创建 `src/components/Comments.astro`：

```astro
---
// giscus 配置。两个 ID 需要用户从 https://giscus.app 获取后填入。
const REPO = 'lsc188zq/lsc188zq.github.io';
const REPO_ID = 'REPLACE_WITH_REPO_ID';
const CATEGORY_ID = 'REPLACE_WITH_CATEGORY_ID';

const configured = !REPO_ID.startsWith('REPLACE') && !CATEGORY_ID.startsWith('REPLACE');
---
{
  configured ? (
    <section class="comments">
      <div class="comments-title">评论</div>
      <script
        is:inline
        src="https://giscus.app/client.js"
        data-repo={REPO}
        data-repo-id={REPO_ID}
        data-category="Announcements"
        data-category-id={CATEGORY_ID}
        data-mapping="pathname"
        data-strict="1"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="top"
        data-theme="preferred_color_scheme"
        data-lang="zh-CN"
        data-loading="lazy"
        crossorigin="anonymous"
        async
      />
    </section>
  ) : (
    <section class="comments-placeholder">
      评论区尚未配置。参见设计文档第 10.3 节，在 https://giscus.app 获取
      <code>data-repo-id</code> 与 <code>data-category-id</code> 后填入
      <code>src/components/Comments.astro</code>。
    </section>
  )
}

<style>
  .comments { margin-top: 34px; padding-top: 20px; border-top: 1px solid var(--bd); }
  .comments-title {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: .12em;
    color: var(--fa);
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .comments-placeholder {
    margin-top: 34px;
    padding: 20px;
    border: 1px dashed var(--bd);
    border-radius: 9px;
    color: var(--fa);
    font-size: 12.5px;
    line-height: 1.8;
  }
  .comments-placeholder code {
    font-family: var(--mono);
    background: var(--chip);
    border: 1px solid var(--bd);
    border-radius: 4px;
    padding: 1px 5px;
  }
</style>
```

未配置 ID 时渲染占位说明而非空白——**空白会让人以为功能坏了**，而占位符直接告诉你怎么修。

- [ ] **Step 5: 接入评论区**

在 `src/layouts/PostLayout.astro` 中，于 `<CodeEnhance />` 之前加入：

```astro
      <Comments />
```

并在 frontmatter 中 import：

```js
import Comments from '../components/Comments.astro';
```

- [ ] **Step 6: 验证占位符渲染**

```bash
npm run build
```

```bash
npm run preview
```

另开终端：

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();await p.goto('http://localhost:4321/');const href=await p.getAttribute('.card-title a','href');await p.goto('http://localhost:4321'+href);const has=await p.\$\$eval('.comments-placeholder',n=>n.length);console.log('占位提示:',has?'已显示':'未显示');await b.close();})"
```

预期：`占位提示: 已显示`。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: Pagefind 搜索与 giscus 评论区"
```

---

## Task 13: 关于页、404 与部署

**Files:**
- Create: `src/pages/about.astro`, `src/pages/404.astro`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: 全部前序任务
- Produces: 可部署的完整站点

- [ ] **Step 1: 创建关于页占位**

创建 `src/pages/about.astro`：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import '../styles/prose.css';
---
<BaseLayout title="关于">
  <div class="about">
    <div class="prose">
      <h2>关于</h2>
      <p>这个页面还没有写。</p>
      <p>编辑 <code>src/pages/about.astro</code>，把上面这段替换成你自己的内容即可。</p>
    </div>
  </div>
</BaseLayout>

<style>
  .about { max-width: 720px; margin: 0 auto; }
</style>
```

**不要从 `简历/林尚灿.md` 生成这个页面。** 那个文件含手机号、邮箱、学校等个人信息，且仓库是公开的。用户明确表示会自行撰写。

- [ ] **Step 2: 创建 404 页**

创建 `src/pages/404.astro`：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="页面不存在">
  <div class="nf">
    <div class="nf-code">404</div>
    <p class="nf-msg">这里没有东西。</p>
    <a class="nf-link" href="/">← 回首页</a>
  </div>
</BaseLayout>

<style>
  .nf { text-align: center; padding: 80px 0; }
  .nf-code {
    font-family: var(--mono);
    font-size: 56px;
    font-weight: 700;
    color: var(--bd);
    line-height: 1;
    margin-bottom: 18px;
  }
  .nf-msg { color: var(--mu); font-size: 14px; margin: 0 0 22px; }
  .nf-link { font-family: var(--mono); font-size: 12.5px; }
</style>
```

- [ ] **Step 3: 创建部署工作流**

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

`npm ci` 要求仓库里有 `package-lock.json`。**确认它已被提交**（`.gitignore` 里不能有它）。

- [ ] **Step 4: 本地完整构建验证**

```bash
rm -rf dist
npm run build
```

预期：构建成功，且 `dist/` 下同时存在文章页与 `pagefind/` 目录。

```bash
ls dist/ dist/pagefind/ | head -20
```

- [ ] **Step 5: 全站截图巡检**

```bash
npm run preview
```

另开终端，按设计文档 12.2 的验收清单逐项截图确认：

```bash
node scripts/shot.mjs "http://localhost:4321/" final-home dark
node scripts/shot.mjs "http://localhost:4321/" final-home light
node scripts/shot.mjs "http://localhost:4321/tags" final-tags dark
node scripts/shot.mjs "http://localhost:4321/about" final-about dark
node scripts/shot.mjs "http://localhost:4321/404" final-404 dark
```

逐项核对设计文档 12.2 的清单：36 篇生成、标题日期分类正确、公式全部渲染、长代码块折叠、目录锚点可点、主题切换保持、筛选正常、窄屏无错位、搜索有结果。

**窄屏单独验证一次**：

```bash
node -e "import('playwright-core').then(async({chromium})=>{const b=await chromium.launch({channel:'msedge'});const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});await p.goto('http://localhost:4321/');await p.screenshot({path:'.shots/mobile-home.png',fullPage:true});await b.close();})"
```

确认卡片变成单列、导航不溢出。

**核对 JavaScript 预算**（全局约束：自有 JS ≤ ~90 行 / 3 KB，**不含 `pagefind/`**）。

这条必须**同时**跨过内联与打包两类脚本。注意「只数内联脚本」是测不出预算的——自家的主题切换、分类筛选、目录高亮、代码复制/折叠**全部是打包后的外部 `.js`**，页面上唯一的内联脚本只有 `<head>` 里那个 FOUC IIFE。所以下面这条命令按**文件**列出并累加：

```bash
node -e "import('fs').then(async fs=>{const out=[];async function walk(d){for(const e of await fs.readdirSync(d,{withFileTypes:true})){const f=d+'/'+e.name;if(e.isDirectory())await walk(f);else if(e.name.endsWith('.js')&&!f.includes('pagefind')){const s=fs.readFileSync(f,'utf8');out.push([f,s.split('\n').filter(l=>l.trim()).length,fs.statSync(f).size]);}}}await walk('dist');out.sort((a,b)=>b[2]-a[2]);let L=0,B=0;for(const[f,l,b]of out){L+=l;B+=b;console.log(String(l).padStart(5)+' 行 '+String((b/1024).toFixed(1)).padStart(7)+' KB  '+f);}console.log('-----');console.log('自有 JS 合计: '+L+' 行 / '+(B/1024).toFixed(1)+' KB');})"
```

预期：合计 **≤ 90 行 / ≤ 3 KB**。**判据是体积**——超过 3 KB 才算失控；行数只作参考。

若列表里出现了**你不认识的文件**（例如某个 Astro 注入的 runtime chunk），**原样报上来，不要自行归类为"第三方、不计入"**——那正是这条检理想的漏掉的东西。

再单独确认一次内联脚本（只为证明 FOUC 脚本确实是内联的，不是拿来当预算的）：

```bash
node -e "import('fs').then(fs=>{const h=fs.readFileSync('dist/index.html','utf8');const m=[...h.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];let n=0;for(const x of m)n+=x[1].split('\n').filter(l=>l.trim()).length;console.log('首页内联脚本行数:',n);})"
```

预期：**个位数**（只有 FOUC 那个 IIFE，约 8 行）。若这里冒出二十几行，说明有脚本没被打包而是内联进了页面——那要查清楚，别当好事。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: 关于页占位、404 页与 GitHub Pages 部署工作流"
```

- [ ] **Step 7: 交付给用户推送**

本地工作到此结束。**由用户执行 `git push`**（分工约定：Claude 写本地仓库，用户推送）。

推送后需在 GitHub 网页端完成的操作，参见设计文档第 15 节。

---

## 附：已知的中间状态

以下状态在任务推进过程中会出现，都是**预期的**，不要顺手修复：

| 出现在 | 状态 | 何时消失 |
|---|---|---|
| Task 4 Step 4 之后、Task 6 Step 4 之前 | 公式失去样式（临时 CDN link 被删，本地样式尚未接入） | Task 6 Step 4 |
| Task 2–10 期间 | 只有 `_sample.md` 一篇样例，首页只有 1 张卡片 | Task 11 |
| Task 12 Step 4 之后 | 评论区显示占位说明而非真实评论框 | 用户填入 giscus ID 后 |
| 任何时刻 | `npm run dev` 下搜索框点了没反应 | 搜索只在 build + preview 后可用 |
