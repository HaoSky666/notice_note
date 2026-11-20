// 手机端界面主题（经典脚本，全局 NoticeNoteThemes）。
// 主题清单与 PC renderer/themes.js 的「极简日常」同 id、同配色，方便两端以后对照。
// 主题属性挂在 <html data-theme>，变量定义在 html[data-theme] 块里，body 及后代继承；
// themes.js 放在 <head> 加载，首屏就是对的颜色，不会先白一下再切。
const NoticeNoteThemes = (() => {
  'use strict';

  const STORAGE_KEY = 'notice-note-mobile-theme';
  const THEMES = [
    {
      id: 'paper',
      name: '暖色纸张',
      desc: '柔和米色，保持经典纸张质感',
      swatch: ['#f3efe7', '#fffdf8', '#2f6b55'],
    },
    {
      id: 'blue',
      name: '清爽蓝',
      desc: '明亮简洁，层次更清晰',
      swatch: ['#edf3f8', '#ffffff', '#3979a8'],
    },
    {
      id: 'mint',
      name: '薄荷绿',
      desc: '自然淡雅，阅读更舒缓',
      swatch: ['#eaf4ef', '#fbfffd', '#2f8063'],
    },
    {
      id: 'dark',
      name: '暗夜极客',
      desc: '深色极简，夜间沉浸高效',
      swatch: ['#1b1e24', '#20232a', '#6366f1'],
    },
    {
      id: 'deepseek',
      name: 'DeepSeek 浅色',
      desc: '纯净白底，接近电脑端浅色主题',
      swatch: ['#f7f8fa', '#ffffff', '#0f1115'],
    },
    {
      id: 'deepseek_dark',
      name: 'DeepSeek 深色',
      desc: '近黑底色，夜间阅读更安静',
      swatch: ['#1b1b1c', '#232325', '#f9fafb'],
    },
  ];
  const THEME_IDS = THEMES.map((theme) => theme.id);

  function get() {
    let saved = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      saved = null;
    }
    return THEME_IDS.indexOf(saved) >= 0 ? saved : 'paper';
  }

  function apply(id) {
    const next = THEME_IDS.indexOf(id) >= 0 ? id : 'paper';
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      // 无痕/隐私模式写不进去，本页仍然按选择生效
    }
    return next;
  }

  function renderPicker(container) {
    if (!container) return;
    const current = get();
    container.innerHTML = THEMES.map((theme) => {
      const isCurrent = theme.id === current;
      const chips = theme.swatch.map((color) => `<i style="background:${color}"></i>`).join('');
      return `
        <button class="mtheme-card${isCurrent ? ' is-current' : ''}" type="button" data-mtheme-id="${theme.id}" aria-pressed="${isCurrent}">
          <span class="mtheme-swatch" aria-hidden="true">${chips}</span>
          <span class="mtheme-info">
            <strong>${theme.name}</strong>
            <small>${theme.desc}</small>
          </span>
          <span class="mtheme-apply">${isCurrent ? '✓ 当前应用' : '使用'}</span>
        </button>
      `;
    }).join('');
    container.querySelectorAll('[data-mtheme-id]').forEach((card) => {
      card.addEventListener('click', () => {
        apply(card.dataset.mthemeId);
        renderPicker(container);
      });
    });
  }

  function init() {
    apply(get());
  }

  return { THEMES, get, apply, renderPicker, init };
})();

NoticeNoteThemes.init();
