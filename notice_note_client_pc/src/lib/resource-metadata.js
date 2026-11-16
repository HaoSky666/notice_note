// 资源文件（PDF/Word/Excel/图片）的回顾元数据持久化。
// 与 noteMetadata 同级但独立成文件：资源列表每次重扫都会从磁盘重建，
// 只有落盘的 reviewDate 能跨刷新、跨重启存活。
// 同一天的资源与笔记平级，不再有主/次文件之分。
// 本模块只依赖纯函数与 fs-utils，便于在 node:test 里做落盘往返测试。

const path = require('node:path');
const { isValidReviewDate, toLocalDateKey } = require('./date-utils');
const { atomicWriteJson, readJsonWithCorruptFallback } = require('./fs-utils');

const RESOURCE_METADATA_FILE_NAME = 'resource-metadata.json';

function normalizeResourceEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const reviewDate = isValidReviewDate(raw.reviewDate) ? raw.reviewDate : null;
  if (!reviewDate) {
    return null;
  }
  return {
    reviewDate,
    name: typeof raw.name === 'string' ? raw.name : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null
  };
}

function normalizeResourceMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (typeof key !== 'string' || !key) {
      continue;
    }
    const normalized = normalizeResourceEntry(entry);
    if (normalized) {
      result[key] = normalized;
    }
  }
  return result;
}

function createResourceMetadataEntry(file, now = new Date()) {
  return {
    reviewDate: isValidReviewDate(file?.reviewDate) ? file.reviewDate : null,
    name: typeof file?.name === 'string' ? file.name : null,
    updatedAt: now.toISOString()
  };
}

// 扫描时把落盘值回填到新建的资源对象上；没有元数据就回到「按创建时间归天」。
function applyResourceMetadata(file, metadata, key) {
  const entry = normalizeResourceEntry(metadata?.[key]);
  return {
    ...file,
    reviewDate: entry?.reviewDate || null
  };
}

function getResourceReviewDayKey(file) {
  if (isValidReviewDate(file?.reviewDate)) {
    return file.reviewDate;
  }
  const created = file?.createdAt ? new Date(file.createdAt) : null;
  return created && !Number.isNaN(created.getTime()) ? toLocalDateKey(created) : null;
}

function moveResourceMetadataTree(metadata, oldKey, newKey) {
  const oldPrefix = `${oldKey.replace(/\/$/, '')}/`;
  const newPrefix = `${newKey.replace(/\/$/, '')}/`;
  let changed = false;
  for (const key of Object.keys(metadata)) {
    if (key === oldKey) {
      metadata[newKey] = metadata[key];
      delete metadata[key];
      changed = true;
    } else if (key.startsWith(oldPrefix)) {
      metadata[`${newPrefix}${key.slice(oldPrefix.length)}`] = metadata[key];
      delete metadata[key];
      changed = true;
    }
  }
  return changed;
}

function deleteResourceMetadataTree(metadata, folderKey) {
  const prefix = `${folderKey.replace(/\/$/, '')}/`;
  let changed = false;
  for (const key of Object.keys(metadata)) {
    if (key === folderKey || key.startsWith(prefix)) {
      delete metadata[key];
      changed = true;
    }
  }
  return changed;
}

function getResourceMetadataPath(appDataPath) {
  return path.join(appDataPath, RESOURCE_METADATA_FILE_NAME);
}

async function loadResourceMetadataFile(filePath) {
  // 元数据损坏不应阻止应用启动：备份文件也坏了就按空元数据重建。
  const parsed = await readJsonWithCorruptFallback(filePath, {});
  return normalizeResourceMetadata(parsed);
}

async function saveResourceMetadataFile(filePath, metadata) {
  await atomicWriteJson(filePath, normalizeResourceMetadata(metadata));
}

module.exports = {
  RESOURCE_METADATA_FILE_NAME,
  normalizeResourceEntry,
  normalizeResourceMetadata,
  createResourceMetadataEntry,
  applyResourceMetadata,
  getResourceReviewDayKey,
  moveResourceMetadataTree,
  deleteResourceMetadataTree,
  getResourceMetadataPath,
  loadResourceMetadataFile,
  saveResourceMetadataFile
};
