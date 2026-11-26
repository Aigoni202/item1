# 前端 HTTP 改造说明（界面不变）

## 文件与调用

- `miniprogram/utils/request.js`：统一地址 `http://127.0.0.1:8081`；从 `beibeiOpenid`读取openid，自动编码并追加到URL查询参数，检查非2xx错误。没有额外登录凭证或鉴权头。
- `miniprogram/pages/login/login.js`：微信登录取得code → POST `/api/login` → 缓存openid和用户资料。全局入口 `app.js`只恢复缓存。
- `miniprogram/utils/api.js`：HTTP接口与旧模板字段之间的适配层，例如将整数 `id`映射为模板使用的字符串 `_id`。
- `pages/index/index.js`：保留原入口、四/六级切换，登录判断改用openid。
- `pages/wordbook/wordbook.js`、`pages/word-card/word-card.js`：GET单词、详情，POST添加生词、DELETE移出生词。
- `pages/collected/collected.js`：生词列表、搜索排序与移除。
- `pages/wrong-book/wrong-book.js`：错题列表、复习、移除。已掌握仅保存于当前设备。
- `pages/profile/profile.js`：读取新缓存、HTTP获取生词/错题数量，管理入口不再显示。
- `pages/pk-room/pk-room.js`：六位数字房间号、创建、加入、准备、开始、取消、分享与两秒轮询。
- `pages/pk-game/pk-game.js`：选择项转换成0—3索引，顺序答题，超时传-1；退出/隐藏停止轮询计时，双方完成跳转结果页。
- `pages/pk-result/pk-result.js`：沿用原界面和结果展示字段，双方对错由服务端返回。
- `pages/challenge/challenge.js`：保留单人练习，用词库生成题目，本地计算练习结果，将错题POST保存。不是服务端竞赛成绩。
- `pages/admin/*/*.js`：当前后端没有管理接口，明确停用并返回首页，不请求不存在的地址。

WXML、WXSS未修改。已有已学、掌握字段在六张表里没有对应列，因此只保存在当前设备，按openid隔离，不跨设备同步。
历史服务端目录及其依赖已删除，不再保留旧平台可执行逻辑。项目JSON未修改，开发者工具配置中遗留的旧目录声明可手工移除，不参与当前HTTP请求。
打卡使用现有“标记已学”按钮及完成闯关时POST `/api/checkins`，没有新增打卡按钮。
字母/个人状态筛选在完整结果集上做客户端过滤，小型课程词库适用；后续数据量变大应改为服务端筛选。

## 页面调用示例

```javascript
const { request } = require('../../utils/request');
// 以下放入async页面事件，统一try/catch并showToast提示失败
const words = await request('/api/words', 'GET', { level: 4, page: 1, pageSize: 20 });
const id = words.list[0].id;
await request('/api/vocabulary', 'POST', { wordId: id }, { personal: true });
await request(`/api/vocabulary/${id}`, 'DELETE', {}, { personal: true });
await request('/api/wrong_words', 'POST', { wordId: id }, { personal: true });
await request(`/api/wrong_words/${id}`, 'DELETE', {}, { personal: true });
await request('/api/checkins', 'POST', {}, { personal: true });
const room = await request('/api/pkroom', 'POST', { level: 4, count: 20 }, { personal: true });
// 好友账号：POST /api/pkroom/{roomCode}/join，再POST /prepare
// 房主账号：POST /api/pkroom/{roomCode}/start
await request(`/api/pkroom/${room.roomCode}/answers`, 'POST', { index: 0, choice: 2 }, { personal: true });
```

## SpringBoot兼容调整

原后端没有需求中的新路径，新增 `FrontendController.java`，兼容 `/api/vocabulary`、`/api/wrong_words`、`/api/pkroom`。
旧接口保留。`PkService.java`新增joined/ready/closed状态；加入不立即开赛，需要好友准备、房主开始；兼容现有界面六位数字输入。
错答/超时自动写入错题本，完成后返回双方每题对错。房间号仍存原CHAR(8)，六位值可用，不必改表。
重新构建并重启后端才能使用这些接口，旧示例文档中“加入即开赛”的规则已被本次准备/开始流程替代。

## 本地验证

1. 启动MySQL并导入word.sql、单词数据。application.yml填写正确微信AppID、AppSecret。
2. 重新打包Java后端：`mvn package`，然后 `java -jar target/beibei-word-1.0.0.jar`。
3. 开发者工具本地调试关闭request合法域名校验，确认本机8081可访问。真机的127.0.0.1不是电脑，需修改BASE_URL。
4. 登录后在缓存确认beibeiOpenid；查四/六级、添加移出生词、保存错题、标记已学并检查打卡。
5. 两账号分别创建/加入、准备/开始，各自依次答完，检查结果与错题本。
6. 运行mock契约测试：`node tools/test-http-frontend.js`；不代表真实微信和MySQL联调通过。

openid直传可被冒用，仅适合受控课程演示，不能当作安全认证。
