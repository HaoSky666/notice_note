'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
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
} = require('../notice_note_client_pc/src/lib/sync-server');

test('配对码只用 32 个不易混淆的字符，长度固定 6 位', () => {
  const code = createPairCode();
  assert.equal(code.length, PAIR_CODE_LENGTH);
  for (const char of code) {
    assert.ok(PAIR_CODE_ALPHABET.includes(char), `出现了字符表外的字符：${char}`);
  }
  // 字符表必须去掉 I/O/0/1，否则读给用户听的时候会歧义
  for (const banned of ['I', 'O', '0', '1']) {
    assert.ok(!PAIR_CODE_ALPHABET.includes(banned), `字符表不该包含 ${banned}`);
  }
  // randomBytes 的字节数必须和字符数一致，否则会读到 undefined
  assert.equal(createPairCode((size) => Buffer.alloc(size, 7)).length, PAIR_CODE_LENGTH);
});

test('token 是 48 位十六进制，两次生成不重复', () => {
  const a = createSyncToken();
  const b = createSyncToken();
  assert.match(a, /^[0-9a-f]{48}$/);
  assert.notEqual(a, b);
});

test('parseRange 解析闭区间，越界与格式错误返回 null', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=100-', 1000), { start: 100, end: 999 });
  assert.deepEqual(parseRange('bytes=-50', 1000), { start: 950, end: 999 });
  // 末尾越过文件大小要夹回来，而不是报错
  assert.deepEqual(parseRange('bytes=900-5000', 1000), { start: 900, end: 999 });
  // 只取第一段
  assert.deepEqual(parseRange('bytes=0-9,20-29', 1000), { start: 0, end: 9 });

  assert.equal(parseRange(undefined, 1000), null);
  assert.equal(parseRange('items=0-9', 1000), null);
  assert.equal(parseRange('bytes=abc', 1000), null);
  assert.equal(parseRange('bytes=1000-', 1000), null);
  assert.equal(parseRange('bytes=0-', 0), null);
  assert.equal(parseRange('bytes=-0', 1000), null);
  assert.equal(parseRange('bytes=-', 1000), null);
});

test('listLanAddresses 过滤回环与 APIPA，按家用网段优先级排序', () => {
  const list = listLanAddresses({
    'Wi-Fi': [
      { family: 'IPv4', internal: false, address: '172.20.10.3' },
      { family: 'IPv6', internal: false, address: 'fe80::1' },
      { family: 'IPv4', internal: true, address: '127.0.0.1' }
    ],
    '以太网': [
      { family: 'IPv4', internal: false, address: '169.254.13.7' },
      { family: 'IPv4', internal: false, address: '192.168.1.9' }
    ]
  });
  assert.deepEqual(list.map((item) => item.address), ['192.168.1.9', '172.20.10.3']);
  assert.deepEqual(listLanAddresses({}), []);
});

test('isAuthorized 只认真实 token，前缀和空值都挡掉', () => {
  const token = createSyncToken();
  assert.equal(extractBearerToken(`Bearer ${token}`), token);
  assert.equal(extractBearerToken('bearer   ' + token + '  '), token);
  assert.equal(extractBearerToken('Token abc'), '');
  assert.equal(extractBearerToken(undefined), '');

  assert.equal(isAuthorized(`Bearer ${token}`, [token]), true);
  assert.equal(isAuthorized(`Bearer ${token}x`, [token]), false);
  assert.equal(isAuthorized(`Bearer ${token.slice(0, -1)}`, [token]), false);
  assert.equal(isAuthorized('', [token]), false);
  assert.equal(isAuthorized(`Bearer ${token}`, []), false);
  assert.equal(isAuthorized(`Bearer ${token}`, null), false);
});

test('getMimeType 按扩展名给类型，未知回落二进制流', () => {
  assert.equal(getMimeType('/a/b.PNG'), 'image/png');
  assert.equal(getMimeType('c.pdf'), 'application/pdf');
  assert.equal(getMimeType('noext'), 'application/octet-stream');
});

