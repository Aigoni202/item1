// pages/profile/profile.js
// 展示用户信息、实时学习统计、登录入口和管理员入口。
const { callApi, isLoggedIn, getCachedUser } = require("../../utils/api");
const { syncTabBar } = require('../../utils/tabbar');

Page({
  data: {
    loggedIn: false,
    loginLoading: false,
    userInfo: {
      nickName: "未登录",
      avatarUrl: "",
    },
    statistics: [
      { label: "已学", value: "--" },
      { label: "未学", value: "--" },
      { label: "生词", value: "--" },
      { label: "错题", value: "--" },
    ],
    isAdmin: false,
    statsLoading: false,
  },
  async onShow() {
    syncTabBar(this);
    const app = getApp();
    // 以当前登录流程写入的 beibeUser 为唯一权限来源，避免旧缓存或全局状态
    // 让普通用户错误显示管理员入口。
    const cachedUser = getCachedUser();
    const loggedIn = Boolean(cachedUser.openid);
    const userInfo = cachedUser.userInfo || app.globalData.userInfo || {
      nickName: "未登录",
      avatarUrl: "",
    };
    const isAdmin = loggedIn && cachedUser.isAdmin === true;
    const nextUserInfo = {
      nickName: loggedIn ? (userInfo.nickName || "微信用户") : "未登录",
      avatarUrl: userInfo.avatarUrl || "",
    };
    if (
      this.data.loggedIn !== loggedIn ||
      this.data.isAdmin !== isAdmin ||
      this.data.userInfo.nickName !== nextUserInfo.nickName ||
      this.data.userInfo.avatarUrl !== nextUserInfo.avatarUrl
    ) {
      this.setData({
        loggedIn,
        userInfo: nextUserInfo,
        isAdmin,
      });
    }
    if (loggedIn) {
      if (!this.data.statsLoading) {
        this.deferLoadStatistics();
      }
    } else {
      this.setData({
        statistics: [
          { label: "已学", value: "--" },
          { label: "未学", value: "--" },
          { label: "生词", value: "--" },
          { label: "错题", value: "--" },
        ],
      });
    }
  },

  onHide() {
    clearTimeout(this.statsTimer);
  },

  deferLoadStatistics() {
    clearTimeout(this.statsTimer);
    this.statsTimer = setTimeout(() => this.loadStatistics(), 80);
  },

  handleLogin() {
    wx.navigateTo({
      url: "/pages/login/login",
    });
  },

  async loadStatistics() {
    if (!isLoggedIn()) {
      return;
    }
    if (this.data.statsLoading) {
      return;
    }
    this.setData({ statsLoading: true });
    try {
      const result = await callApi("getUserStats", {}, {
        fallback: "学习统计加载失败",
        requireLogin: true,
        showLogin: false,
      });
      const stats = result.stats || {};
      this.setData({
        statistics: [
          { label: "已学", value: Number(stats.learned || 0) },
          { label: "未学", value: Number(stats.unlearned || 0) },
          { label: "生词", value: Number(stats.collected || 0) },
          { label: "错题", value: Number(stats.wrong || 0) },
        ],
      });
      this.statsLoaded = true;
      this.lastStatsAt = Date.now();
    } catch (error) {
      if (error.message !== "未登录") {
        console.error("加载学习统计失败：", error);
      }
    } finally {
      this.setData({ statsLoading: false });
    }
  },
  // 只有登录用户的 isAdmin 为 true 时才显示并允许进入后台。
  openAdmin() {
    if (!this.data.isAdmin) {
      wx.reLaunch({
        url: "/pages/index/index",
      });
      return;
    }
    // 先进入管理员首页，再从菜单进入具体管理页面。
    wx.navigateTo({
      url: "/pages/admin/index/index",
    });
  },
});
