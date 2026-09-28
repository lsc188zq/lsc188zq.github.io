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
  let fenceLen = 0;

  const fenceMatch = (line) => line.match(/^\s*(`{3,}|~{3,})/);
  // 闭合围栏：整行只有围栏、允许首尾空白，不能带 info string。
  // 与开启围栏分开判定——'```js' 这种整行不是纯围栏，不构成闭合。
  const fenceClose = (line) => line.match(/^\s*(`{3,}|~{3,})\s*$/);

  for (const line of lines) {
    const m = fenceMatch(line);

    if (!inFence && m) {
      if (buf.length) {
        segs.push({ type: 'text', content: buf.join('\n') });
        buf = [];
      }
      inFence = true;
      fenceChar = m[1][0];
      fenceLen = m[1].length;
      buf.push(line);
      continue;
    }

    if (inFence) {
      buf.push(line);
      const c = fenceClose(line);
      // 闭合围栏必须：与开启围栏同种字符，且不短于开启围栏（CommonMark）。
      // 少这两条里的任意一条，围栏内的内容就会被提前切成正文段，
      // 随之被 normalizeMath 之类的改写静默破坏——改坏了代码，却不报错。
      if (c && c[1][0] === fenceChar && c[1].length >= fenceLen) {
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
              // 正文来自 vault，多为 CRLF：按 '\n' 切行后每行尾随一个 '\r'。
              // 匹配前先摘掉它——`.*` 不匹配 '\r'、`$` 又没有 m 标志（只在整串末尾成立），
              // 带着 '\r' 的行一行都匹配不上，函数会「检测到要平移」却一字不改地静默返回。
              // 摘下的 '\r' 必须原样拼回：每一行的行尾序列（\r\n / \n）不得被改写。
              const cr = line.endsWith('\r') ? '\r' : '';
              const core = cr ? line.slice(0, -1) : line;
              const m = core.match(/^(#{1,6})(\s.*)$/);
              if (!m) return line;
              const lv = Math.min(6, Math.max(1, m[1].length + shift));
              return '#'.repeat(lv) + m[2] + cr;
            })
            .join('\n')
        : seg.content
    )
    .join('\n');
}

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
 * 取正文第一个合格行作为摘要，供首页卡片与 SEO 使用。
 * 标题、代码块、引用、列表、表格、图片、块级公式都不算合格行。
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
        // 整行删掉会留下「给定  个数」这样的双空格残迹，卡片上很难看。
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

/**
 * 剥离正文开头的 Obsidian 标签行（如 `#DP #单调队列`），返回标签数组与剩余正文。
 *
 * 判据：整行 trim 后按空白切分，**每个 token 都形如 `#` + 非空白非 `#` 的字符**才算标签行。
 * 于是两种「以 # 开头但不是标签」的行不会被误吃：
 *   - `## 题目描述`：切出来第二个 token 是 `题目描述`，不以 `#` 开头；
 *   - `#include <iostream>`：第二个 token 是 `<iostream>`，不以 `#` 开头。
 *
 * 连续多行标签行一并吃掉；标签按出现顺序**去重**——同一篇里出现两次同名标签，
 * 会让标签云显示的篇数与标签详情页列出的篇数对不上。
 *
 * **没有标签行时 body 与入参逐字节相同**，同步脚本靠这条保证幂等（第二次运行必须
 * 产出同样内容，否则每次都会判定「有更新」而重写全部文件）。
 * 注意 split('\n') 会把 CRLF 的 `\r` 留在各行末尾、join('\n') 又原样拼回，
 * 所以换行符不被改动——**不要**改成 split(/\r?\n/)。
 */
export function splitLeadingTags(md) {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  const tags = [];
  const seen = new Set();
  let j = i;
  while (j < lines.length) {
    const tokens = lines[j].trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || !tokens.every((t) => /^#[^\s#]/.test(t))) break;
    for (const t of tokens) {
      const name = t.slice(1);
      if (!seen.has(name)) { seen.add(name); tags.push(name); }
    }
    j++;
  }

  if (j === i) return { tags: [], body: md };
  return { tags, body: lines.slice(0, i).concat(lines.slice(j)).join('\n') };
}
