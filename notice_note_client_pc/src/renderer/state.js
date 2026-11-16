// 渲染层状态：唯一来源收进 appState 对象，不再有 50+ 个顶层 let 散落在全局词法环境。
// 13 个经典脚本仍用裸标识符读写（本文件通过全局对象属性做 get/set 转发），
// 因此不需要同步改 12 个文件；新增状态一律加进 appState，禁止再新增顶层 let。
// window.noticeNoteStateSnapshot() 供调试与冒烟测试核对状态集合。
const appState = {
  notes: [],
  folders: [],
  pdfFiles: [],
  resourceFiles: [],
  activeNoteId: null,
  activePdfId: null,
  activeResourceId: null,
  activeFolderId: null,
  sidebarViewMode: "all",
  reminderCalendarMonth: new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ),
  selectedReminderDate: toLocalDateKey(new Date()),
  noteRecoveryLogCache: null,
  storageInfo: null,
  appSettings: null,
  // 侧边栏拖拽中的条目 { kind: "folders"|"notes"|"files", id }。
  // HTML5 拖拽在 dragover 阶段读不到 dataTransfer，靠它判断落点算「排序」还是「移入目录」。
  sidebarDrag: null,
  markdownEditor: null,
  isRenderingEditor: false,
  pdfLoadingTask: null,
  pdfDocument: null,
  pdfPreviewKey: null,
  pdfPreviewReadyKey: null,
  pdfPreviewPromise: null,
  pdfOutlineEntries: [],
  pdfOutlineIndexVersion: 0,
  pdfOutlineHighlightFrame: null,
  activePdfOutlineButton: null,
  pdfZoom: 1,
  pdfLoadVersion: 0,
  pdfPageRenderVersion: 0,
  pdfPageObserver: null,
  pdfLazyJobs: [],
  imageZoom: 1,
  workspaceTabs: [],
  activeWorkspaceTabKey: null,
  draggedWorkspaceTabKey: null,
  workspaceTabDragStartedAt: 0,
  workspaceTabPointerDrag: null,
  workspaceContentRenderVersion: 0,
  filePreviewVersion: 0,
  draftsMap: new Map(),
  activeDraftId: null,
  pendingCloseDraftId: null,
  pendingCloseTabKey: null,
  wordOutlineHeadings: [],
  wordOutlineHighlightFrame: null,
  viewerSearchMatches: [],
  activeViewerSearchIndex: -1,
  imageLightboxPreviousFocus: null,
  imageLightboxZoom: 1
};

const appStateConstants = {
  SIDEBAR_COLLAPSED_KEY: "notice-note:sidebar-collapsed",
  SIDEBAR_WIDTH_KEY: "notice-note:sidebar-width",
  SIDEBAR_MIN_WIDTH: 200,
  SIDEBAR_MAX_WIDTH: 600,
  PDF_OUTLINE_WIDTH_KEY: "notice-note:pdf-outline-width",
  PDF_OUTLINE_MIN_WIDTH: 160,
  PDF_OUTLINE_MAX_WIDTH: 600,
  INTERFACE_THEME_KEY: "notice-note:interface-theme",
  DRAFTS_PERSIST_KEY: "notice-note:drafts",
  WORKSPACE_TABS_PERSIST_KEY: "notice-note:workspace-tabs",
  ACTIVE_TAB_PERSIST_KEY: "notice-note:active-workspace-tab",
  NOTE_RECOVERY_PERSIST_KEY: "notice-note:recovery-log:v1",
  IMAGE_LIGHTBOX_MIN_ZOOM: 0.25,
  IMAGE_LIGHTBOX_MAX_ZOOM: 5,
  noteSaveStates: new Map(),
  blurRevealState: { revealed: new Map() },
  workspaceTabViewStates: new Map(),
  editorEmptyState: (() => {
    const element = document.createElement("div");
    element.className = "editor-empty-state";
    element.hidden = true;
    element.innerHTML =
      "<h2>欢迎使用 Notice Note</h2><p>从左侧打开一个文件，或点击左上角 + 新建内容。</p>";
    return element;
  })()
};

contentShell.append(appStateConstants.editorEmptyState);

for (const key of Object.keys(appState)) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    enumerable: true,
    get() {
      return appState[key];
    },
    set(value) {
      appState[key] = value;
    },
  });
}

for (const [key, value] of Object.entries(appStateConstants)) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    enumerable: true,
    writable: false,
    value,
  });
}

window.noticeNoteAppState = appState;
window.noticeNoteStateSnapshot = () => ({ ...appState });
