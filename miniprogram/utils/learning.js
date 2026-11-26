// 当前学习词书状态：四级和六级共用，保存在本地，保证下次进入仍使用上次选择。
const STORAGE_KEY = "selectedBookLevel";

function normalizeLevel(level) {
  return Number(level) === 6 ? 6 : 4;
}

function getSelectedLevel() {
  const value =
    wx.getStorageSync(STORAGE_KEY) ||
    wx.getStorageSync("wordbookLevel") ||
    4;
  return normalizeLevel(value || 4);
}

function setSelectedLevel(level) {
  const normalized = normalizeLevel(level);
  wx.setStorageSync(STORAGE_KEY, normalized);
  // 兼容旧版首页和词库曾使用的缓存键。
  wx.setStorageSync("wordbookLevel", normalized);
  return normalized;
}

module.exports = {
  STORAGE_KEY,
  normalizeLevel,
  getSelectedLevel,
  setSelectedLevel,
};
