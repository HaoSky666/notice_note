// 回顾 Tab（经典脚本，全局函数以 rv 开头）。
// 口径与 PC 回顾面板一致：月历选天 → 只看这一天归档了哪些笔记和资料 → 当天可标记已看过。
// 手机上不再展示「回顾队列」和提醒列表（2026-11-19 按用户反馈移除）：
// 这一页只回答「哪天添加了哪些文件」，排期/提醒归日历 Tab 管。
// 完成/标记已看过 = 写天级锚点 + 事件日志 + 移出手动顺序，记入 dirty 待同步回传。

let rvMonth = null; // 当前显示的月份（当月 1 号）
let rvSelectedKey = ''; // 当前查看的那一天

// 手机端字段名与 PC 不同（资源列表叫 resources），装配参数时映射一次。
function rvGetSource(library) {
  const review = library.review || {};
  return {
    notes: library.notes || [],
    resourceFiles: library.resources || [],
    dayReminders: review.reminders || [],
    dayReviewLog: review.log || []
  };
}

// 回顾面板只列复习文件；密码保护目录的内容本来就不上手机，这里再挡一层。
function rvGetDayMap(library) {
  const protectedIds = new Set(
    (library.folders || []).filter((folder) => folder.isProtected).map((folder) => folder.id)
  );
  const visible = (item) => !protectedIds.has(item.folderId || null);
  const source = rvGetSource(library);
  return toReviewDayMap(buildDayIndex({
    notes: source.notes.filter(visible),
    resourceFiles: source.resourceFiles.filter(visible)
  }));
}

// 与 PC formatReviewDayShort 同款：2026-08-12 -> 8月12日
function rvFormatDayShort(dayKey) {
  if (!dayKey) {
    return '未归天';
  }
  const [, month, day] = String(dayKey).split('-');
  return `${Number(month)} 月 ${Number(day)} 日`;
}

