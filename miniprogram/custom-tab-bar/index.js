Component({
  data: {
    selected: 0,
    tabs: [
      { path: '/pages/index/index', text: '首页', icon: '/images/icons/tab-home.svg', activeIcon: '/images/icons/tab-home-active.svg' },
      { path: '/pages/study/study', text: '学习', icon: '/images/icons/tab-study.svg', activeIcon: '/images/icons/tab-study-active.svg' },
      { path: '/pages/ai/ai', text: 'AI', icon: '/images/icons/tab-ai.svg', activeIcon: '/images/icons/tab-ai-active.svg' },
      { path: '/pages/profile/profile', text: '我的', icon: '/images/icons/tab-profile.svg', activeIcon: '/images/icons/tab-profile-active.svg' },
    ],
  },
  lifetimes: { attached() { this.syncSelected(); } },
  pageLifetimes: { show() { this.syncSelected(); } },
  methods: {
    syncSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      if (!current) return;
      const index = this.data.tabs.findIndex(tab => tab.path === '/' + current.route);
      if (index >= 0 && index !== this.data.selected) this.setData({ selected: index });
    },
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const tab = this.data.tabs[index];
      if (!tab || this.switching || index === this.data.selected) return;
      this.switching = true;
      // 不提前高亮：跳转失败仍保留真实页面的选中态。
      wx.switchTab({ url: tab.path, success: () => this.syncSelected(),
        fail: () => wx.showToast({ title: '切换失败，请重试', icon: 'none' }),
        complete: () => { this.switching = false; } });
    },
  },
});
