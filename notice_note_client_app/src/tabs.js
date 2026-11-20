// 底部 Tab 导航与启动 wiring（经典脚本，最后加载）。
// 笔记 Tab 沿用 app.js 的列表/详情；日历/回顾/记忆各自一个面板。
// 返回键优先消费：关设置面板 → 非笔记 Tab 回笔记 → 交给 app.js 的导航逻辑。
const NoticeNoteTabs = (() => {
  'use strict';

  const TAB_NAMES = ['notes', 'calendar', 'review', 'memory'];
  let activeTab = 'notes';

  function getPanels() {
    return {
      notes: document.querySelector('#contentPanel'),
      calendar: document.querySelector('#calendarPanel'),
      review: document.querySelector('#reviewPanel'),
      memory: document.querySelector('#memoryPanel')
    };
  }

  function renderActive() {
    if (activeTab === 'calendar') {
      calRender();
    } else if (activeTab === 'review') {
      rvRender();
    } else if (activeTab === 'memory') {
      memRender();
    }
  }

  function syncPanelVisibility() {
    const panels = getPanels();
    for (const tab of TAB_NAMES) {
      if (panels[tab]) {
        panels[tab].hidden = tab !== activeTab;
      }
    }
    // 非笔记 Tab 下详情页必须收起，否则会盖在当前 Tab 上面
    const noteDetailPanel = document.querySelector('#noteDetailPanel');
    if (noteDetailPanel) {
      noteDetailPanel.hidden = true;
    }
  }

  function switchTab(name) {
    if (!TAB_NAMES.includes(name)) {
      return;
    }
    activeTab = name;
    // app.js 的 showContentPanel() 读这个标记：后台刷新不能把笔记列表顶到别的 Tab 前面
    document.body.dataset.activeTab = name;
    syncPanelVisibility();
    document.querySelectorAll('#tabBar .tab-item').forEach((button) => {
      const selected = button.dataset.tab === name;
      button.classList.toggle('is-active', selected);
      if (selected) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });
    renderActive();
    window.scrollTo({ top: 0 });
  }

  // 回到前台时的兜底：只对齐非笔记 Tab 的面板显隐，不重绘、不滚动。
  // 笔记 Tab 的「列表 ↔ 详情」由 app.js 自己管，这里不能插手（会把详情页收起）。
  function restoreActivePanel() {
    if (activeTab === 'notes') {
      return;
    }
    syncPanelVisibility();
  }

  // 返回 true 表示本次返回键已被消费
  function handleBack() {
    const dialog = document.querySelector('#msettingsDialog');
    if (dialog?.open) {
      dialog.close();
      return true;
    }
    const progress = document.querySelector('#syncProgress');
    if (progress && !progress.hidden) {
      progress.hidden = true;
      return true;
    }
    if (activeTab !== 'notes') {
      switchTab('notes');
      return true;
    }
    return false;
  }

  // 从日历/回顾打开笔记：切回笔记 Tab 再进详情，并记住来源 Tab。
  // 详情页的「返回」与系统返回键据此回到原 Tab，而不是一律落回笔记列表。
  function openNoteFromTab(noteId) {
    const originTab = activeTab;
    switchTab('notes');
    openNote(noteId, { originTab }).catch((error) => {
      const statusText = document.querySelector('#statusText');
      if (statusText) {
        statusText.textContent = error.message || '读取本地文件失败';
      }
    });
  }

  function boot() {
    document.body.dataset.activeTab = activeTab;
    document.querySelectorAll('#tabBar .tab-item').forEach((button) => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    document.querySelector('#syncButton')?.addEventListener('click', () => {
      if (NoticeNoteStore.getConnection()) {
        msetRunSync();
      } else {
        msetOpen();
      }
    });
    document.querySelector('#msettingsButton')?.addEventListener('click', msetOpen);
    // 同步/导入落库后刷新当前非笔记 Tab
    window.addEventListener('nn-library-changed', () => {
      if (activeTab !== 'notes') {
        renderActive();
      }
    });
    // 从后台切回来：app.js 的 resumeMobileSession 会重新 loadLibrary，
    // 其中 showContentPanel() 已被 Tab 守卫拦住；这里再对齐一次，防止别的路径改了 hidden。
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        restoreActivePanel();
      }
    });
    window.addEventListener('focus', restoreActivePanel);
  }

  boot();

  const api = {
    switchTab,
    handleBack,
    openNoteFromTab,
    getActive: () => activeTab
  };
  // 经典脚本顶层的 const 只进全局词法环境，不会变成 window 属性。
  // app.js 里用的是 window.NoticeNoteTabs?.xxx（返回键、详情页返回来源 Tab），
  // 不显式挂一次，那些调用全是 undefined。
  window.NoticeNoteTabs = api;
  return api;
})();