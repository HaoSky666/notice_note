// 界面主题数据与主题切换
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
const THEME_LIST = [
  {
    id: "paper",
    name: "暖色纸张",
    category: "minimal",
    desc: "柔和米色，保持经典纸张质感",
    avatar: "",
  },
  {
    id: "blue",
    name: "清爽蓝",
    category: "minimal",
    desc: "明亮简洁，层次更清晰",
    avatar: "",
  },
  {
    id: "mint",
    name: "薄荷绿",
    category: "minimal",
    desc: "自然淡雅，阅读更舒缓",
    avatar: "",
  },
  {
    id: "dark",
    name: "暗夜极客",
    category: "minimal",
    desc: "深色极简，夜间沉浸高效",
    avatar: "",
  },
  {
    id: "miku",
    name: "初音未来",
    category: "anime",
    desc: "葱绿元气二次元偶像",
    avatar: "./assets/themes/miku.jpg",
  },
  {
    id: "sakura",
    name: "霓虹樱花",
    category: "anime",
    desc: "梦幻浪漫樱粉与夜色少女",
    avatar: "./assets/themes/sakura.jpg",
  },
  {
    id: "violet",
    name: "永恒之紫",
    category: "anime",
    desc: "优雅紫罗兰魔女治愈风",
    avatar: "./assets/themes/violet.jpg",
  },
  {
    id: "cyberpunk",
    name: "赛博朋克",
    category: "gaming",
    desc: "高能霓虹姬与夜幕暗紫",
    avatar: "./assets/themes/cyberpunk.jpg",
  },
  {
    id: "pixel",
    name: "复古 GameBoy",
    category: "gaming",
    desc: "8-Bit 像素小勇者与红白机回忆",
    avatar: "./assets/themes/pixel.jpg",
  },
  {
    id: "nte_city",
    name: "异环·海拉都市",
    category: "gaming",
    desc: "《异环》海拉都市夜景与荧光青异能",
    avatar: "./assets/themes/nte_city.jpg",
  },
  {
    id: "nte_mint",
    name: "异环·薄荷异象",
    category: "gaming",
    desc: "《异环》薄荷助手与异像古董店特别配色",
    avatar: "./assets/themes/nte_mint.jpg",
  },
  {
    id: "nte_anomaly",
    name: "异环·异象警告",
    category: "gaming",
    desc: "《异环》都市异象收容警告与黑黄警戒",
    avatar: "./assets/themes/nte_city.jpg",
  },
  {
    id: "nte_eloi",
    name: "异环·伊洛伊",
    category: "gaming",
    desc: "《异环》伊洛伊（薄绿发·黑粉犄角·灵属性），多小人立绘与炫彩爆棚",
    avatar: "./assets/themes/nte_eloi.png",
  },
  {
    id: "crimson",
    name: "暗黑血色",
    category: "gaming",
    desc: "深邃龙姬与炽热血红游戏风",
    avatar: "./assets/themes/crimson.jpg",
  },
];
const INTERFACE_THEMES = new Set(THEME_LIST.map((t) => t.id));
let activeThemeCategory = "all";
function getInterfaceTheme() {
  const savedTheme = localStorage.getItem(INTERFACE_THEME_KEY);
  return INTERFACE_THEMES.has(savedTheme) ? savedTheme : "paper";
}
function updateThemeSummaryCard(themeId) {
  const info = THEME_LIST.find((t) => t.id === themeId) || THEME_LIST[0];
  if (currentThemePreview) {
    if (info.avatar) {
      currentThemePreview.className = `settings-theme-preview theme-preview-${info.id} has-avatar`;
      currentThemePreview.innerHTML = `<img class="theme-avatar-img" src="${info.avatar}" alt="${info.name}">`;
    } else {
      currentThemePreview.className = `settings-theme-preview theme-preview-${info.id}`;
      currentThemePreview.innerHTML = `<i></i><i></i><i></i>`;
    }
  }
  if (currentThemeName) currentThemeName.textContent = info.name;
  if (currentThemeDesc) currentThemeDesc.textContent = info.desc;
}
function applyInterfaceTheme(theme) {
  const nextTheme = INTERFACE_THEMES.has(theme) ? theme : "paper";
  document.body.dataset.theme = nextTheme;
  localStorage.setItem(INTERFACE_THEME_KEY, nextTheme);
  updateThemeSummaryCard(nextTheme);
}
function renderThemePickerGrid() {
  if (!themePickerGrid) return;
  const allCount = THEME_LIST.length;
  const minimalCount = THEME_LIST.filter((t) => t.category === "minimal").length;
  const animeCount = THEME_LIST.filter((t) => t.category === "anime").length;
  const gamingCount = THEME_LIST.filter((t) => t.category === "gaming").length;

  themePickerTabs.forEach((tab) => {
    const cat = tab.dataset.category;
    const isActive = cat === activeThemeCategory;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
    if (cat === "all") tab.textContent = `全部 (${allCount})`;
    else if (cat === "minimal") tab.textContent = `🌿 极简日常 (${minimalCount})`;
    else if (cat === "anime") tab.textContent = `🌸 二次元动漫 (${animeCount})`;
    else if (cat === "gaming") tab.textContent = `🎮 游戏电竞 (${gamingCount})`;
  });

  const currentTheme = getInterfaceTheme();
  const filtered =
    activeThemeCategory === "all"
      ? THEME_LIST
      : THEME_LIST.filter((t) => t.category === activeThemeCategory);

  themePickerGrid.innerHTML = filtered
    .map((t) => {
      const isSelected = t.id === currentTheme;
      const categoryBadge =
        t.category === "anime"
          ? "🌸 二次元"
          : t.category === "gaming"
            ? "🎮 游戏"
            : "🌿 极简";
      const previewHtml = t.avatar
        ? `<span class="settings-theme-preview theme-preview-${t.id} has-avatar" aria-hidden="true"><img class="theme-avatar-img" src="${t.avatar}" alt="${t.name}"></span>`
        : `<span class="settings-theme-preview theme-preview-${t.id}" aria-hidden="true"><i></i><i></i><i></i></span>`;

      return `
      <button class="theme-picker-card-item ${isSelected ? "is-selected" : ""}" type="button" data-theme-id="${t.id}" aria-label="应用主题：${t.name}。${t.desc}" aria-pressed="${isSelected}">
        ${previewHtml}
        <span class="theme-picker-card-info">
          <span class="theme-picker-card-header">
            <strong>${t.name}</strong>
            <span class="theme-category-badge category-${t.category}">${categoryBadge}</span>
          </span>
          <small>${t.desc}</small>
        </span>
        ${isSelected ? '<span class="theme-applied-badge">✓ 当前应用</span>' : '<span class="theme-apply-btn">使用</span>'}
      </button>
    `;
    })
    .join("");

  themePickerGrid
    .querySelectorAll(".theme-picker-card-item")
    .forEach((card) => {
      card.addEventListener("click", () => {
        const themeId = card.dataset.themeId;
        applyInterfaceTheme(themeId);
        renderThemePickerGrid();
      });
    });
}
