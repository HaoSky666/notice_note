// 日历 Tab（经典脚本，全局函数以 cal 开头）。
// 展示口径与 PC「提醒日历」完全一致：条目由 lib/shared/day-index.js 的 buildCalendarEntries
// 生成（复习日 reminder / 已回顾 reviewed / 今日自动回顾 today），网格标记也只有 PC 有的三样：
// 当天安排条数徽章、今日回顾圆点、已看过圆点。
// 「有内容」这类内容天标记归回顾 Tab 管，不在这里重复——手机日历以前把 PC 两个日历揉成一个，
// 2026-11-19 按反馈收敛成只看安排。
let calMonth = null;
let calSelectedKey = '';
// 抽屉开关：`${date}|${kind}|${dayKey}`。切换日期/月份时清空，避免展开状态跟着漂。
let calExpandedEntry = '';

// 手机端字段名与 PC 不同（资源列表叫 resources），装配参数时映射一次。
function calGetSource(library) {
  const review = library.review || {};
  return {
    notes: library.notes || [],
    resourceFiles: library.resources || [],
    dayReminders: review.reminders || [],
    dayReviewLog: review.log || []
  };
}

function calGroupEntriesByDate(entries) {
  const map = new Map();
  for (const entry of entries) {
    const list = map.get(entry.date);
    if (list) {
      list.push(entry);
    } else {
      map.set(entry.date, [entry]);
    }
  }
  return map;
}

