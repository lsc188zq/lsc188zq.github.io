// 与文件系统和 git 打交道的部分。纯转换逻辑在 transform.mjs，那里才是测试重点。
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** 递归列出目录下所有 .md 文件，返回相对 vaultPath 的 POSIX 风格路径。 */
export async function listMarkdown(vaultPath, relDir) {
  const abs = path.join(vaultPath, relDir);
  const out = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // 目录不存在，跳过
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue;
        await walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        out.push(path.relative(vaultPath, full).split(path.sep).join('/'));
      }
    }
  }

  await walk(abs);
  return out;
}

/**
 * 取文件在 git 中的首次提交日期（YYYY-MM-DD）。
 * 用首次而非最后一次：否则改个错别字，文章的发布时间就会跳到今天。
 */
export function gitFirstCommitDate(vaultPath, relPath) {
  try {
    const out = execFileSync(
      'git',
      ['-C', vaultPath, 'log', '--diff-filter=A', '--follow', '--format=%ad', '--date=short', '--', relPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const lines = out.trim().split('\n').filter(Boolean);
    // git log 默认新→旧，最后一行是最早的
    return lines.length > 0 ? lines[lines.length - 1] : null;
  } catch {
    return null;
  }
}

/** 兜底：文件系统修改时间。git 不可用或文件未提交时使用。 */
export async function fileMtimeDate(fullPath) {
  const st = await fs.stat(fullPath);
  return st.mtime.toISOString().slice(0, 10);
}
