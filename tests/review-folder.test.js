const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  REVIEW_FOLDER_NAME,
  LEGACY_REVIEW_FOLDER_NAME,
  ensureReviewFolder
} = require('../notice_note_client_pc/src/lib/review-folder');

async function withTempDir(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nn-review-folder-'));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('R4：全新存储目录下自动创建 .study_notice', async () => {
  await withTempDir(async (dir) => {
    const result = await ensureReviewFolder(dir);
    assert.equal(result.created, true);
    assert.equal(result.migrated, false);
    assert.equal(result.reviewPath, path.join(dir, REVIEW_FOLDER_NAME));
    const stats = await fs.stat(result.reviewPath);
    assert.equal(stats.isDirectory(), true);
  });
});

test('R4：旧名 study_notice 会被迁移，不丢原有内容', async () => {
  await withTempDir(async (dir) => {
    const legacy = path.join(dir, LEGACY_REVIEW_FOLDER_NAME);
    await fs.mkdir(legacy, { recursive: true });
    await fs.writeFile(path.join(legacy, 'note.md'), '# 旧笔记', 'utf8');

    const result = await ensureReviewFolder(dir);
    assert.equal(result.migrated, true);
    assert.equal(result.created, false);
    assert.equal(await fs.readFile(path.join(result.reviewPath, 'note.md'), 'utf8'), '# 旧笔记');
    let legacyExists = true;
    try {
      await fs.stat(legacy);
    } catch {
      legacyExists = false;
    }
    assert.equal(legacyExists, false);
  });
});

test('R4：重复调用幂等，不会覆盖已有目录与文件', async () => {
  await withTempDir(async (dir) => {
    const first = await ensureReviewFolder(dir);
    await fs.writeFile(path.join(first.reviewPath, 'note.md'), 'keep', 'utf8');
    const second = await ensureReviewFolder(dir);
    assert.equal(second.created, false);
    assert.equal(second.migrated, false);
    assert.equal(await fs.readFile(path.join(second.reviewPath, 'note.md'), 'utf8'), 'keep');
  });
});

test('R4：切换到一个已有项目目录时不会把 .git 等当成回顾目录', async () => {
  await withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, '.git'));
    const result = await ensureReviewFolder(dir);
    assert.equal(result.created, true);
    assert.deepEqual((await fs.readdir(dir)).sort(), ['.git', REVIEW_FOLDER_NAME]);
  });
});

test('自定义目录名可用（便于测试与未来配置）', async () => {
  await withTempDir(async (dir) => {
    const result = await ensureReviewFolder(dir, {
      reviewFolderName: '_review', legacyFolderName: '_old_review'
    });
    assert.equal(result.reviewPath, path.join(dir, '_review'));
    assert.equal((await fs.stat(result.reviewPath)).isDirectory(), true);
  });
});
