const { execFileSync } = require('node:child_process');
const path = require('node:path');

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.exe`;
  const executablePath = path.join(context.appOutDir, appName);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');
  const rceditPath = path.join(
    context.packager.projectDir,
    'node_modules',
    'electron-winstaller',
    'vendor',
    'rcedit.exe'
  );

  let lastError = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      execFileSync(rceditPath, [executablePath, '--set-icon', iconPath], {
        stdio: 'inherit'
      });
      return;
    } catch (error) {
      lastError = error;
      wait(500);
    }
  }

  throw lastError;
};
