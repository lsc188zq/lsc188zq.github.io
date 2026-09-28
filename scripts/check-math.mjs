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
