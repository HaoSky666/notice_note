// 局域网同步客户端（经典脚本）。
// 流程：配对（ping → pair 换 token）→ 同步（先回传 dirty → 拉清单 → 差量拉正文/附件 → 整事务落库）。
// 合并规则全部在 PC 端跑（lib/sync-merge.js），手机回传后照单全收权威清单。
const SYNC_DEFAULT_PORT = 47820;
const SYNC_ASSET_RETRY = 3;
const SYNC_NOTE_IDS_CHUNK = 40;

function syncBaseUrl(host) {
  const trimmed = String(host || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  // 允许用户直接粘 host:port；不带端口就用默认 47820
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed.includes(':') ? trimmed : `${trimmed}:${SYNC_DEFAULT_PORT}`}`;
}

async function syncFetchJson(baseUrl, path, { method = 'GET', token = '', body = null } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error(payload?.error || `同步服务返回 ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function syncPing(host) {
  const baseUrl = syncBaseUrl(host);
  if (!baseUrl) {
    throw new Error('请先输入电脑的内网 IP');
  }
  const payload = await syncFetchJson(baseUrl, '/api/ping');
  if (!payload?.ok) {
    throw new Error('这个地址上没有 Notice Note 同步服务');
  }
  return { baseUrl, name: payload.name || 'Notice Note', port: payload.port };
}

async function syncPair(host, code, device) {
  const { baseUrl, name } = await syncPing(host);
  const payload = await syncFetchJson(baseUrl, '/api/pair', {
    method: 'POST',
    body: { code: String(code || '').trim().toUpperCase(), device: device || '手机' }
  });
  if (!payload?.token) {
    throw new Error('配对失败：没有拿到令牌');
  }
  const connection = {
    baseUrl,
    host: String(host || '').trim(),
    token: payload.token,
    serverName: name,
    pairedAt: new Date().toISOString(),
    lastSyncAt: null
  };
  NoticeNoteStore.saveConnection(connection);
  return connection;
}

// 附件下载：Range 续传。中途断网从已收字节继续，而不是整个重下。
async function syncDownloadAsset(baseUrl, token, asset, onProgress) {
  const url = `${baseUrl}/api/asset?path=${encodeURIComponent(asset.source)}`;
  const chunks = [];
  let received = 0;
  let lastError = null;
  for (let attempt = 0; attempt < SYNC_ASSET_RETRY; attempt += 1) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (received > 0) {
        headers.Range = `bytes=${received}-`;
      }
      const response = await fetch(url, { headers });
      if (response.status === 416) {
        // 已收字节越过文件末尾：文件在 PC 端变小了，整段重下
        chunks.length = 0;
        received = 0;
        continue;
      }
      if (!response.ok && response.status !== 206) {
        throw new Error(`附件下载失败（${response.status}）：${asset.source}`);
      }
      if (received > 0 && response.status === 200) {
        // 服务端没按 Range 切片（理论上不会），丢弃已收部分重来
        chunks.length = 0;
        received = 0;
      }
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(value);
        received += value.length;
        onProgress?.(received, asset.size);
      }
      return new Blob(chunks, { type: asset.mimeType || 'application/octet-stream' });
    } catch (error) {
      lastError = error;
      // 401/404 是确定性错误，重试没有意义
      if (error.status === 401 || error.status === 404) {
        throw error;
      }
    }
  }
  throw lastError || new Error(`附件下载失败：${asset.source}`);
}

function syncBuildMergePayload() {
  const library = NoticeNoteStore.getLibrary();
  const dirty = NoticeNoteStore.getDirty();
  if (!library || !NoticeNoteStore.hasDirty()) {
    return null;
  }
  const cardIdSet = new Set(dirty.cardIds);
  const answerIdSet = new Set(dirty.answerIds);
  const reviewDaySet = new Set(dirty.reviewDays);
  const reviewLogIdSet = new Set(dirty.reviewLogIds);
  const cards = (library.memory?.cards || []).filter((card) => cardIdSet.has(card.id));
  const answers = (library.memory?.answers || []).filter((entry) => answerIdSet.has(entry.id));
  const history = {};
  for (const dayKey of reviewDaySet) {
    const value = library.review?.history?.[`day:${dayKey}`];
    if (value) {
      history[`day:${dayKey}`] = value;
    }
  }
  const log = (library.review?.log || []).filter((entry) => reviewLogIdSet.has(entry.id));
  if (cards.length === 0 && answers.length === 0 && log.length === 0 && Object.keys(history).length === 0) {
    return null;
  }
  return { cards, answers, review: { history, log } };
}

