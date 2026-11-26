// 页面接入示例：复制所需事件到实际页面，并在 WXML 绑定对应按钮。
const api = require('../../utils/api');

Page({
  data: { words: [], room: null, error: '' },

  onLoad() { this.loadWords(); },

  async loadWords() {
    try {
      const result = await api.getWords(4, 1); // 六级改为 6；分页使用 page 参数。
      this.setData({ words: result.list });
    } catch (error) { this.showError(error); }
  },

  async handleLogin() {
    try {
      await api.login();
      wx.showToast({ title: '登录成功' });
    } catch (error) { this.showError(error); }
  },

  async handleCollect(event) {
    try {
      // WXML 按钮：data-id="{{item.id}}" bindtap="handleCollect"
      await api.addVocabulary(event.currentTarget.dataset.id);
      wx.showToast({ title: '已加入生词本' });
    } catch (error) { this.showError(error); }
  },

  async handleCheckin() {
    try {
      await api.checkin();
      wx.showToast({ title: '打卡成功' });
    } catch (error) { this.showError(error); }
  },

  async handleCreatePk() {
    try {
      const room = await api.createRoom(4, 10);
      this.setData({ room });
      // 把 room.roomCode 分享给好友；好友调用 api.joinRoom(code)。
      this.startPolling(room.roomCode);
    } catch (error) { this.showError(error); }
  },

  startPolling(code) {
    this.stopPolling();
    this.polling = true;
    const refresh = async () => {
      try {
        const room = await api.getRoom(code);
        if (!this.polling) return;
        this.setData({ room });
        if (['finished', 'expired'].includes(room.status)) {
          this.stopPolling();
          return;
        }
      } catch (error) {
        this.stopPolling();
        this.showError(error);
      }
      if (this.polling) this.pollTimer = setTimeout(refresh, 2000);
    };
    refresh();
  },

  async handleAnswer(event) {
    try {
      const { index, choice } = event.currentTarget.dataset;
      const room = await api.answer(this.data.room.roomCode, Number(index), Number(choice));
      this.setData({ room });
    } catch (error) { this.showError(error); }
  },

  stopPolling() { this.polling = false; clearTimeout(this.pollTimer); },
  onHide() { this.stopPolling(); },
  onShow() {
    const room = this.data.room;
    if (room && ['waiting', 'playing'].includes(room.status)) this.startPolling(room.roomCode);
  },
  onUnload() { this.stopPolling(); },
  showError(error) { wx.showToast({ title: error.message || '操作失败', icon: 'none' }); },
});
