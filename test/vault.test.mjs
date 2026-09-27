// scripts/lib/vault.mjs 的单元测试。
//
// 为什么这一层也值得测：T10 的执行路径里，主循环在 `publish !== true` 处 continue，
// 而此刻 vault 里一篇都没标记，所以日期逻辑（gitFirstCommitDate / fileMtimeDate）
// 在整个 T10 里一次都执行不到；listMarkdown 的三个失败面（读不到的目录、
// 隐藏目录、非 .md）在真实 vault 上也不会同时出现。这些只能靠单元测试覆盖。
//
// 夹具全部是临时目录里现造的假数据，**不含任何真实 vault 内容或个人信息**。
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { listMarkdown, gitFirstCommitDate, fileMtimeDate } from '../scripts/lib/vault.mjs';

const tmpRoots = [];

/** 造一个临时「库根」，路径刻意带空格（本机真实 vaultPath 就含空格）。返回的是库根，不是它的父目录。 */
function makeTmpVault() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-vault-test-'));
  tmpRoots.push(parent);
  const vault = path.join(parent, 'fake vault');
  fs.mkdirSync(vault);
  return vault;
}

after(() => {
  for (const r of tmpRoots) fs.rmSync(r, { recursive: true, force: true });
});

// 本机没有 git 时，git 相关用例 skip 而不是红——它们测的是调用方式，不是「git 一定存在」。
let gitOk = true;
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' });
} catch {
  gitOk = false;
}

/** 在夹具仓库里跑 git。身份与签名都就地指定，不依赖本机的全局 git 配置。 */
function git(repo, args, env) {
  return execFileSync(
    'git',
    ['-c', 'user.name=Tester', '-c', 'user.email=tester@example.invalid', '-c', 'commit.gpgsign=false'].concat(args),
    {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, env || {}),
    }
  );
}

/**
 * 造夹具仓库：同一篇笔记 添加(2021-03-05) → 删除(2022-07-09) → 重建(2023-01-20)。
 *
 * 删除再重建是**故意**的：`git log --diff-filter=A` 通常只留一行输出（添加那一次提交），
 * 那时取第一行还是最后一行没有区别，用例就抓不住「取成了最后一次」。只有添加过两次，
 * 「取最后一行」才等于「最早的那次添加」。实测：本夹具下 git 输出两行（2023-01-20 / 2021-03-05）。
 */
function makeRepo() {
  const repo = makeTmpVault();
  git(repo, ['init']);
  const note = path.join(repo, '笔记.md');
  fs.writeFileSync(note, '第一版\n', 'utf8');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', '第一次'], {
    GIT_AUTHOR_DATE: '2021-03-05T12:00:00+0800',
    GIT_COMMITTER_DATE: '2021-03-05T12:00:00+0800',
  });
  git(repo, ['rm', '笔记.md']);
  git(repo, ['commit', '-m', '删掉'], {
    GIT_AUTHOR_DATE: '2022-07-09T12:00:00+0800',
    GIT_COMMITTER_DATE: '2022-07-09T12:00:00+0800',
  });
  fs.writeFileSync(note, '重建版\n', 'utf8');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', '重建'], {
    GIT_AUTHOR_DATE: '2023-01-20T12:00:00+0800',
    GIT_COMMITTER_DATE: '2023-01-20T12:00:00+0800',
  });
  return repo;
}

