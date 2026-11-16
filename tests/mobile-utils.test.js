const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateMobilePackage,
  planMobileAssets,
  computeUnusedAssetKeys,
  normalizeMobileFolder,
  splitClozeSegments,
  escapeHtml,
  isPreviewableResourceMime
} = require('../notice_note_client_app/src/lib/mobile-utils');

function snapshotOf(assets) {
  return { folders: [], notes: [], resources: [], assets };
}

test('validateMobilePackage 拒绝格式/版本/结构不对的包', () => {
  assert.throws(() => validateMobilePackage(null), /不是有效/);
  assert.throws(() => validateMobilePackage({ format: 'notice-note-mobile', formatVersion: 1 }), /不是有效/);
  assert.throws(() => validateMobilePackage({
    format: 'notice-note-mobile', formatVersion: 2, snapshot: { folders: [] }
  }), /内容不完整/);
  const valid = snapshotOf([]);
  assert.equal(validateMobilePackage({ format: 'notice-note-mobile', formatVersion: 2, snapshot: valid }), valid);
});

test('planMobileAssets 在任何写入之前算完整份资产边界', () => {
  const snapshot = snapshotOf([
    { source: 'images/a.png', size: 10, mimeType: 'image/png' },
    { source: 'files/b.pdf', size: 20 },
    { source: 'notes/c.md', size: 0 }
  ]);
  assert.deepEqual(planMobileAssets(snapshot, 46, 16), [
    { source: 'images/a.png', start: 16, end: 26, size: 10, mimeType: 'image/png' },
    { source: 'files/b.pdf', start: 26, end: 46, size: 20, mimeType: 'application/octet-stream' },
    { source: 'notes/c.md', start: 46, end: 46, size: 0, mimeType: 'application/octet-stream' }
  ]);
});

test('P1-9 回归：包被截断 / 尾部有多余数据 / size 非法时，规划阶段就失败', () => {
  const base = [{ source: 'a', size: 10 }, { source: 'b', size: 5 }];
  assert.throws(() => planMobileAssets(snapshotOf(base), 30, 16), /数据不完整|无法识别/);
  assert.throws(() => planMobileAssets(snapshotOf(base), 32, 16), /无法识别/);
  assert.throws(() => planMobileAssets(snapshotOf([{ source: 'a', size: -1 }]), 16, 16), /数据不完整/);
  assert.throws(() => planMobileAssets(snapshotOf([{ source: 'a', size: 1.5 }]), 18, 16), /数据不完整/);
  assert.throws(() => planMobileAssets(snapshotOf([{ source: '', size: 1 }]), 17, 16), /数据不完整/);
  assert.throws(() => planMobileAssets(snapshotOf([{ source: 'a', size: 1 }]), 17, 99), /长度无效/);
});

test('重复 source 会被拒绝，避免写入阶段互相覆盖', () => {
  assert.throws(
    () => planMobileAssets(snapshotOf([{ source: 'a', size: 1 }, { source: 'a', size: 1 }]), 18, 16),
    /重复的附件/
  );
});

test('computeUnusedAssetKeys 只列出旧包独有、需要清理的附件', () => {
  assert.deepEqual(
    computeUnusedAssetKeys(['a', 'b', 'c'], new Set(['b', 'd'])).sort(),
    ['a', 'c']
  );
  assert.deepEqual(computeUnusedAssetKeys([], ['a']), []);
});

test('P1-7 回归：离线包中的密码目录一律标成未解锁/明文', () => {
  const folder = normalizeMobileFolder({
    id: 'f1', name: '私密', isProtected: true, isUnlocked: true, noteCount: 3
  });
  assert.equal(folder.isProtected, true);
  assert.equal(folder.isUnlocked, false);
  assert.equal(folder.isPlaintextExport, true);
  assert.equal(normalizeMobileFolder({ id: 'f2' }).isPlaintextExport, false);
});

test('P1-11 回归：{{ }} 糊住解析与 PC 语义一致，且不跨行', () => {
  assert.deepEqual(splitClozeSegments('前{{答案}}后'), [
    { type: 'text', value: '前' },
    { type: 'cloze', value: '答案' },
    { type: 'text', value: '后' }
  ]);
  assert.deepEqual(splitClozeSegments('{{}}'), [{ type: 'cloze', value: '' }]);
  assert.deepEqual(splitClozeSegments('{{跨\n行}}'), [
    { type: 'text', value: '{{跨\n行}}' }
  ]);
  assert.deepEqual(splitClozeSegments('没有糊住'), [{ type: 'text', value: '没有糊住' }]);
  assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});

test('手机端只对图片内嵌预览，其他资源明确走「仅保存」提示', () => {
  assert.equal(isPreviewableResourceMime('image/png'), true);
  assert.equal(isPreviewableResourceMime('image/jpeg'), true);
  assert.equal(isPreviewableResourceMime('application/pdf'), false);
  assert.equal(isPreviewableResourceMime(undefined), false);
});
