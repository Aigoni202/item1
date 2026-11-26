App({
  onLaunch() {
    this.globalData.openid = wx.getStorageSync('beibeiOpenid') || '';
    const user = wx.getStorageSync('beibeiHttpUser') || {};
    this.globalData.userInfo = { nickName: user.nickname || '微信用户', avatarUrl: user.avatarUrl || '' };
  },
  globalData: { openid: '', userInfo: null, isAdmin: false },
});
