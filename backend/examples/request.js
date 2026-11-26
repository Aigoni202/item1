// 复制为 miniprogram/utils/api.js，只使用 HTTP 请求。
const BASE_URL = 'https://api.example.com';

function request(path, method = 'GET', data = {}, personal = false) {
  if (personal) {
    const openid = wx.getStorageSync('beibeiOpenid');
    if (!openid) return Promise.reject(new Error('请先微信登录'));
    path += (path.includes('?') ? '&' : '?') + 'openid=' + encodeURIComponent(openid);
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      timeout: 15000,
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res.data);
        const detail = res.data && res.data.detail;
        reject(new Error(typeof detail === 'string' ? detail : `请求失败（${res.statusCode}）`));
      },
      fail(error) { reject(new Error(error.errMsg || '网络连接失败')); },
    });
  });
}

async function login(nickname = '微信用户', avatarUrl = '') {
  const result = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
  if (!result.code) throw new Error('未取得微信登录code');
  const response = await request('/api/login', 'POST', { code: result.code, nickname, avatarUrl });
  wx.setStorageSync('beibeiOpenid', response.openid);
  wx.setStorageSync('beibeiHttpUser', response.user);
  return response.user;
}

module.exports = {
  request, login,
  getWords: (level = 4, page = 1, keyword = '') => request('/api/words', 'GET', { level, page, pageSize: 20, keyword }),
  getWord: id => request(`/api/words/${id}`),
  getVocabulary: (page = 1) => request('/api/books/vocabulary', 'GET', { page }, true),
  addVocabulary: id => request(`/api/books/vocabulary/${id}`, 'PUT', {}, true),
  removeVocabulary: id => request(`/api/books/vocabulary/${id}`, 'DELETE', {}, true),
  getWrongWords: (page = 1) => request('/api/books/wrong_words', 'GET', { page }, true),
  markWrong: id => request(`/api/books/wrong_words/${id}`, 'PUT', {}, true),
  cancelWrong: id => request(`/api/books/wrong_words/${id}`, 'DELETE', {}, true),
  checkin: () => request('/api/checkins', 'POST', {}, true),
  getCheckins: (page = 1) => request('/api/checkins', 'GET', { page }, true),
  createRoom: (level = 4, count = 10) => request('/api/pk/rooms', 'POST', { level, count }, true),
  joinRoom: code => request(`/api/pk/rooms/${encodeURIComponent(code)}/join`, 'POST', {}, true),
  getRoom: code => request(`/api/pk/rooms/${encodeURIComponent(code)}`, 'GET', {}, true),
  answer: (code, index, choice) => request(`/api/pk/rooms/${encodeURIComponent(code)}/answers`, 'POST', { index, choice }, true),
  getPkRecords: (page = 1) => request('/api/pk/records', 'GET', { page }, true),
  logout() {
    wx.removeStorageSync('beibeiOpenid');
    wx.removeStorageSync('beibeiHttpUser');
  },
};
