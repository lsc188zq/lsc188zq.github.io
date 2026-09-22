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
