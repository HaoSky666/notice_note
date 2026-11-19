// 把 PC 端的 UMD 纯函数库复制到手机端 src/lib/shared/。
// 单一事实来源在 notice_note_client_pc/src/lib/：改源头后运行 npm run sync:libs。
// Capacitor 的 webDir 是 src，打包只带 src 内的文件，所以必须复制而不是跨目录引用。
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'notice_note_client_pc/src/lib');
const TARGET_DIR = path.join(ROOT, 'notice_note_client_app/src/lib/shared');

const SHARED_LIBS = [
  'date-utils.js',
  'memory-types.js',
  'sm2-scheduler.js',
  'memory-card-store.js',
  'ai-judge.js',
  'review-queue.js'
];

fs.mkdirSync(TARGET_DIR, { recursive: true });
for (const name of SHARED_LIBS) {
  const source = fs.readFileSync(path.join(SOURCE_DIR, name), 'utf8');
  const header = `// 【自动复制】源头：notice_note_client_pc/src/lib/${name}\n`
    + '// 请勿直接编辑本文件；修改源头后运行 npm run sync:libs 重新生成。\n';
  fs.writeFileSync(path.join(TARGET_DIR, name), header + source);
}
console.log(`已复制 ${SHARED_LIBS.length} 个共享库到 ${path.relative(ROOT, TARGET_DIR)}`);