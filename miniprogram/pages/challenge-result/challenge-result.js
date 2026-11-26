// pages/challenge-result/challenge-result.js
// 展示服务端计算的闯关结果和本次错题。
Page({
  data: {
    result: {
      score: 0,
      totalScore: 0,
      correctCount: 0,
      wrongCount: 0,
      duration: 0,
      wrongWords: [],
    },
  },

  onLoad() {
    const result = wx.getStorageSync("challengeResult") || {};
    this.setData({
      result: {
        ...this.data.result,
        ...result,
        durationSeconds: (Number(result.duration) / 1000).toFixed(1),
      },
    });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },

  playAgain() {
    wx.redirectTo({
      url: "/pages/challenge/challenge",
    });
  },
});
