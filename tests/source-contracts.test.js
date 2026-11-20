// 源码契约测试：这些断言锁住 P0/P1 修复的关键实现形状。
// 纯逻辑已在各自的单元测试里覆盖；这里防止「改着改着又把接线拆掉」。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PC = path.join(ROOT, 'notice_note_client_pc/src');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
function pc(file) {
  return read(`notice_note_client_pc/src/${file}`);
}
function app(file) {
  return read(`notice_note_client_app/src/${file}`);
}

test('P0-1 资源归天日期与主次角色必须落盘并在重扫时回填', () => {
  const main = pc('main.js');
  assert.match(main, /loadResourceMetadata\(\)/, '重扫前必须读取落盘元数据');
  assert.match(main, /applyResourceMetadata\(scanned, resourceMetadata/, '扫描时要回填');
  assert.match(main, /async function persistReviewMetadata\(entry, target, filePath\)/);
  assert.match(main, /setResourceMetadata\(filePath, target\)/);
  assert.match(main, /await saveResourceMetadata\(\)/);
  assert.match(main, /async function restoreReviewState\(snapshot, error\)/, '写盘失败要能回滚');
  assert.match(main, /moveResourceMetadataTree\(resourceMetadata/, '文件夹改名要迁移资源 key');
});

test('P0-2 切换笔记必须重建 EditorState，不能只 dispatch 全文 changes', () => {
  const entry = fs.readFileSync(path.join(PC, 'editor-entry.js'), 'utf8');
  const setMarkdown = entry.slice(entry.indexOf('setMarkdown(value)'), entry.indexOf('insertMarkdown(value)'));
  assert.match(setMarkdown, /view\.setState\(buildEditorState\(nextValue\)\)/);
  assert.doesNotMatch(setMarkdown, /view\.dispatch\(\{\s*changes/, '不能把整篇替换塞进 undo 历史');
  const bundle = fs.readFileSync(path.join(PC, 'vendor/editor.bundle.js'), 'utf8');
  assert.match(bundle, /\.setState\(/, 'bundle 必须重新生成过');
});

test('P0-3 外部打开传 { type, id }，不再静默 catch(console.error)', () => {
  const viewers = pc('renderer/viewers.js');
  assert.match(viewers, /openEntryWithDefaultApp\(\{ type: 'file', id: file\.id \}\)/);
  assert.doesNotMatch(viewers, /openEntryWithDefaultApp\(\{ path:/);
  assert.match(viewers, /showErrorToast\?\.\(error, '无法用默认应用打开'\)/);
});

test('P0-4 / R4 启动与切换存储位置都要确保 .study_notice 存在', () => {
  const main = pc('main.js');
  assert.match(main, /await ensureReviewFolder\(/);
  const useNotesPath = main.slice(
    main.indexOf('async function useNotesPath('),
    main.indexOf('async function chooseNotesPath('),
  );
  assert.match(useNotesPath, /await migrateReviewFolder\(\);/, '切库后也必须建目录');
  assert.match(pc('lib/review-folder.js'), /fs\.mkdir\(reviewPath, \{ recursive: true \}\)/);
  const review = pc('renderer/review-browser.js');
  assert.match(review, /showErrorToast\?\.\(/, '失败要给用户可见反馈');
  assert.match(review, /window\.noticeNote\.listFolders\(\)/, '兜底重拉文件夹列表');
});

test('P0-5 退出前统计 dirty 并询问；保护目录草稿不落 localStorage', () => {
  const boot = pc('renderer/boot.js');
  const editor = pc('renderer/editor.js');
  assert.match(boot, /window\.noticeNoteGetDirtySummary =/);
  assert.match(boot, /window\.noticeNoteSaveAllForQuit =/);
  assert.match(boot, /window\.noticeNoteFlushForQuit =/);
  assert.match(pc('main.js'), /async function requestQuit\(\)/);
  assert.match(pc('main.js'), /buttons: \['保存并退出', '不保存直接退出', '取消'\]/);
  assert.match(editor, /protectedContentDropped: true/, '草稿正文不能明文写入');
  assert.match(editor, /scheduleDraftsToStorage|scheduleNoteRecovery/, '按键写入要 debounce');
});

test('P1-6 旧按笔记提醒 UI 已彻底移除，数据字段仍保留供迁移', () => {
  const renderer = ['renderer/boot.js', 'renderer/editor.js', 'renderer/dom.js', 'renderer/sidebar.js']
    .map(pc).join('\n');
  for (const name of [
    'openReminderConfigButton', 'reminderDialog', 'reminderInput',
    'renderReminders', 'addAutoReminders', 'createReminderDate', 'skipWeekend'
  ]) {
    assert.doesNotMatch(renderer, new RegExp(`\\b${name}\\b`), `${name} 不应再出现`);
  }
  assert.doesNotMatch(pc('index.html'), /richtext/);
  assert.match(pc('main.js'), /migrateRemindersToDays\(\)/, '历史数据迁移入口必须保留');
});

test('P1-7 通知不泄露锁定目录标题；离线包不谎报已解锁', () => {
  const main = pc('main.js');
  assert.match(main, /function isProtectedFromDailyReview\(folderId\)/);
  assert.match(main, /getReviewDayContent\(record\.dayKey, \{ includeProtected: false \}\)/);
  assert.match(main, /isUnlocked: false/);
  assert.match(main, /isPlaintextExport: isFolderProtected\(folder\)/);
  assert.match(app('app.js'), /此离线包未加密|未加密/);
  assert.match(app('app.js'), /normalizeMobileFolder/);
});

test('P1-8 自动排期节奏走偏移表；复习日不早于今天', () => {
  const main = pc('main.js');
  // 第 2/3/7/15/30 天 = 距当天 1/2/6/14/29 天，偏移表在 date-utils 里单一来源
  assert.match(main, /AUTO_REMINDER_DAY_OFFSETS\.map\(\(offset\) => toLocalDateKey\(addDays\(today, offset\)\)\)/);
  assert.match(main, /复习日不能早于今天/);
  const dateUtils = pc('lib/date-utils.js');
  assert.match(dateUtils, /const AUTO_REMINDER_DAY_OFFSETS = \[1, 2, 6, 14, 29\];/);
  assert.match(dateUtils, /function addMonthsClamped\(date, months\)/);
});

test('P1-9 离线包导入全量预校验 + 单事务写入', () => {
  const source = app('app.js');
  assert.match(source, /planMobileAssets\(snapshot, file\.size, assetOffset\)/);
  // 事务执行统一收敛到 store.js（同步落库也走同一入口）：跨 store 单事务 + 中止回滚保障不变
  assert.match(source, /NoticeNoteStore\.runAssetTransaction\(\{/);
  const store = app('store.js');
  assert.match(store, /transaction\(\[ASSET_STORE, SNAPSHOT_STORE\], 'readwrite'\)/);
  assert.match(store, /transaction\.onabort/);
  assert.doesNotMatch(source, /window\.open\(/);
});

test('P1-13 错过的提醒不写「已看过」锚点，改为补通知', () => {
  const main = pc('main.js');
  const settle = main.slice(main.indexOf('async function settleExpiredReminders()'), main.indexOf('function flushMissedReminderNotice()'));
  assert.doesNotMatch(settle, /dailyReviewHistory\[/, '错过的提醒不能假装用户看过');
  assert.match(settle, /pendingMissedReminderNotice/);
  assert.match(main, /flushMissedReminderNotice\(\)/);
});

test('P1-12 回顾面板有完成入口，主进程允许任意一天完成', () => {
  const reviewBrowser = pc('renderer/review-browser.js');
  assert.match(reviewBrowser, /renderReviewPanelCompleteBar/);
  assert.match(pc('main.js'), /if \(action === 'defer' && !isTodaysSelection\)/);
  // 分级入口：只有今日回顾日给主按钮，其余日子弱化为「标记这一天已看过」
  assert.match(reviewBrowser, /function getTodayDailyReviewDayKey/);
  assert.match(reviewBrowser, /const isTodayReviewDay = targetDayKey === getTodayDailyReviewDayKey\(\)/);
  assert.match(reviewBrowser, /is-secondary/);
  // 空白日不挂完成按钮（\r?\n：src 下是 CRLF，测试文件是 LF，别被换行符绊住）
  assert.match(reviewBrowser, /if \(!hasContent\) \{\r?\n\s+return null;/);
});

test('P2-15/18/21/25/26/28 关键接线都在', () => {
  const main = pc('main.js');
  assert.match(main, /async function refreshAfterFolderStructureChange\(\)/);
  assert.match(main, /set noteFileMap\(value\) \{ noteFileMap = value; \}/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  assert.match(main, /shouldSkipScanEntry\(entry\.name/);
  assert.match(main, /async function cleanupOrphanImageAssets/);
  assert.match(main, /readJsonWithCorruptFallback\(getConfigPath\(\), null\)/);
  assert.match(pc('index.html'), /http-equiv="Content-Security-Policy"/);
  const editorEntry = fs.readFileSync(path.join(PC, 'editor-entry.js'), 'utf8');
  assert.match(editorEntry, /cm-remote-image-hint/, '远程图片必须点击后才加载');
  assert.match(editorEntry, /const isRemote =/);
  assert.match(editorEntry, /const loadRemote = \(\) =>/);
});

test('P2-17/24 状态收敛与共享天索引', () => {
  assert.match(pc('renderer/state.js'), /const appState = \{/);
  assert.match(pc('renderer/state.js'), /Object\.defineProperty\(globalThis, key/);
  assert.match(pc('renderer/review-browser.js'), /toReviewDayMap\(buildDayIndex\(/);
  assert.match(pc('renderer/sidebar.js'), /return buildCalendarEntries\(/);
});

test('P2-19/20/29 测试、lint、CI 与打包配置', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.test, 'node --test tests/*.test.js');
  assert.match(pkg.scripts.lint, /eslint/);
  assert.ok(pkg.devDependencies.eslint);
  assert.ok(!pkg.build.files.some((entry) => entry.includes('node_modules/**/*')));
  assert.ok(!pkg.build.files.some((entry) => entry.includes('notice_note_client_app')));
  assert.ok(!pkg.dependencies['@capacitor/core'], 'Android 依赖不能进 PC 安装包');
  assert.ok(pkg.devDependencies['@capacitor/core']);
  assert.ok(fs.existsSync(path.join(ROOT, '.github/workflows/ci.yml')));
  // APK 的 versionName 必须和根 package.json 对齐，否则发布页写的版本和装上的不是一回事。
  // 不写死具体版本号：每次发版只改两处，不再让这条断言跟着蹦。
  const versionName = pkg.version.replace(/\./g, '\\.');
  assert.match(
    read('notice_note_client_app/android/app/build.gradle'),
    new RegExp(`versionName "${versionName}"`),
    'Android versionName 要和根 package.json 一致',
  );
});

test('第二轮 R2/R3/R6/R7/R8/R9/R10/R16/R17/R18 接线都在', () => {
  const main = pc('main.js');
  const boot = pc('renderer/boot.js');
  const editor = pc('renderer/editor.js');
  const appSource = app('app.js');

  // R2：通知不再靠窗口创建后抢跑 send，改由渲染层拉取 + ack
  assert.match(main, /ipcMain\.handle\('reminders:take-pending'/);
  assert.match(main, /ipcMain\.handle\('reminders:ack-pending'/);
  assert.match(main, /once\('did-finish-load'/);
  assert.match(boot, /takePendingReminders\?\.\(\)/);
  assert.match(boot, /ackPendingReminders\?\.\(\)/);

  // R3：保护目录-only 提醒与「没发通知就不写锚点」
  assert.match(main, /buildDayReminderNotice\(\{/);
  assert.match(main, /if \(decision\.markAsReviewed\)/);

  // R6：两个图片 widget 共用远程门控
  const editorEntry = fs.readFileSync(path.join(PC, 'editor-entry.js'), 'utf8');
  assert.equal((editorEntry.match(/createImageGate\(/g) || []).length, 3,
    '1 处定义 + ImageWidget + ImageBelowWidget');
  assert.doesNotMatch(editorEntry, /image\.src = this\.src;/, 'widget 不应再直接赋值 src');

  // R7 / R8 / R9 / R10
  assert.match(main, /resourceMetadata = previousState\.resourceMetadata/);
  assert.match(main, /const previousResourceMetadata = structuredClone\(resourceMetadata\)/);
  assert.match(main.slice(main.indexOf('async function scanDirectory('), main.indexOf('function classifyResourceFile(')),
    /shouldSkipScanEntry\(entry\.name, false, REVIEW_FOLDER_NAME\)/);
  assert.match(main, /不能删除包含回顾目录的文件夹/);
  assert.match(pc('ipc/folders.js'), /ctx\.assertMutableFolder\(folder, '移动'\)/);

  // R16：PDF 文本层也懒加载，搜索时补齐
  const viewers = pc('renderer/viewers.js');
  assert.match(viewers, /async function ensureAllPdfTextLayers\(\)/);
  assert.match(viewers, /textRenderPromise/);
  assert.match(boot, /ensureAllPdfTextLayers\(\)\)\.then\(updateViewerSearch\)/);

  // R17：Android 死代码删除
  assert.doesNotMatch(appSource, /function writeOfflineValue\(/);
  assert.doesNotMatch(appSource, /function deleteUnusedOfflineAssets\(/);
  assert.match(appSource, /function readOfflineValue\(/);

  // R18：密码设置后立刻重写草稿；加载时按当前 folders 再过滤
  assert.match(pc('renderer/sidebar.js'), /flushDraftsToStorage\(\);/);
  assert.match(editor, /const protectedNow = isDraftInProtectedFolder\(draft\)/);

  // R5：草稿图片入口
  assert.match(editor, /草稿暂不支持插入图片/);
  assert.match(editor, /草稿暂不支持粘贴图片/);
  assert.match(pc('renderer/context-menu.js'), /!activeDraftId/);
});

test('第三轮收尾：待发提醒持久化、切库隔离、草稿富文本图片与本地脱敏', () => {
  const main = pc('main.js');
  const editor = pc('renderer/editor.js');

  // 错过提醒待发状态持久化，ack 后才清空并落盘
  assert.match(main, /normalizePendingMissedReminderNotice\(config\.pendingMissedReminderNotice\)/);
  assert.match(main, /missedReminderNoticeDate,\s*\n\s*pendingMissedReminderNotice/);
  assert.match(main, /ipcMain\.handle\('reminders:ack-pending', async \(\) => \{[\s\S]*await saveConfig\(\)/);
  assert.match(main, /id: `missed:\$\{notice\.date\}`/);

  // 切库按库隔离：同一路径直接返回；切换后清空提醒/日志/历史
  assert.match(main, /path\.resolve\(nextPath\) === path\.resolve\(getNotesPath\(\)\)/);
  assert.match(main, /dayReminders = \[\];\s*\n\s*dayRemindersMigrated = false;\s*\n\s*dayReviewLog = \[\];/);
  assert.match(main, /pendingMissedReminderNotice = previousState\.pendingMissedReminderNotice/);
  assert.match(main, /sendDayRemindersChanged\(\)/);

  // 富文本粘贴：草稿不逐张保存图片，只保留文字并提示
  assert.match(editor, /const isDraft = Boolean\(activeDraftId\)/);
  assert.match(editor, /已只保留文字内容/);
  assert.match(editor, /if \(isDraft\) \{\s*\n\s*imageMarkdownMap\.set\(src, ""\)/);

  // 加载时按当前密码目录脱敏后立即回写 localStorage
  assert.match(editor, /localStorage\.setItem\(DRAFTS_PERSIST_KEY, JSON\.stringify\(sanitizedDrafts\)\)/);

  // 设置页说明切库不会迁移提醒
  assert.match(pc('index.html'), /切换后新库从空白的提醒与回顾开始/);
});

test('侧边栏拖拽排序：目录/笔记/资源文件各自成组，顺序落 config', () => {
  const main = pc('main.js');
  const sidebar = pc('renderer/sidebar.js');
  const library = pc('ipc/library.js');
  const preload = pc('preload.js');

  // 主进程：顺序只存 id 数组，合并/移动走可测纯函数
  assert.match(main, /let sidebarOrder = \{ folders: \[\], notes: \[\], files: \[\] \}/);
  assert.match(main, /mergeSidebarOrder\(base, sidebarOrder\[kind\]\)/);
  assert.match(main, /moveSidebarEntry\(merged, dragId, targetId, position\)/);
  assert.match(library, /ipcMain\.handle\('sidebar:reorder', ctx\.reorderSidebar\)/);
  assert.match(main, /reorderDailyReview,\s*\n\s*reorderSidebar,/);
  assert.match(preload, /reorderSidebar: \(kind, dragId, targetId, position\)/);
  // 顺序随 config 落盘、切库时重置并纳入回滚快照
  assert.match(main, /dailyReviewOrder,\s*\n\s*sidebarOrder,/);
  assert.match(main, /sidebarOrder = \{ folders: \[\], notes: \[\], files: \[\] \};/);
  assert.match(main, /sidebarOrder = previousState\.sidebarOrder;/);

  // 渲染层：三组各自套排序，分组顺序（目录 → 笔记 → 资源文件）由渲染顺序保证
  assert.match(sidebar, /sortBySidebarOrder\(\s*getCurrentFolders\(\),/);
  assert.match(sidebar, /sortBySidebarOrder\(orderedNotes, "notes"/);
  assert.match(sidebar, /"files",\s*\n\s*\(file\) => file\.id,/);
  // 落点判定：上下边缘是排序，中间留给目录的「移入」
  assert.match(sidebar, /const DROP_EDGE_RATIO = 0\.3;/);
  assert.match(sidebar, /kind === "folders" && position && drag\.id !== folder\.id/);
  assert.match(sidebar, /bindSidebarReorder\(item, "notes", note\.id\)/);
  assert.match(sidebar, /bindSidebarReorder\(item, "files", file\.id\)/);
});

test('回顾面板当天文件拖拽排序：顺序按天存，不影响「推哪套」', () => {
  const main = pc('main.js');
  const review = pc('renderer/review-browser.js');
  const sidebar = pc('renderer/sidebar.js');
  const library = pc('ipc/library.js');
  const preload = pc('preload.js');

  // 主进程：每天一份 key 数组（note:/file: 前缀），默认顺序由纯函数算
  assert.match(main, /let reviewDayOrder = \{\};/);
  assert.match(main, /normalizeReviewDayOrder\(config\.reviewDayOrder, isValidReviewDate\)/);
  assert.match(main, /buildDefaultReviewDayOrder\(dayNotes, dayFiles\)/);
  assert.match(main, /mergeSidebarOrder\(base, reviewDayOrder\[dayKey\] \|\| \[\]\)/);
  assert.match(main, /reviewDayOrder = \{ \.\.\.reviewDayOrder, \[dayKey\]: next \}/);
  assert.match(library, /ipcMain\.handle\('review-day:reorder', ctx\.reorderReviewDayFile\)/);
  assert.match(preload, /reorderReviewDayFile: \(dayKey, dragKey, targetKey, position\)/);
  assert.match(main, /reorderSidebar,\s*\n\s*reorderReviewDayFile,/);
  // 落盘、切库重置、回滚快照三处都要带上，漏一处就会出现「拖了但下次启动回到原样」
  assert.match(main, /dailyReviewOrder,\s*\n\s*sidebarOrder,\s*\n\s*reviewDayOrder,/);
  assert.match(main, /sidebarOrder = \{ folders: \[\], notes: \[\], files: \[\] \};\s*\n\s*reviewDayOrder = \{\};/);
  assert.match(main, /reviewDayOrder: \{ \.\.\.reviewDayOrder \},/);
  assert.match(main, /reviewDayOrder = previousState\.reviewDayOrder;/);
  // 面板靠 appSettings 拿到顺序，不额外开广播
  assert.match(main, /reviewQueue: getReviewQueue\(\),\s*\n\s*sidebarOrder,\s*\n\s*reviewDayOrder,/);

  // 渲染层：同一天内按手动顺序渲染，只认同一天的拖拽
  assert.match(review, /sortReviewDayEntries\(entries, appSettings\?\.reviewDayOrder\?\.\[dayKey\]\)/);
  assert.match(review, /reviewFileDrag = \{ dayKey, key: entry\.key \}/);
  assert.match(review, /if \(!drag \|\| drag\.dayKey !== dayKey \|\| drag\.key === key\)/);
  assert.match(review, /bindReviewDayFileReorder\(node, dayKey, entry\.key\)/);
  assert.match(review, /reorderReviewDayFile\(\s*\n?\s*dayKey,/);
  // 手柄由 createReviewDayItem 按需渲染，搜索结果那种平铺列表不带手柄
  assert.match(sidebar, /if \(drag\) \{/);
  assert.match(sidebar, /dragHandle\.title = "拖动调整这一天的顺序"/);
});

test('P2-27 主题图已纳入版本控制', () => {
  for (const name of ['deepseek_whale.png', 'deepseek_whale_dark.png']) {
    assert.ok(fs.existsSync(path.join(PC, `assets/themes/${name}`)));
  }
  assert.match(read('.gitignore'), /\.dsh-vision-router\//);
});

test('记忆卡模块：SM-2 调度与 .memory_card 落盘接线', () => {
  const main = pc('main.js');
  const preload = pc('preload.js');
  const memoryIpc = pc('ipc/memory-cards.js');
  const sidebar = pc('renderer/sidebar.js');
  const dom = pc('renderer/dom.js');
  const memory = pc('renderer/memory.js');
  const index = pc('index.html');

  // 数据目录必须挂在笔记库下（源码根目录打包后是只读 asar，写不进去）
  assert.match(main, /function getMemoryCardDirPath\(\) \{\s*\n\s*return path\.join\(getNotesPath\(\), MEMORY_CARD_DIR_NAME\);/);
  assert.match(main, /path\.join\(getMemoryCardDirPath\(\), MEMORY_CARD_FILE_NAME\)/);
  assert.match(main, /path\.join\(getMemoryCardDirPath\(\), MEMORY_SETTINGS_FILE_NAME\)/);

  // 启动与切换笔记库都要重新读；切库失败要整体回滚
  assert.match(main, /await loadNotes\(\);\s*\n\s*\/\/ 记忆卡跟着笔记库走[\s\S]{0,140}await loadMemoryCards\(\);/);
  assert.match(main, /await loadNotes\(\);\s*\n\s*await loadMemoryCards\(\);/);
  assert.match(main, /memoryCards = previousState\.memoryCards;/);
  assert.match(main, /memorySettings = previousState\.memorySettings;/);
  // 切库后必须广播新快照，否则界面停在旧库的卡片上
  assert.match(main, /function sendMemoryChanged\(\)/);
  assert.match(main, /await loadMemoryCards\(\);\s*\n\s*await loadMemoryAnswers\(\);\s*\n\s*sendMemoryChanged\(\);/);
  assert.match(preload, /onMemoryChanged: \(callback\) => \{/);

  // IPC 链路：主进程 handler → preload 暴露 → 渲染层调用
  assert.match(memoryIpc, /ipcMain\.handle\('memory:list', async \(\) => \{/);
  assert.match(memoryIpc, /ipcMain\.handle\('memory:review', ctx\.reviewMemoryCard\)/);
  assert.match(memoryIpc, /ipcMain\.handle\('memory:settings:update', ctx\.updateMemoryCardSettings\)/);
  assert.match(preload, /reviewMemoryCard: \(payload\) => ipcRenderer\.invoke\('memory:review', payload\)/);
  assert.match(preload, /updateMemorySettings: \(settings\) => ipcRenderer\.invoke\('memory:settings:update', settings\)/);
  assert.match(main, /registerMemoryIpc\(ipcContext\);/);

  // 导航入口与侧边栏分发
  assert.match(index, /id="showMemoryButton"/);
  assert.match(index, /renderer\/memory\.js/);
  assert.match(dom, /const memoryView = document\.querySelector\("#memoryView"\);/);
  assert.match(sidebar, /\["calendar", "reminder", "memory"\]\.includes\(mode\)/);
  assert.match(sidebar, /if \(sidebarViewMode === "memory"\) \{\s*\n\s*renderMemorySidebar\(\);/);

  // 修改/删除入口挂在卡片信息行上：编辑按钮进编辑器，删除按钮在编辑器里。
  assert.match(index, /id="memoryEditCardButton"/);
  assert.match(dom, /const memoryEditCardButton = document\.querySelector\("#memoryEditCardButton"\);/);
  assert.match(memory, /memoryEditCardButton\?\.addEventListener\("click", \(\) => \{/);
  assert.match(memory, /memoryDeleteCardButton\?\.addEventListener\("click", deleteMemoryCardFromEditor\);/);

  // 切窗口回来不能清空正在编辑的草稿：只有显式打开编辑器才回填表单
  assert.match(memory, /memoryEditorSession \+= 1;/);
  assert.match(memory, /if \(memoryEditorRenderedSession === memoryEditorSession\) \{\s*\n\s*return;/);
  assert.match(
    memory,
    /if \(memoryViewMode === "study"\) \{\s*\n\s*renderMemoryView\(\);\s*\n\s*\} else \{\s*\n\s*renderMemoryStats\(\);/
  );

  // 侧边栏选中态跟着卡面走：只切 class，不重建列表（否则滚动位置会跳）
  assert.match(memory, /item\.dataset\.memoryCardId = card\.id;/);
  assert.match(memory, /function syncMemorySidebarActive\(\)/);
  assert.match(memory, /item\.classList\.toggle\("is-active", item\.dataset\.memoryCardId === memoryCurrentCardId\);/);

  // 笔记右键快速建卡：菜单项只对笔记出现，弹框状态与编辑器的 memoryEditorTypes 分开持有
  assert.match(index, /id="memoryQuickDialog"/);
  assert.match(index, /id="memoryQuickTypeChips"/);
  assert.match(pc('renderer/dom.js'), /const memoryQuickDialog = document\.querySelector\("#memoryQuickDialog"\);/);
  assert.match(pc('renderer/context-menu.js'), /if \(entry\.type === "note"\) \{\s*\n\s*contextMenu\.append\(\s*\n\s*createContextMenuItem\("制作成记忆卡片"/);
  assert.match(memory, /async function openMemoryQuickCreate\(noteId\)/);
  assert.match(memory, /memoryQuickTypes = \[\];/);
  assert.match(memory, /await window\.noticeNote\.createMemoryCard\(\{ front, back, types \}\);/);
});

test('记忆卡类型：多类型落盘、按类型学习、筛选由主进程统一持有', () => {
  const main = pc('main.js');
  const preload = pc('preload.js');
  const memoryIpc = pc('ipc/memory-cards.js');
  const store = pc('lib/memory-card-store.js');
  const types = pc('lib/memory-types.js');
  const index = pc('index.html');
  const memory = pc('renderer/memory.js');

  // 类型目录从卡片的 types 汇总，没有第二份需要同步的数据
  assert.match(types, /function collectCardTypes\(cards\)/);
  assert.match(types, /function normalizeCardTypes\(value\)/);
  assert.match(main, /const \{ normalizeCardTypes, normalizeTypeName \} = require\('\.\/lib\/memory-types'\);/);

  // 快照按类型筛选，目录与 allTotal 始终基于全部卡片
  assert.match(store, /options && options\.type/);
  assert.match(store, /const list = type \? all\.filter\(\(card\) => hasCardType\(card, type\)\) : all;/);
  assert.match(store, /types: catalog,/);
  assert.match(store, /allTotal: all\.length/);

  // 筛选放主进程：切库广播走的也是同一份口径
  assert.match(main, /let memoryTypeFilter = null;/);
  assert.match(main, /memoryTypeFilter = snapshot\.type;/);
  assert.match(main, /memoryTypeFilter = null;\s*\n  return memoryCards;/);
  assert.match(memoryIpc, /ipcMain\.handle\('memory:filter', ctx\.filterMemoryCards\)/);
  assert.match(preload, /filterMemoryCards: \(payload\) => ipcRenderer\.invoke\('memory:filter', payload\)/);

  // 界面：学习页切换条 + 编辑器类型输入
  assert.match(index, /id="memoryTypeBar"/);
  assert.match(index, /id="memoryTypeInput"/);
  assert.match(memory, /async function setMemoryTypeFilter\(typeName\)/);
  assert.match(memory, /window\.noticeNote\.filterMemoryCards\(\{ type: typeName \|\| null \}\)/);
  assert.match(memory, /const types = \[\.\.\.memoryEditorTypes\];/);
  assert.match(memory, /updateMemoryCard\(\{ id: memoryEditingCardId, front, back, types \}\)/);
});

test('记忆卡天级间隔按本地日切，不是 24 小时整', () => {
  const scheduler = pc('lib/sm2-scheduler.js');
  const memory = pc('renderer/memory.js');

  // 天数统一从「当天 00:00」往后推，逾期天数按整天算。
  assert.match(scheduler, /function localDayIndex\(time\) \{\s*\n\s*const date = new Date\(time\);\s*\n\s*return Date\.UTC\(/);
  assert.match(scheduler, /function dueFromDays\(now, days\) \{\s*\n\s*const date = new Date\(now\);\s*\n\s*date\.setHours\(0, 0, 0, 0\);/);
  assert.match(scheduler, /function lateDaysSince\(dueAt, now\)/);
  assert.match(scheduler, /const lateDays = lateDaysSince\(current\.dueAt, now\);/);

  // 渲染层快照带日期戳：跨天后必须重新取，否则早上还显示昨晚的待复习数。
  assert.match(memory, /let memorySnapshotDay = "";/);
  assert.match(memory, /const dayChanged = memorySnapshotDay !== currentMemoryDayStamp\(\);/);
  assert.match(memory, /await ensureMemorySnapshot\(true\);/);
});

test('记忆卡界面配色跟主题走，不写死暖色 --nn-* 令牌', () => {
  const css = pc('styles.css');
  const start = css.indexOf('记忆卡（SM-2 间隔重复）');
  assert.ok(start > 0, '找不到记忆卡样式段');
  const block = css.slice(start);

  // 深色/冷色主题的 --nn-* 不会跟着变，混用会让整块发黄。
  assert.match(block, /--mv-bg: var\(--theme-canvas, var\(--nn-canvas\)\)/);
  assert.match(block, /--mv-surface: var\(--theme-surface, var\(--nn-surface-100\)\)/);
  assert.match(block, /--mv-border: var\(--theme-border, var\(--nn-line-300\)\)/);
  assert.match(block, /\.memory-view \{[\s\S]{0,200}background: var\(--mv-bg\)/);
  assert.match(block, /\.memory-card-stage \{[\s\S]{0,220}background: var\(--mv-surface\)/);

  // 卡片高度随内容，不再固定撑满（min-height 会让单行问题变成大白框）。
  const stageRule = block.match(/\.memory-card-stage \{[^}]*\}/);
  assert.ok(stageRule, '找不到 .memory-card-stage 规则');
  assert.doesNotMatch(stageRule[0], /min-height/);
  assert.match(stageRule[0], /max-height/);
});

test('记忆卡长答案靠 margin:auto 居中，不会被信息行盖住', () => {
  const css = pc('styles.css');
  const block = css.slice(css.indexOf('记忆卡（SM-2 间隔重复）'));
  const bodyRule = block.match(/\.memory-card-body \{[^}]*\}/);
  assert.ok(bodyRule, '找不到 .memory-card-body 规则');

  // justify-content:center + overflow:auto 会让内容向两端等量溢出，
  // 顶部跑到信息行后面且滚不到 —— 长答案被「新卡 · 未开始」压住就是这个。
  assert.doesNotMatch(bodyRule[0], /justify-content/);
  assert.match(block, /\.memory-card-inner \{[\s\S]{0,220}margin: auto 0;/);
  assert.match(pc('index.html'), /<div class="memory-card-inner">/);
});

test('记忆卡 AI 判定：作答 → 模型 → 落盘调度的接线', () => {
  const main = pc('main.js');
  const preload = pc('preload.js');
  const memoryIpc = pc('ipc/memory-cards.js');
  const memory = pc('renderer/memory.js');
  const index = pc('index.html');
  const dom = pc('renderer/dom.js');

  // key 只在主进程：渲染层只发起 invoke，不发网络请求、不碰 apiKey
  assert.match(memoryIpc, /ipcMain\.handle\('memory:judge', ctx\.judgeMemoryAnswer\)/);
  assert.match(preload, /judgeMemoryAnswer: \(payload\) => ipcRenderer\.invoke\('memory:judge', payload\)/);
  assert.match(memory, /window\.noticeNote\.judgeMemoryAnswer\(\{ cardId, answer \}\)/);
  assert.doesNotMatch(memory, /apiKey/, '渲染层不该出现 apiKey');
  assert.doesNotMatch(memory, /fetch\(/, '渲染层不该自己发请求');

  // 判定完直接按档位调度，不再等用户点四档
  assert.match(main, /const next = scheduleMemoryCard\(cardBefore, judgment\.rating, memorySettings, Date\.now\(\)\);/);
  // 判定必须带上前几次作答作为背景
  assert.match(main, /const history = listCardAnswers\(memoryAnswers, cardId, 3\);/);

  // 改判要用评分前的卡片状态重算，否则连点两次会把间隔乘两次
  assert.match(main, /let lastMemoryJudge = null;/);
  assert.match(main, /lastMemoryJudge = \{ cardId, cardBefore, entryId \};/);
  assert.match(main, /const base = context \? context\.cardBefore : card;/);

  // 历史跟卡片同目录，删卡片要连带清理孤儿条目
  assert.match(main, /function getMemoryAnswerLogPath\(\) \{\s*\n\s*return path\.join\(getMemoryCardDirPath\(\), ANSWER_LOG_FILE_NAME\);/);
  assert.match(main, /pruneAnswersForCards\(memoryAnswers, new Set\(memoryCards\.map\(\(card\) => card\.id\)\)\)/);

  // 界面三块：作答区、判定结果、历史
  for (const id of [
    'memoryAnswerZone',
    'memoryAnswerInput',
    'memoryAnswerSubmitButton',
    'memoryJudgeResult',
    'memoryJudgeOverrideButton',
    'memoryAnswerHistory'
  ]) {
    assert.match(index, new RegExp(`id="${id}"`), `index.html 缺 #${id}`);
  }
  assert.match(dom, /const memoryAnswerInput = document\.querySelector\("#memoryAnswerInput"\);/);

  // 草稿按卡片隔离：后台重渲染不能把正在敲的内容冲掉
  assert.match(memory, /if \(memoryAnswerDraftCardId !== card\.id\) \{/);
  // 中文输入法选词回车不能当成提交
  assert.match(memory, /if \(event\.isComposing \|\| event\.keyCode === 229\) \{/);
});

test('记忆卡 AI 判定：没配 Key 或判定失败都要退回手动四档', () => {
  const memory = pc('renderer/memory.js');
  // 四档只在三种情况下露出：未配置 AI、判定失败、主动改判
  assert.match(
    memory,
    /const showRatingBar = memoryRevealed\s*\n\s*&& \(!aiReady \|\| memoryJudgeState === "error" \|\| memoryJudgeState === "override"\);/
  );
  assert.match(memory, /function isMemoryAiReady\(\) \{\s*\n\s*return Boolean\(memorySnapshot\?\.aiJudge\?\.configured\);/);
  // 判定失败时保留已敲的答案，并把四档放出来
  assert.match(memory, /memoryJudgeState = "error";/);
  // 数字键只在四档真的可见时生效
  assert.match(memory, /if \(!memoryRevealed \|\| !memoryRatingBar \|\| memoryRatingBar\.hidden\) \{/);
});

test('作答必须发生在看不见答案的时候：输入框只在问题面', () => {
  const memory = pc('renderer/memory.js');

  // 输入区的可见条件必须带 !memoryRevealed：翻面后还能作答，等于边看答案边回忆
  assert.match(memory, /const showAnswerInput = aiReady && !showResult && !memoryRevealed;/);
  // 配了 AI 就不给「显示答案」按钮，答案只能由判定结果带出来
  assert.match(memory, /memoryRevealButton\.hidden = memoryRevealed \|\| aiReady;/);
  // 判定成功要翻面（否则看不到正确答案），失败也要翻面（否则改判无从对照）
  assert.match(memory, /memoryJudgeState = "result";[\s\S]{0,400}memoryRevealed = true;/);
  assert.match(memory, /memoryJudgeState = "error";[\s\S]{0,600}memoryRevealed = true;/);
  // 历史里存着上次的作答原文，翻面前不能露出来
  assert.match(memory, /memoryAnswerHistory\.hidden = !memoryRevealed \|\| entries\.length === 0;/);
  // 空格不再是「翻答案」：配了 AI 时把光标送进作答框（判定中也不许翻）
  assert.match(
    memory,
    /if \(isMemoryAiReady\(\) && !memoryRevealed && memoryJudgeState === "idle"[\s\S]{0,140}memoryAnswerInput\?\.focus\(\);/
  );
  // 每张新卡自动聚焦输入框，全程不用摸鼠标
  assert.match(memory, /function focusMemoryAnswerInput\(\) \{/);
  for (const fn of ['openMemoryView', 'selectMemoryCard', 'goToNextMemoryCard']) {
    assert.match(
      memory,
      new RegExp(`function ${fn}\\([^)]*\\)[\\s\\S]{0,700}focusMemoryAnswerInput\\(\\);`),
      `${fn} 之后要把光标送回作答框`
    );
  }
});

test('AI 判定以机制覆盖为准，示例数值不作为扣分点', () => {
  const judge = pc('lib/ai-judge.js');
  // 阈值、窗口、比例都是可配参数。用户答「失败率超过阈值」即算覆盖，
  // 不能因为没背出 50% / 1s 就扣分——那是把配置项当知识点考。
  assert.match(judge, /评分依据是「机制是否覆盖」，不是「数值是否背对」/, '判定标准要写明机制优先');
  assert.match(judge, /标为「举例」「示例」或写在括号里的参数，一律不作为评分点/);
  assert.match(judge, /只报数值不说机制/, '反例也要写明：背数字不说机制才算没掌握');
  // 手机端跑同一份共享库，漏同步会让两端判定不一致
  assert.match(
    app('lib/shared/ai-judge.js'),
    /评分依据是「机制是否覆盖」，不是「数值是否背对」/,
    '手机端共享库要跟着同步（npm run sync:libs）'
  );
});

test('作答框要放得下长答案：PC 与手机都不小于 6 行', () => {
  // 3 行写三五个要点的答案要一直滚，看不见自己写了什么
  assert.match(
    pc('styles.css'),
    /\.memory-answer-input \{[\s\S]{0,240}min-height: 126px/,
    'PC 作答框最小高度'
  );
  assert.match(
    read('notice_note_client_pc/src/index.html'),
    /id="memoryAnswerInput"[^>]*rows="6"/,
    'PC 初始行数'
  );
  assert.match(
    app('styles.css'),
    /\.mem-answer-input \{[\s\S]{0,240}min-height: 132px/,
    '手机作答框最小高度'
  );
  assert.match(app('memory.js'), /textarea\.rows = 6;/, '手机初始行数');
});

test('新增的作答区与历史样式同样跟主题走，不写死颜色', () => {
  const css = pc('styles.css');
  const start = css.indexOf('作答区：AI 判定的入口');
  assert.ok(start > 0, '找不到作答区样式段');
  // 只截到下一段（新建 / 编辑卡片）为止，后面的侧边栏样式是既有代码。
  const end = css.indexOf('新建 / 编辑卡片', start);
  const block = css.slice(start, end > start ? end : undefined);
  // 只查「颜色值」：十六进制、rgb()、hsl()。border: none 这类不带颜色的声明不算。
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/, '作答区/历史样式里出现了硬编码十六进制颜色');
  assert.doesNotMatch(block, /\brgba?\(/, '作答区/历史样式里出现了硬编码 rgb()');
  assert.doesNotMatch(block, /\bhsla?\(/, '作答区/历史样式里出现了硬编码 hsl()');
  // 关键元素至少要用到主题令牌
  assert.match(block, /\.memory-answer-input \{[\s\S]{0,220}border: 1px solid var\(--mv-border\)/);
  assert.match(block, /\.memory-judge-badge \{[\s\S]{0,240}background: var\(--mv-surface\)/);
});

test('局域网同步：附件白名单放行笔记内嵌图片，其余内部目录仍拒绝', () => {
  const main = pc('main.js');
  const start = main.indexOf('function resolveSyncAsset(');
  assert.ok(start > 0, 'resolveSyncAsset 必须存在');
  const end = main.indexOf('\n}', start);
  const block = main.slice(start, end > start ? end : undefined);
  // 内嵌图片在内部元数据目录的 notice_note_images 子目录，属于内容，必须单独放行
  assert.match(block, /IMAGE_ASSET_DIR_NAME/, '图片子目录白名单不能丢');
  assert.match(block, /isPathInside\(imageRoot, absolute\)/);
  // 其余内部目录（密码哈希、卡片落盘等）仍然拒绝
  assert.match(block, /isInternalDirectory\(segment\)/);
  // 清单与下载走同一份快照资产集合，避免「清单有、下载 404」的契约错位
  assert.match(main, /assets: snapshot\.assets/);
});

test('手机端 hidden 兜底：自定义 display 的面板/遮罩必须能被 hidden 隐藏', () => {
  const css = app('styles.css');
  assert.match(css, /\[hidden\]\s*\{\s*display: none !important;\s*\}/);
});

test('手机端镜像 PC 可见性：浏览藏回顾文件夹，回顾/日历只取复习文件', () => {
  const main = pc('main.js');
  // 文件夹摘要必须带 isReviewFolder，手机端才能隐藏 .study_notice（PC 侧边栏同款规则）
  const folderSummary = main.slice(
    main.indexOf('function createMobileFolderSummary('),
    main.indexOf('async function createMobileExportSnapshot('),
  );
  assert.match(folderSummary, /isReviewFolder: Boolean\(folder\.isReviewFolder\)/);
  // 笔记/资源摘要都要带 isReviewFile，回顾与日历候选才能只认复习文件
  const noteSummary = main.slice(
    main.indexOf('function createMobileNoteSummary('),
    main.indexOf('function createMobileFolderSummary('),
  );
  assert.match(noteSummary, /isReviewFile: Boolean\(note\.isReviewFile\)/);
  assert.match(main, /isReviewFile: Boolean\(file\.isReviewFile\)/, '资源摘要缺 isReviewFile');

  const appSource = app('app.js');
  assert.match(appSource, /function isReviewBrowseFolder\(/, '需要沿祖先链判断回顾目录');
  const childFolders = appSource.slice(
    appSource.indexOf('function getChildFolders('),
    appSource.indexOf('function getFolderById('),
  );
  assert.match(childFolders, /!isReviewBrowseFolder\(folder\.id\)/, '浏览树要藏回顾目录及子目录');
  const filteredNotes = appSource.slice(
    appSource.indexOf('function getFilteredNotes('),
    appSource.indexOf('function getFilteredResources('),
  );
  assert.match(filteredNotes, /note\.isReviewFile/, '浏览/搜索不展示复习笔记');
  const filteredResources = appSource.slice(
    appSource.indexOf('function getFilteredResources('),
    appSource.indexOf('function getChildFolders('),
  );
  assert.match(filteredResources, /file\.isReviewFile/, '浏览/搜索不展示复习资料');

  // 回顾面板镜像 PC getReviewDayMap：内容天走共享 day-index，不在手机端再攒一套候选。
  // 队列已从手机端移除（2026-11-19），所以这里锁的是「用共享索引」而不是旧的 rvGetCandidates。
  const review = app('review.js');
  assert.match(
    review,
    /toReviewDayMap\(buildDayIndex\(/,
    '回顾面板要走共享索引 buildDayIndex + toReviewDayMap'
  );
  assert.doesNotMatch(review, /!item\.isReviewFile/, '不要在手机端重复实现复习文件过滤');
  assert.doesNotMatch(review, /textContent = ['"]回顾队列['"]/, '手机端不再展示回顾队列');
  assert.match(review, /isProtected/, '密码保护目录的内容不上回顾面板');
  // 日历内容天与安排条目都走共享 day-index（与 PC 提醒日历同一口径），
  // 手机端不再自己 filter isReviewFile / 自己读 reminders，否则就是第四套口径。
  const calendar = app('calendar.js');
  assert.match(
    calendar,
    /toReviewDayMap\(buildDayIndex\(/,
    '日历内容天要走共享索引 buildDayIndex + toReviewDayMap'
  );
  assert.match(calendar, /buildCalendarEntries\(/, '日历安排条目要走共享 buildCalendarEntries');
  assert.doesNotMatch(calendar, /!item\.isReviewFile/, '不要在手机端重复实现复习文件过滤');
  assert.doesNotMatch(
    calendar,
    /item\.dayKey === dayKey/,
    '提醒条目要按 date 匹配选中日，dayKey 是内容天'
  );
});

test('回到前台的刷新不能改变当前 Tab 的视图', () => {
  const appSource = app('app.js');
  const tabs = app('tabs.js');

  // showContentPanel 被 resume / 同步刷新复用，必须按当前 Tab 让位
  const showPanel = appSource.slice(
    appSource.indexOf('function showContentPanel('),
    appSource.indexOf('function showNoteDetailPanel('),
  );
  assert.match(showPanel, /isNotesTabActive\(\)/, 'showContentPanel 要识别当前 Tab');
  assert.match(appSource, /document\.body\.dataset\.activeTab/, 'app.js 要读 body[data-active-tab]');

  // loadLibrary 是「重新读数据」，不是「切回笔记列表」：详情页也不能被收起
  const loadLibrary = appSource.slice(
    appSource.indexOf('async function loadLibrary('),
    appSource.indexOf('installNavigationHistory();'),
  );
  assert.match(loadLibrary, /ensureNotesPanelVisible\(\)/, '后台刷新只能保证列表可见');
  assert.doesNotMatch(loadLibrary, /^\s*showContentPanel\(\);$/m, 'loadLibrary 不能强行切回笔记列表');

  assert.match(tabs, /document\.body\.dataset\.activeTab = name/, 'switchTab 必须写 Tab 标记');
  assert.match(tabs, /function restoreActivePanel/, '回到前台要有兜底对齐');
  assert.match(tabs, /addEventListener\('visibilitychange'/, '可见性恢复要重新对齐面板');
});

test('手机日历点条目是原地展开抽屉，不切月份', () => {
  const calendar = app('calendar.js');
  const createEntry = calendar.slice(
    calendar.indexOf('function calCreateEntry('),
    calendar.indexOf('function calRenderEntryDrawer('),
  );
  assert.match(createEntry, /calExpandedEntry = isOpen \? '' : entryId/, '再点一次要收起');
  assert.doesNotMatch(createEntry, /calMonth\s*=/, '点条目不该切走当前月份');
  assert.match(calendar, /cal-entry-drawer/, '抽屉容器不能删');
  assert.match(calendar, /rvCompleteDay\(entry\.dayKey\)/, '抽屉里的标记按钮作用于这一套的 dayKey');
});

test('PC 提醒日历点条目也是原地展开抽屉，不切回顾面板', () => {
  const sidebar = pc('renderer/sidebar.js');
  const createEntry = sidebar.slice(
    sidebar.indexOf('function createReminderEntry('),
    sidebar.indexOf('function createReminderEntryDrawer('),
  );
  assert.match(createEntry, /reminderExpandedEntry = isOpen \? "" : entryId/, '再点一次要收起');
  assert.doesNotMatch(createEntry, /activateReviewBrowser\(/, '点条目不该切走侧边栏视图');
  assert.doesNotMatch(createEntry, /selectReviewDay\(/, '点条目不该跳天');

  // 抽屉内容必须来自共享 dayIndex（getReviewDayMap），不能自己再算一套
  const drawer = sidebar.slice(
    sidebar.indexOf('function createReminderEntryDrawer('),
    sidebar.indexOf('function revealExpandedReminderEntry('),
  );
  assert.match(drawer, /dayMap\.get\(entry\.dayKey\)/, '抽屉内容要按 dayKey 取');
  assert.match(drawer, /handleDailyReview\(entry\.dayKey, "complete"\)/, '标记按钮作用于这一套的 dayKey');

  // 状态收在 appState 里，不新增顶层 let
  assert.match(pc('renderer/state.js'), /reminderExpandedEntry:/, '展开态要进 appState');
  assert.doesNotMatch(sidebar, /^let reminderExpandedEntry/m, '不要新增顶层 let');
});

test('手机端从日历/回顾打开文章，返回要回到来源 Tab', () => {
  const appSource = app('app.js');
  const tabs = app('tabs.js');

  // openNoteFromTab 必须记住来源 Tab 再切笔记：详情页返回据此回到原处
  assert.match(tabs, /const originTab = activeTab;/, '打开详情前要先记住来源 Tab');
  assert.match(tabs, /openNote\(noteId, \{ originTab \}\)/, '来源 Tab 要传给 openNote');

  // 关详情统一走 closeNoteDetail：来源不是笔记就切回原 Tab，而不是一律落回列表
  const close = appSource.slice(
    appSource.indexOf('function closeNoteDetail('),
    appSource.indexOf('function ensureNotesPanelVisible('),
  );
  assert.match(close, /originTab !== 'notes'/, '来源不是笔记时要切回原 Tab');
  assert.match(close, /window\.NoticeNoteTabs\.switchTab\(originTab\)/);

  // 「← 返回」与安卓物理返回键两条路径都要走同一个函数
  assert.match(appSource, /if \(!noteDetailPanel\.hidden\) \{\s*closeNoteDetail\(\);/, '系统返回键要走 closeNoteDetail');
  assert.match(appSource, /noteBackButton\.addEventListener\('click', \(\) => \{\s*closeNoteDetail\(\);/, '返回按钮要走 closeNoteDetail');

  // 经典脚本顶层的 const 不会挂到 window；app.js 用的是 window.NoticeNoteTabs，必须显式挂
  assert.match(tabs, /window\.NoticeNoteTabs = api;/, 'tabs.js 要显式挂 window，否则 app.js 里的 window 调用全是 undefined');
});

test('手机端界面主题：6 套极简主题与 PC 同 id，颜色只能走令牌', () => {
  const html = app('index.html');
  // 主题脚本必须在 head 里先跑，否则首屏会先渲染默认纸色再跳
  assert.match(html, /<head>[\s\S]*?themes\.js/, 'themes.js 要在 head 里引入');
  assert.match(html, /id="msetThemeList"/, '设置面板要有主题列表容器');

  const themes = app('themes.js');
  assert.match(themes, /notice-note-mobile-theme/, '主题要落 localStorage');
  assert.match(themes, /document\.documentElement\.dataset\.theme/, '主题挂 <html data-theme>');
  assert.doesNotMatch(themes, /document\.body\.dataset\.theme/, '不要挂 body，html 上才能让 :root 背景一起换');

  // 与 PC renderer/themes.js 的 minimal 分类逐个对齐，PC 加主题时这里会提醒补
  const pcThemes = pc('renderer/themes.js');
  const pcMinimal = [...pcThemes.matchAll(/id:\s*"([a-z_]+)",\s*name:\s*"[^"]+",\s*category:\s*"minimal"/g)].map((m) => m[1]);
  const appIds = [...themes.matchAll(/id:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(appIds, pcMinimal, '手机端主题 id 要与 PC 极简日常一致');

  const css = app('styles.css');
  for (const id of pcMinimal) {
    assert.match(css, new RegExp(`html\\[data-theme="${id}"\\]\\s*\\{`), `缺 ${id} 主题变量块`);
  }

  // 去掉 :root 与主题块后，组件样式里不许再写死暖米色（否则深色主题会白一块黑一块）
  const withoutTokens = css.replace(/(:root|html\[data-theme="[^\]]+"\])\s*\{[^}]*\}/g, '');
  assert.doesNotMatch(withoutTokens, /#f5c56b/i, '组件样式里还有硬编码的暖黄');
  assert.doesNotMatch(withoutTokens, /rgba\(245,\s*197,\s*107/i, '组件样式里还有硬编码的暖黄');
  assert.doesNotMatch(withoutTokens, /rgba\(255,\s*250,\s*243/i, '组件样式里还有硬编码的纸白');
  assert.doesNotMatch(withoutTokens, /#fffaf3/i, '组件样式里还有硬编码的纸白');
  assert.doesNotMatch(withoutTokens, /#2f241b/i, '组件样式里还有硬编码的墨色');

  // 组件颜色必须引用令牌（抽查几个改动过的位置）
  assert.match(css, /\.content-tools\s*\{[\s\S]{0,260}background: var\(--paper-veil\)/);
  assert.match(css, /\.msettings-field input\s*\{[\s\S]{0,200}background: var\(--surface-input\)/);
  assert.match(css, /\.msettings-dialog::backdrop\s*\{\s*background: var\(--overlay\)/);

  // 设置面板要真的渲染主题列表
  assert.match(app('msettings.js'), /NoticeNoteThemes\.renderPicker\(msetThemeList\)/);
});

test('手机端键盘弹出时底部 Tab 要让位，不能顶在键盘上沿', () => {
  const appSource = app('app.js');
  const css = app('styles.css');

  // Android WebView 走 adjustResize：键盘弹出后 window.innerHeight 直接变小，
  // position:fixed; bottom:0 的 Tab 会跟着弹到键盘上沿，正好压在作答按钮上面。
  assert.match(appSource, /const KEYBOARD_SHRINK_THRESHOLD = \d+;/, '要有视口缩水阈值');
  assert.match(appSource, /document\.body\.classList\.toggle\('is-keyboard-open', open\)/, '要打键盘态标记');
  assert.match(appSource, /window\.addEventListener\('resize', syncKeyboardLayout\)/, '视口变化要重算');
  assert.match(appSource, /function isTextEntryFocused\(\)/, '要区分输入框和按钮，点按钮不弹键盘');

  // 没聚焦输入框时缩窗口（桌面拖窗口大小）不能误判成键盘弹出
  assert.match(
    appSource,
    /const open = shrinking && \(keyboardOpen \|\| isTextEntryFocused\(\)\)/,
    '键盘态必须和输入框焦点绑定',
  );

  assert.match(css, /body\.is-keyboard-open \.tab-bar\s*\{\s*display: none;/, '键盘态下 Tab 要隐藏');
  assert.match(
    css,
    /body\.is-keyboard-open \.app-shell\s*\{\s*padding-bottom: 16px;/,
    'Tab 藏了要把 84px 下边距收掉，否则键盘上方多一条空白',
  );
});

test('PC 作答框：Enter 换行，Shift + Enter 才提交', () => {
  const memory = pc('renderer/memory.js');
  const html = pc('index.html');

  // 写长答案时回车几乎都是想换行；只用 Enter 提交会边写边误提交。
  assert.match(
    memory,
    /if \(event\.key === "Enter" && event\.shiftKey\) \{\s*event\.preventDefault\(\);\s*submitMemoryAnswer\(\);/,
    'Shift + Enter 要提交',
  );
  assert.doesNotMatch(
    memory,
    /event\.key === "Enter" && !event\.shiftKey\) \{\s*event\.preventDefault\(\);\s*submitMemoryAnswer\(\);/,
    '光回车不能再提交',
  );

  // 提示文案必须和实际按键一致，否则用户按提示操作会当场踩坑
  assert.match(html, /Shift \+ Enter 提交 · Enter 换行/, 'index.html 的提示要更新');
  assert.match(memory, /"Shift \+ Enter 提交 · Enter 换行 · 完全不会就写「不会」"/, '渲染时的提示也要更新');
  assert.doesNotMatch(html, /回车提交后才会看到答案/, '占位文案不能还写「回车提交」');
});
