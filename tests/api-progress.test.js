const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storage = new Map([['beibeiOpenid', 'user-a']]);
const requests = [];
let responses = [];
let failNext = false;

global.wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  request(options) {
    requests.push(options);
    if (failNext) {
      failNext = false;
      options.fail({ errMsg: 'request:fail test' });
      return;
    }
    const response = responses.shift() || { statusCode: 200, data: {} };
    if (response.fail) options.fail({ errMsg: response.fail });
    else options.success(response);
  },
  showToast() {},
  showModal() {},
  navigateTo() {},
  switchTab() {},
  setStorage() {},
};
global.getApp = () => ({ globalData: {} });

delete require.cache[require.resolve('../miniprogram/utils/request')];
delete require.cache[require.resolve('../miniprogram/utils/api')];
const api = require('../miniprogram/utils/api');

function reset() {
  requests.length = 0;
  responses = [];
  failNext = false;
}

function loadPage(name) {
  let page;
  const filename = path.join(root, 'miniprogram/pages', name, `${name}.js`);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    Page: value => { page = value; },
    require(source) {
      if (source.includes('utils/api')) return api;
      if (source.includes('utils/learning')) return {
        getSelectedLevel: () => 4,
        setSelectedLevel() {},
        normalizeLevel: value => Number(value) || 4,
      };
      if (source.includes('utils/tabbar')) return { syncTabBar() {} };
      throw new Error(`unexpected require: ${source}`);
    },
    wx: global.wx,
    console: { ...console, error() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    Promise,
    Boolean,
    Number,
    String,
  });
  page.setData = function setData(patch, callback) {
    for (const [key, value] of Object.entries(patch)) {
      const nested = key.match(/^([^.[\]]+)(?:\[(\d+)\])?\.([^.[\]]+)$/);
      if (nested) {
        const target = nested[2] === undefined
          ? this.data[nested[1]]
          : this.data[nested[1]][Number(nested[2])];
        target[nested[3]] = value;
      } else {
        this.data[key] = value;
      }
    }
    if (callback) callback();
  };
  return page;
}

test('learned state uses progress PUT/DELETE and never sends learnedIds', async () => {
  reset();
  responses.push({ statusCode: 200, data: { learned: true } });
  await api.callApi('markWordLearned', { wordId: 17, learned: true }, { requireLogin: true });
  assert.equal(requests[0].method, 'PUT');
  assert.match(requests[0].url, /\/api\/progress\/17\?openid=user-a$/);

  responses.push({ statusCode: 200, data: { learned: false } });
  await api.callApi('markWordLearned', { wordId: 17, learned: false }, { requireLogin: true });
  assert.equal(requests[1].method, 'DELETE');

  responses.push({ statusCode: 200, data: { list: [], total: 0, page: 1, pageSize: 20 } });
  await api.callApi('getWordList', { level: 4, filter: 'learned', page: 1, pageSize: 20 });
  assert.equal(Object.hasOwn(requests[2].data, 'learnedIds'), false);
});

test('wrong mastery, filters, and stats use their server endpoints', async () => {
  reset();
  responses.push({ statusCode: 200, data: { mastered: true } });
  await api.callApi('markWrongMastered', { wordId: 19, mastered: true }, { requireLogin: true });
  assert.equal(requests[0].method, 'PUT');
  assert.match(requests[0].url, /\/api\/wrong_words\/19\/mastered\?openid=user-a$/);
  assert.deepEqual(requests[0].data, { mastered: true });

  responses.push({ statusCode: 200, data: { list: [], total: 0, page: 1, pageSize: 20 } });
  await api.callApi('getWrongWords', { level: '4', mastered: 'false', page: 1, pageSize: 20 });
  assert.equal(requests[1].data.level, 4);
  assert.equal(requests[1].data.mastered, false);

  responses.push({ statusCode: 200, data: { stats: { learned: 3, wrong: 2 } } });
  const result = await api.callApi('getUserStats', {}, { requireLogin: true });
  assert.match(requests[2].url, /\/api\/stats\?openid=user-a$/);
  assert.equal(result.stats.learned, 3);
});

test('challenge submission stores only incorrect answers as wrong words', async () => {
  reset();
  storage.set('challengeQuestions:user-a', [
    { id: 1, meaning: '正确一' },
    { id: 2, meaning: '正确二' },
  ]);
  responses.push(
    { statusCode: 200, data: { ok: true } },
    { statusCode: 200, data: { ok: true } },
  );

  await api.callApi('submitChallenge', { answers: [
    { wordId: 1, selectedMeaning: '正确一', elapsedMs: 1000, timedOut: false },
    { wordId: 2, selectedMeaning: '错误', elapsedMs: 1000, timedOut: false },
  ] }, { requireLogin: true });

  const wrongWrites = requests.filter(item => item.url.includes('/api/wrong_words'));
  assert.equal(wrongWrites.length, 1);
  assert.deepEqual(wrongWrites[0].data, { wordId: 2 });
});

test('failed server writes leave word-card and wrong-book state unchanged', async () => {
  reset();
  const card = loadPage('word-card');
  card.data.word = { _id: '17', level: 4, learned: false };
  failNext = true;
  await card.toggleLearned();
  assert.equal(card.data.word.learned, false);

  const wrongBook = loadPage('wrong-book');
  wrongBook.data.list = [{ _id: '19', mastered: false }];
  failNext = true;
  await wrongBook.toggleMastered({ currentTarget: { dataset: {
    word: wrongBook.data.list[0], index: 0,
  } } });
  assert.equal(wrongBook.data.list[0].mastered, false);
});

test('successful learned write remains visible when the separate checkin fails', async () => {
  reset();
  const card = loadPage('word-card');
  card.data.word = { _id: '17', level: 4, learned: false };
  responses.push(
    { statusCode: 200, data: { learned: true } },
    { fail: 'request:fail checkin' },
  );

  await card.toggleLearned();

  assert.equal(card.data.word.learned, true);
  assert.equal(requests.length, 2);
  assert.match(requests[1].url, /\/api\/checkins\?openid=user-a$/);
});

