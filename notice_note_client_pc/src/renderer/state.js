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
  // 提醒日历里展开的那个安排条目（`日期|kind|dayKey`）。空串 = 全部收起。
  reminderExpandedEntry: "",
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
  imageLightboxZoom: 1,
  // 记忆卡：最近一次 IPC 快照、当前面板、正在学的卡、是否已翻面。
  memorySnapshot: null,
  memoryViewMode: "study",
  memoryCurrentCardId: null,
  memoryEditingCardId: null,
  memoryRevealed: false,
  // 编辑会话号：显式打开编辑器才 +1，用来区分「新一次编辑」和「后台重渲染」，
  // 后者不能把输入框写回快照值（否则切窗口回来草稿就没了）。
  memoryEditorSession: 0,
  memoryEditorRenderedSession: 0,
  // 按类型学习的当前筛选（null = 全部）。由主进程快照回传，渲染层只做镜像。
  memoryTypeFilter: null,
  // 编辑器里正在编辑的类型列表，保存时随卡面一起提交。
  memoryEditorTypes: [],
  // 从笔记右键「制作成记忆卡片」弹出的快速建卡框：来源笔记 id 与已选类型。
  // 与 memoryEditorTypes 分开存，两处互不干扰；关闭弹框即清空。
  memoryQuickNoteId: null,
  memoryQuickTypes: [],
  // AI 判定：作答草稿、判定状态机、最近一次判定结果、当前卡的作答历史。
  // 草稿带 cardId：切卡才清空，后台重渲染不能把正在敲的内容冲掉。
  memoryAnswerDraft: "",
  memoryAnswerDraftCardId: null,
  // idle（还没作答）| judging（等待模型）| result（已出结果，等下一张）| error（判定失败，退回手动）| override（改判中）
  memoryJudgeState: "idle",
  memoryJudgeResult: null,
  memoryJudgeError: "",
  memoryAnswers: [],
  memoryAnswersCardId: null,
  memoryAnswersExpanded: false,
  // 历史请求序号：快速切卡时丢弃后到的旧响应。
  memoryAnswersSeq: 0,
  // 设置弹窗里的 AI 判定配置（含 apiKey，只在主进程与设置页之间流转）。
  aiJudgeSettings: null
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