// 一次完整同步。onProgress(stage, detail) 用于界面进度条。
async function syncNow(onProgress) {
  const connection = NoticeNoteStore.getConnection();
  if (!connection?.token) {
    throw new Error('还没有配对电脑，请先在设置里完成配对');
  }
  const { baseUrl, token } = connection;
  const report = (stage, detail) => onProgress?.(stage, detail);

  // 1) 先回传本地变更。失败就整体中止，dirty 保留，下次同步继续推。
  const payload = syncBuildMergePayload();
  if (payload) {
    report('merge', '正在回传复习进度...');
    try {
      await syncFetchJson(baseUrl, '/api/merge', { method: 'POST', token, body: payload });
    } catch (error) {
      if (error.status === 401) {
        NoticeNoteStore.saveConnection(null);
        throw new Error('配对已失效，请在设置里重新配对');
      }
      throw error;
    }
  }

  // 2) 拉全量清单
  report('manifest', '正在拉取清单...');
  let manifest;
  try {
    manifest = await syncFetchJson(baseUrl, '/api/manifest', { token });
  } catch (error) {
    if (error.status === 401) {
      NoticeNoteStore.saveConnection(null);
      throw new Error('配对已失效，请在设置里重新配对');
    }
    throw error;
  }
  if (!manifest || !Array.isArray(manifest.notes) || !Array.isArray(manifest.folders)) {
    throw new Error('清单格式不正确，请确认电脑端是最新版本');
  }

  const previous = NoticeNoteStore.getLibrary() || await NoticeNoteStore.loadSnapshot();
  const plan = window.NoticeNoteSyncPlan;
  const notePlan = plan.planNoteSync(previous?.notes || [], manifest.notes);
  const assetPlan = plan.planAssetSync(previous?.assets || [], manifest.assets || []);

  // 3) 差量拉笔记正文（ids 分批，避免 URL 过长）
  const fetchedContents = [];
  for (let i = 0; i < notePlan.fetchIds.length; i += SYNC_NOTE_IDS_CHUNK) {
    const ids = notePlan.fetchIds.slice(i, i + SYNC_NOTE_IDS_CHUNK);
    report('notes', `正在拉取笔记 ${Math.min(i + SYNC_NOTE_IDS_CHUNK, notePlan.fetchIds.length)}/${notePlan.fetchIds.length}`);
    const payloadNotes = await syncFetchJson(baseUrl, `/api/notes?ids=${encodeURIComponent(ids.join(','))}`, { token });
    fetchedContents.push(...(payloadNotes?.notes || []));
  }

  // 4) 逐个下载变更附件（Range 续传）
  const puts = [];
  for (let i = 0; i < assetPlan.fetchAssets.length; i += 1) {
    const asset = assetPlan.fetchAssets[i];
    report('assets', `正在下载附件 ${i + 1}/${assetPlan.fetchAssets.length} · ${asset.source}`);
    const blob = await syncDownloadAsset(baseUrl, token, asset, (received, total) => {
      report('assets', `正在下载附件 ${i + 1}/${assetPlan.fetchAssets.length} · ${Math.round(received / 1024)}KB${total ? ` / ${Math.round(total / 1024)}KB` : ''}`);
    });
    puts.push({ key: asset.source, blob });
  }

  // 5) 组装新快照：清单是权威集合；作答历史保留手机本地这份（PC 的作答不上手机）
  const localAnswers = previous?.memory?.answers || [];
  const nextCardIds = new Set((manifest.memory?.cards || []).map((card) => card.id));
  const snapshot = {
    version: 1,
    app: manifest.app || { name: 'Notice Note', generatedAt: new Date().toISOString() },
    folders: manifest.folders,
    notes: plan.assembleNotes(manifest.notes, fetchedContents, previous?.notes || []),
    resources: manifest.resources || [],
    assets: manifest.assets || [],
    review: manifest.review || { enabled: true, reminders: [], history: {}, log: [], order: [] },
    memory: {
      cards: manifest.memory?.cards || [],
      settings: manifest.memory?.settings || {},
      answers: localAnswers.filter((entry) => nextCardIds.has(entry.cardId))
    }
  };

  // 6) 单事务落库：附件 + 快照 + 清理失效附件，失败整体回滚
  report('write', '正在写入手机本地...');
  await NoticeNoteStore.runAssetTransaction({
    puts,
    removedKeys: assetPlan.removedKeys,
    snapshot
  });

  // 回传已成功、权威快照已落库，本地变更追踪清零
  NoticeNoteStore.clearDirty();
  const nextLibrary = await NoticeNoteStore.loadSnapshot();
  NoticeNoteStore.setLibrary(nextLibrary);
  NoticeNoteStore.saveConnection({ ...connection, lastSyncAt: new Date().toISOString() });
  NoticeNoteStore.notifyLibraryChanged();
  return {
    noteCount: snapshot.notes.length,
    resourceCount: snapshot.resources.length,
    assetDownloads: puts.length,
    pushed: Boolean(payload)
  };
}