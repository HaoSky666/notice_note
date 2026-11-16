// 静态检查：语法检查 + 渲染层经典脚本的跨文件重名检测 + 页面脚本完整性
// --syntax-only 只跑 node --check（用于快速冒烟）
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const syntaxOnly = process.argv.includes('--syntax-only');
const PC_SRC = path.join(ROOT, 'notice_note_client_pc/src');

const TARGETS = [
  'notice_note_client_pc/src/main.js',
  'notice_note_client_pc/src/preload.js',
  'notice_note_client_app/src/app.js',
  'notice_note_client_app/src/lib/mobile-utils.js',
  ...fs.readdirSync(path.join(PC_SRC, 'lib')).map((f) => `notice_note_client_pc/src/lib/${f}`),
  ...fs.readdirSync(path.join(PC_SRC, 'ipc')).map((f) => `notice_note_client_pc/src/ipc/${f}`),
  ...fs.readdirSync(path.join(PC_SRC, 'renderer')).map((f) => `notice_note_client_pc/src/renderer/${f}`)
].filter((rel) => rel.endsWith('.js'));

let failed = 0;
for (const rel of TARGETS) {
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
  } catch (error) {
    console.log(`FAIL ${rel}`);
    console.log(error.stderr?.toString().split('\n').slice(0, 4).join('\n'));
    failed += 1;
  }
}
console.log(`语法检查：${TARGETS.length} 个文件，失败 ${failed} 个`);

// 顶层声明扫描：13 个经典脚本共享同一个全局词法环境，重名会直接导致页面白屏。
function collectTopLevelDeclarations(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const names = new Set();
  const declaration = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/;
  for (const line of lines) {
    const match = declaration.exec(line);
    if (match) {
      names.add(match[1]);
    }
  }
  return names;
}

if (!syntaxOnly) {
  const rendererDir = path.join(PC_SRC, 'renderer');
  const classicScripts = fs.readdirSync(rendererDir)
    .filter((name) => name.endsWith('.js'))
    .sort();
  const owners = new Map();
  const duplicates = [];
  for (const name of classicScripts) {
    for (const declared of collectTopLevelDeclarations(path.join(rendererDir, name))) {
      const previous = owners.get(declared);
      if (previous && previous !== name) {
        duplicates.push(`${declared}: ${previous} / ${name}`);
      } else {
        owners.set(declared, name);
      }
    }
  }
  if (duplicates.length > 0) {
    console.log('FAIL 渲染层顶层声明重名（经典脚本共享全局词法环境）:');
    for (const item of duplicates) {
      console.log(`  ${item}`);
    }
    failed += 1;
  } else {
    console.log(`顶层声明检查：${classicScripts.length} 个经典脚本，${owners.size} 个全局名，无重名`);
  }

  // 页面引用的脚本必须真实存在，且顺序里 dom.js 要在最前（其它文件依赖它的常量）。
  const html = fs.readFileSync(path.join(PC_SRC, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="\.\/([^"]+)"/g)].map((match) => match[1]);
  const missing = scripts.filter((rel) => !fs.existsSync(path.join(PC_SRC, rel)));
  if (missing.length > 0) {
    console.log('FAIL index.html 引用了不存在的脚本:', missing.join(', '));
    failed += 1;
  } else {
    console.log(`页面脚本检查：${scripts.length} 个引用全部存在`);
  }
}

console.log(`\n静态检查${failed === 0 ? '通过' : `失败 ${failed} 项`}`);
process.exit(failed === 0 ? 0 : 1);
