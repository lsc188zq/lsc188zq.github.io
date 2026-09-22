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

// 浏览器对任何页面都会自动请求 /favicon.ico；页面没有图标时 preview 返回 404，
// 这是预期的工具噪声（见 progress.md Ruling 4）。只忽略路径恰为 /favicon.ico 的失败，
// 判断依据是 location 而非 text（404 的 console error 文本里不含 URL）。
// 其它任何错误一律照旧收集，不影响下面的 exit 1。
const isFaviconRequest = m => {
  try {
    return new URL(m.location()?.url ?? '').pathname === '/favicon.ico';
  } catch {
    return false;
  }
};

const errors = [];
let ignoredFavicons = 0;
page.on('console', m => {
  if (m.type() !== 'error') return;
  if (isFaviconRequest(m)) { ignoredFavicons++; return; }
  errors.push(m.text());
});
page.on('pageerror', e => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });
await page.evaluate(t => localStorage.setItem('theme', t), theme);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);

const file = path.join(outDir, `${name}-${theme}.png`);
await page.screenshot({ path: file, fullPage: true });
await browser.close();

console.log(`截图: ${file}`);
if (ignoredFavicons > 0) {
  console.log(`已忽略: /favicon.ico 404（占位页无图标，Ruling 4）${ignoredFavicons > 1 ? ` ×${ignoredFavicons}` : ''}`);
}
if (errors.length) {
  console.log('页面错误:');
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}
