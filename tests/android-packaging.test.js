// Android 打包配置契约：装机后同步能不能用，全看这三处。
// 这些是原生工程文件，改坏了编译器不会报错，只会在手机上静默失败，所以单独锁住。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('Android 装机可用：INTERNET 权限 + 明文 HTTP + mixed content 三件套', () => {
  // 局域网同步直连 http://内网IP:47820，三处缺任意一处都会让手机端同步失败：
  // 1) 没有 INTERNET 权限，WebView 里所有 fetch 直接拒绝；
  // 2) targetSdk 28+ 默认禁止明文流量；
  // 3) App 页面跑在 https://localhost，向 http:// 发请求属于 mixed content，默认被拦。
  const manifest = read('notice_note_client_app/android/app/src/main/AndroidManifest.xml')
    .replace(/<!--[\s\S]*?-->/g, '');

  assert.ok(
    manifest.includes('android.permission.INTERNET'),
    'AndroidManifest 缺 INTERNET 权限：装到手机后同步请求发不出去',
  );
  assert.match(
    manifest,
    /android:usesCleartextTraffic="true"/,
    'AndroidManifest 缺 usesCleartextTraffic：Android 9+ 会拦掉 http 同步',
  );

  // Capacitor 8 读的是 android.allowMixedContent；server.cleartext 这个键已被移除。
  const config = JSON.parse(read('notice_note_client_app/capacitor.config.json'));
  assert.equal(
    config.android?.allowMixedContent,
    true,
    'capacitor.config.json 要设 android.allowMixedContent，否则 https 页面发不出 http 请求',
  );
});
