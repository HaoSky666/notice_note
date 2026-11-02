// 语法检查：主进程、预加载、渲染进程各模块、Android 端
const { execFileSync } = require('child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  'notice_note_client_pc/src/main.js',
  'notice_note_client_pc/src/preload.js',
  'notice_note_client_app/src/app.js',
  ...fs.readdirSync(path.join(ROOT, 'notice_note_client_pc/src/lib')).map((f) => `notice_note_client_pc/src/lib/${f}`),
  ...fs.readdirSync(path.join(ROOT, 'notice_note_client_pc/src/ipc')).map((f) => `notice_note_client_pc/src/ipc/${f}`),
  ...fs.readdirSync(path.join(ROOT, 'notice_note_client_pc/src/renderer')).map((f) => `notice_note_client_pc/src/renderer/${f}`)
];

let failed = 0;
for (const rel of TARGETS) {
  if (!rel.endsWith('.js')) continue;
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
    console.log(`OK   ${rel}`);
  } catch (error) {
    console.log(`FAIL ${rel}`);
    console.log(error.stderr?.toString().split('\n').slice(0, 4).join('\n'));
    failed++;
  }
}

console.log(`\n${TARGETS.length} 个文件，失败 ${failed} 个`);
process.exit(failed === 0 ? 0 : 1);
