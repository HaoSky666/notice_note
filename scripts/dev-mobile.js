// 手机端浏览器调试服务：静态托管 notice_note_client_app/src，端口 47821。
// 用法：npm run dev:app，然后浏览器打开 http://localhost:47821。
// 调试两条路：
//   1. 局域网同步：PC 端开启同步并生成配对码，页面「设置」里填本机 IP + 配对码直接拉真实数据
//      （sync-server 开了 CORS，浏览器可直连）。
//   2. 离线包：笔记页「导入文件」选择 .notice-note-mobile 包。
// 启动前自动复制 PC 共享库，保证与源头一致。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP_SRC = path.join(ROOT, 'notice_note_client_app/src');
const PORT = Number(process.env.PORT) || 47821;

execFileSync(process.execPath, [path.join(__dirname, 'sync-mobile-libs.js')], { stdio: 'inherit' });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent((request.url || '/').split('?')[0]);
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(APP_SRC, relative);
  // 防目录穿越：只允许访问 src 内的文件
  if (!filePath.startsWith(APP_SRC + path.sep) && filePath !== APP_SRC) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(PORT, () => {
  console.log(`手机端调试服务已启动：http://localhost:${PORT}`);
  console.log('同步调试：PC 端「设置 → 局域网同步」开启并生成配对码，页面设置里填本机内网 IP + 配对码。');
  console.log('离线包调试：笔记页「导入文件」选择 .notice-note-mobile 包。');
});