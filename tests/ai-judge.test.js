// AI 判定的纯函数测试：配置归一化、prompt 结构、回复解析容错。
// 网络请求不在这一层，所以这里不需要 mock 任何东西。
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AI_JUDGE_DEFAULT_BASE_URL,
  AI_JUDGE_DEFAULT_MODEL,
  AI_JUDGE_DEFAULTS,
  AI_JUDGE_MIN_TIMEOUT_MS,
  AI_JUDGE_MAX_TIMEOUT_MS,
  AI_JUDGE_ANSWER_MAX_LENGTH,
  AI_JUDGE_REASON_MAX_LENGTH,
  VALID_RATINGS,
  AiJudgeParseError,
  normalizeAiJudgeConfig,
  isAiJudgeConfigured,
  buildJudgeEndpoint,
  buildJudgeMessages,
  buildJudgePayload,
  parseJudgeReply,
  truncateAnswer
} = require('../notice_note_client_pc/src/lib/ai-judge');

test('normalizeAiJudgeConfig 补齐默认值并去掉 baseURL 尾斜杠', () => {
  const config = normalizeAiJudgeConfig({});
  assert.equal(config.baseUrl, AI_JUDGE_DEFAULT_BASE_URL);
  assert.equal(config.model, AI_JUDGE_DEFAULT_MODEL);
  assert.equal(config.apiKey, '');
  assert.equal(config.enabled, true);
  assert.equal(config.disableThinking, true);

  const trimmed = normalizeAiJudgeConfig({ baseUrl: 'https://example.com/v1///' });
  assert.equal(trimmed.baseUrl, 'https://example.com/v1');
});

test('normalizeAiJudgeConfig 把超时夹在合理区间，非法值回默认', () => {
  assert.equal(normalizeAiJudgeConfig({ timeoutMs: 1 }).timeoutMs, AI_JUDGE_MIN_TIMEOUT_MS);
  assert.equal(normalizeAiJudgeConfig({ timeoutMs: 1e9 }).timeoutMs, AI_JUDGE_MAX_TIMEOUT_MS);
  assert.equal(normalizeAiJudgeConfig({ timeoutMs: 'abc' }).timeoutMs, AI_JUDGE_DEFAULTS.timeoutMs);
  assert.equal(normalizeAiJudgeConfig({ timeoutMs: 8000 }).timeoutMs, 8000);
});

test('apiKey 里的斜杠必须保留：千帆的 key 形如 bce-v3/<标识>/<摘要>', () => {
  const key = 'bce-v3/FAKEKEYFORTEST/0123456789abcdef';
  assert.equal(normalizeAiJudgeConfig({ apiKey: `  ${key}  ` }).apiKey, key);
});

test('isAiJudgeConfigured 要求 key、端点、模型三样齐全且开关打开', () => {
  const base = { baseUrl: 'https://x/v1', model: 'm', apiKey: 'k' };
  assert.equal(isAiJudgeConfigured(base), true);
  assert.equal(isAiJudgeConfigured({ ...base, apiKey: '' }), false);
  assert.equal(isAiJudgeConfigured({ ...base, enabled: false }), false);
  // 模型名留空视为「用默认模型」，不算未配置（用户清空输入框时不该整个功能失灵）
  assert.equal(normalizeAiJudgeConfig({ ...base, model: '' }).model, AI_JUDGE_DEFAULT_MODEL);
  assert.equal(isAiJudgeConfigured({ ...base, model: '' }), true);
});

test('buildJudgeEndpoint 不重复拼 /chat/completions', () => {
  assert.equal(buildJudgeEndpoint('https://x/v1'), 'https://x/v1/chat/completions');
  assert.equal(buildJudgeEndpoint('https://x/v1/'), 'https://x/v1/chat/completions');
  assert.equal(
    buildJudgeEndpoint('https://x/v1/chat/completions'),
    'https://x/v1/chat/completions'
  );
});

test('buildJudgeMessages 带上正反面、本次回答与历史，且明确 easy 的门槛', () => {
  const messages = buildJudgeMessages({
    front: 'SM-2 的 ease factor 初始值？',
    back: '2.5',
    answer: '2.5，界面显示 250%',
    history: [
      { rating: 'hard', answer: '好像是 2 点几' },
      { rating: 'again', answer: '不记得' }
    ]
  });
  assert.equal(messages.length, 2);
  const [system, user] = messages;
  assert.equal(system.role, 'system');
  assert.equal(user.role, 'user');
  assert.match(system.content, /again/);
  assert.match(system.content, /easy 的前提/, '必须写清 easy 需要额外信息，否则模型会把复述判成 easy');
  assert.match(user.content, /卡片正面：SM-2 的 ease factor 初始值？/);
  assert.match(user.content, /卡片背面（标准答案）：2\.5/);
  assert.match(user.content, /用户本次回答：2\.5，界面显示 250%/);
  assert.match(user.content, /- 困难：好像是 2 点几/);
  assert.match(user.content, /- 重来：不记得/);
  // 历史只是背景，不能变成主要判据
  assert.match(user.content, /仅作背景参考/);
});