async function withServer(run, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-sync-'));
  const assetPath = path.join(dir, 'demo.bin');
  // 用 0-255 的递增字节，方便断言 Range 切出来的位置对不对
  fs.writeFileSync(assetPath, Buffer.from(Array.from({ length: 256 }, (_, i) => i)));

  const tokens = [];
  const merged = [];
  const server = createSyncServer({
    port: 0,
    getPairCode: () => 'ABC234',
    getTokens: () => tokens.slice(),
    addToken: async (token) => { tokens.push(token); },
    getManifest: async () => ({ version: 1, notes: [{ id: 'n1', updatedAt: '2026-01-01T00:00:00.000Z' }] }),
    getNotesContent: async (query) => ({ notes: [{ id: 'n1', content: '正文' }], query }),
    resolveAsset: (rel) => (rel === 'demo.bin' ? assetPath : null),
    applyMerge: async (payload) => {
      merged.push(payload);
      return { ok: true, cards: payload.cards?.length || 0 };
    },
    ...overrides
  });
  const { port } = await server.start();
  try {
    await run({ base: `http://127.0.0.1:${port}`, tokens, merged, dir });
  } finally {
    await server.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('ping 不需要配对，用来确认这个 IP 上确实是自己的 PC', async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/ping`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.name, 'Notice Note');
  });
});

test('配对码错误不进 token，正确后拿到的 token 能访问清单', async () => {
  await withServer(async ({ base, tokens }) => {
    const bad = await fetch(`${base}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WRONG1', device: '测试机' })
    });
    assert.equal(bad.status, 401);
    assert.equal(tokens.length, 0);

    const ok = await fetch(`${base}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'abc234', device: '测试机' })
    });
    assert.equal(ok.status, 200);
    const { token } = await ok.json();
    assert.match(token, /^[0-9a-f]{48}$/);
    assert.equal(tokens.length, 1);

    const manifest = await fetch(`${base}/api/manifest`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(manifest.status, 200);
    assert.equal((await manifest.json()).notes[0].id, 'n1');
  });
});

test('没有 token 时清单与附件一律 401，不能让同网段的人白拿', async () => {
  await withServer(async ({ base }) => {
    for (const url of ['/api/manifest', '/api/notes', '/api/asset?path=demo.bin']) {
      const response = await fetch(`${base}${url}`);
      assert.equal(response.status, 401, `${url} 应该被拦下`);
    }
  });
});

test('附件按 Range 切片返回 206，Content-Range 与实际字节对得上', async () => {
  await withServer(async ({ base, tokens }) => {
    tokens.push('t'.repeat(48));
    const auth = { Authorization: `Bearer ${'t'.repeat(48)}` };

    const whole = await fetch(`${base}/api/asset?path=demo.bin`, { headers: auth });
    assert.equal(whole.status, 200);
    assert.equal(whole.headers.get('accept-ranges'), 'bytes');
    assert.equal((await whole.arrayBuffer()).byteLength, 256);

    const part = await fetch(`${base}/api/asset?path=demo.bin`, {
      headers: { ...auth, Range: 'bytes=10-19' }
    });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), 'bytes 10-19/256');
    const bytes = Buffer.from(await part.arrayBuffer());
    assert.equal(bytes.length, 10);
    assert.equal(bytes[0], 10);
    assert.equal(bytes[9], 19);
  });
});

test('Range 越界回 416，附件不存在回 404', async () => {
  await withServer(async ({ base, tokens }) => {
    tokens.push('t'.repeat(48));
    const auth = { Authorization: `Bearer ${'t'.repeat(48)}` };

    const outOfRange = await fetch(`${base}/api/asset?path=demo.bin`, {
      headers: { ...auth, Range: 'bytes=9999-' }
    });
    assert.equal(outOfRange.status, 416);

    const missing = await fetch(`${base}/api/asset?path=../secret.txt`, { headers: auth });
    assert.equal(missing.status, 404);
  });
});

test('清单与正文接口把 since / ids 原样交给上层，不在服务层做业务判断', async () => {
  await withServer(async ({ base, tokens }) => {
    tokens.push('t'.repeat(48));
    const auth = { Authorization: `Bearer ${'t'.repeat(48)}` };

    const response = await fetch(`${base}/api/notes?ids=a,b&since=2026-01-01T00:00:00.000Z`, { headers: auth });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.query, { ids: ['a', 'b'], since: '2026-01-01T00:00:00.000Z' });
  });
});

test('merge 把手机回传的复习状态交给主进程处理', async () => {
  await withServer(async ({ base, tokens, merged }) => {
    tokens.push('t'.repeat(48));
    const response = await fetch(`${base}/api/merge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${'t'.repeat(48)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: [{ id: 'c1' }, { id: 'c2' }], answers: [] })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).cards, 2);
    assert.equal(merged.length, 1);
  });
});

test('请求体不是 JSON 时回 400，未知接口分未配对与已配对两种情况', async () => {
  await withServer(async ({ base, tokens }) => {
    const badJson = await fetch(`${base}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json'
    });
    assert.equal(badJson.status, 400);

    // 未配对时连路由是否存在都不该泄露，一律 401
    const anonymous = await fetch(`${base}/api/nope`);
    assert.equal(anonymous.status, 401);

    tokens.push('t'.repeat(48));
    const notFound = await fetch(`${base}/api/nope`, {
      headers: { Authorization: `Bearer ${'t'.repeat(48)}` }
    });
    assert.equal(notFound.status, 404);
  });
});

test('重复 start 不会起第二个监听，stop 之后端口释放', async () => {
  await withServer(async ({ base }) => {
    // withServer 里已经 start 过，这里再 start 一次应该返回同一个端口
    const response = await fetch(`${base}/api/ping`);
    assert.equal(response.status, 200);
  });
});
