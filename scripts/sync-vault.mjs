import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { normalizeMath, normalizeHeadings, makeSlug, extractDescription, splitLeadingTags } from './lib/transform.mjs';
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

  // 标签行在正规化之前剥掉。今天的两个正规化函数都不会碰这一行
  // （normalizeMath 只改 \( \) 与 \[ \]；normalizeHeadings 要求 `#` 后有空格才当标题），
  // 所以先后顺序今天不影响结果——先剥是为了让「正文」进入这两个函数时已经是干净的正文。
  const { tags: vaultTags, body: rawBody } = splitLeadingTags(parsed.content);
  const body = normalizeHeadings(normalizeMath(rawBody));

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
      tags: parsed.data.tags ?? vaultTags,
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
