// HTTP响应映射为现有模板字段，不改界面。
const session = require('./request');
const { request, isLoggedIn } = session;
const personal = (path, method = 'GET', data = {}) => request(path, method, data, { personal: true });
function stateKey(name) { return `${name}:${wx.getStorageSync('beibeiOpenid') || 'guest'}`; }
function normalize(w) {
  return { ...w, _id: String(w.id), learned: Boolean(w.learned),
    mastered: Boolean(w.mastered), collected: Boolean(w.collected) };
}
async function all(path, data = {}, privateData = false) {
  let list = [], page = 1, result;
  do {
    result = await request(path, 'GET', { ...data, page, pageSize: 100 }, { personal: privateData });
    if (!Array.isArray(result.list)) throw new Error('列表接口格式错误');
    list = list.concat(result.list);
    if (!result.list.length) break;
    page++;
  } while (list.length < result.total);
  return list.map(normalize);
}
function paginate(list, data) {
  const page = Number(data.page || 1), pageSize = Number(data.pageSize || 20);
  return { list: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize };
}
async function wordList(data) {
  const result = await request('/api/words', 'GET', data);
  return { ...result, list: result.list.map(normalize) };
}
async function dispatch(name, data = {}) {
  switch (name) {
    case 'getWordList': return wordList(data);
    case 'getWordDetail': {
      return { word: normalize(await request(`/api/words/${data.wordId}`)) };
    }
    case 'toggleCollect': {
      const saved = await all('/api/vocabulary', {}, true);
      const collected = !saved.some(w => w._id === String(data.wordId));
      await personal(collected ? '/api/vocabulary' : `/api/vocabulary/${data.wordId}`, collected ? 'POST' : 'DELETE', collected ? { wordId: Number(data.wordId) } : {});
      return { collected };
    }
    case 'removeCollectedWord': return personal(`/api/vocabulary/${data.wordId}`, 'DELETE');
    case 'removeWrongWord': return personal(`/api/wrong_words/${data.wordId}`, 'DELETE');
    case 'getCollectedWords': {
      let list = await all('/api/vocabulary', {}, true);
      if (data.keyword) list = list.filter(w => w.word.toLowerCase().includes(data.keyword.toLowerCase()));
      if (data.sort === 'letter') list.sort((a, b) => a.word.localeCompare(b.word));
      return paginate(list.map(w => ({ ...w, collected: true })), data);
    }
    case 'getWrongWords': {
      const query = { page: data.page, pageSize: data.pageSize };
      if (['4', '6'].includes(String(data.level))) query.level = Number(data.level);
      if (['true', 'false'].includes(String(data.mastered))) query.mastered = String(data.mastered) === 'true';
      const result = await personal('/api/wrong_words', 'GET', query);
      return { ...result, list: result.list.map(normalize) };
    }
    case 'markWordLearned': {
      if (typeof data.learned !== 'boolean') throw new Error('学习状态无效');
      return personal(`/api/progress/${data.wordId}`, data.learned ? 'PUT' : 'DELETE');
    }
    case 'markWrongMastered': {
      if (typeof data.mastered !== 'boolean') throw new Error('掌握状态无效');
      return personal(`/api/wrong_words/${data.wordId}/mastered`, 'PUT', { mastered: data.mastered });
    }
    case 'getUserStats': return personal('/api/stats');
    case 'getChallengeWords': {
      const result = await request('/api/words', 'GET', { level: data.level, pageSize: 100 });
      const pool = result.list;
      if (new Set(pool.map(w => w.meaning)).size < 4) throw new Error('至少需要四种不同释义');
      const questions = pool.slice().sort(() => Math.random() - 0.5).slice(0, 20).map(w => {
        const alternatives = [...new Set(pool.map(x => x.meaning).filter(x => x !== w.meaning))];
        const options = alternatives.sort(() => Math.random() - 0.5).slice(0, 3).concat(w.meaning).sort(() => Math.random() - 0.5);
        return { ...w, correctMeaning: w.meaning, correctLabel: w.meaning, options };
      });
      wx.setStorageSync(stateKey('challengeQuestions'), questions);
      return { questions };
    }
    case 'submitChallenge': {
      const questions = wx.getStorageSync(stateKey('challengeQuestions')) || [];
      const wrongWords = [], correct = [];
      let score = 0;
      for (const answer of data.answers) {
        const q = questions.find(w => String(w.id) === String(answer.wordId));
        if (!q) throw new Error('题目上下文已失效，请重新开始');
        if (!answer.timedOut && answer.selectedMeaning === q.meaning) {
          correct.push(q); score += Math.max(0, Math.round((10 - answer.elapsedMs / 1000) * 10));
        } else wrongWords.push(q);
      }
      for (const w of wrongWords) await personal('/api/wrong_words', 'POST', { wordId: w.id });
      await personal('/api/checkins', 'POST');
      return { score, totalScore: questions.length * 100, correctCount: correct.length, wrongCount: wrongWords.length,
        wrongWords, duration: data.answers.reduce((s, a) => s + a.elapsedMs, 0) };
    }
    default: throw new Error('尚未支持的操作：' + name);
  }
}
async function callApi(name, data = {}, options = {}) {
  try {
    if (options.requireLogin && !isLoggedIn()) {
      if (options.showLogin !== false) session.requireLogin(options.loginMessage);
      throw new Error('未登录');
    }
    return await dispatch(name, data);
  } catch (error) {
    if (error.message !== '未登录') wx.showToast({ title: error.message || options.fallback || '请求失败', icon: 'none' });
    throw error;
  }
}
module.exports = { ...session, callApi, personal };

