'use strict';

// 局域网同步服务：手机在同一个 WiFi 下直连 PC 拉数据。
//
// 职责边界：
//   1. 只负责「搬运」——清单、笔记正文、附件字节流、手机回传的复习状态。
//   2. 不知道笔记/卡片长什么样，全部通过注入的回调取，方便单测和复用。
//   3. 鉴权只有一层：配对码换 token，之后所有请求校验 token。
//
// 不做什么：不做公网暴露、不做 TLS、不做多用户。它假设运行在家庭局域网里，
// 同网段的其他设备拿不到 token 就进不来。

const http = require('node:http');
const os = require('node:os');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');

// 固定端口便于在 Windows 防火墙里放行一次。改了要同步改 README。
const SYNC_SERVER_PORT = 47820;

// 字符表去掉 I/O/0/1 这类容易看错的字符；正好 32 个，
// 所以 randomBytes 取模是均匀的，没有 modulo bias。
const PAIR_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAIR_CODE_LENGTH = 6;

// 手机回传的只有记忆卡状态和作答记录，正常几百 KB；给 8MB 上限防误传大文件。
const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024;

const MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function createPairCode(randomBytes = crypto.randomBytes) {
  const bytes = randomBytes(PAIR_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < PAIR_CODE_LENGTH; i += 1) {
    code += PAIR_CODE_ALPHABET[bytes[i] % PAIR_CODE_ALPHABET.length];
  }
  return code;
}

function createSyncToken(randomBytes = crypto.randomBytes) {
  return randomBytes(24).toString('hex');
}

// "bytes=0-1023" → { start, end }（闭区间）。格式不对或越界返回 null。
// 只取第一段：手机端是单线程顺序下载，不需要 multipart/byteranges。
function parseRange(header, size) {
  if (typeof header !== 'string' || !header.startsWith('bytes=')) {
    return null;
  }
  const spec = header.slice('bytes='.length).split(',')[0].trim();
  const match = /^(\d*)-(\d*)$/.exec(spec);
  if (!match) {
    return null;
  }
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return null;
  }
  if (!Number.isInteger(size) || size <= 0) {
    return null;
  }
  let start;
  let end;
  if (!rawStart) {
    // "bytes=-500" 表示最后 500 字节
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return null;
    }
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  if (start < 0 || start >= size || end < start) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

// 列出本机内网 IPv4。家用场景优先级：192.168 > 10 > 172.16-31 > 其它，
// 因为手机最可能和 192.168 那段在同一个 WiFi 下。
function listLanAddresses(interfaces = os.networkInterfaces()) {
  const result = [];
  for (const [name, list] of Object.entries(interfaces || {})) {
    for (const item of list || []) {
      if (!item || item.family !== 'IPv4' || item.internal) {
        continue;
      }
      if (item.address.startsWith('169.254.')) {
        // APIPA 地址意味着没拿到 DHCP，手机连不上，别拿去展示
        continue;
      }
      result.push({ name, address: item.address });
    }
  }
  const rank = (address) => {
    if (address.startsWith('192.168.')) return 0;
    if (address.startsWith('10.')) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
    return 3;
  };
  return result.sort((a, b) => rank(a.address) - rank(b.address));
}

function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') {
    return '';
  }
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1].trim() : '';
}

// 逐个比对而不是 includes：token 是长随机串，用常数时间比较避免逐位试探。
function isAuthorized(headerValue, tokens) {
  const token = extractBearerToken(headerValue);
  if (!token) {
    return false;
  }
  const list = Array.isArray(tokens) ? tokens : [];
  const tokenBuffer = Buffer.from(token, 'utf8');
  return list.some((item) => {
    if (typeof item !== 'string' || item.length !== token.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(item, 'utf8'), tokenBuffer);
  });
}

function getMimeType(filePath) {
  const ext = String(filePath).slice(String(filePath).lastIndexOf('.')).toLowerCase();
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
}

function readJsonBody(req, limit = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    // 手机端用 CapacitorHttp 走原生层其实不需要 CORS，
    // 但留着便于在浏览器里直接调接口排查问题。
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
  });
  res.end(body);
}

/**
 * 创建同步服务（不自动监听）。
 *
 * @param {object} options
 * @param {number} [options.port]            监听端口，0 表示随机（测试用）
 * @param {() => string} options.getPairCode 当前配对码
 * @param {() => string[]} options.getTokens 已配对的 token 列表
 * @param {(token: string, device: string) => Promise<void>} options.addToken 记录新配对
 * @param {() => Promise<object>} options.getManifest 生成全量清单
 * @param {(query: { since?: string, ids?: string[] }) => Promise<object>} options.getNotesContent
 * @param {(relPath: string) => string|null} options.resolveAsset 把相对路径解析成绝对路径，越界返回 null
 * @param {(payload: object) => Promise<object>} options.applyMerge 合并手机回传的状态
 * @param {() => string} [options.getServerName]
 */
