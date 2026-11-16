const test = require('node:test');
const assert = require('node:assert/strict');
const {
  localDateKey,
  getDayKeyOfEntry,
  buildDayIndex,
  toReviewDayMap,
  buildCalendarEntries
} = require('../notice_note_client_pc/src/renderer/day-index');

function source(overrides = {}) {
  return {
    notes: [],
    resourceFiles: [],
    dayReminders: [],
    dayReviewLog: [],
    ...overrides
  };
}

test('getDayKeyOfEntry：归天日期优先，否则按创建时间', () => {
  assert.equal(getDayKeyOfEntry({ reviewDate: '2026-11-12', createdAt: '2020-01-01T00:00:00Z' }), '2026-11-12');
  assert.equal(getDayKeyOfEntry({ createdAt: '2026-01-31T23:30:00' }), '2026-01-31');
  assert.equal(getDayKeyOfEntry({ reviewDate: 'bad', createdAt: 'not-a-date' }), null);
  assert.equal(getDayKeyOfEntry(null), null);
});

test('buildDayIndex：笔记、资源、提醒、回顾事件按同一个 dayKey 聚合', () => {
  const note = { id: 'n1', isReviewFile: true, reviewDate: '2026-11-12' };
  const file = { id: 'f1', isReviewFile: true, reviewDate: '2026-11-12' };
  const index = buildDayIndex(source({
    notes: [note, { id: 'n2', isReviewFile: false }],
    resourceFiles: [file],
    dayReminders: [{ date: '2026-11-20', dayKey: '2026-11-12', done: false }],
    dayReviewLog: [{ dayKey: '2026-11-12', reviewedAt: '2026-11-13T10:00:00Z' }]
  }));
  assert.equal(index.size, 1);
  const day = index.get('2026-11-12');
  assert.deepEqual(day.notes, [note]);
  assert.deepEqual(day.files, [file]);
  assert.equal(day.reminders.length, 1);
  assert.equal(day.reviewEvents.length, 1);
  assert.equal(day.lastReviewedAt, '2026-11-13T10:00:00Z');
});

test('toReviewDayMap：只保留有内容的天，且按日期升序', () => {
  const index = buildDayIndex(source({
    notes: [
      { id: 'a', isReviewFile: true, reviewDate: '2026-11-15' },
      { id: 'b', isReviewFile: true, reviewDate: '2026-11-12' }
    ],
    dayReminders: [{ date: '2026-11-20', dayKey: '2026-11-30' }]
  }));
  const map = toReviewDayMap(index);
  assert.deepEqual([...map.keys()], ['2026-11-12', '2026-11-15']);
  assert.equal(map.has('2026-11-30'), false, '只有提醒、没有文件的天不进回顾面板');
});

test('P2-24 回归：日历与回顾面板从同一份索引取数，数量一致', () => {
  const data = source({
    notes: [{ id: 'n1', isReviewFile: true, reviewDate: '2026-11-12', isDailyReview: true }],
    resourceFiles: [{ id: 'f1', isReviewFile: true, reviewDate: '2026-11-12' }],
    dayReminders: [
      { date: '2026-11-13', dayKey: '2026-11-12', done: false },
      { date: '2026-11-20', dayKey: '2026-11-12', done: true }
    ],
    dayReviewLog: [{ dayKey: '2026-11-12', reviewedAt: '2026-11-14T09:00:00Z' }]
  });
  const dayIndex = buildDayIndex(data);
  const reviewDay = toReviewDayMap(dayIndex).get('2026-11-12');
  const entries = buildCalendarEntries(data, '2026-11-12');

  assert.equal(reviewDay.notes.length + reviewDay.files.length, 2);
  assert.equal(entries.filter((item) => item.dayKey === '2026-11-12').length, 4,
    '2 个复习日 + 1 条已回顾 + 1 条今日自动回顾');
  assert.deepEqual(entries.map((item) => item.kind).sort(), ['reminder', 'reminder', 'reviewed', 'today']);
  assert.equal(entries.find((item) => item.kind === 'reviewed').date, '2026-11-14');
  assert.equal(entries.find((item) => item.kind === 'today').date, '2026-11-12');
});

test('空数据与脏数据不会抛错', () => {
  assert.equal(buildDayIndex(null).size, 0);
  assert.equal(toReviewDayMap(buildDayIndex(source())).size, 0);
  assert.deepEqual(buildCalendarEntries(source(), '2026-01-01'), []);
  const index = buildDayIndex(source({
    dayReminders: [null, {}, { dayKey: '2026-01-01' }],
    dayReviewLog: [null, { dayKey: '2026-01-01', reviewedAt: 'not-a-date' }]
  }));
  assert.equal(index.get('2026-01-01').reminders.length, 1);
});

test('localDateKey 不依赖全局 toLocalDateKey', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05');
});
