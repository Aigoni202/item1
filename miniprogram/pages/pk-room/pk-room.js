const { personal, requireLogin } = require('../../utils/api');
const { getSelectedLevel, setSelectedLevel } = require('../../utils/learning');
Page({
  data: { level: 4, roomCode: '', roomId: '', hasRoom: false, role: '', roomStatus: '',
    guestJoined: false, guestReady: false, loading: false, joining: false, starting: false },
  onLoad(options = {}) {
    this.alive = true;
    this.setData({ level: Number(options.level) === 6 ? 6 : getSelectedLevel(), roomCode: options.roomCode || '' });
    if (options.roomCode && requireLogin()) this.joinRoom();
  },
  onShow() { this.alive = true; if (this.data.hasRoom) this.poll(); },
  onHide() { this.alive = false; clearTimeout(this.timer); },
  onUnload() { this.onHide(); },
  chooseLevel(e) { const level = Number(e.currentTarget.dataset.level); setSelectedLevel(level); this.setData({ level }); },
  onRoomCodeInput(e) { this.setData({ roomCode: e.detail.value }); },
  async createRoom() {
    if (!requireLogin() || this.data.loading) return;
    this.setData({ loading: true });
    try {
      const room = await personal('/api/pkroom', 'POST', { level: this.data.level, count: 20 });
      this.sync(room); this.poll();
    } catch (e) { this.error(e); } finally { this.setData({ loading: false }); }
  },
  async joinRoom() {
    if (!requireLogin() || this.data.joining) return;
    if (!/^\d{6}$/.test(this.data.roomCode)) return this.error(new Error('请输入六位数字房间号'));
    this.setData({ joining: true });
    try {
      const room = await personal(`/api/pkroom/${this.data.roomCode}/join`, 'POST');
      this.sync(room); this.poll();
    } catch (e) { this.error(e); } finally { this.setData({ joining: false }); }
  },
  sync(room) {
    const user = wx.getStorageSync('beibeiHttpUser') || {};
    const role = Number(user.id) === Number(room.ownerId) ? 'owner' : 'guest';
    this.setData({ hasRoom: true, roomCode: room.roomCode, roomId: room.roomCode, level: room.level,
      role, roomStatus: room.status, guestJoined: Boolean(room.guestId), guestReady: room.status === 'ready' });
    if (room.status === 'playing' && !this.entered) {
      this.entered = true;
      wx.redirectTo({ url: `/pages/pk-game/pk-game?roomId=${room.roomCode}` });
    }
    if (['expired', 'closed'].includes(room.status)) {
      this.setData({ hasRoom: false }); this.error(new Error('房间已关闭或过期'));
    }
  },
  poll() {
    clearTimeout(this.timer);
    if (!this.alive || !this.data.hasRoom || this.polling || this.entered) return;
    this.polling = true;
    personal(`/api/pkroom/${this.data.roomCode}`).then(room => { if (this.alive) this.sync(room); })
      .catch(e => { if (this.alive) this.error(e); })
      .finally(() => { this.polling = false; if (this.alive && this.data.hasRoom && !this.entered) this.timer = setTimeout(() => this.poll(), 2000); });
  },
  async action(name) {
    if (this.data.starting) return;
    this.setData({ starting: true });
    try { this.sync(await personal(`/api/pkroom/${this.data.roomCode}/${name}`, 'POST')); }
    catch (e) { this.error(e); } finally { this.setData({ starting: false }); }
  },
  prepareRoom() { return this.action('prepare'); },
  startRoom() { return this.action('start'); },
  cancelRoom() {
    wx.showModal({ title: '取消房间', content: '确定结束这个房间？', success: async res => {
      if (!res.confirm) return;
      try { await personal(`/api/pkroom/${this.data.roomCode}`, 'DELETE'); this.setData({ hasRoom: false }); clearTimeout(this.timer); }
      catch (e) { this.error(e); }
    } });
  },
  onShareAppMessage() { return { title: '贝贝单词，邀请你来PK', path: `/pages/pk-room/pk-room?roomCode=${this.data.roomCode}&level=${this.data.level}` }; },
  error(e) { wx.showToast({ title: e.message || '操作失败', icon: 'none' }); },
});
