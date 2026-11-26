// pages/word-card/word-card.js
// 单词卡片支持手势左右切换，不调用任何发音接口。
const { callApi, requireLogin } = require("../../utils/api");
const {
  getSelectedLevel,
  setSelectedLevel,
  normalizeLevel,
} = require("../../utils/learning");

Page({
  data: {
    list: [],
    index: 0,
    level: 4,
    page: 1,
    pageSize: 50,
    total: 0,
    hasMore: false,
    loadingMore: false,
    mode: "list",
    word: null,
    startX: 0,
    loading: true,
    source: "wordbook",
  },

  onLoad(options) {
    this.pageAlive = true;
    const context = wx.getStorageSync("wordCardContext") || {};
    const mode = String(options.mode || "");
    const level = normalizeLevel(options.level || context.level || getSelectedLevel());
    setSelectedLevel(level);
    if (mode === "learn") {
      this.setData({
        mode: "learn",
        level: [4, 6].includes(level) ? level : 4,
        source: "learn",
      });
      this.loadLearningWords();
      return;
    }

    const index = Number(options.index || context.index || 0);
    const initialWord =
      (context.list && context.list[index]) ||
      null;
    this.setData({
      list: context.list || [],
      index,
      level: [4, 6].includes(level) ? level : 4,
      page: Number(context.page || 1),
      pageSize: Number(context.pageSize || 50),
      total: Number(context.total || (context.list || []).length),
      hasMore: Boolean(
        context.hasMore ||
        (context.list || []).length < Number(context.total || 0)
      ),
      query: context.query || {
        level,
        letter: "",
        keyword: "",
        filter: "all",
      },
      word: initialWord,
      // 列表项已经有单词内容时，先立即显示卡片，不等待详情接口。
      loading: !initialWord,
      source: context.source || "wordbook",
    });
    this.loadWord(options.wordId || (context.list && context.list[index] && context.list[index]._id));
  },

  onUnload() {
    this.pageAlive = false;
  },

  async loadLearningWords() {
    if (!this.pageAlive) {
      return;
    }
    this.setData({ loading: true });
    try {
      let result = await callApi("getWordList", {
        level: this.data.level,
        filter: "unlearned",
        page: 1,
        pageSize: 50,
      }, {
        fallback: "学习单词加载失败",
        requireLogin: false,
      });
      let list = result.list || [];
      let query = {
        level: this.data.level,
        letter: "",
        keyword: "",
        filter: "unlearned",
      };
      if (!list.length) {
        result = await callApi("getWordList", {
          level: this.data.level,
          filter: "all",
          page: 1,
          pageSize: 50,
        }, {
          fallback: "学习单词加载失败",
          requireLogin: false,
        });
        list = result.list || [];
        query.filter = "all";
      }
      if (!this.pageAlive) {
        return;
      }
      this.setData({
        list,
        index: 0,
        page: 1,
        pageSize: 50,
        total: Number(result.total || list.length),
        hasMore: list.length < Number(result.total || list.length),
        query,
        // 先显示列表返回的完整单词数据，详情接口在后台补充状态。
        word: list[0] || null,
        loading: !list.length,
      });
      if (list.length) {
        this.loadWord(list[0]._id);
      } else {
        this.setData({ word: null });
      }
    } catch (error) {
      if (error.message !== "未登录") {
        console.error("加载学习单词失败：", error);
      }
    } finally {
      if (this.pageAlive) {
        this.setData({ loading: false });
      }
    }
  },

  async loadWord(wordId) {
    if (!wordId) {
      return;
    }

    this.wordRequestId = (this.wordRequestId || 0) + 1;
    const requestId = this.wordRequestId;
    if (!this.pageAlive) {
      return;
    }
    if (!this.data.word || this.data.word._id !== wordId) {
      this.setData({ loading: true });
    }
    try {
      const result = await callApi("getWordDetail", { wordId }, {
        fallback: "单词加载失败",
        requireLogin: false,
      });
      // 防止旧请求晚返回，把刚切到的新单词覆盖掉，造成“跳两个单词”的错觉。
      if (
        requestId !== this.wordRequestId ||
        !this.pageAlive ||
        (this.data.word && this.data.word._id !== wordId)
      ) {
        return;
      }
      this.setData({ word: result.word, loading: false });
    } catch (error) {
      if (error.message !== "未登录") {
        console.error("加载单词详情失败：", error);
      }
    } finally {
      // 旧请求结束时不能影响当前单词的加载状态。
      if (
        requestId === this.wordRequestId &&
        this.pageAlive &&
        (!this.data.word || this.data.word._id === wordId)
      ) {
        this.setData({ loading: false });
      }
    }
  },

  touchStart(event) {
    this.startX = event.touches[0].clientX;
  },

  touchEnd(event) {
    const endX = event.changedTouches[0].clientX;
    const distance = endX - this.startX;
    if (Math.abs(distance) < 80) {
      return;
    }
    // 从右往左滑动进入下一个单词，从左往右滑动返回上一个。
    if (distance < 0) {
      this.nextWord();
    } else {
      this.previousWord();
    }
  },

  updateContext(index) {
    const word = this.data.list[index];
    if (!word) {
      return;
    }
    // 先展示列表中的单词，详情接口只负责补充收藏和已学状态。
    this.setData({
      index,
      word,
      loading: false,
    });
    this.loadWord(word._id);
  },

  async loadMoreWords() {
    if (this.data.loadingMore || !this.data.hasMore || !this.data.query) {
      return false;
    }

    this.setData({ loadingMore: true });
    try {
      const result = await callApi("getWordList", {
        ...this.data.query,
        page: this.data.page + 1,
        pageSize: this.data.pageSize,
      }, {
        fallback: "更多单词加载失败",
        requireLogin: false,
      });
      const incoming = result.list || [];
      const list = this.data.list.concat(incoming);
      const total = Number(result.total || this.data.total);
      await new Promise((resolve) => {
        this.setData({
          list,
          page: result.page || this.data.page + 1,
          total,
          hasMore: incoming.length > 0 && list.length < total,
        }, resolve);
      });
      // 直接返回新增数量，避免 setData 尚未完成时读取到旧 list 长度。
      return incoming.length;
    } catch (error) {
      console.error("加载更多单词失败：", error);
      return false;
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  previousWord() {
    const now = Date.now();
    if (
      this.navigatingWord ||
      now - (this.lastNavigationAt || 0) < 520
    ) {
      return;
    }
    this.navigatingWord = true;
    this.lastNavigationAt = now;
    if (this.data.index <= 0) {
      wx.showToast({
        title: "已经是第一个",
        icon: "none",
      });
      this.navigatingWord = false;
      return;
    }
    this.updateContext(this.data.index - 1);
    setTimeout(() => {
      this.navigatingWord = false;
    }, 520);
  },

  async nextWord() {
    const now = Date.now();
    if (
      this.navigatingWord ||
      now - (this.lastNavigationAt || 0) < 520
    ) {
      return;
    }
    this.navigatingWord = true;
    this.lastNavigationAt = now;
    try {
      if (this.data.index < this.data.list.length - 1) {
        this.updateContext(this.data.index + 1);
        return;
      }

      if (this.data.hasMore) {
        const addedCount = await this.loadMoreWords();
        if (addedCount > 0) {
          this.updateContext(this.data.index + 1);
          return;
        }
      }

      if (
        this.data.index >= this.data.list.length - 1 &&
        !this.data.hasMore
      ) {
        wx.showToast({
          title: "已经是最后一个",
          icon: "none",
        });
      }
    } finally {
      setTimeout(() => {
        this.navigatingWord = false;
      }, 520);
    }
  },

  async toggleCollect() {
    if (!this.data.word) {
      return;
    }
    if (!requireLogin("收藏单词需要登录，是否前往我的页面登录？")) {
      return;
    }
    try {
      const result = await callApi("toggleCollect", {
        wordId: this.data.word._id,
        level: this.data.word.level,
      }, {
        fallback: "收藏操作失败",
        requireLogin: true,
      });
      const collected = Boolean(result && result.collected);
      this.setData({
        "word.collected": collected,
      });
      wx.showToast({
        title: collected ? "已加入生词本" : "已移出生词本",
        icon: "success",
      });
    } catch (error) {
      if (error.message !== "未登录") {
        console.error("收藏操作失败：", error);
      }
    }
  },

  async toggleLearned() {
    if (!this.data.word) {
      return;
    }
    if (!requireLogin("标记学习状态需要登录，是否前往我的页面登录？")) {
      return;
    }
    const learned = !Boolean(this.data.word.learned);
    try {
      const result = await callApi("markWordLearned", {
        wordId: this.data.word._id,
        level: this.data.word.level,
        learned,
      }, {
        fallback: "学习状态更新失败",
        requireLogin: true,
      });
      this.setData({
        "word.learned": Boolean(result && result.learned),
      });
      if (learned) {
        const { personal } = require('../../utils/api');
        try {
          await personal('/api/checkins', 'POST');
        } catch (error) {
          console.error("打卡失败：", error);
        }
      }
      wx.showToast({
        title: learned ? "已标记为已学" : "已标记为未学",
        icon: "success",
      });
    } catch (error) {
      if (error.message !== "未登录") {
        console.error("学习状态更新失败：", error);
      }
    }
  },
});

