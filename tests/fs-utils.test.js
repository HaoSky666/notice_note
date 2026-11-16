const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  pathExists,
  atomicWriteJson,
  readJsonWithBackup,
  readJsonWithCorruptFallback
} = require('../notice_note_client_pc/src/lib/fs-utils');

async function withTempDir(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nn-fs-utils-'));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('atomicWriteJson 保留 .bak 备份且内容可读', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'meta.json');
    await atomicWriteJson(target, { a: 1 });
    await atomicWriteJson(target, { a: 2 });
    assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), { a: 2 });
    assert.deepEqual(JSON.parse(await fs.readFile(`${target}.bak`, 'utf8')), { a: 1 });
  });
});

test('主文件损坏、备份完好时自动从备份恢复', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'meta.json');
    await atomicWriteJson(target, { a: 1 });
    await atomicWriteJson(target, { a: 2 });
    await fs.writeFile(target, '{ broken', 'utf8');
    assert.deepEqual(await readJsonWithBackup(target, {}), { a: 1 });
    assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), { a: 1 });
  });
});

test('P2-28 回归：主文件与备份同时损坏时降级重建，不阻断启动', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'config.json');
    await fs.writeFile(target, '{ broken', 'utf8');
    await fs.writeFile(`${target}.bak`, 'also broken', 'utf8');
    assert.deepEqual(await readJsonWithCorruptFallback(target, { default: true }), { default: true });
    const files = await fs.readdir(dir);
    assert.ok(files.some((name) => name.startsWith('config.json.corrupt-')),
      '损坏的主文件应另存一份供排查');
  });
});

test('文件不存在时返回 fallback，不留下临时文件', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'missing.json');
    assert.equal(await pathExists(target), false);
    assert.deepEqual(await readJsonWithBackup(target, {}), {});
    assert.deepEqual(await fs.readdir(dir), []);
  });
});

test('连续 10 次原子写入后文件仍完整', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'meta.json');
    for (let index = 0; index < 10; index += 1) {
      await atomicWriteJson(target, { index, text: 'x'.repeat(2000) });
    }
    const parsed = JSON.parse(await fs.readFile(target, 'utf8'));
    assert.equal(parsed.index, 9);
    assert.equal(parsed.text.length, 2000);
  });
});
