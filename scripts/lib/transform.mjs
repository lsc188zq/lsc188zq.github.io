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
