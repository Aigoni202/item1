// pages/index/index.js
// 首页展示主要功能入口。
const {
  getSelectedLevel,
  setSelectedLevel,
} = require("../../utils/learning");
const { callApi, isLoggedIn, requireLogin } = require("../../utils/api");
const { syncTabBar } = require('../../utils/tabbar');

Page({
  data: {
    currentTab: 0,
    pageTitle: "贝贝单词",
    pageSubtitle: "把每天的积累，变成看得见的进步。",
    selectedLevel: 4,
    selectedLevelLabel: "四级",
    featureList: [],
    featureDisabled: false,
    heroWord: null,
    newCount: null,
    learnedCount: null,
    wrongCount: null,
    homeLoading: false,
    homeError: "",
  },

  buildFeatureList(level) {
    const isCET6 = Number(level) === 6;
    return [
      {
        id: "book",
        title: `${isCET6 ? "六级" : "四级"}词库`,
        description: isCET6 ? "挑战更高阶词汇" : "从高频核心词开始",
        iconType: isCET6 ? "book-six" : "book-four",
        iconLabel: isCET6 ? "6" : "4",
        tone: isCET6 ? "violet" : "blue",
        kicker: isCET6 ? "CET 6" : "CET 4",
      },
      {
        id: "learn",
        title: "记单词",
        description: "按计划开始学习",
        iconType: "word",
        tone: "sky",
        kicker: "DAILY",
      },
      {
        id: "challenge",
        title: "闯关模式",
        description: "边玩边巩固记忆",
        iconType: "challenge",
        tone: "yellow",
        kicker: "GAME",
      },
      {
        id: "new-words",
        title: "生词本",
        description: "集中管理陌生词汇",
        iconType: "saved",
        tone: "mint",
        kicker: "SAVE",
      },
      {
        id: "mistakes",
        title: "错题本",
        description: "复习容易出错的词",
        iconType: "wrong",
        tone: "peach",
        kicker: "REVIEW",
      },
      {
        id: "pk",
        title: "好友 PK",
        description: "和好友一起比一比",
        iconType: "pk",
        tone: "pink",
        kicker: "FRIENDS",
      },
    ];
  },

  onLoad() {
    const level = getSelectedLevel();
    this.applySelectedLevel(level);
    this.loadHomeSummary(level);
  },

  onShareAppMessage() {
    return {
      title: "贝贝单词 - 把每天的积累变成进步",
      path: "/pages/index/index",
    };
  },

  onShareTimeline() {
    return {
      title: "贝贝单词 - 每天记几个单词",
      query: "",
    };
  },

  onShow() {
    syncTabBar(this);
    // 从其他页面切回首页时同步最新词书选择。
    this.featureNavigating = false;
    const level = getSelectedLevel();
    if (this.data.featureDisabled || level !== this.data.selectedLevel) {
      this.setData({ featureDisabled: false });
      this.applySelectedLevel(level);
      this.loadHomeSummary(level);
    }
  },

  applySelectedLevel(level) {
    const selectedLevel = setSelectedLevel(level);
    this.setData({
      selectedLevel,
      selectedLevelLabel: selectedLevel === 6 ? "六级" : "四级",
      featureList: this.buildFeatureList(selectedLevel),
    });
  },

  chooseBook(event) {
    const level = Number(event.currentTarget.dataset.level);
    if (![4, 6].includes(level) || level === this.data.selectedLevel) {
      return;
    }
    this.applySelectedLevel(level);
    this.loadHomeSummary(level);
    wx.showToast({
      title: `已切换${level === 6 ? "六级" : "四级"}词书`,
      icon: "success",
      duration: 1200,
    });
  },

  async loadHomeSummary(level = this.data.selectedLevel) {
    this.homeRequestId = (this.homeRequestId || 0) + 1;
    const requestId = this.homeRequestId;
    this.setData({
      homeLoading: true,
      homeError: "",
      heroWord: null,
      newCount: null,
      learnedCount: null,
      wrongCount: null,
    });
    try {
      const [unlearned, learned] = await Promise.all([
        callApi("getWordList", {
          level,
          filter: "unlearned",
          page: 1,
          pageSize: 1,
        }, {
          fallback: "首页单词加载失败",
          requireLogin: false,
        }),
        callApi("getWordList", {
          level,
          filter: "learned",
          page: 1,
          pageSize: 1,
        }, {
          fallback: "学习进度加载失败",
          requireLogin: false,
        }),
      ]);
      let wrongCount = null;
      if (isLoggedIn()) {
        const wrongWords = await callApi("getWrongWords", {
          level: String(level),
          mastered: "false",
          page: 1,
          pageSize: 1,
        }, {
          fallback: "错词数量加载失败",
          requireLogin: true,
        });
        wrongCount = Number(wrongWords.total || 0);
      }
      if (
        requestId !== this.homeRequestId ||
        Number(level) !== Number(this.data.selectedLevel)
      ) {
        return;
      }
      const totalUnlearned = Number(unlearned.total || 0);
      this.setData({
        heroWord: (unlearned.list || [])[0] || null,
        newCount: Math.min(totalUnlearned, 20),
        learnedCount: Number(learned.total || 0),
        wrongCount,
      });
    } catch (error) {
      if (requestId !== this.homeRequestId) {
        return;
      }
      this.setData({ homeError: "学习数据加载失败，请重试" });
      console.error("首页学习摘要加载失败：", error);
    } finally {
      if (requestId === this.homeRequestId) {
        this.setData({ homeLoading: false });
      }
    }
  },

  retryHomeSummary() {
    this.loadHomeSummary(this.data.selectedLevel);
  },

  onAiPreview() {
    wx.showToast({
      title: "AI 学习将按功能逐项开放",
      icon: "none",
      duration: 1800,
    });
  },

  onTabItemTap(event) {
    const currentTab = Number(event.index);
    const tabInfo = {
      0: {
        pageTitle: "贝贝单词",
        pageSubtitle: "把每天的积累，变成看得见的进步。",
      },
      1: {
        pageTitle: "词库",
        pageSubtitle: "选择适合你的词汇学习内容。",
      },
      2: {
        pageTitle: "错题本",
        pageSubtitle: "复习和巩固容易出错的词汇。",
      },
    };

    this.setData({
      currentTab,
      ...(tabInfo[currentTab] || tabInfo[0]),
    });
  },

  safeNavigate(type, url) {
    if (this.featureNavigating) {
      return;
    }
    this.featureNavigating = true;
    this.setData({ featureDisabled: true });
    const unlock = () => {
      setTimeout(() => {
        this.featureNavigating = false;
        this.setData({ featureDisabled: false });
      }, 800);
    };
    setTimeout(() => {
      const options = {
        url,
        fail: () => {
          wx.showToast({
            title: "页面打开失败，请重新编译",
            icon: "none",
            duration: 2000,
          });
          unlock();
        },
      };
      if (type === "switchTab") {
        wx.switchTab(options);
      } else {
        wx.navigateTo(options);
      }
    }, 60);
  },

  onFeatureTap(event) {
    if (this.data.featureDisabled || this.featureNavigating) {
      return;
    }
    const { title, id } = event.currentTarget.dataset;
    if (id === "book") {
      setSelectedLevel(this.data.selectedLevel);
      this.safeNavigate("navigateTo", "/pages/wordbook/wordbook");
      return;
    }
    if (id === "learn" || title === "记单词") {
      this.safeNavigate(
        "navigateTo",
        `/pages/word-card/word-card?mode=learn&level=${this.data.selectedLevel}`
      );
      return;
    }
    if (id === "new-words" || title === "生词本") {
      this.safeNavigate("navigateTo", "/pages/collected/collected");
      return;
    }
    if (id === "challenge" || title === "闯关模式") {
      this.safeNavigate(
        "navigateTo",
        `/pages/challenge/challenge?level=${this.data.selectedLevel}`
      );
      return;
    }
    if (id === "mistakes" || title === "错题本") {
      this.safeNavigate("navigateTo", "/pages/wrong-book/wrong-book");
      return;
    }
    if (id === "pk" || title === "好友 PK") {
      if (!requireLogin("好友 PK 需要登录后使用，是否前往我的页面登录？")) {
        return;
      }
      this.safeNavigate(
        "navigateTo",
        `/pages/pk-room/pk-room?level=${this.data.selectedLevel}`
      );
      return;
    }
    if (id === "ai") {
      this.safeNavigate("switchTab", "/pages/ai/ai");
      return;
    }
    wx.showToast({
      title: `${title}开发中`,
      icon: "none",
      duration: 1800,
    });
  },
});
