const { syncTabBar } = require('../../utils/tabbar');

Page({
  onShow() { syncTabBar(this); },
  showComingSoon() {
    wx.showToast({ title: '该功能正在逐项开发', icon: 'none', duration: 1800 });
  },
});
