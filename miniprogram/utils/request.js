// 本地开发者工具地址，真机需改为电脑局域网地址或HTTPS域名。
const BASE_URL = 'http://127.0.0.1:8081';
function request(path, method = 'GET', data = {}, options = {}) {
  const openid = wx.getStorageSync('beibeiOpenid');
  if (options.personal && !openid) return Promise.reject(new Error('未登录'));
  if (openid && path !== '/api/login') path += (path.includes('?') ? '&' : '?') + 'openid=' + encodeURIComponent(openid);
  return new Promise((resolve, reject) => wx.request({
    url: BASE_URL + path, method, data, timeout: 15000,
    header: { 'content-type': 'application/json' },
    success(res) {
      if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res.data);
      const detail = res.data && res.data.detail;
      const error = new Error(typeof detail === 'string' ? detail : `请求失败（${res.statusCode}）`);
      error.statusCode = res.statusCode; reject(error);
    },
    fail(error) { reject(new Error(error.errMsg || '连接失败，请检查8081服务')); },
  }));
}
function isLoggedIn() { return Boolean(wx.getStorageSync('beibeiOpenid')); }
function getCachedUser() {
  const user = wx.getStorageSync('beibeiHttpUser') || {};
  return { openid: wx.getStorageSync('beibeiOpenid') || '', isAdmin: false,
    userInfo: { nickName: user.nickname || '微信用户', avatarUrl: user.avatarUrl || '' } };
}
function requireLogin(message = '该功能需要登录，是否前往登录？') {
  if (isLoggedIn()) return true;
  wx.showModal({ title: '请先登录', content: message,
    success: res => { if (res.confirm) wx.navigateTo({ url: '/pages/login/login' }); } });
  return false;
}
async function login() {
  const result = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
  if (!result.code) throw new Error('获取微信code失败');
  const response = await request('/api/login', 'POST', { code: result.code });
  if (!response.openid) throw new Error('登录响应缺少openid');
  wx.setStorageSync('beibeiOpenid', response.openid);
  wx.setStorageSync('beibeiHttpUser', response.user || {});
  getApp().globalData.openid = response.openid;
  getApp().globalData.userInfo = getCachedUser().userInfo;
  wx.removeStorageSync('wordCardContext');
  return response;
}
module.exports = { BASE_URL, request, login, isLoggedIn, getCachedUser, requireLogin };