// 与 PC formatReviewDayShort 同款：2026-08-12 -> 8月12日
function calFormatDayShort(dayKey) {
  if (!dayKey) {
    return '未归天';
  }
  const [, month, day] = String(dayKey).split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function calEntryMeta(entry) {
  if (entry.kind === 'today') {
    return '今日回顾';
  }
  if (entry.kind === 'reviewed') {
    return `已回顾 · ${formatDateTime(entry.reviewedAt)}`;
  }
  return entry.done ? '已提醒' : '待提醒';
}

// 图例小样用 CSS 画，不用 ◔ ▢ 这类符号——部分字体缺字会显示成方块，各端也不一致。
function calCreateLegend() {
  const legend = document.createElement('p');
  legend.className = 'cal-legend';
  const items = [
    ['is-count', '安排条数'],
    ['is-daily', '今日回顾'],
    ['is-history', '已看过']
  ];
  for (const [kind, label] of items) {
    const item = document.createElement('span');
    item.className = 'cal-legend-item';
    const swatch = document.createElement('i');
    swatch.className = `cal-legend-swatch ${kind}`;
    swatch.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = label;
    item.append(swatch, text);
    legend.append(item);
  }
  return legend;
}

function calRender() {
  const panel = document.querySelector('#calendarPanel');
  if (!panel) {
    return;
  }
  panel.innerHTML = '';
  const library = NoticeNoteStore.getLibrary();
  if (!library) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '还没有内容：先在笔记页点「同步」配对电脑，或导入离线包。';
    panel.append(empty);
    return;
  }

  const todayKey = NoticeNoteDateUtils.toLocalDateKey(new Date());
  if (!calMonth) {
    const now = new Date();
    calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!calSelectedKey) {
    calSelectedKey = todayKey;
  }

  // 内容天只用来在点开条目后展示那一套内容，不参与网格标记。
  const source = calGetSource(library);
  const dayMap = toReviewDayMap(buildDayIndex(source));
  const entriesByDate = calGroupEntriesByDate(buildCalendarEntries(source, todayKey));

  // 页面标题：和回顾页的「每日回顾」同级，否则月初那块直接贴顶、没有起点。
  const heading = document.createElement('div');
  heading.className = 'tab-heading';
  const headingTitle = document.createElement('h2');
  headingTitle.textContent = '提醒日历';
  heading.append(headingTitle);
  panel.append(heading);

  // 头部：上一月 / 月份 / 下一月 / 回到今天
  const header = document.createElement('div');
  header.className = 'cal-header';
  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.className = 'cal-nav';
  prevButton.textContent = '‹';
  prevButton.setAttribute('aria-label', '上一月');
  prevButton.addEventListener('click', () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
    calExpandedEntry = '';
    calRender();
  });
  const title = document.createElement('strong');
  title.className = 'cal-title';
  title.textContent = `${calMonth.getFullYear()} 年 ${calMonth.getMonth() + 1} 月`;
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'cal-nav';
  nextButton.textContent = '›';
  nextButton.setAttribute('aria-label', '下一月');
  nextButton.addEventListener('click', () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
    calExpandedEntry = '';
    calRender();
  });
  const todayButton = document.createElement('button');
  todayButton.type = 'button';
  todayButton.className = 'cal-today';
  todayButton.textContent = '今天';
  todayButton.addEventListener('click', () => {
    const now = new Date();
    calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    calSelectedKey = todayKey;
    calExpandedEntry = '';
    calRender();
  });
  header.append(prevButton, title, nextButton, todayButton);
  panel.append(header);

  // 月历网格（周一起始，与 PC 一致）
  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  for (const label of ['一', '二', '三', '四', '五', '六', '日']) {
    const cell = document.createElement('div');
    cell.className = 'cal-week';
    cell.textContent = label;
    grid.append(cell);
  }
  const firstWeekday = (calMonth.getDay() + 6) % 7;
  for (let i = 0; i < firstWeekday; i += 1) {
    const blank = document.createElement('div');
    blank.className = 'cal-day is-blank';
    grid.append(blank);
  }
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
    const dayKey = NoticeNoteDateUtils.toLocalDateKey(date);
    const dayEntries = entriesByDate.get(dayKey) || [];
    const hasDailyReview = dayEntries.some((entry) => entry.kind === 'today');
    const hasReviewHistory = dayEntries.some((entry) => entry.kind === 'reviewed');
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-day';
    cell.dataset.dayKey = dayKey;
    cell.classList.toggle('has-daily-review', hasDailyReview);
    cell.classList.toggle('has-review-history', hasReviewHistory);
    if (dayKey === todayKey) {
      cell.classList.add('is-today');
    }
    if (dayKey === calSelectedKey) {
      cell.classList.add('is-selected');
    }
    const number = document.createElement('span');
    number.textContent = String(day);
    cell.append(number);
    // 与 PC 提醒日历同款：有安排就在右上角挂条数徽章，没有安排什么都不挂。
    if (dayEntries.length > 0) {
      const badge = document.createElement('small');
      badge.className = 'cal-day-badge';
      badge.textContent = String(dayEntries.length);
      cell.append(badge);
    }
    const marks = [
      hasReviewHistory ? '已看过' : '',
      hasDailyReview ? '今日回顾' : '',
      dayEntries.length > 0 ? `${dayEntries.length} 项安排` : ''
    ].filter(Boolean);
    cell.setAttribute('aria-label', marks.length > 0 ? `${dayKey}，${marks.join('，')}` : dayKey);
    cell.addEventListener('click', () => {
      calSelectedKey = dayKey;
      calExpandedEntry = '';
      calRender();
    });
    grid.append(cell);
  }
  panel.append(grid);

  panel.append(calCreateLegend());

  calRenderSelectedDay(panel, library, dayMap, entriesByDate);
  calRevealExpandedEntry(panel);
}

