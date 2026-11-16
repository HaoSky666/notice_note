// 回顾目录的收敛入口：迁移旧名 + 不存在时创建。
// 抽成 lib 模块是为了「启动时」和「切换存储位置后」走同一份逻辑，也便于用临时目录做行为测试。
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathExists } = require('./fs-utils');

const REVIEW_FOLDER_NAME = '.study_notice';
const LEGACY_REVIEW_FOLDER_NAME = 'study_notice';

async function ensureReviewFolder(notesDir, options = {}) {
  const reviewFolderName = options.reviewFolderName || REVIEW_FOLDER_NAME;
  const legacyFolderName = options.legacyFolderName || LEGACY_REVIEW_FOLDER_NAME;
  const reviewPath = path.join(notesDir, reviewFolderName);
  const legacyPath = path.join(notesDir, legacyFolderName);
  let migrated = false;
  let created = false;

  if (!await pathExists(reviewPath) && await pathExists(legacyPath)) {
    await fs.rename(legacyPath, reviewPath);
    migrated = true;
  }
  if (!await pathExists(reviewPath)) {
    await fs.mkdir(reviewPath, { recursive: true });
    created = true;
  }
  return { migrated, created, reviewPath };
}

module.exports = {
  REVIEW_FOLDER_NAME,
  LEGACY_REVIEW_FOLDER_NAME,
  ensureReviewFolder
};
