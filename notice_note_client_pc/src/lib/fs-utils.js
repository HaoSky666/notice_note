// 文件系统工具：原子写入、备份与回退读取
const fs = require('node:fs/promises');
const fsConstants = require('node:fs').constants;
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function replaceFileSafely(tempPath, targetPath) {
  try {
    await fs.rename(tempPath, targetPath);
    return;
  } catch (error) {
    if (!['EEXIST', 'EPERM', 'EACCES'].includes(error.code) || !await pathExists(targetPath)) {
      throw error;
    }
  }

  const rollbackPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${randomUUID()}.rollback`
  );
  await fs.rename(targetPath, rollbackPath);
  try {
    await fs.rename(tempPath, targetPath);
    await fs.rm(rollbackPath, { force: true });
  } catch (error) {
    try {
      if (!await pathExists(targetPath)) {
        await fs.rename(rollbackPath, targetPath);
      }
    } catch (rollbackError) {
      console.error('恢复原文件失败:', targetPath, rollbackError);
    }
    throw error;
  }
}

async function atomicWriteFile(targetPath, data, options = {}) {
  const targetDir = path.dirname(targetPath);
  const tempPath = path.join(targetDir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`);
  const backupPath = `${targetPath}.bak`;
  await fs.mkdir(targetDir, { recursive: true });

  let handle;
  try {
    handle = await fs.open(tempPath, 'wx', 0o600);
    await handle.writeFile(data, options.encoding ? { encoding: options.encoding } : undefined);
    await handle.sync();
    await handle.close();
    handle = null;

    if (options.keepBackup && await pathExists(targetPath)) {
      const backupTempPath = path.join(
        targetDir,
        `.${path.basename(targetPath)}.${randomUUID()}.backup.tmp`
      );
      try {
        await fs.copyFile(targetPath, backupTempPath, fsConstants.COPYFILE_EXCL);
        await replaceFileSafely(backupTempPath, backupPath);
      } finally {
        await fs.rm(backupTempPath, { force: true }).catch(() => {});
      }
    }

    await replaceFileSafely(tempPath, targetPath);
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
}

async function atomicWriteJson(targetPath, value) {
  await atomicWriteFile(targetPath, JSON.stringify(value, null, 2), {
    encoding: 'utf8',
    keepBackup: true
  });
}

async function readJsonWithBackup(targetPath, fallbackValue) {
  const backupPath = `${targetPath}.bak`;
  let primaryError = null;

  try {
    return JSON.parse(await fs.readFile(targetPath, 'utf8'));
  } catch (error) {
    primaryError = error;
  }

  try {
    const backupRaw = await fs.readFile(backupPath, 'utf8');
    const parsed = JSON.parse(backupRaw);
    await atomicWriteFile(targetPath, backupRaw, { encoding: 'utf8' });
    console.warn('已从备份恢复损坏或缺失的 JSON 文件:', targetPath);
    return parsed;
  } catch (backupError) {
    if (primaryError?.code === 'ENOENT' && backupError.code === 'ENOENT') {
      return fallbackValue;
    }
    throw new Error(`无法读取 ${path.basename(targetPath)}，主文件和备份均不可用`, {
      cause: primaryError
    });
  }
}

module.exports = {
  pathExists,
  replaceFileSafely,
  atomicWriteFile,
  atomicWriteJson,
  readJsonWithBackup
};
