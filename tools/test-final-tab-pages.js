const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
const indexPageConfig = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.json'), 'utf8'));
assert.equal(indexPageConfig.enableShareAppMessage, undefined, '页面配置不能包含无效的 enableShareAppMessage');
assert.equal(indexPageConfig.enableShareTimeline, undefined, '页面配置不能包含无效的 enableShareTimeline');
assert.deepEqual(app.tabBar.list.map(item => [item.pagePath, item.text]), [
  ['pages/index/index', '首页'],
  ['pages/study/study', '学习'],
  ['pages/ai/ai', 'AI'],
  ['pages/profile/profile', '我的'],
]);

let capturedPage;
global.Page = value => { capturedPage = value; };
global.wx = { navigateTo() {}, showToast() {} };

function loadPage(relativePath) {
  capturedPage = undefined;
  try {
    require(path.join(root, relativePath));
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
  assert.ok(capturedPage, `${relativePath} 必须注册页面`);
  return capturedPage;
}

const study = loadPage('miniprogram/pages/study/study.js');
assert.equal(typeof study.openFeature, 'function');
const routes = [];
global.wx.navigateTo = ({ url }) => routes.push(url);
['book', 'learn', 'wrong', 'saved', 'challenge'].forEach(id => {
  study.openFeature({ currentTarget: { dataset: { id } } });
});
assert.deepEqual(routes, [
  '/pages/wordbook/wordbook',
  '/pages/word-card/word-card?mode=learn&level=4',
  '/pages/wrong-book/wrong-book',
  '/pages/collected/collected',
  '/pages/challenge/challenge?level=4',
]);

const ai = loadPage('miniprogram/pages/ai/ai.js');
assert.equal(typeof ai.showComingSoon, 'function');
console.log('PASS: final tab configuration and new tab page entries');
