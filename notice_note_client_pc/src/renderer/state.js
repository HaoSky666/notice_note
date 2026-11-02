// 渲染进程可变状态与持久化键名
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
let notes = [];
let folders = [];
let pdfFiles = [];
let resourceFiles = [];
let activeNoteId = null;
let activePdfId = null;
let activeResourceId = null;
let activeFolderId = null;
let sidebarViewMode = "all";
let reminderCalendarMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1,
);
let selectedReminderDate = toLocalDateKey(new Date());
const noteSaveStates = new Map();
let noteRecoveryLogCache = null;
let storageInfo = null;
let appSettings = null;
let markdownEditor = null;
let isRenderingEditor = false;
const blurRevealState = { revealed: new Map() };
let pdfLoadingTask = null;
let pdfDocument = null;
let pdfPreviewKey = null;
let pdfPreviewReadyKey = null;
let pdfPreviewPromise = null;
let pdfOutlineEntries = [];
let pdfOutlineIndexVersion = 0;
let pdfOutlineHighlightFrame = null;
let activePdfOutlineButton = null;
let pdfZoom = 1;
let pdfLoadVersion = 0;
let pdfPageRenderVersion = 0;
let imageZoom = 1;
let workspaceTabs = [];
let activeWorkspaceTabKey = null;
let draggedWorkspaceTabKey = null;
let workspaceTabDragStartedAt = 0;
let workspaceTabPointerDrag = null;
let workspaceContentRenderVersion = 0;
const workspaceTabViewStates = new Map();
let filePreviewVersion = 0;
let draftsMap = new Map();
let activeDraftId = null;
let pendingCloseDraftId = null;
let pendingCloseTabKey = null;
let wordOutlineHeadings = [];
let wordOutlineHighlightFrame = null;
let viewerSearchMatches = [];
let activeViewerSearchIndex = -1;
const SIDEBAR_COLLAPSED_KEY = "notice-note:sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "notice-note:sidebar-width";
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;
const PDF_OUTLINE_WIDTH_KEY = "notice-note:pdf-outline-width";
const PDF_OUTLINE_MIN_WIDTH = 160;
const PDF_OUTLINE_MAX_WIDTH = 600;
const INTERFACE_THEME_KEY = "notice-note:interface-theme";
const DRAFTS_PERSIST_KEY = "notice-note:drafts";
const WORKSPACE_TABS_PERSIST_KEY = "notice-note:workspace-tabs";
const ACTIVE_TAB_PERSIST_KEY = "notice-note:active-workspace-tab";
const NOTE_RECOVERY_PERSIST_KEY = "notice-note:recovery-log:v1";
const editorEmptyState = document.createElement("div");
editorEmptyState.className = "editor-empty-state";
editorEmptyState.hidden = true;
editorEmptyState.innerHTML =
  "<h2>欢迎使用 Notice Note</h2><p>从左侧打开一个文件，或点击左上角 + 新建内容。</p>";
contentShell.append(editorEmptyState);

let imageLightboxPreviousFocus = null;
let imageLightboxZoom = 1;
const IMAGE_LIGHTBOX_MIN_ZOOM = 0.25;
const IMAGE_LIGHTBOX_MAX_ZOOM = 5;
