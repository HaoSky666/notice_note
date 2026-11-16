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
  assert.match(source, /transaction\(\[ASSET_STORE, SNAPSHOT_STORE\], 'readwrite'\)/);
  assert.match(source, /transaction\.onabort/);
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
  assert.match(read('notice_note_client_app/android/app/build.gradle'), /versionName "0\.1\.0"/);
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