function createSyncServer(options) {
  const {
    port = SYNC_SERVER_PORT,
    getPairCode,
    getTokens,
    addToken,
    getManifest,
    getNotesContent,
    resolveAsset,
    applyMerge,
    getServerName = () => 'Notice Note'
  } = options || {};

  for (const [name, fn] of Object.entries({
    getPairCode,
    getTokens,
    addToken,
    getManifest,
    getNotesContent,
    resolveAsset,
    applyMerge
  })) {
    if (typeof fn !== 'function') {
      throw new TypeError(`createSyncServer 缺少回调：${name}`);
    }
  }

  let server = null;
  let listeningPort = 0;

  async function handleRequest(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
        'Access-Control-Max-Age': '600'
      });
      res.end();
      return;
    }

    // 发现接口不鉴权：手机配对前要先确认「这个 IP 上确实是我的 PC」。
    if (req.method === 'GET' && url.pathname === '/api/ping') {
      sendJson(res, 200, {
        ok: true,
        name: getServerName(),
        version: 1,
        port: listeningPort
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/pair') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      const input = String(body?.code || '').trim().toUpperCase();
      const expected = String(getPairCode() || '').toUpperCase();
      if (!input || !expected || input !== expected) {
        sendJson(res, 401, { error: '配对码不正确' });
        return;
      }
      const token = createSyncToken();
      const device = String(body?.device || '').trim().slice(0, 60) || '手机';
      await addToken(token, device);
      sendJson(res, 200, { ok: true, token, name: getServerName() });
      return;
    }

    if (!isAuthorized(req.headers.authorization, getTokens())) {
      sendJson(res, 401, { error: '未配对或配对已失效，请重新配对' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/manifest') {
      const manifest = await getManifest();
      sendJson(res, 200, manifest);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/notes') {
      const since = url.searchParams.get('since') || '';
      const idsParam = url.searchParams.get('ids') || '';
      const ids = idsParam ? idsParam.split(',').map((id) => id.trim()).filter(Boolean) : [];
      const payload = await getNotesContent({ since: since || undefined, ids });
      sendJson(res, 200, payload);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/asset') {
      const relPath = url.searchParams.get('path') || '';
      const absolutePath = resolveAsset(relPath);
      if (!absolutePath) {
        sendJson(res, 404, { error: '附件不存在' });
        return;
      }
      let stats;
      try {
        stats = await fsp.stat(absolutePath);
      } catch {
        sendJson(res, 404, { error: '附件不存在' });
        return;
      }
      if (!stats.isFile()) {
        sendJson(res, 404, { error: '附件不存在' });
        return;
      }

      const mimeType = getMimeType(absolutePath);
      const range = parseRange(req.headers.range, stats.size);
      if (req.headers.range && !range) {
        res.writeHead(416, {
          'Content-Range': `bytes */${stats.size}`,
          'Access-Control-Allow-Origin': '*'
        });
        res.end();
        return;
      }

      if (range) {
        const { start, end } = range;
        res.writeHead(206, {
          'Content-Type': mimeType,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        });
        const stream = fs.createReadStream(absolutePath, { start, end });
        stream.on('error', () => res.destroy());
        stream.pipe(res);
        return;
      }

      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': stats.size,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      const stream = fs.createReadStream(absolutePath);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/merge') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      const result = await applyMerge(body || {});
      sendJson(res, 200, result || { ok: true });
      return;
    }

    sendJson(res, 404, { error: '接口不存在' });
  }

  async function start() {
    if (server) {
      return { port: listeningPort };
    }
    server = http.createServer((req, res) => {
      handleRequest(req, res).catch((error) => {
        // 任何未捕获异常都要回一个明确的 500，否则手机端只会看到连接被重置
        if (!res.headersSent) {
          sendJson(res, 500, { error: `同步服务内部错误：${error?.message || error}` });
        } else {
          res.destroy();
        }
      });
    });
    // 大附件传输可能超过 Node 默认的 5 分钟，关掉请求超时，
    // 由手机端自己控制取消。
    server.requestTimeout = 0;
    server.headersTimeout = 60000;

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server?.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server?.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '0.0.0.0');
    });

    listeningPort = server.address().port;
    return { port: listeningPort };
  }

  async function stop() {
    if (!server) {
      return;
    }
    const closing = server;
    server = null;
    // keep-alive 连接会让 close() 一直挂着，先掐断
    closing.closeAllConnections?.();
    await new Promise((resolve) => closing.close(() => resolve()));
    listeningPort = 0;
  }

  return {
    start,
    stop,
    getPort: () => listeningPort,
    isRunning: () => Boolean(server)
  };
}

module.exports = {
  SYNC_SERVER_PORT,
  PAIR_CODE_ALPHABET,
  PAIR_CODE_LENGTH,
  createPairCode,
  createSyncToken,
  parseRange,
  listLanAddresses,
  extractBearerToken,
  isAuthorized,
  getMimeType,
  createSyncServer
};