test('listMarkdown 递归收集 .md，返回相对 vaultPath 的 POSIX 路径', async () => {
  const vault = makeTmpVault();
  fs.mkdirSync(path.join(vault, '子目录', '更深'), { recursive: true });
  fs.mkdirSync(path.join(vault, '.隐藏'), { recursive: true });
  fs.mkdirSync(path.join(vault, '项目', '三眼枪'), { recursive: true });
  fs.writeFileSync(path.join(vault, '顶.md'), 'x\n', 'utf8');
  fs.writeFileSync(path.join(vault, '子目录', '中.md'), 'x\n', 'utf8');
  fs.writeFileSync(path.join(vault, '子目录', '更深', '底.md'), 'x\n', 'utf8');
  fs.writeFileSync(path.join(vault, '子目录', '笔记.txt'), 'x\n', 'utf8');
  fs.writeFileSync(path.join(vault, '大写.MD'), 'x\n', 'utf8');
  fs.writeFileSync(path.join(vault, '.隐藏', '藏.md'), 'x\n', 'utf8');
  fs.writeFileSync(path.join(vault, '项目', '三眼枪', '枪.md'), 'x\n', 'utf8');

  // 传的是子目录：返回的路径必须相对 vaultPath（带前缀），而不是相对这个子目录
  assert.deepEqual(await listMarkdown(vault, '项目/三眼枪'), ['项目/三眼枪/枪.md']);

  const all = (await listMarkdown(vault, '.')).sort();
  assert.deepEqual(all, ['子目录/更深/底.md', '子目录/中.md', '项目/三眼枪/枪.md', '大写.MD', '顶.md'].sort());
  assert.ok(all.every((p) => !p.includes('\\')), '返回的必须是 POSIX 风格路径');
});

test('listMarkdown 对不存在的目录返回空数组，不抛错', async () => {
  const vault = makeTmpVault();
  assert.deepEqual(await listMarkdown(vault, '没有这个目录'), []);
  assert.deepEqual(await listMarkdown(path.join(vault, '整个库都不存在'), '.'), []);
});

test('gitFirstCommitDate 取首次提交日期，不是最后一次', (t) => {
  if (!gitOk) return t.skip('本机没有可用的 git');
  const repo = makeRepo();

  const got = gitFirstCommitDate(repo, '笔记.md');
  assert.match(got ?? '', /^\d{4}-\d{2}-\d{2}$/, '必须是 YYYY-MM-DD');
  assert.equal(got, '2021-03-05', '最早一次添加是 2021-03-05；取到 2023-01-20 说明取成了最后一次添加');
});

test('gitFirstCommitDate 在文件改名之后仍取原始首次提交（--follow）', (t) => {
  if (!gitOk) return t.skip('本机没有可用的 git');
  const repo = makeRepo();
  git(repo, ['mv', '笔记.md', '改名后.md']);
  git(repo, ['commit', '-m', '改名'], {
    GIT_AUTHOR_DATE: '2024-05-06T12:00:00+0800',
    GIT_COMMITTER_DATE: '2024-05-06T12:00:00+0800',
  });

  assert.equal(
    gitFirstCommitDate(repo, '改名后.md'),
    '2021-03-05',
    '改名那次（2024-05-06）不是首次提交；取到它就说明丢了 --follow'
  );
});

test('gitFirstCommitDate 未跟踪 / 非 git 目录 / 不存在的路径都返回 null', (t) => {
  if (!gitOk) return t.skip('本机没有可用的 git');
  const repo = makeRepo();
  fs.writeFileSync(path.join(repo, '未跟踪.md'), '没提交过\n', 'utf8');

  assert.equal(gitFirstCommitDate(repo, '未跟踪.md'), null);

  const plain = makeTmpVault();
  assert.equal(gitFirstCommitDate(plain, 'x.md'), null, '不是 git 仓库');
  assert.equal(gitFirstCommitDate(path.join(plain, '没有这个目录'), 'x.md'), null, '库根不存在');
});

test('fileMtimeDate 返回 mtime 的 YYYY-MM-DD', async () => {
  const vault = makeTmpVault();
  const p = path.join(vault, '文件.md');
  fs.writeFileSync(p, 'x\n', 'utf8');
  const t = new Date('2021-03-05T12:00:00Z').getTime() / 1000;
  fs.utimesSync(p, t, t);

  assert.equal(await fileMtimeDate(p), '2021-03-05');
});
