'use strict';

// 侧边栏顺序的纯函数：只处理 id 数组，不关心数据来自文件夹、笔记还是资源文件。
// stored 是手动顺序（可能含已删除的 id、也可能缺新条目），base 是默认顺序。

// 合并成「当前完整顺序」：手动排过的按手动顺序，没排过的按默认顺序接在后面。
// 与渲染层的实际排法保持同一口径，避免落盘的顺序和界面看到的不一致。
function mergeSidebarOrder(base, stored) {
  const known = new Set(base);
  const seen = new Set();
  const merged = [];
  for (const id of stored || []) {
    if (known.has(id) && !seen.has(id)) {
      merged.push(id);
      seen.add(id);
    }
  }
  for (const id of base) {
    if (!seen.has(id)) {
      merged.push(id);
      seen.add(id);
    }
  }
  return merged;
}

// 把 dragId 移到 targetId 的前/后。目标不存在或拖到自己身上返回 null。
function moveSidebarEntry(order, dragId, targetId, position) {
  if (dragId === targetId) {
    return null;
  }
  const next = order.filter((id) => id !== dragId);
  const index = next.indexOf(targetId);
  if (index === -1) {
    return null;
  }
  next.splice(position === 'before' ? index : index + 1, 0, dragId);
  return next;
}

// 按手动顺序排序：不在顺序里的 id 排到最后，彼此保持原有相对顺序（稳定排序）。
function sortIdsBySidebarOrder(ids, order) {
  if (!Array.isArray(order) || order.length === 0) {
    return [...ids];
  }
  const rank = new Map();
  order.forEach((id, index) => rank.set(id, index));
  return [...ids].sort((a, b) => {
    const rankA = rank.has(a) ? rank.get(a) : Number.MAX_SAFE_INTEGER;
    const rankB = rank.has(b) ? rank.get(b) : Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });
}

module.exports = {
  mergeSidebarOrder,
  moveSidebarEntry,
  sortIdsBySidebarOrder
};
