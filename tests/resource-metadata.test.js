const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  normalizeResourceEntry,
  normalizeResourceMetadata,
  createResourceMetadataEntry,
  applyResourceMetadata,
  getResourceReviewDayKey,
  moveResourceMetadataTree,
  deleteResourceMetadataTree,
  loadResourceMetadataFile,
  saveResourceMetadataFile,
  getResourceMetadataPath
} = require('../notice_note_client_pc/src/lib/resource-metadata');

async function withTempDir(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nn-resource-meta-'));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('元数据条目只接受合法的归天日期', () => {
  assert.deepEqual(normalizeResourceEntry({ reviewDate: '2026-11-12' }), {
    reviewDate: '2026-11-12', name: null, updatedAt: null
  });
  // 主/次角色已移除：只剩 reviewRole 的旧条目不再被保留
  assert.equal(normalizeResourceEntry({ reviewDate: '2026-11-12', reviewRole: 'primary' })?.reviewRole, undefined);
  assert.equal(normalizeResourceEntry({ reviewRole: 'primary' }), null);
  assert.equal(normalizeResourceEntry({ reviewDate: '2026-1-2', reviewRole: 'boss' }), null);
  assert.equal(normalizeResourceEntry(null), null);
  assert.equal(normalizeResourceEntry([]), null);
});

test('整份元数据损坏/非对象时降级为空，应用仍可启动', () => {
  assert.deepEqual(normalizeResourceMetadata(null), {});
  assert.deepEqual(normalizeResourceMetadata([]), {});
  assert.deepEqual(normalizeResourceMetadata('bad'), {});
  assert.deepEqual(normalizeResourceMetadata({ a: 1, b: null, c: { reviewDate: '2026-01-01' } }), {
    c: { reviewDate: '2026-01-01', name: null, updatedAt: null }
  });
});

test('P0-1 回归：设归天日期 -> 重新扫描（模拟刷新/重启）-> 日期仍在', async () => {
  await withTempDir(async (dir) => {
    const metaPath = getResourceMetadataPath(path.join(dir, '.notice-note'));
    const key = 'notes/a.pdf';

    // 第一次扫描：磁盘上只有文件属性，按创建时间归天
    const freshlyScanned = {
      id: `${dir}/notes/a.pdf`, name: 'a.pdf', path: `${dir}/notes/a.pdf`,
      createdAt: '2026-01-01T00:00:00.000Z', reviewDate: null
    };
    assert.equal(getResourceReviewDayKey(freshlyScanned), '2026-01-01');

    // 用户在回顾面板把归天改成 2026-11-12
    const edited = { ...freshlyScanned, reviewDate: '2026-11-12' };
    const metadata = {};
    metadata[key] = createResourceMetadataEntry(edited, new Date('2026-11-12T08:00:00Z'));
    await saveResourceMetadataFile(metaPath, metadata);

    // 触发任意一次资源重扫：内存列表被全部丢弃，只靠落盘元数据回填
    const rebuilt = { ...freshlyScanned, reviewDate: null };
    const restored = applyResourceMetadata(rebuilt, await loadResourceMetadataFile(metaPath), key);
    assert.equal(restored.reviewDate, '2026-11-12');
    assert.equal(getResourceReviewDayKey(restored), '2026-11-12');
  });
});

test('清空归天日期也要落盘，不能因为「无有效值」被跳过', async () => {
  await withTempDir(async (dir) => {
    const metaPath = getResourceMetadataPath(path.join(dir, '.notice-note'));
    await saveResourceMetadataFile(metaPath, {
      'notes/a.pdf': { reviewDate: '2026-11-12' }
    });
    const metadata = await loadResourceMetadataFile(metaPath);
    // 显式清空时直接删除该 key，重建后回到按创建时间归天
    delete metadata['notes/a.pdf'];
    await saveResourceMetadataFile(metaPath, metadata);
    const restored = applyResourceMetadata(
      { name: 'a.pdf', createdAt: '2026-01-01T00:00:00.000Z' },
      await loadResourceMetadataFile(metaPath),
      'notes/a.pdf'
    );
    assert.equal(restored.reviewDate, null);
    assert.equal(getResourceReviewDayKey(restored), '2026-01-01');
  });
});

test('主文件与备份同时损坏时按空元数据重建，不抛错阻断启动', async () => {
  await withTempDir(async (dir) => {
    const metaPath = getResourceMetadataPath(path.join(dir, '.notice-note'));
    await fs.mkdir(path.dirname(metaPath), { recursive: true });
    await fs.writeFile(metaPath, '{ broken', 'utf8');
    await fs.writeFile(`${metaPath}.bak`, 'still broken', 'utf8');
    assert.deepEqual(await loadResourceMetadataFile(metaPath), {});
  });
});

test('文件夹移动/重命名/删除时元数据 key 同步迁移', () => {
  const metadata = {
    'old/a.pdf': { reviewDate: '2026-01-01' },
    'old/sub/b.pdf': { reviewDate: '2026-01-02' },
    'keep/c.pdf': { reviewDate: '2026-01-03' }
  };
  assert.equal(moveResourceMetadataTree(metadata, 'old', 'new'), true);
  assert.deepEqual(Object.keys(metadata).sort(), ['keep/c.pdf', 'new/a.pdf', 'new/sub/b.pdf']);
  assert.equal(deleteResourceMetadataTree(metadata, 'new'), true);
  assert.deepEqual(Object.keys(metadata), ['keep/c.pdf']);
});
