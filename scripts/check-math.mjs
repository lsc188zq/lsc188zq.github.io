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

  // 去掉 frontmatter。
  // 行号要按**文件真实行号**报，所以得记住 frontmatter 占了几行——否则报出来的
  // 位置比实际少一个 frontmatter 的长度（本批 31 篇差 8 行；另 5 篇没有 description、
  // frontmatter 少一行，差 7 行——所以这里必须**按篇现量**，写死一个数就会错），
  // 拿着行号去 Obsidian 里找会找错地方。
  const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n/);
  const fmLines = fmMatch ? fmMatch[0].split('\n').length - 1 : 0;
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
  const segs = splitSegments(body);

  let lineNo = 0;
  for (const seg of segs) {
    const startLine = lineNo;
    const n = seg.content.split('\n').length;
    lineNo += n;

    if (seg.type === 'code') continue;

    seg.content.split('\n').forEach((line, i) => {
      const at = fmLines + startLine + i + 1;
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

  // 检查残留的 Obsidian 专有语法。
  // **`m` 标志不能省**：没有它 `^` 只匹配整个字符串的开头，而 body 剥掉 frontmatter 后
  // 首字符是换行（生成文件是 `---\n…\n---\n\n正文`），所以 `^>` 这一支**一次都不可能命中**
  // ——callout 检查会变成摆设。`^` 那一支必须配 `m`，`` ```ad- `` 那一支不需要。
  if (/```ad-|^>\s*\[!/m.test(body)) {
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
