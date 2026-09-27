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

test('extractDescription 跳过标题与代码块取第一行正文', () => {
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

test('extractDescription 跳过代码段，找不到合格行时返回空串', () => {
  // 负路径：代码行本身足够长（14 字），所以它落空只能是「跳过代码段」造成的，
  // 不是被 < 10 的字数门槛滤掉的。原用例用的是 'int x;'（6 字），
  // 删掉 if (seg.type !== 'text') continue; 也照样通过——那是假防护。
  assert.equal(extractDescription('```cpp\nint x = 12345;\n```'), '');
  // 正对照：同一行内容去掉围栏后必须被选中，证明上面的空串不是门槛造成的
  assert.equal(extractDescription('int x = 12345;'), 'int x = 12345;');
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

// ---- 评审修复轮补的用例：每条都对应一个具体的、实测可见的坏法 ----

test('splitSegments 的闭合围栏必须与开启围栏同种字符', () => {
  const md = ['```', 'a', '~~~', '```'].join('\n');
  const segs = splitSegments(md);
  assert.deepEqual(segs.map((s) => s.type), ['code']);
});

test('splitSegments 识别带前导空白的围栏', () => {
  const md = ['正文', '   ```cpp', '   int x = 1;', '   ```', '结尾'].join('\n');
  const segs = splitSegments(md);
  assert.deepEqual(segs.map((s) => s.type), ['text', 'code', 'text']);
});

test('splitSegments 的闭合围栏必须不短于开启围栏、且整行只有围栏', () => {
  // 长度：4 反引号开启的围栏里，一行 3 反引号按 CommonMark 不构成闭合
  const long = ['````', '```', '正文里的 \\(x\\)', '````'].join('\n');
  assert.deepEqual(splitSegments(long).map((s) => s.type), ['code']);
  // 后果：那行 3 反引号若被当成闭合，后面的内容就落到正文段被静默改写
  assert.equal(normalizeMath(long), long);
  // info string：带 info string 的整行（如 '```js'）不构成闭合
  const info = ['```', 'x', '```js', '```'].join('\n');
  assert.deepEqual(splitSegments(info).map((s) => s.type), ['code']);
});

test('mapText 恒等回调下多段往返保形', () => {
  const md = ['正文一', '```cpp', 'int x = 1;', '```', '正文二'].join('\n');
  assert.equal(mapText(md, (t) => t), md);
});

test('normalizeMath 的同种定界符之间不互相吞并（非贪婪）', () => {
  assert.equal(normalizeMath('\\[a\\]\n\n\\[b\\]'), '$$a$$\n\n$$b$$');
  assert.equal(normalizeMath('\\(a\\) 与 \\(b\\)'), '$a$ 与 $b$');
});

test('makeSlug 的后处理：折叠连字符、剥除首尾、只剥末尾的 .md', () => {
  assert.equal(makeSlug('a - b.md'), 'a-b');
  assert.equal(makeSlug('-a-.md'), 'a');
  assert.equal(makeSlug('note.md.bak'), 'note.md.bak');
});

test('extractDescription 的 10 字门槛在边界两侧的行为', () => {
  // 正好 10 字：接受（判定是「< 10 才跳过」）
  const ten = '一二三四五六七八九十';
  assert.equal(extractDescription(ten), ten);
  // 9 字：跳过，结果落回后面那一行
  const nine = '一二三四五六七八九';
  const longer = '这是一行足够长的正文内容。';
  assert.equal(extractDescription(nine + '\n' + longer), longer);
});

test('extractDescription 跳过引用行与块级公式，并剥掉 LaTeX 命令', () => {
  const md = [
    '> 引用行内容足够长也不该被选中。',
    '$$这是块级公式也不该被选中。$$',
    '给定 \\log n 的复杂度说明，足够长。',
  ].join('\n');
  assert.equal(extractDescription(md), '给定 n 的复杂度说明，足够长。');
});
