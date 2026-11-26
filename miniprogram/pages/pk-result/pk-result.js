// 好友 PK 结果页：展示双方成绩、胜负和双方本次错题。
Page({
  data: {
    result: {
      roomCode: "",
      level: 4,
      ownerScore: 0,
      guestScore: 0,
      winner: "draw",
      ownerWrongWords: [],
      guestWrongWords: [],
    },
    role: "",
    myScore: 0,
    opponentScore: 0,
    outcome: "平局",
    myWrongWords: [],
    questionResults: [],
  },

  onLoad() {
    const result = wx.getStorageSync("pkResult") || {};
    const role = wx.getStorageSync("pkRole") || "";
    const myScore = role === "guest"
      ? Number(result.guestScore || 0)
      : Number(result.ownerScore || 0);
    const opponentScore = role === "guest"
      ? Number(result.ownerScore || 0)
      : Number(result.guestScore || 0);
    const outcome = result.winner === "draw"
      ? "平局"
      : result.winner === role
        ? "你赢了"
        : "你输了";
    this.setData({
      result,
      role,
      myScore,
      opponentScore,
      outcome,
      myWrongWords: role === "guest"
        ? result.guestWrongWords || []
        : result.ownerWrongWords || [],
      questionResults: this.buildQuestionResults(result, role),
    });
  },

  buildQuestionResults(result, role) {
    const list = Array.isArray(result.questionResults)
      ? result.questionResults
      : [];
    return list.map((item) => ({
      ...item,
      myCorrect: role === "guest"
        ? Boolean(item.guestCorrect)
        : Boolean(item.ownerCorrect),
      opponentCorrect: role === "guest"
        ? Boolean(item.ownerCorrect)
        : Boolean(item.guestCorrect),
    }));
  },

  goHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },

  playAgain() {
    wx.redirectTo({
      url: "/pages/pk-room/pk-room",
    });
  },
});
