const assert = require('node:assert/strict');
const Module = require('node:module');

let page;
let loggedIn = true;
let apiHandler = async action => {
  if (action === 'getWordList') {
    return { list: [{ _id: 'w1', word: 'abandon', phonetic: '/əˈbændən/', pos: 'v.', meaning: '放弃；抛弃' }], total: 28 };
  }
  return { list: [], total: 5 };
};
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === '../../utils/learning') {
    return {
      getSelectedLevel: () => 4,
      setSelectedLevel: level => Number(level) === 6 ? 6 : 4,
    };
  }
  if (request === '../../utils/api') {
    return {
      callApi: (...args) => apiHandler(...args),
      isLoggedIn: () => loggedIn,
      requireLogin: () => true,
    };
  }
  if (request === '../../utils/tabbar') return { syncTabBar() {} };
  return originalLoad(request, parent, isMain);
};

global.Page = value => { page = value; };
global.wx = { showToast() {}, showModal() {} };
require('../miniprogram/pages/index/index');
Module._load = originalLoad;

page.data = JSON.parse(JSON.stringify(page.data));
page.setData = patch => {
  Object.entries(patch).forEach(([key, value]) => {
    const parts = key.split('.');
    let target = page.data;
    while (parts.length > 1) target = target[parts.shift()];
    target[parts[0]] = value;
  });
};

assert.equal(typeof page.loadHomeSummary, 'function', '首页必须加载真实学习摘要');
assert.equal(typeof page.onAiPreview, 'function', 'AI 入口必须有明确的未开放反馈');

const routes = [];
const realSafeNavigate = page.safeNavigate;
page.safeNavigate = (type, url) => routes.push({ type, url });
[
  ['book', '词库'],
  ['learn', '记单词'],
  ['new-words', '生词本'],
  ['challenge', '闯关模式'],
  ['mistakes', '错题本'],
  ['pk', '好友 PK'],
].forEach(([id, title]) => page.onFeatureTap({ currentTarget: { dataset: { id, title } } }));

assert.deepEqual(routes, [
  { type: 'navigateTo', url: '/pages/wordbook/wordbook' },
  { type: 'navigateTo', url: '/pages/word-card/word-card?mode=learn&level=4' },
  { type: 'navigateTo', url: '/pages/collected/collected' },
  { type: 'navigateTo', url: '/pages/challenge/challenge?level=4' },
  { type: 'navigateTo', url: '/pages/wrong-book/wrong-book' },
  { type: 'navigateTo', url: '/pages/pk-room/pk-room?level=4' },
]);

const realSetTimeout = global.setTimeout;
let navigationFailureToast;
let navigationApiContext;
page.safeNavigate = realSafeNavigate;
page.featureNavigating = false;
page.data.featureDisabled = false;
global.setTimeout = callback => { callback(); return 1; };
global.wx.navigateTo = function navigateTo(options) {
  navigationApiContext = this;
  options.fail({ errMsg: 'navigateTo:fail can not navigateTo a tabbar page' });
};
global.wx.showToast = options => { navigationFailureToast = options; };
page.onFeatureTap({ currentTarget: { dataset: { id: 'book', title: '词库' } } });
global.setTimeout = realSetTimeout;
assert.ok(navigationFailureToast, '页面跳转失败时必须给用户可见提示');
assert.equal(navigationApiContext, global.wx, '微信导航 API 必须通过 wx 对象直接调用');
assert.equal(page.featureNavigating, false, '页面跳转失败后必须允许再次点击');

(async () => {
  await page.loadHomeSummary();
  assert.equal(page.data.heroWord.word, 'abandon');
  assert.equal(page.data.newCount, 20);
  assert.equal(page.data.learnedCount, 28);
  assert.equal(page.data.wrongCount, 5);

  let resolveLevel4;
  const level4Result = new Promise(resolve => { resolveLevel4 = resolve; });
  apiHandler = async (action, payload) => {
    if (action === 'getWrongWords') return { list: [], total: 1 };
    if (payload.level === 4) return level4Result;
    return payload.filter === 'unlearned'
      ? { list: [{ _id: 'w6', word: 'advanced', phonetic: '/ədˈvænst/', pos: 'adj.', meaning: '高级的' }], total: 9 }
      : { list: [], total: 91 };
  };
  page.data.selectedLevel = 4;
  const staleRequest = page.loadHomeSummary(4);
  page.data.selectedLevel = 6;
  await page.loadHomeSummary(6);
  resolveLevel4({ list: [{ _id: 'w4', word: 'abandon' }], total: 20 });
  await staleRequest;
  assert.equal(page.data.heroWord.word, 'advanced', '旧级别请求不能覆盖新级别');

  apiHandler = async () => { throw new Error('network failed'); };
  await page.loadHomeSummary(6);
  assert.equal(page.data.heroWord, null, '失败时不能保留旧词');
  assert.equal(page.data.homeError, '学习数据加载失败，请重试');

  console.log('PASS: home summary and legacy feature routes');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
