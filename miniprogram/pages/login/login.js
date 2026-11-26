const { login } = require('../../utils/request');
Page({
  data: { loading: false },
  async handleLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      await login(); wx.showToast({ title: '登录成功' }); this.goBack();
    } catch (error) {
      wx.showToast({ title: error.message || error.errMsg || '登录失败', icon: 'none' });
    } finally { this.setData({ loading: false }); }
  },
  cancelLogin() { this.goBack(); },
  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/profile/profile' });
  },
});
