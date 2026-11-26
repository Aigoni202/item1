// pages/wrong-book/wrong-book.js
// 错题本支持词书筛选、掌握状态筛选、复习、移除和标记掌握。
const { callApi, isLoggedIn, requireLogin } = require("../../utils/api");
const { syncTabBar } = require('../../utils/tabbar');

Page({
  data: {
    list: [],
    level: "all",
    mastered: "all",
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    hasMore: false,
    levelOptions: [
      { value: "all", label: "全部" },
      { value: "4", label: "四级" },
      { value: "6", label: "六级" },
    ],
    masteredOptions: [
      { value: "all", label: "全部状态" },
      { value: "false", label: "未掌握" },
      { value: "true", label: "已掌握" },
    ],
    loggedIn: false,
  },

  onShow() {
    syncTabBar(this);
    if (isLoggedIn()) {
      this.setData({ loggedIn: true });
      // tab 切换先显示页面，错题数据延后一点加载；已有数据时短时间内复用缓存。
      if (!this.data.loading) {
        this.deferLoadWords(true);
      }
    } else {
      this.setData({
        loggedIn: false,
        list: [],
        total: 0,
        hasMore: false,
      });
    }
  },

  onHide() {
    clearTimeout(this.loadTimer);
  },

  deferLoadWords(reset = false) {
    clearTimeout(this.loadTimer);
    this.loadTimer = setTimeout(() => this.loadWords(reset), 80);
  },

  goLogin() {
    wx.switchTab({
      url: "/pages/profile/profile",
    });
  },

  chooseLevel(event) {
    if (!requireLogin("错题本需要登录后查看，是否前往我的页面登录？")) {
      return;
    }
    this.setData(
      {
        level: event.currentTarget.dataset.value,
      },
      () => this.loadWords(true)
    );
  },

  chooseMastered(event) {
    if (!requireLogin("错题本需要登录后查看，是否前往我的页面登录？")) {
      return;
    }
    this.setData(
      {
        mastered: event.currentTarget.dataset.value,
      },
      () => this.loadWords(true)
    );
  },

  async loadWords(reset = false) {
    if (this.data.loading) {
      return;
    }
    if (!requireLogin("错题本需要登录后查看，是否前往我的页面登录？")) {
      return;
    }

    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true });
    try {
      const result = await callApi("getWrongWords", {
        level: this.data.level,
        mastered: this.data.mastered,
        page,
        pageSize: this.data.pageSize,
      }, {
        fallback: "错题本加载失败",
        requireLogin: true,
      });
      const incoming = result.list || [];
      const list = reset ? incoming : this.data.list.concat(incoming);
      this.setData({
        list,
        page: result.page || page,
        total: result.total || 0,
        hasMore: list.length < (result.total || 0),
      });
      this.hasLoaded = true;
      this.lastLoadAt = Date.now();
    } catch (error) {
      console.error("加载错题本失败：", error);
      if (error.message !== "未登录") {
        console.error("加载错题本失败：", error);
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadWords(false);
    }
  },

  reviewWord(event) {
    const index = Number(event.currentTarget.dataset.index);
    const word = this.data.list[index];
    if (!word) {
      return;
    }
    wx.setStorageSync("wordCardContext", {
      list: this.data.list,
      index,
      source: "wrong-book",
    });
    wx.navigateTo({
      url: `/pages/word-card/word-card?wordId=${word._id}&index=${index}`,
    });
  },

  removeWord(event) {
    if (!requireLogin("移除错题需要登录，是否前往我的页面登录？")) {
      return;
    }
    const word = event.currentTarget.dataset.word;
    wx.showModal({
      title: "移除错题",
      content: `确定移除“${word.word}”吗？`,
      confirmColor: "#CF222E",
      success: async (modalResult) => {
        if (!modalResult.confirm) {
          return;
        }
        try {
          await callApi("removeWrongWord", {
            wordId: word._id,
          }, {
            fallback: "移除失败",
            requireLogin: true,
          });
          wx.showToast({
            title: "已移除",
            icon: "success",
          });
          this.loadWords(true);
        } catch (error) {
          if (error.message !== "未登录") {
            console.error("移除错题失败：", error);
          }
        }
      },
    });
  },

  async toggleMastered(event) {
    if (!requireLogin("标记错题状态需要登录，是否前往我的页面登录？")) {
      return;
    }
    const word = event.currentTarget.dataset.word;
    try {
      const result = await callApi("markWrongMastered", {
        wordId: word._id,
        mastered: !Boolean(word.mastered),
      }, {
        fallback: "状态更新失败",
        requireLogin: true,
      });
      const index = Number(event.currentTarget.dataset.index);
      this.setData({
        [`list[${index}].mastered`]: Boolean(
          result && result.mastered
        ),
      });
    } catch (error) {
      if (error.message !== "未登录") {
        console.error("更新错题状态失败：", error);
      }
    }
  },
});
