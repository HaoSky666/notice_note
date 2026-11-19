/* 同步差量规划（纯函数，UMD）：对比手机本地快照与 PC 全量清单，算出要拉什么、删什么。
 * 浏览器：window.NoticeNoteSyncPlan；Node：module.exports（供 tests 直接 require）。
 *
 * 约定与 lib/sync-merge.js 一致：PC 是权威集合，清单是全量的。
 * 「本地有、清单没有」= PC 已删 → 删；updatedAt/size 变了 → 重新拉。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../../../notice_note_client_pc/src/lib/sync-merge'));
  } else {
    root.NoticeNoteSyncPlan = factory(root.NoticeNoteSyncMerge);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (syncMerge) {
  'use strict';

  var collectRemovedIds = syncMerge.collectRemovedIds;

  /* 笔记差量：新笔记或 updatedAt 变化的要拉正文；清单里没有的本地笔记要删。
   * localNotes 可以带 content（本地快照），manifestNotes 是纯摘要。 */
  function planNoteSync(localNotes, manifestNotes) {
    var localList = Array.isArray(localNotes) ? localNotes : [];
    var manifestList = Array.isArray(manifestNotes) ? manifestNotes : [];
    var localById = new Map();
    for (var i = 0; i < localList.length; i += 1) {
      var note = localList[i];
      if (note && typeof note.id === 'string') {
        localById.set(note.id, note);
      }
    }
    var fetchIds = [];
    for (var j = 0; j < manifestList.length; j += 1) {
      var summary = manifestList[j];
      if (!summary || typeof summary.id !== 'string') {
        continue;
      }
      var local = localById.get(summary.id);
      if (!local || String(local.updatedAt || '') !== String(summary.updatedAt || '')) {
        fetchIds.push(summary.id);
      }
    }
    var keepIds = new Set(manifestList.map(function (item) { return item && item.id; }).filter(Boolean));
    var removedIds = collectRemovedIds(localList.map(function (item) { return item && item.id; }).filter(Boolean), keepIds);
    return { fetchIds: fetchIds, removedIds: removedIds };
  }

  /* 附件差量：按 source + size + updatedAt 判断是否需要重新下载。
   * 返回的 fetchAssets 带完整元信息，下载器直接用。 */
  function planAssetSync(localAssets, manifestAssets) {
    var localList = Array.isArray(localAssets) ? localAssets : [];
    var manifestList = Array.isArray(manifestAssets) ? manifestAssets : [];
    var localBySource = new Map();
    for (var i = 0; i < localList.length; i += 1) {
      var asset = localList[i];
      if (asset && typeof asset.source === 'string') {
        localBySource.set(asset.source, asset);
      }
    }
    var fetchAssets = [];
    for (var j = 0; j < manifestList.length; j += 1) {
      var next = manifestList[j];
      if (!next || typeof next.source !== 'string') {
        continue;
      }
      var local = localBySource.get(next.source);
      var changed = !local
        || Number(local.size) !== Number(next.size)
        || String(local.updatedAt || '') !== String(next.updatedAt || '');
      if (changed) {
        fetchAssets.push(next);
      }
    }
    var keepSources = new Set(manifestList.map(function (item) { return item && item.source; }).filter(Boolean));
    var removedKeys = collectRemovedIds(localList.map(function (item) { return item && item.source; }).filter(Boolean), keepSources);
    return { fetchAssets: fetchAssets, removedKeys: removedKeys };
  }

  /* 把清单摘要 + 拉到的正文 + 本地旧正文合成完整快照笔记。
   * 没拉到也没有本地正文的笔记（理论上不存在）给空串兜底，不能让同步崩掉。 */
  function assembleNotes(manifestNotes, fetchedContents, localNotes) {
    var manifestList = Array.isArray(manifestNotes) ? manifestNotes : [];
    var fetchedById = new Map();
    var fetchedList = Array.isArray(fetchedContents) ? fetchedContents : [];
    for (var i = 0; i < fetchedList.length; i += 1) {
      var item = fetchedList[i];
      if (item && typeof item.id === 'string') {
        fetchedById.set(item.id, item.content);
      }
    }
    var localById = new Map();
    var localList = Array.isArray(localNotes) ? localNotes : [];
    for (var j = 0; j < localList.length; j += 1) {
      var note = localList[j];
      if (note && typeof note.id === 'string') {
        localById.set(note.id, note.content);
      }
    }
    return manifestList
      .filter(function (summary) { return summary && typeof summary.id === 'string'; })
      .map(function (summary) {
        var content = fetchedById.has(summary.id)
          ? fetchedById.get(summary.id)
          : (localById.has(summary.id) ? localById.get(summary.id) : '');
        return Object.assign({}, summary, { content: typeof content === 'string' ? content : '' });
      });
  }

  return {
    planNoteSync: planNoteSync,
    planAssetSync: planAssetSync,
    assembleNotes: assembleNotes
  };
});