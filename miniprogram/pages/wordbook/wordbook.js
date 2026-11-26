// pages/wordbook/wordbook.js
// 四级、六级词库列表，收藏和学习状态由HTTP接口返回。
const { callApi } = require("../../utils/api");
const { syncTabBar } = require('../../utils/tabbar');
const {
  getSelectedLevel,
  setSelectedLevel,
  normalizeLevel,
} = require("../../utils/learning");

Page({
  data: {
    level: 4,
    keyword: "",
    letter: "",
    filter: "all",
    letterOptions: [
      { value: "", label: "全部" },
      ...("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((item) => ({
        value: item,
        label: item,
      }))),
    ],
    list: [],
    page: 1,
    pageSize: 30,
    total: 0,
    loading: false,
    hasMore: false,
    filters: [
      { value: "all", label: "全部" },
      { value: "collected", label: "收藏" },
      { value: "learned", label: "已学" },
      { value: "unlearned", label: "未学" },
    ],
  },

  onLoad(options = {}) {
    this.alive = true;
    const level = options.level
      ? normalizeLevel(options.level)
      : getSelectedLevel();
    setSelectedLevel(level);
    this.setData({ level });
  },

  onShow() {
    this.alive = true;
    syncTabBar(this);
    const cachedLevel = getSelectedLevel();
    if (cachedLevel !== this.data.level) {
      this.setData(
        {
          level: cachedLevel,
          letter: "",
          keyword: "",
          filter: "all",
        },
        () => this.deferLoadWords(true)
      );
      return;
    }
    // tab 切换时先让页面出现；已有数据时不重复请求，减少底部导航卡顿。
    if (!this.hasLoaded || this.lastOpenid !== wx.getStorageSync('beibeiOpenid') || Date.now() - (this.lastLoadAt || 0) > 30000) {
      this.deferLoadWords(true);
    }
  },

  onHide() {
    clearTimeout(this.loadTimer);
  },
  onUnload() {
    this.alive = false;
    this.requestVersion = (this.requestVersion || 0) + 1;
    clearTimeout(this.loadTimer);
  },

  deferLoadWords(reset = false) {
    clearTimeout(this.loadTimer);
    this.loadTimer = setTimeout(() => this.loadWords(reset), 80);
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadWords(false);
    }
  },

  chooseLevel(event) {
    const level = normalizeLevel(event.currentTarget.dataset.level);
    setSelectedLevel(level);
    this.setData(
      {
        level,
        letter: "",
      },
      () => this.loadWords(true)
    );
  },

  chooseLetter(event) {
    const letter = String(event.currentTarget.dataset.letter || "");
    this.setData(
      {
        letter: this.data.letter === letter ? "" : letter,
      },
      () => this.loadWords(true)
    );
  },

  chooseFilter(event) {
    this.setData(
      {
        filter: event.currentTarget.dataset.filter,
      },
      () => this.loadWords(true)
    );
  },

  onKeywordInput(event) {
    const keyword = event.detail.value;
    this.setData({
      keyword,
    });
  },

  search() {
    const keyword = String(this.data.keyword || "").trim();
    this.setData(
      {
        // 搜索是当前词书内的全局搜索，不再叠加 A-Z 字母筛选。
        letter: keyword ? "" : this.data.letter,
      },
      () => this.loadWords(true)
    );
  },

  async loadWords(reset = false) {
    if (!reset && (this.loadingRequest || !this.data.hasMore)) return;
    if (reset) {
      clearTimeout(this.loadTimer);
      this.requestVersion = (this.requestVersion || 0) + 1;
      // 新筛选允许立即开始，不等待上一字母的请求。
      this.loadingRequest = false;
      this.activeQuery = {
        level: this.data.level, letter: this.data.keyword.trim() ? '' : this.data.letter,
        keyword: this.data.keyword.trim(), filter: this.data.filter,
      };
      this.setData({ list: [], page: 1, total: 0, hasMore: false });
    }
    const version = this.requestVersion || 0;
    const page = reset ? 1 : this.data.page + 1;
    this.loadingRequest = true;
    this.setData({ loading: true });
    try {
      const result = await callApi("getWordList", {
        ...this.activeQuery,
        page,
        pageSize: 30,
      }, {
        fallback: "词库加载失败",
        requireLogin: false,
      });
      if (!this.alive || version !== this.requestVersion) return;
      const existing = new Set(this.data.list.map(w => String(w.id)));
      const incoming = (result.list || []).filter(w => !existing.has(String(w.id)));
      const length = this.data.list.length;
      const patch = {
        page: result.page || page,
        total: result.total || 0,
        hasMore: (result.list || []).length > 0 && length + incoming.length < (result.total || 0),
      };
      // 追加时仅跨逻辑/视图桥传新30条，不反复传整个历史列表。
      if (reset) patch.list = incoming;
      else incoming.forEach((word, index) => { patch[`list[${length + index}]`] = word; });
      this.setData(patch);
      this.hasLoaded = true;
      this.lastOpenid = wx.getStorageSync('beibeiOpenid');
      this.lastLoadAt = Date.now();
    } catch (error) {
      if (!this.alive || version !== this.requestVersion) return;
      if (error.message !== "未登录") {
        console.error("加载词库失败：", error);
      }
    } finally {
      if (this.alive && version === this.requestVersion) {
        this.loadingRequest = false;
        this.setData({ loading: false });
      }
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
      level: this.data.level,
      page: this.data.page,
      pageSize: this.data.pageSize,
      total: this.data.total,
      hasMore: this.data.hasMore,
      query: this.activeQuery,
      source: "wordbook",
    });
    wx.navigateTo({
      url: `/pages/word-card/word-card?wordId=${word._id}&index=${index}`,
    });
  },

  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadWords(false);
    }
  },
});
