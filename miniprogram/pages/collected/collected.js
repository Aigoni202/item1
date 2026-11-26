// pages/collected/collected.js
// 生词本支持时间/字母排序、搜索和移除收藏。
const { callApi, isLoggedIn, requireLogin } = require("../../utils/api");

Page({
  data: {
    list: [],
    keyword: "",
    sort: "time",
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    hasMore: false,
    loggedIn: false,
  },

  onShow() {
    if (isLoggedIn()) {
      this.setData({ loggedIn: true });
      this.loadWords(true);
    } else {
      this.setData({
        loggedIn: false,
        list: [],
        total: 0,
        hasMore: false,
      });
    }
  },

  goLogin() {
    wx.switchTab({
      url: "/pages/profile/profile",
    });
  },

  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value,
    });
  },

  search() {
    if (!requireLogin("生词本需要登录后查看，是否前往我的页面登录？")) {
      return;
    }
    this.loadWords(true);
  },

  chooseSort(event) {
    if (!requireLogin("生词本需要登录后查看，是否前往我的页面登录？")) {
      return;
    }
    this.setData(
      {
        sort: event.currentTarget.dataset.sort,
      },
      () => this.loadWords(true)
    );
  },

  async loadWords(reset = false) {
    if (this.data.loading) {
      return;
    }
    if (!requireLogin("生词本需要登录后查看，是否前往我的页面登录？")) {
      return;
    }

    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true });
    try {
      const result = await callApi("getCollectedWords", {
        keyword: this.data.keyword,
        sort: this.data.sort,
        page,
        pageSize: this.data.pageSize,
      }, {
        fallback: "生词本加载失败",
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
    } catch (error) {
      console.error("加载生词本失败：", error);
      if (error.message !== "未登录") {
        console.error("加载生词本失败：", error);
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  openWord(event) {
    const index = Number(event.currentTarget.dataset.index);
    const word = this.data.list[index];
    if (!word) {
      return;
    }

    wx.setStorageSync("wordCardContext", {
      list: this.data.list,
      index,
      source: "collected",
    });
    wx.navigateTo({
      url: `/pages/word-card/word-card?wordId=${word._id}&index=${index}`,
    });
  },

  removeWord(event) {
    if (!requireLogin("移出生词需要登录，是否前往我的页面登录？")) {
      return;
    }
    const word = event.currentTarget.dataset.word;
    wx.showModal({
      title: "移出生词本",
      content: `确定移除“${word.word}”吗？`,
      confirmColor: "#CF222E",
      success: async (modalResult) => {
        if (!modalResult.confirm) {
          return;
        }

        try {
          await callApi("removeCollectedWord", {
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
            console.error("移除生词失败：", error);
          }
        }
      },
    });
  },
});
