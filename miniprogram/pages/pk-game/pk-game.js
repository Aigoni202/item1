const { personal, requireLogin } = require('../../utils/api');
Page({
  data: { roomId: '', role: '', currentQuestion: null, currentIndex: 0, totalCount: 20, countdown: 10,
    roundStarted: false, selectedMeaning: '', answerState: '', correctMeaning: '', submitted: false,
    waitingOpponent: false, loading: true, ownerScore: 0, guestScore: 0, ownerProgress: 0, guestProgress: 0 },
  onLoad(options = {}) {
    this.alive = true;
    if (!requireLogin()) return;
    this.setData({ roomId: options.roomId || '' });
    this.refresh();
  },
  onShow() { this.alive = true; if (this.data.roomId && !this.data.loading) this.refresh(); },
  onHide() { this.alive = false; clearTimeout(this.pollTimer); clearTimeout(this.nextTimer); clearInterval(this.clock); this.clock = null; },
  onUnload() { this.onHide(); },
  async refresh() {
    if (!this.alive || this.fetching || this.finished) return;
    this.fetching = true;
    try {
      const room = await personal(`/api/pkroom/${this.data.roomId}`);
      if (this.alive) this.sync(room);
    } catch (e) { if (this.alive) this.error(e); }
    finally {
      this.fetching = false;
      if (this.alive && !this.finished) { clearTimeout(this.pollTimer); this.pollTimer = setTimeout(() => this.refresh(), 2000); }
    }
  },
  sync(room) {
    if (['closed', 'expired'].includes(room.status)) {
      this.finished = true; clearInterval(this.clock);
      wx.showModal({ title: '对战结束', content: '房间已关闭或过期', showCancel: false,
        success: () => wx.redirectTo({ url: '/pages/pk-room/pk-room' }) }); return;
    }
    const user = wx.getStorageSync('beibeiHttpUser') || {};
    const role = Number(user.id) === Number(room.ownerId) ? 'owner' : 'guest';
    this.room = room;
    this.setData({ role, ownerScore: room.ownerScore, guestScore: room.guestScore,
      ownerProgress: room.ownerProgress, guestProgress: room.guestProgress, totalCount: room.questions.length, loading: false });
    if (room.status === 'finished') {
      this.finished = true; clearInterval(this.clock); clearTimeout(this.nextTimer);
      wx.setStorageSync('pkRole', role); wx.setStorageSync('pkResult', { ...room,
        winner: room.winnerId == null ? 'draw' : Number(room.winnerId) === Number(room.ownerId) ? 'owner' : 'guest' });
      wx.redirectTo({ url: '/pages/pk-result/pk-result' }); return;
    }
    const index = Object.keys(room.myAnswers).length;
    if (index >= room.questions.length) {
      clearInterval(this.clock); this.setData({ submitted: true, waitingOpponent: true, roundStarted: false }); return;
    }
    if (this.data.currentIndex !== index || !this.data.currentQuestion || !this.clock) {
      clearInterval(this.clock);
      const q = room.questions[index];
      this.setData({ currentIndex: index, currentQuestion: { ...q, options: q.options.map((label, i) => ({ value: String(i), label })) },
        countdown: 10, roundStarted: room.status === 'playing', submitted: false, waitingOpponent: false,
        selectedMeaning: '', answerState: '', correctMeaning: '' });
      // 前台展示计时；后台超时不在客户端伪造分数。服务端接收-1表示超时。
      this.deadline = Date.now() + 10000;
      this.clock = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
        this.setData({ countdown: remaining });
        if (!remaining) this.submit(-1);
      }, 250);
    }
  },
  chooseOption(e) { return this.submit(Number(e.currentTarget.dataset.meaning)); },
  async submit(choice) {
    if (!this.alive || this.sending || this.data.submitted || !this.data.roundStarted) return;
    this.sending = true; clearInterval(this.clock); this.clock = null;
    this.setData({ submitted: true, selectedMeaning: String(choice) });
    try {
      const room = await personal(`/api/pkroom/${this.data.roomId}/answers`, 'POST', { index: this.data.currentIndex, choice });
      if (this.alive) this.sync(room);
    } catch (e) {
      this.setData({ submitted: false }); this.error(e); if (this.alive) this.refresh();
    } finally { this.sending = false; }
  },
  error(e) { wx.showToast({ title: e.message || '请求失败', icon: 'none' }); },
});
