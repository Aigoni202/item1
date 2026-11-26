// HTTP响应映射为现有模板字段，不改界面。
const session = require('./request');
const { request, isLoggedIn } = session;
const personal = (path, method = 'GET', data = {}) => request(path, method, data, { personal: true });
function stateKey(name) { return `${name}:${wx.getStorageSync('beibeiOpenid') || 'guest'}`; }
function states(name) { return wx.getStorageSync(stateKey(name)) || {}; }
function setState(name, id, value) {
  const data = states(name); data[id] = value; wx.setStorageSync(stateKey(name), data);
}
function normalize(w) {
  return { ...w, _id: String(w.id), learned: Boolean(states('learned')[w.id]),
    mastered: Boolean(states('mastered')[w.id]), collected: Boolean(w.collected) };
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
  const learned = states('learned');
  const learnedIds = ['learned', 'unlearned'].includes(data.filter)
    ? Object.keys(learned).filter(id => learned[id] && /^\d+$/.test(id)).join(',') : '';
  const result = await request('/api/words', 'GET', { ...data, learnedIds });
  return { ...result, list: result.list.map(normalize) };
}
async function dispatch(name, data = {}) {
  switch (name) {
    case 'getWordList': return wordList(data);
    case 'getWordDetail': {
      const word = normalize(await request(`/api/words/${data.wordId}`));
      if (isLoggedIn()) word.collected = (await all('/api/vocabulary', {}, true)).some(w => w._id === word._id);
      return { word };
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
      let list = await all('/api/wrong_words', {}, true);
      if (['4', '6'].includes(String(data.level))) list = list.filter(w => w.level === Number(data.level));
      if (['true', 'false'].includes(data.mastered)) list = list.filter(w => w.mastered === (data.mastered === 'true'));
      return paginate(list, data);
    }
    // 当前六张表没有这两种状态字段，只存本设备，不伪称服务端同步。
    case 'markWordLearned': setState('learned', data.wordId, data.learned); return { learned: data.learned };
    case 'markWrongMastered': setState('mastered', data.wordId, data.mastered); return { mastered: data.mastered };
    case 'getUserStats': {
      const [v, w, a, b] = await Promise.all([personal('/api/vocabulary'), personal('/api/wrong_words'),
        request('/api/words', 'GET', { level: 4, pageSize: 1 }), request('/api/words', 'GET', { level: 6, pageSize: 1 })]);
      const learned = Object.values(states('learned')).filter(Boolean).length;
      return { stats: { learned, unlearned: Math.max(0, a.total + b.total - learned), collected: v.total, wrong: w.total } };
    }
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
