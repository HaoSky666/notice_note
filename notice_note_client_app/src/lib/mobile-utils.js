/* Notice Note 手机端共用工具（UMD）
 * 浏览器：window.NoticeNoteMobileUtils
 * Node：module.exports（供 tests/ 直接 require，无需 DOM）
 * 这里只放纯函数：离线包校验/规划、文件夹语义归一、糊住语法解析。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.NoticeNoteMobileUtils = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MOBILE_PACKAGE_MAGIC = 'NNMOBILE';
  var MOBILE_PACKAGE_HEADER_SIZE = 16;
  var MOBILE_PACKAGE_VERSION = 2;

  function validateMobilePackage(packageData) {
    if (!packageData || packageData.format !== 'notice-note-mobile'
      || packageData.formatVersion !== MOBILE_PACKAGE_VERSION) {
      throw new Error('文件不是有效的 Notice Note 手机离线包');
    }
    var snapshot = packageData.snapshot;
    if (!snapshot || !Array.isArray(snapshot.folders) || !Array.isArray(snapshot.notes)
      || !Array.isArray(snapshot.resources) || !Array.isArray(snapshot.assets)) {
      throw new Error('离线包内容不完整，请在电脑端重新导出');
    }
    return snapshot;
  }

  /* 全量预校验：在写任何数据之前把整个包的资产边界算完。
   * 任何一条不合法就抛错，导入方因此可以「先校验、再单事务写入」，
   * 不会出现「旧 snapshot 还在但同名附件已被新包覆盖」的半套状态。
   */
  function planMobileAssets(snapshot, fileSize, assetOffset) {
    if (!snapshot || !Array.isArray(snapshot.assets)) {
      throw new Error('离线包内容不完整，请在电脑端重新导出');
    }
    if (!Number.isSafeInteger(fileSize) || !Number.isSafeInteger(assetOffset)
      || assetOffset < 0 || assetOffset > fileSize) {
      throw new Error('离线包长度无效，请在电脑端重新导出');
    }
    var seen = new Set();
    var plan = [];
    var offset = assetOffset;
    for (var index = 0; index < snapshot.assets.length; index += 1) {
      var asset = snapshot.assets[index];
      var size = Number(asset && asset.size);
      if (!asset || typeof asset.source !== 'string' || !asset.source
        || !Number.isSafeInteger(size) || size < 0) {
        throw new Error('离线包中的附件数据不完整，请在电脑端重新导出');
      }
      if (seen.has(asset.source)) {
        throw new Error('离线包包含重复的附件，请在电脑端重新导出');
      }
      if (offset + size > fileSize) {
        throw new Error('离线包中的附件数据不完整，请在电脑端重新导出');
      }
      seen.add(asset.source);
      plan.push({
        source: asset.source,
        start: offset,
        end: offset + size,
        size: size,
        mimeType: asset.mimeType || 'application/octet-stream'
      });
      offset += size;
    }
    if (offset !== fileSize) {
      throw new Error('离线包包含无法识别的数据，请在电脑端重新导出');
    }
    return plan;
  }

  function computeUnusedAssetKeys(previousSources, nextSources) {
    var next = nextSources instanceof Set ? nextSources : new Set(nextSources || []);
    var previous = previousSources instanceof Set ? Array.from(previousSources) : (previousSources || []);
    return previous.filter(function (source) { return !next.has(source); });
  }

  /* 离线包始终是明文：PC 导出时即使目录已解锁也不会带密码数据。
   * 手机端没有密码校验能力，isUnlocked 恒 false，锁徽章改由 isProtected 表达「未加密」。
   */
  function normalizeMobileFolder(folder) {
    if (!folder || typeof folder !== 'object') {
      return folder;
    }
    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId || null,
      path: folder.path,
      isProtected: Boolean(folder.isProtected),
      // 回顾目录隐藏标志必须保留：浏览层靠它镜像 PC 侧边栏藏起 .study_notice。
      // 早前白名单漏了这字段，导致同步清单带了标志也在读快照时被丢掉。
      isReviewFolder: Boolean(folder.isReviewFolder),
      isUnlocked: false,
      isPlaintextExport: Boolean(folder.isProtected),
      noteCount: Number(folder.noteCount) || 0
    };
  }

  /* {{ ... }} 糊住语法：PC 端是视觉遮挡（点击展开），不是加密。
   * 手机端按同样语义渲染成可点击的 span，避免导出的答案直接明文显示。
   * 不跨行匹配——与 PC 编辑器一致，多行内容要分行糊住。
   */
  function splitClozeSegments(text) {
    var value = String(text || '');
    var segments = [];
    var cursor = 0;
    var pattern = /\{\{([^{}\n]*)\}\}/g;
    var match;
    while ((match = pattern.exec(value)) !== null) {
      if (match.index > cursor) {
        segments.push({ type: 'text', value: value.slice(cursor, match.index) });
      }
      segments.push({ type: 'cloze', value: match[1] });
      cursor = match.index + match[0].length;
    }
    if (cursor < value.length) {
      segments.push({ type: 'text', value: value.slice(cursor) });
    }
    return segments;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 手机端只内嵌预览图片；其余资源明确提示「仅保存，不预览」。
  function isPreviewableResourceMime(mimeType) {
    return typeof mimeType === 'string' && /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(mimeType);
  }

  return {
    MOBILE_PACKAGE_MAGIC: MOBILE_PACKAGE_MAGIC,
    MOBILE_PACKAGE_HEADER_SIZE: MOBILE_PACKAGE_HEADER_SIZE,
    MOBILE_PACKAGE_VERSION: MOBILE_PACKAGE_VERSION,
    validateMobilePackage: validateMobilePackage,
    planMobileAssets: planMobileAssets,
    computeUnusedAssetKeys: computeUnusedAssetKeys,
    normalizeMobileFolder: normalizeMobileFolder,
    splitClozeSegments: splitClozeSegments,
    escapeHtml: escapeHtml,
    isPreviewableResourceMime: isPreviewableResourceMime
  };
});
