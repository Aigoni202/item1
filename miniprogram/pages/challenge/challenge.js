// pages/challenge/challenge.js
// 闯关答题页：每题 10 秒，英文选中文，不播放音频。
const { callApi, requireLogin } = require("../../utils/api");
const {
  getSelectedLevel,
  setSelectedLevel,
  normalizeLevel,
} = require("../../utils/learning");

Page({
  data: {
    level: 4,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    selectedMeaning: "",
    answerState: "",
    correctMeaning: "",
    explanation: "",
    correctLabel: "",
    gainScore: 0,
    score: 0,
    scorePercent: 0,
    countdown: 10,
    loading: true,
    submitting: false,
    startedAt: 0,
    questionStartedAt: 0,
    answers: [],
    totalCount: 0,
  },

  onLoad(options) {
    const level = options && options.level
      ? normalizeLevel(options.level)
      : getSelectedLevel();
    setSelectedLevel(level);
    this.setData({
      level,
    });
    this.loadChallenge();
  },

  normalizeQuestions(questions) {
    return (Array.isArray(questions) ? questions : []).map((question) => ({
      ...question,
      options: (Array.isArray(question.options) ? question.options : [])
        .map((item) => {
          // 兼容旧版HTTP接口返回的字符串选项，避免升级期间选项文字为空。
          if (typeof item === "string") {
            return {
              value: item,
              label: item,
            };
          }
          const value = String(item && (item.value || item.label) || "");
          return {
            value,
            label: String(item && (item.label || item.value) || value),
          };
        })
        .filter((item) => item.value),
    }));
  },

  onUnload() {
    this.stopTimer();
  },

  chooseLevel(event) {
    const level = normalizeLevel(event.currentTarget.dataset.level);
    if (level === this.data.level) {
      return;
    }

    if (this.data.questions.length && this.data.currentIndex > 0) {
      wx.showModal({
        title: "切换词书",
        content: "切换后当前闯关进度会清空，确定继续吗？",
        success: (result) => {
          if (result.confirm) {
            setSelectedLevel(level);
            this.setData({ level }, () => this.loadChallenge());
          }
        },
      });
      return;
    }

    setSelectedLevel(level);
    this.setData({ level }, () => this.loadChallenge());
  },

  async loadChallenge() {
    this.stopTimer();
    this.setData({ loading: true });
    try {
      const result = await callApi("getChallengeWords", {
        level: this.data.level,
      }, {
        fallback: "闯关题目加载失败",
        requireLogin: false,
      });
      const questions = this.normalizeQuestions(result.questions);
      if (!questions.length) {
        throw new Error("暂无单词，请管理员导入");
      }

      const now = Date.now();
      this.setData(
        {
          questions,
          totalCount: questions.length,
          currentIndex: 0,
          currentQuestion: questions[0],
          selectedMeaning: "",
          answerState: "",
          correctMeaning: "",
          correctLabel: "",
          gainScore: 0,
          score: 0,
          scorePercent: 0,
          explanation: "",
          countdown: 10,
          loading: false,
          submitting: false,
          startedAt: now,
          questionStartedAt: now,
          answers: [],
        },
        () => this.startTimer()
      );
    } catch (error) {
      console.error("获取闯关题目失败：", error);
      this.setData({ loading: false });
      wx.showModal({
        title: "无法开始闯关",
        content: error.errMsg || error.message || "暂无单词，请管理员导入。",
        showCancel: false,
      });
    }
  },

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.data.answerState) {
        return;
      }

      const elapsed = Date.now() - this.data.questionStartedAt;
      const countdown = Math.max(0, 10 - Math.ceil(elapsed / 1000));
      this.setData({ countdown });
      if (countdown <= 0) {
        this.answerQuestion("", true);
      }
    }, 200);
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  answerQuestion(selectedMeaning, timedOut = false) {
    if (this.data.answerState || !this.data.currentQuestion) {
      return;
    }

    const question = this.data.currentQuestion;
    const elapsedMs = Math.min(10000, Date.now() - this.data.questionStartedAt);
    // 单人练习使用本地题目判分，不作为服务端竞赛成绩。
    const correct = selectedMeaning === question.correctMeaning;
    const answerState = timedOut ? "timeout" : correct ? "correct" : "wrong";
    const gainScore = correct
      ? Math.max(0, Math.round((10 - elapsedMs / 1000) * 10))
      : 0;
    const score = Math.min(2000, this.data.score + gainScore);
    const answers = this.data.answers.concat({
      wordId: question.id,
      selectedMeaning,
      elapsedMs,
      timedOut,
    });

    this.stopTimer();
    this.setData({
      selectedMeaning,
      answerState,
      correctMeaning: question.correctMeaning || "",
      correctLabel: question.correctLabel || question.correctMeaning || "",
      explanation: question.explanation || "",
      gainScore,
      score,
      scorePercent: Math.min(100, Math.round((score / 2000) * 100)),
      answers,
    });

    // 错误或超时保留 3 秒，让用户看清红色错误项和绿色正确项。
    const revealDuration = answerState === "correct" ? 350 : 3000;
    setTimeout(() => this.goNext(), revealDuration);
  },

  chooseOption(event) {
    this.answerQuestion(event.currentTarget.dataset.meaning, false);
  },

  async goNext() {
    const nextIndex = this.data.currentIndex + 1;
    if (nextIndex >= this.data.questions.length) {
      await this.submitResult();
      return;
    }

    const now = Date.now();
    this.setData(
      {
        currentIndex: nextIndex,
        currentQuestion: this.data.questions[nextIndex],
        selectedMeaning: "",
        answerState: "",
        correctMeaning: "",
        correctLabel: "",
        gainScore: 0,
        explanation: "",
        countdown: 10,
        questionStartedAt: now,
      },
      () => this.startTimer()
    );
  },

  async submitResult() {
    if (this.data.submitting) {
      return;
    }
    this.stopTimer();
    if (!requireLogin("保存闯关成绩和错题需要登录，是否前往我的页面登录？")) {
      this.setData({ submitting: false });
      return;
    }
    this.setData({ submitting: true });
    wx.showLoading({
      title: "提交结果",
      mask: true,
    });

    try {
      const result = await callApi("submitChallenge", {
        level: this.data.level,
        answers: this.data.answers,
      }, {
        fallback: "提交结果失败",
        requireLogin: true,
      });
      wx.setStorageSync("challengeResult", result);
      wx.redirectTo({
        url: "/pages/challenge-result/challenge-result",
      });
    } catch (error) {
      console.error("提交闯关结果失败：", error);
      wx.showModal({
        title: "提交失败",
        content: error.errMsg || "请稍后重试。",
        showCancel: false,
      });
    } finally {
      this.setData({ submitting: false });
      wx.hideLoading();
    }
  },
});
