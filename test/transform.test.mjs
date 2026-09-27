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
