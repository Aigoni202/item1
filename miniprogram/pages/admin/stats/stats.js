// 当前后端没有管理接口，停用历史入口。
Page({
  data: { list: [], users: [], words: [], admins: [], loading: false },
  onLoad() {
    wx.showModal({ title: '暂不可用', content: '当前SpringBoot后端尚未提供管理接口，请使用Navicat管理课程数据。', showCancel: false,
      success: () => wx.switchTab({ url: '/pages/index/index' }) });
  },
});