function rvFormatDayTitle(dayKey) {
  const [year, month, day] = String(dayKey).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${year} 年 ${month} 月 ${day} 日 · 周${weekdays[date.getDay()]}`;
}

function rvParseDayKey(dayKey) {
  const [year, month, day] = String(dayKey).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function rvDayTotal(day) {
  return (day ? day.notes.length : 0) + (day ? day.files.length : 0);
}

// 完成回顾 / 标记已看过：与 PC handleDailyReview(complete) 同语义。
// 本地先落库，dirty 追踪，下次同步先回传再拉权威清单。
function rvCompleteDay(dayKey) {
  const library = NoticeNoteStore.getLibrary();
  if (!library || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return;
  }
  const now = new Date().toISOString();
  if (!library.review) {
    library.review = { enabled: true, reminders: [], history: {}, log: [], order: [] };
  }
  library.review.history = { ...(library.review.history || {}), [`day:${dayKey}`]: now };
  const entry = { id: NoticeNoteStore.randomId(), dayKey, reviewedAt: now };
  library.review.log = [...(library.review.log || []), entry];
  library.review.order = (library.review.order || []).filter((key) => key !== dayKey);
  NoticeNoteStore.addToDirty('reviewDays', dayKey);
  NoticeNoteStore.addToDirty('reviewLogIds', entry.id);
  NoticeNoteStore.runAssetTransaction({ snapshot: library })
    .then(() => {
      NoticeNoteStore.notifyLibraryChanged();
    })
    .catch((error) => {
      console.error('保存回顾状态失败:', error);
    });
}

// 文件卡片：笔记按修改时间倒序在前，资料接在后面（与 PC 回顾面板同序）。
function rvRenderFileList(container, day) {
  if (!day || rvDayTotal(day) === 0) {
    const empty = document.createElement('p');
    empty.className = 'cal-day-empty';
    empty.textContent = '这一天还没有回顾文件。';
    container.append(empty);
    return;
  }
  const list = document.createElement('div');
  list.className = 'note-list rv-file-list';
  const notes = [...day.notes].sort(
    (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)
  );
  for (const note of notes) {
    list.append(renderNoteCard(note, true));
  }
  for (const file of day.files) {
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
  container.append(list);
}

// 月历：与 PC 回顾面板同口径（周一起始，有文件的天挂小圆点，空白天也能点开看）。
// 复用日历 Tab 的 .cal-* 样式，两个 Tab 的月历视觉保持一致。
function rvRenderCalendar(dayMap, todayKey) {
  const wrap = document.createElement('div');
  wrap.className = 'rv-calendar';

  const header = document.createElement('div');
  header.className = 'cal-header';
  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.className = 'cal-nav';
  prevButton.textContent = '‹';
  prevButton.setAttribute('aria-label', '上一月');
  prevButton.addEventListener('click', () => {
    rvMonth = new Date(rvMonth.getFullYear(), rvMonth.getMonth() - 1, 1);
    rvRender();
  });
  const title = document.createElement('strong');
  title.className = 'cal-title';
  title.textContent = `${rvMonth.getFullYear()} 年 ${rvMonth.getMonth() + 1} 月`;
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'cal-nav';
  nextButton.textContent = '›';
  nextButton.setAttribute('aria-label', '下一月');
  nextButton.addEventListener('click', () => {
    rvMonth = new Date(rvMonth.getFullYear(), rvMonth.getMonth() + 1, 1);
    rvRender();
  });
  const todayButton = document.createElement('button');
  todayButton.type = 'button';
  todayButton.className = 'cal-today';
  todayButton.textContent = '今天';
  todayButton.addEventListener('click', () => {
    const now = new Date();
    rvMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    rvSelectedKey = todayKey;
    rvRender();
  });
  header.append(prevButton, title, nextButton, todayButton);
  wrap.append(header);

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  for (const label of ['一', '二', '三', '四', '五', '六', '日']) {
    const cell = document.createElement('div');
    cell.className = 'cal-week';
    cell.textContent = label;
    grid.append(cell);
  }
  const firstWeekday = (rvMonth.getDay() + 6) % 7;
  for (let i = 0; i < firstWeekday; i += 1) {
    const blank = document.createElement('div');
    blank.className = 'cal-day is-blank';
    grid.append(blank);
  }
  const daysInMonth = new Date(rvMonth.getFullYear(), rvMonth.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(rvMonth.getFullYear(), rvMonth.getMonth(), day);
    const dayKey = NoticeNoteDateUtils.toLocalDateKey(date);
    const total = rvDayTotal(dayMap.get(dayKey));
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-day';
    cell.dataset.dayKey = dayKey;
    cell.classList.toggle('has-files', total > 0);
    if (dayKey === todayKey) {
      cell.classList.add('is-today');
    }
    if (dayKey === rvSelectedKey) {
      cell.classList.add('is-selected');
    }
    const number = document.createElement('span');
    number.textContent = String(day);
    cell.append(number);
    cell.setAttribute('aria-label', total > 0 ? `${dayKey}，${total} 个文件` : `${dayKey}，没有文件`);
    cell.addEventListener('click', () => {
      rvSelectedKey = dayKey;
      rvRender();
    });
    grid.append(cell);
  }
  wrap.append(grid);

  const legend = document.createElement('p');
  legend.className = 'cal-legend';
  const item = document.createElement('span');
  item.className = 'cal-legend-item';
  const swatch = document.createElement('i');
  swatch.className = 'cal-legend-swatch is-files';
  swatch.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = '有文件';
  item.append(swatch, text);
  legend.append(item);
  wrap.append(legend);

  return wrap;
}

// 日期条：‹ 11月12日 › + 第 N/M 天 · X 个文件。只有「有文件的日期」之间跳，空白天不占位。
function rvRenderDayBar(dayMap, dayKeys) {
  const bar = document.createElement('div');
  bar.className = 'rv-day-bar';

  const index = dayKeys.indexOf(rvSelectedKey);
  const prevKey = dayKeys.filter((key) => key < rvSelectedKey).pop() || '';
  const nextKey = dayKeys.find((key) => key > rvSelectedKey) || '';

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.className = 'cal-nav';
  prevButton.textContent = '‹';
  prevButton.title = '上一个有文件的日期';
  prevButton.setAttribute('aria-label', '上一个有文件的日期');
  prevButton.disabled = !prevKey;
  prevButton.addEventListener('click', () => {
    rvSelectedKey = prevKey;
    rvMonth = new Date(rvParseDayKey(prevKey).getFullYear(), rvParseDayKey(prevKey).getMonth(), 1);
    rvRender();
  });

  const info = document.createElement('div');
  info.className = 'rv-day-info';
  const title = document.createElement('strong');
  title.textContent = rvFormatDayShort(rvSelectedKey);
  title.title = rvFormatDayTitle(rvSelectedKey);
  const meta = document.createElement('span');
  const total = rvDayTotal(dayMap.get(rvSelectedKey));
  meta.textContent = index >= 0
    ? `第 ${index + 1} / ${dayKeys.length} 天 · ${total} 个文件`
    : '空白日 · 没有回顾文件';
  info.append(title, meta);

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'cal-nav';
  nextButton.textContent = '›';
  nextButton.title = '下一个有文件的日期';
  nextButton.setAttribute('aria-label', '下一个有文件的日期');
  nextButton.disabled = !nextKey;
  nextButton.addEventListener('click', () => {
    rvSelectedKey = nextKey;
    rvMonth = new Date(rvParseDayKey(nextKey).getFullYear(), rvParseDayKey(nextKey).getMonth(), 1);
    rvRender();
  });

  bar.append(prevButton, info, nextButton);
  return bar;
}

// 当天操作：今天要回顾的那一套给主按钮，其他有内容的天给弱化按钮（与 PC 两级入口一致）。
// 空白日不挂按钮——没有可回顾的内容，留个灰按钮会让人误以为系统在催。
function rvRenderCompleteBar(day, history) {
  if (!day || rvDayTotal(day) === 0) {
    return null;
  }
  const dayKey = rvSelectedKey;
  const isTodayReviewDay = [...day.notes, ...day.files].some((item) => item.isDailyReview);
  const viewedAt = history[`day:${dayKey}`];

  const bar = document.createElement('div');
  bar.className = 'rv-complete-bar';
  const button = document.createElement('button');
  button.type = 'button';
  if (isTodayReviewDay) {
    button.className = 'primary-action';
    button.textContent = viewedAt ? '✓ 今天已看过 · 再看一遍' : '✓ 完成回顾';
  } else {
    button.className = 'secondary-action';
    button.textContent = viewedAt ? '再次标记已看过' : '标记这一天已看过';
  }
  button.title = isTodayReviewDay
    ? '把今天这一套标记为已回顾，自动回顾会换到下一套'
    : '这一套不是今天要回顾的内容；标记后它会排到自动回顾的队尾';
  button.addEventListener('click', () => {
    rvCompleteDay(dayKey);
    rvRender();
  });
  bar.append(button);
  return bar;
}

function rvRender() {
  const panel = document.querySelector('#reviewPanel');
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
  if (!rvMonth) {
    const now = new Date();
    rvMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!rvSelectedKey) {
    rvSelectedKey = todayKey;
  }

  const dayMap = rvGetDayMap(library);
  const dayKeys = [...dayMap.keys()];
  const history = (library.review || {}).history || {};

  const heading = document.createElement('div');
  heading.className = 'rv-heading';
  const title = document.createElement('h2');
  title.textContent = '每日回顾';
  heading.append(title);
  const dirty = NoticeNoteStore.getDirty();
  if (dirty.reviewDays.length > 0) {
    const badge = document.createElement('span');
    badge.className = 'rv-pending-badge';
    badge.textContent = `${dirty.reviewDays.length} 天待回传`;
    heading.append(badge);
  }
  panel.append(heading);

  panel.append(rvRenderCalendar(dayMap, todayKey));

  const card = document.createElement('section');
  card.className = 'cal-day-panel rv-day-panel';
  card.append(rvRenderDayBar(dayMap, dayKeys));
  const completeBar = rvRenderCompleteBar(dayMap.get(rvSelectedKey), history);
  if (completeBar) {
    card.append(completeBar);
  }
  rvRenderFileList(card, dayMap.get(rvSelectedKey));
  panel.append(card);

  const hint = document.createElement('p');
  hint.className = 'rv-hint';
  hint.textContent = '回顾进度保存在手机本地，点笔记页「同步」后回传电脑，两端保持一致。';
  panel.append(hint);
}
