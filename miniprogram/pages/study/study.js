const { getSelectedLevel } = require('../../utils/learning');
const { syncTabBar } = require('../../utils/tabbar');

Page({
  data: { selectedLevel: 4 },
  onLoad() { this.setData({ selectedLevel: getSelectedLevel() }); },
  onShow() {
    syncTabBar(this);
    this.setData({ selectedLevel: getSelectedLevel() });
  },
  openFeature(event) {
    const routes = {
      book: '/pages/wordbook/wordbook',
      learn: `/pages/word-card/word-card?mode=learn&level=${this.data.selectedLevel}`,
      wrong: '/pages/wrong-book/wrong-book',
      saved: '/pages/collected/collected',
      challenge: `/pages/challenge/challenge?level=${this.data.selectedLevel}`,
    };
    const url = routes[event.currentTarget.dataset.id];
    if (url) wx.navigateTo({ url });
  },
});