// 展开后把抽屉带进视口；只在用户点开时执行（没有展开项就直接返回，首次渲染不会滚动）
function calRevealExpandedEntry(panel) {
  if (!calExpandedEntry) {
    return;
  }
  const drawer = panel.querySelector('.cal-entry-drawer');
  if (drawer && typeof drawer.scrollIntoView === 'function') {
    requestAnimationFrame(() => {
      drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}

// 选中日面板 = PC 提醒日历的详细区：只列安排条目。
// 点条目原地展开抽屉，直接看到那一套的笔记/资料；再点一次收起，不切月份、不打乱当前选中日。
function calRenderSelectedDay(panel, library, dayMap, entriesByDate) {
  const section = document.createElement('section');
  section.className = 'cal-day-panel';
  const dayKey = calSelectedKey;
  const dayEntries = entriesByDate.get(dayKey) || [];

  const heading = document.createElement('div');
  heading.className = 'cal-day-heading';
  const title = document.createElement('h2');
  const [, selectedMonth, selectedDay] = dayKey.split('-');
  title.textContent = `${Number(selectedMonth)} 月 ${Number(selectedDay)} 日的安排`;
  heading.append(title);
  section.append(heading);

  if (dayEntries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'cal-day-empty';
    empty.textContent = '这一天没有安排。';
    section.append(empty);
    panel.append(section);
    return;
  }

  const list = document.createElement('div');
  list.className = 'cal-entries';
  for (const entry of dayEntries) {
    list.append(calCreateEntry(entry));
    if (calExpandedEntry === calEntryId(entry)) {
      list.append(calRenderEntryDrawer(entry, library, dayMap));
    }
  }
  section.append(list);
  panel.append(section);
}

function calEntryId(entry) {
  return `${entry.date}|${entry.kind}|${entry.dayKey}`;
}

function calCreateEntry(entry) {
  const entryId = calEntryId(entry);
  const isOpen = calExpandedEntry === entryId;
  const item = document.createElement('button');
  item.type = 'button';
  item.className = entry.kind === 'today' ? 'cal-entry is-daily-review' : 'cal-entry';
  item.classList.toggle('is-open', isOpen);
  item.setAttribute('aria-expanded', String(isOpen));

  const head = document.createElement('div');
  head.className = 'cal-entry-head';
  const name = document.createElement('strong');
  name.textContent = `${calFormatDayShort(entry.dayKey)} 那一套`;
  const chevron = document.createElement('i');
  chevron.className = 'cal-entry-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  head.append(name, chevron);

  const sub = document.createElement('span');
  sub.textContent = '回顾面板 · 一整天内容';
  const meta = document.createElement('span');
  meta.className = 'cal-entry-meta';
  meta.textContent = calEntryMeta(entry);
  item.append(head, sub, meta);
  item.addEventListener('click', () => {
    calExpandedEntry = isOpen ? '' : entryId;
    calRender();
  });
  return item;
}

// 抽屉内容 = 原来「跳过去那天」看到的东西：篇数、笔记/资料卡片、标记已看过。
function calRenderEntryDrawer(entry, library, dayMap) {
  const drawer = document.createElement('div');
  drawer.className = 'cal-entry-drawer';

  const day = dayMap.get(entry.dayKey);
  const notes = day ? day.notes : [];
  const files = day ? day.files : [];
  if (notes.length === 0 && files.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'cal-entry-drawer-empty';
    empty.textContent = '这一套的内容已经不在了。';
    drawer.append(empty);
    return drawer;
  }

  const count = document.createElement('p');
  count.className = 'cal-day-count';
  count.textContent = `${notes.length} 篇笔记 · ${files.length} 个资料`;
  drawer.append(count);

  const list = document.createElement('div');
  list.className = 'note-list cal-file-list';
  for (const note of notes) {
    list.append(renderNoteCard(note, true));
  }
  for (const file of files) {
    list.append(renderResourceCard(file));
  }
  list.addEventListener('click', (event) => {
    const resourceCard = event.target.closest('.resource-card');
    if (resourceCard) {
      openResourceCard(resourceCard);
      return;
    }
    const noteCard = event.target.closest('.note-card');
    if (noteCard) {
      NoticeNoteTabs.openNoteFromTab(noteCard.dataset.noteId);
    }
  });
  drawer.append(list);

  const actions = document.createElement('div');
  actions.className = 'cal-day-actions';
  const markButton = document.createElement('button');
  markButton.type = 'button';
  markButton.className = 'primary-action';
  const history = (library.review || {}).history || {};
  const viewedAt = history[`day:${entry.dayKey}`];
  markButton.textContent = viewedAt ? '再次标记已看过' : '标记这一天已看过';
  markButton.addEventListener('click', () => {
    rvCompleteDay(entry.dayKey);
    calRender();
  });
  actions.append(markButton);
  const hint = document.createElement('span');
  hint.className = 'cal-day-hint';
  hint.textContent = '标记后下次同步回传电脑';
  actions.append(hint);
  drawer.append(actions);

  return drawer;
}
