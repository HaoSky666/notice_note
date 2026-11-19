// ESLint 9 flat config
// 渲染层是 13 个经典脚本共享全局词法环境，跨文件引用无法被 no-undef 正确理解，
// 因此边界模块（lib/ipc/tests/scripts）开全套规则，渲染层只开文件内可判定的规则；
// 跨文件重名检测由 scripts/lint.js 负责。
const commonRules = {
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-unreachable': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-cond-assign': 'error',
  'no-unsafe-negation': 'error'
};

const nodeGlobals = {
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'writable',
  require: 'readonly',
  exports: 'writable',
  process: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  structuredClone: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextDecoder: 'readonly',
  TextEncoder: 'readonly',
  AbortController: 'readonly',
  fetch: 'readonly',
  Map: 'readonly',
  Set: 'readonly',
  Promise: 'readonly'
};

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  crypto: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  Image: 'readonly',
  Blob: 'readonly',
  FileReader: 'readonly',
  DOMParser: 'readonly',
  HTMLElement: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  URL: 'readonly',
  structuredClone: 'readonly',
  indexedDB: 'readonly'
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'release/**',
      'tmp/**',
      'dist/**',
      '**/vendor/**',
      'notice_note_client_app/android/**',
      'notice_note_client_pc/src/vendor/editor.bundle.js'
    ]
  },
  {
    files: [
      'notice_note_client_pc/src/main.js',
      'notice_note_client_pc/src/preload.js',
      'notice_note_client_pc/src/lib/**/*.js',
      'notice_note_client_pc/src/ipc/**/*.js',
      'notice_note_client_app/src/lib/**/*.js',
      'scripts/**/*.js',
      'tests/**/*.js',
      'vite.editor.config.js',
      'eslint.config.js'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: nodeGlobals
    },
    rules: {
      ...commonRules,
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }]
    }
  },
  {
    files: ['notice_note_client_pc/src/editor-entry.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals
    },
    rules: {
      ...commonRules,
      'no-undef': 'off',
      'no-unused-vars': ['warn', { args: 'none' }]
    }
  },
  {
    files: [
      'notice_note_client_pc/src/renderer/**/*.js',
      'notice_note_client_app/src/*.js'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      ...commonRules,
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  }
];
