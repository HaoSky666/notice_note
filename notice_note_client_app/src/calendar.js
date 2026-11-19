// 日历 Tab（经典脚本，全局函数以 cal 开头）。
// 月历镜像 PC 回顾面板：周一起始、内容天打点、今天/选中态；
// 额外标出「复习日」（提醒的 date）与「已看过」，点选某天展示该天文件套与回顾操作。
let calMonth = null;
let calSelectedKey = '';

function calGetDayMap(library) {
  const dayMap = new Map();
  const add = (item, kind) => {
    // 镜像 PC getReviewDayContent：日历的内容天只来自复习文件，不是全库笔记。
    if (!item.isReviewFile) {
      return;
    }
    const dayKey = NoticeNoteStore.getItemDayKey(item);
    if (!dayKey) {
      return;
    }
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { dayKey, notes: [], files: [] });
    }
    const day = dayMap.get(dayKey);
    if (kind === 'note') {
      day.notes.push(item);
    } else {
      day.files.push(item);
    }
  };
  for (const note of library.notes || []) {
    add(note, 'note');
  }
  for (const file of library.resources || []) {
    add(file, 'file');
  }
  return dayMap;
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

  const dayMap = calGetDayMap(library);
  const review = library.review || {};
  const history = review.history || {};
  const reminders = review.reminders || [];
  const reminderDateSet = new Set(reminders.map((item) => item.date).filter(Boolean));

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
    const hasFiles = dayMap.has(dayKey);
    const viewed = Boolean(history[`day:${dayKey}`]);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-day';
    cell.dataset.dayKey = dayKey;
    if (hasFiles) {
      cell.classList.add('has-files');
    }
    if (reminderDateSet.has(dayKey)) {
      cell.classList.add('is-reminder');
    }
    if (viewed) {
      cell.classList.add('is-viewed');
    }
    if (dayKey === todayKey) {
      cell.classList.add('is-today');
    }
    if (dayKey === calSelectedKey) {
      cell.classList.add('is-selected');
    }
    const number = document.createElement('span');
    number.textContent = String(day);
    cell.append(number);
    if (hasFiles) {
      const dot = document.createElement('i');
      dot.setAttribute('aria-hidden', 'true');
      cell.append(dot);
    }
    cell.setAttribute('aria-label', `${dayKey}${hasFiles ? '，有内容' : ''}${viewed ? '，已看过' : ''}`);
    cell.addEventListener('click', () => {
      calSelectedKey = dayKey;
      calRender();
    });
    grid.append(cell);
  }
  panel.append(grid);

  const legend = document.createElement('p');
  legend.className = 'cal-legend';
  legend.textContent = '· 有内容　◔ 复习日　✓ 已看过';
  panel.append(legend);

  calRenderSelectedDay(panel, library, dayMap);
}

function calRenderSelectedDay(panel, library, dayMap) {
  const section = document.createElement('section');
  section.className = 'cal-day-panel';
  const dayKey = calSelectedKey;
  const day = dayMap.get(dayKey);
  const review = library.review || {};
  const viewedAt = (review.history || {})[`day:${dayKey}`];

  const heading = document.createElement('div');
  heading.className = 'cal-day-heading';
  const title = document.createElement('h2');
  title.textContent = dayKey;
  heading.append(title);
  if (viewedAt) {
    const badge = document.createElement('span');
    badge.className = 'cal-viewed-badge';
    badge.textContent = `已看过 · ${formatDateTime(viewedAt)}`;
    heading.append(badge);
  }
  section.append(heading);

  // 这一套内容对应的复习日提醒
  const dayReminders = (review.reminders || []).filter((item) => item.dayKey === dayKey);
  if (dayReminders.length > 0) {
    const list = document.createElement('div');
    list.className = 'cal-reminders';
    for (const reminder of dayReminders) {
      const row = document.createElement('span');
      row.className = reminder.done ? 'cal-reminder is-done' : 'cal-reminder';
      row.textContent = `复习日 ${reminder.date}${reminder.done ? ' · 已复习' : ' · 待复习'}`;
      list.append(row);
    }
    section.append(list);
  }

  if (!day || (day.notes.length === 0 && day.files.length === 0)) {
    const empty = document.createElement('p');
    empty.className = 'cal-day-empty';
    empty.textContent = '这一天没有归档的复习内容。';
    section.append(empty);
    panel.append(section);
    return;
  }

  const count = document.createElement('p');
  count.className = 'cal-day-count';
  count.textContent = `${day.notes.length} 篇笔记 · ${day.files.length} 个资料`;
  section.append(count);

  const list = document.createElement('div');
  list.className = 'note-list cal-file-list';
  for (const note of day.notes) {
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
  section.append(list);

  const actions = document.createElement('div');
  actions.className = 'cal-day-actions';
  const markButton = document.createElement('button');
  markButton.type = 'button';
  markButton.className = 'primary-action';
  markButton.textContent = viewedAt ? '再次标记已看过' : '标记这一天已看过';
  markButton.addEventListener('click', () => {
    rvCompleteDay(dayKey);
    calRender();
  });
  actions.append(markButton);
  const hint = document.createElement('span');
  hint.className = 'cal-day-hint';
  hint.textContent = '标记后下次同步回传电脑';
  actions.append(hint);
  section.append(actions);
  panel.append(section);
}