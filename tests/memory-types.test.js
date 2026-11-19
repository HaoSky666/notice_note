// 记忆卡「类型」的纯函数测试：规范化、目录汇总、大小写不敏感匹配。
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_CARD_TYPES,
  MAX_TYPE_NAME_LENGTH,
  normalizeTypeName,
  normalizeCardTypes,
  collectCardTypes,
  hasCardType
} = require('../notice_note_client_pc/src/lib/memory-types');

test('normalizeTypeName 去掉 # 前缀与首尾空白，并截断长度', () => {
  assert.equal(normalizeTypeName('  限流  '), '限流');
  assert.equal(normalizeTypeName('#熔断'), '熔断');
  assert.equal(normalizeTypeName('##降级'), '降级');
  assert.equal(normalizeTypeName(null), '');
  assert.equal(normalizeTypeName('x'.repeat(MAX_TYPE_NAME_LENGTH + 10)).length, MAX_TYPE_NAME_LENGTH);
});

test('normalizeCardTypes 去空、大小写去重、保留首次写法、限制条数', () => {
  assert.deepEqual(normalizeCardTypes(['限流', ' 限流 ', '']), ['限流']);
  assert.deepEqual(normalizeCardTypes(['Redis', 'redis']), ['Redis']);
  assert.deepEqual(normalizeCardTypes('不是数组'), []);
  const many = Array.from({ length: MAX_CARD_TYPES + 5 }, (_, index) => `t${index}`);
  assert.equal(normalizeCardTypes(many).length, MAX_CARD_TYPES);
});

test('collectCardTypes 统计张数，一个类型被多张卡共用时累加', () => {
  const cards = [
    { types: ['限流', '熔断'] },
    { types: ['限流'] },
    { types: ['降级'] },
    { types: [] }
  ];
  const catalog = collectCardTypes(cards);
  const byName = Object.fromEntries(catalog.map((item) => [item.name, item.count]));
  assert.deepEqual(byName, { 限流: 2, 熔断: 1, 降级: 1 });
});

test('hasCardType 大小写不敏感，不修改原卡片', () => {
  const card = { types: ['Redis'] };
  assert.equal(hasCardType(card, 'redis'), true);
  assert.equal(hasCardType(card, ' #REDIS '), true);
  assert.equal(hasCardType(card, '限流'), false);
  assert.deepEqual(card.types, ['Redis']);
});
