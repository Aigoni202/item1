// 页面onShow调用，覆盖switchTab、分享直达及程序跳转的选中态。
function syncTabBar(page) {
  if (typeof page.getTabBar !== 'function') return;
  const bar = page.getTabBar();
  if (bar && typeof bar.syncSelected === 'function') bar.syncSelected();
}
module.exports = { syncTabBar };
