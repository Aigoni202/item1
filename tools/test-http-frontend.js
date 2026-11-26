// 无网络、无数据库的前端契约测试：node tools/test-http-frontend.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const storage = new Map();
let response = { statusCode: 200, data: { ok: true } }, last, page;
const wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  login: options => options.success({ code: 'fresh-code' }),
  request(options) { last = options; options.success(response); },
  showToast() {}, showModal() {}, navigateBack() {}, switchTab() {},
};
global.wx = wx;
global.getApp = () => ({ globalData: {} });
const session = require('../miniprogram/utils/request');
const api = require('../miniprogram/utils/api');
function loadPage(name) {
  vm.runInNewContext(fs.readFileSync(path.join(root, `miniprogram/pages/${name}/${name}.js`), 'utf8'), {
    require: source => require(path.resolve(root, 'miniprogram/pages', name, source)),
    Page: value => { page = value; }, wx, getApp, getCurrentPages: () => [1, 2],
    console, setTimeout, clearTimeout, setInterval, clearInterval,
  });
  page.setData = function(data, callback) { Object.assign(this.data, data); if (callback) callback(); };
  return page;
}
async function main() {
  await assert.rejects(session.request('/api/checkins', 'POST', {}, { personal: true }), /未登录/);
  response = { statusCode: 200, data: { openid: 'abc+&', user: { id: 9, nickname: '测试' } } };
  await session.login();
  assert.equal(last.url, 'http://127.0.0.1:8081/api/login');
  assert.equal(last.data.code, 'fresh-code');
  assert.equal(storage.get('beibeiOpenid'), 'abc+&');
  assert.equal(session.getCachedUser().userInfo.nickName, '测试');
  response = { statusCode: 200, data: { ok: true } };
  await api.personal('/api/vocabulary', 'POST', { wordId: 17 });
  assert.equal(last.url, 'http://127.0.0.1:8081/api/vocabulary?openid=abc%2B%26');
  assert.equal(last.data.wordId, 17);
  assert.equal(last.header.Authorization, undefined);
  response = { statusCode: 409, data: { detail: '房间已满' } };
  await assert.rejects(api.personal('/api/pkroom/123456/join', 'POST'), /房间已满/);
  response = { statusCode: 200, data: { id: 17, word: 'test', level: 4, meaning: '测试' } };
  storage.delete('beibeiOpenid');
  const detail = await api.callApi('getWordDetail', { wordId: 17 });
  assert.equal(detail.word._id, '17');
  response = { statusCode: 200, data: { list: [{ id: 17, word: 'test', collected: true }], total: 1, page: 1 } };
  const list = await api.callApi('getWordList', { level: 4, letter: 'T', page: 1, pageSize: 30 });
  assert.equal(last.data.letter, 'T');
  assert.equal(last.data.pageSize, 30);
  assert(last.url.includes('/api/words'));
  assert.equal(list.list[0].collected, true);
  response = { statusCode: 200, data: { id: 17, word: 'test', level: 4, meaning: '测试' } };
  const card = loadPage('word-card');
  card.pageAlive = true; card.data.word = null;
  await card.loadWord('17');
  assert.equal(card.data.word.word, 'test'); // 直接打开卡片也能展示详情。
  storage.set('beibeiOpenid', 'abc');
  const game = loadPage('pk-game');
  game.alive = true;
  game.sync({ roomCode: '123456', status: 'playing', ownerId: 9, guestId: 10, level: 4,
    ownerScore: 0, guestScore: 0, ownerProgress: 0, guestProgress: 0,
    questions: [{ word: 'test', options: ['a', 'b', 'c', 'd'] }], myAnswers: {} });
  assert.equal(game.data.role, 'owner');
  assert.equal(game.data.currentQuestion.options[2].value, '2');
  game.onHide();
  console.log('PASS: login, openid encoding, write body, HTTP errors, field mapping, direct word card, PK options/lifecycle');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
