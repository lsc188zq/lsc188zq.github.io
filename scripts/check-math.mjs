import fs from 'node:fs/promises';
import path from 'node:path';
import { splitSegments } from './lib/transform.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'src', 'content', 'blog');

// 目录读不到时**必须报错退出**：原来 `readdir(DIR).catch(() => [])` 把「目录不存在」
// 静默吞成空数组，再打印「通过：0 篇」——检查根本没跑，输出却是一片绿。
let names;
try {
  names = await fs.readdir(DIR);
} catch (e) {
  const why = e.code === 'ENOENT' ? '目录不存在' : `目录读不了（${e.code}）`;
  console.error(`公式检查无法运行：${why} — ${DIR}`);
  console.error('同步脚本没跑过？先 npm run sync 再检查。');
  process.exit(2);
}

const files = names.filter((f) => f.endsWith('.md') && !f.startsWith('_'));

// 空目录同理：一篇都没检查，就不许说「通过」。派生目录为空说明同步没跑或跑坏了。
if (files.length === 0) {
  console.error(`公式检查无法运行：目录里没有可检查的 .md 文件（0 篇）— ${DIR}`);
  console.error('空目录意味着同步没跑或跑坏了，此时的「通过」是假的——先 npm run sync。');
  process.exit(2);
}

// 退出码约定：0 = 通过；1 = 跑成了、发现了问题；2 = 根本没跑成（环境问题）。

const problems = [];

for (const f of files) {
  const raw = await fs.readFile(path.join(DIR, f), 'utf8');

  // 去掉 frontmatter。
  // 行号要按**文件真实行号**报，所以得记住 frontmatter 占了几行——否则报出来的
  // 位置比实际少一个 frontmatter 的长度（本批 31 篇差 8 行；另 5 篇没有 description、
  // frontmatter 少一行，差 7 行——所以这里必须**按篇现量**，写死一个数就会错），
  // 拿着行号去 Obsidian 里找会找错地方。
  // body 从同一份 fmMatch 上 slice，frontmatter 正则不再写第二遍——两处各写一遍时，
  // 哪天只改一处，行号基准就会换个形式复发。
  const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n/);
  const fmLines = fmMatch ? fmMatch[0].split('\n').length - 1 : 0;
  const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;
  const segs = splitSegments(body);

  // 逐行检查的结果先攒着，和 `$$` 的结论合并去重后统一按行号顺序输出。
  const fileProbs = [];
  const dd = []; // 正文段里未被转义的 `$$` 出现（{ at, text }）

  let lineNo = 0;
  for (const seg of segs) {
    const startLine = lineNo;
    const n = seg.content.split('\n').length;
    lineNo += n;

    if (seg.type === 'code') continue;

    seg.content.split('\n').forEach((line, i) => {
      const at = fmLines + startLine + i + 1;
      const text = line.trim().slice(0, 60);
      const dollars = (line.match(/(?<!\\)\$/g) ?? []).length;
      if (dollars % 2 !== 0) {
        fileProbs.push({ at, kind: 'dollar', msg: `${f}:${at}  行内 $ 数量为奇数（${dollars} 个）— ${text}` });
      }
      if (/\\\(/.test(line) && !/\\\)/.test(line)) {
        fileProbs.push({ at, kind: 'paren', msg: `${f}:${at}  \\( 未闭合 — ${text}` });
      }
      if (/\\\[/.test(line) && !/\\\]/.test(line)) {
        fileProbs.push({ at, kind: 'bracket', msg: `${f}:${at}  \\[ 未闭合 — ${text}` });
      }
      // 块级定界符要单独数：逐行 `$` 奇偶对 `$$` 是盲的（2 个 = 偶数），一行 `$$`
      // 的未闭合它永远报不出来。只数正文段——代码段在上面已经 continue 了。
      const ddN = (line.match(/(?<!\\)\$\$/g) ?? []).length;
      for (let k = 0; k < ddN; k++) dd.push({ at, text });
    });
  }

  // 未被转义的 `$$` 总数为奇数 = 有未闭合的块级公式。贪心配对下（第 1、2 个配成一对），
  // 落单的总是最后一个，报它的行；只出现 1 个时，它自己就是那个未闭合的开定界符。
  if (dd.length % 2 !== 0) {
    const last = dd[dd.length - 1];
    // 同一行不要报两条：`$$$x`（`$$` + `$`，共 3 个 `$`）会被两条检查同时命中。
    // 选定的优先级：**报 `$$` 未闭合、压掉同一行那条 `$` 奇偶**——它更精确，点明了
    // 落单的是块定界符；同一行报两条是同一根因数了两遍。只压 kind: 'dollar'，
    // `\(` / `\[` 是别的缺陷，不受影响。
    for (let k = fileProbs.length - 1; k >= 0; k--) {
      if (fileProbs[k].kind === 'dollar' && fileProbs[k].at === last.at) fileProbs.splice(k, 1);
    }
    fileProbs.push({ at: last.at, kind: 'dd', msg: `${f}:${last.at}  $$ 未闭合 — ${last.text}` });
  }

  // 残留的 Obsidian 专有语法：逐行扫、报**第一处命中**的行号。
  // 逐行判定时每行各自是单行字符串，`^` 天然匹配行首——上一轮「整段扫 + 缺 m 标志 →
  // `^>` 那支一次都命不中」的形态从结构上不再可能；而整段 `test` 只知道「有」，
  // 报不出行号（规格 5.4 要求 `xxx.md:42` 这种定点格式）。
  // 扫描范围与原实现一致（整个 body，不限正文段）：` ```ad- ` 与 `> [!` 都算。
  const bodyLines = body.split('\n');
  for (let j = 0; j < bodyLines.length; j++) {
    if (/^\s*>\s*\[!/.test(bodyLines[j]) || /```ad-/.test(bodyLines[j])) {
      const at = fmLines + j + 1;
      fileProbs.push({ at, kind: 'callout', msg: `${f}:${at}  含 Obsidian callout / admonition 语法，博客不渲染` });
      break;
    }
  }

  fileProbs.sort((a, b) => a.at - b.at);
  problems.push(...fileProbs.map((p) => p.msg));
}

if (problems.length === 0) {
  console.log(`公式检查通过：${files.length} 篇，未发现问题。`);
  process.exit(0);
}

console.log(`公式检查发现 ${problems.length} 处问题：\n`);
problems.forEach((p) => console.log('  ' + p));
console.log('\n这些是源文件里的写法问题，需要在 Obsidian 里修正后重新 npm run sync。');
process.exit(1);