test('buildJudgeMessages 不把历史当成判定依据、最多取三条', () => {
  const messages = buildJudgeMessages({
    front: 'q',
    back: 'a',
    answer: 'x',
    history: [
      { rating: 'again', answer: '1' },
      { rating: 'again', answer: '2' },
      { rating: 'good', answer: '3' },
      { rating: 'easy', answer: '4' }
    ]
  });
  const user = messages[1].content;
  assert.doesNotMatch(user, /- .*：4$/m, '第四条历史不该进 prompt');
  assert.match(user, /- 良好：3/);
});

test('buildJudgeMessages 忽略 rating 非法的历史条目', () => {
  const messages = buildJudgeMessages({
    front: 'q',
    back: 'a',
    answer: 'x',
    history: [{ rating: 'unknown', answer: '脏数据' }]
  });
  assert.doesNotMatch(messages[1].content, /脏数据/);
});

test('buildJudgePayload 关闭 thinking 并带 json_object', () => {
  const payload = buildJudgePayload({ apiKey: 'k', model: 'm', disableThinking: true }, []);
  assert.equal(payload.temperature, 0);
  assert.deepEqual(payload.thinking, { type: 'disabled' });
  assert.deepEqual(payload.response_format, { type: 'json_object' });
  assert.ok(payload.max_tokens >= 800, '推理模型会吃 token，上限不能太小');

  const open = buildJudgePayload({ apiKey: 'k', model: 'm', disableThinking: false }, []);
  assert.equal(open.thinking, undefined, '不关思考时不能带 thinking 参数，否则部分端点 400');
});

test('truncateAnswer 超长截断并加省略号', () => {
  const long = 'x'.repeat(AI_JUDGE_ANSWER_MAX_LENGTH + 50);
  const result = truncateAnswer(long);
  assert.equal(result.length, AI_JUDGE_ANSWER_MAX_LENGTH + 1);
  assert.ok(result.endsWith('…'));
  assert.equal(truncateAnswer('  短  '), '短');
  assert.equal(truncateAnswer(null), '');
});

test('parseJudgeReply 解析标准 JSON', () => {
  const result = parseJudgeReply('{"rating":"good","reason":"核心点答对"}');
  assert.equal(result.rating, 'good');
  assert.equal(result.reason, '核心点答对');
});

test('parseJudgeReply 容忍 markdown 围栏与前后废话', () => {
  const fenced = parseJudgeReply('```json\n{"rating":"hard","reason":"漏了数值"}\n```');
  assert.equal(fenced.rating, 'hard');

  const chatty = parseJudgeReply('好的，我的判断是：{"rating":"again","reason":"答错"} 以上。');
  assert.equal(chatty.rating, 'again');
  assert.equal(chatty.reason, '答错');
});

test('parseJudgeReply 接受中文档位与同义字段名', () => {
  assert.equal(parseJudgeReply('{"rating":"良好","reason":"ok"}').rating, 'good');
  assert.equal(parseJudgeReply('{"level":"简单","reason":"ok"}').rating, 'easy');
  assert.equal(parseJudgeReply('掌握程度：困难').rating, 'hard');
});

test('parseJudgeReply 在纯文本回复里也能找到档位', () => {
  const result = parseJudgeReply('这个回答只能算 hard，因为漏了核心点。');
  assert.equal(result.rating, 'hard');
  assert.match(result.reason, /漏了核心点/);
});

test('parseJudgeReply 空回复与无法识别都抛 AiJudgeParseError', () => {
  assert.throws(() => parseJudgeReply(''), AiJudgeParseError);
  assert.throws(() => parseJudgeReply('   '), AiJudgeParseError);
  assert.throws(() => parseJudgeReply('我觉得还行吧，说不好。'), AiJudgeParseError);
  try {
    parseJudgeReply('我完全判断不了');
  } catch (error) {
    assert.equal(error.code, 'AI_JUDGE_PARSE');
  }
});

test('parseJudgeReply 理由超长截断，不把整段推理塞进结果条', () => {
  const longReason = '很长的理由'.repeat(100);
  const result = parseJudgeReply(JSON.stringify({ rating: 'good', reason: longReason }));
  assert.equal(result.reason.length, AI_JUDGE_REASON_MAX_LENGTH);
});

test('VALID_RATINGS 与 SM-2 调度器的档位保持一致', () => {
  const { RATINGS } = require('../notice_note_client_pc/src/lib/sm2-scheduler');
  assert.deepEqual([...VALID_RATINGS].sort(), [...RATINGS].sort());
});
