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

  function switchTab(name) {
    if (!TAB_NAMES.includes(name)) {
      return;
    }
    activeTab = name;
    const panels = getPanels();
    const noteDetailPanel = document.querySelector('#noteDetailPanel');
    if (noteDetailPanel) {
      noteDetailPanel.hidden = true;
    }
    for (const tab of TAB_NAMES) {
      if (panels[tab]) {
        panels[tab].hidden = tab !== name;
      }
    }
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

  // 从日历/回顾打开笔记：切回笔记 Tab 再进详情，保持导航状态一致
  function openNoteFromTab(noteId) {
    switchTab('notes');
    openNote(noteId).catch((error) => {
      const statusText = document.querySelector('#statusText');
      if (statusText) {
        statusText.textContent = error.message || '读取本地文件失败';
      }
    });
  }

  function boot() {
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
  }

  boot();

  return {
    switchTab,
    handleBack,
    openNoteFromTab,
    getActive: () => activeTab
  };
})();