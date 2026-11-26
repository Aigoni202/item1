const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let definition;
const requests = [], patches = [];
const wx = { getStorageSync: () => '', setStorageSync() {} };
const api = { callApi(name, data) {
  return new Promise((resolve, reject) => requests.push({ data, resolve, reject }));
} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/wordbook/wordbook.js'), 'utf8'), {
  Page: value => { definition = value; }, wx, console, setTimeout, clearTimeout, Set,
  require(name) {
    if (name.endsWith('/api')) return api;
    if (name.endsWith('/tabbar')) return { syncTabBar() {} };
    return { getSelectedLevel: () => 4, setSelectedLevel() {}, normalizeLevel: Number };
  },
});
definition.setData = function(patch, callback) {
  patches.push(patch);
  for (const [key, value] of Object.entries(patch)) {
    const match = key.match(/^list\[(\d+)\]$/);
    if (match) this.data.list[Number(match[1])] = value;
    else this.data[key] = value;
  }
  if (callback) callback();
};
function rows(start, count) { return Array.from({ length: count }, (_, i) => ({ id: start + i, word: 'word' + (start + i) })); }
async function main() {
  const page = definition;
  page.onLoad();
  page.data.letter = 'A';
  const a = page.loadWords(true);
  assert.equal(requests[0].data.pageSize, 30);
  page.data.letter = 'B';
  const b = page.loadWords(true);
  assert.equal(page.data.list.length, 0);
  assert.equal(page.data.page, 1);
  requests[1].resolve({ list: rows(100, 30), total: 65, page: 1 });
  await b;
  requests[0].resolve({ list: rows(1, 30), total: 40, page: 1 });
  await a;
  assert.equal(page.data.list[0].id, 100); // 旧A请求不能覆盖B。
  const next = page.loadWords(false);
  await page.loadWords(false);
  assert.equal(requests.length, 3); // 加载锁防重复请求。
  assert.equal(requests[2].data.page, 2);
  requests[2].resolve({ list: rows(130, 30), total: 65, page: 2 });
  await next;
  assert.equal(page.data.list.length, 60);
  assert(patches.some(p => p['list[30]'] && !Object.hasOwn(p, 'list')));
  const end = page.loadWords(false);
  requests[3].resolve({ list: rows(160, 5), total: 65, page: 3 });
  await end;
  assert.equal(page.data.hasMore, false);
  await page.loadWords(false);
  assert.equal(requests.length, 4);
  page.data.letter = 'C';
  const fail = page.loadWords(true);
  requests[4].reject(new Error('test failure'));
  await fail;
  assert.equal(page.data.loading, false);
  const retry = page.loadWords(true);
  requests[5].resolve({ list: [], total: 0, page: 1 });
  await retry;
  assert.equal(page.data.hasMore, false);
  const closed = page.loadWords(true);
  page.onUnload();
  requests[6].resolve({ list: rows(1, 30), total: 30, page: 1 });
  await closed;
  assert.equal(page.data.list.length, 0);
  console.log('PASS: 30/page, reset, stale-response protection, append-only setData, load lock, end, error, unload');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
