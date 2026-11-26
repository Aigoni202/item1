# 呗呗单词

呗呗单词是一款基于微信小程序和微信云开发的英语词汇学习应用，面向四六级词库学习，包含词库浏览、单词卡片、生词本、闯关模式、错题本、好友 PK 和管理后台。

## 1. 技术栈

- 微信小程序原生开发
- 微信云开发
- 云数据库
- 云函数
- JavaScript
- WXML / WXSS
- GitHub 简约风 UI

当前主色为 `#0969DA`，页面使用白色、浅灰背景、灰色边框和简洁卡片布局。

## 2. 项目目录

```text
miniprogram-1/
├─ miniprogram/
│  ├─ app.js
│  ├─ app.json
│  ├─ app.wxss
│  ├─ sitemap.json
│  ├─ utils/
│  │  └─ cloud.js                 # 云函数调用、登录和错误提示工具
│  └─ pages/
│     ├─ login/                   # 微信一键登录
│     ├─ index/                   # 首页
│     ├─ profile/                 # 我的
│     ├─ wordbook/                # 四六级词库
│     ├─ word-card/               # 单词卡片
│     ├─ collected/               # 生词本
│     ├─ challenge/               # 闯关答题
│     ├─ challenge-result/        # 闯关结果
│     ├─ wrong-book/              # 错题本
│     ├─ pk-room/                 # 好友 PK 房间
│     ├─ pk-game/                 # 好友 PK 答题
│     ├─ pk-result/               # 好友 PK 结果
│     └─ admin/                   # 管理后台
│        ├─ index/                # 管理后台菜单首页
│        ├─ login/                # 管理员登录
│        ├─ words/                # 单词列表和批量导入
│        ├─ word-edit/            # 单词新增和编辑
│        ├─ users/                # 用户管理
│        ├─ stats/                # 数据统计
│        └─ admins/               # 管理员设置
├─ cloudfunctions/
│  ├─ login/
│  ├─ initAdmin/
│  ├─ adminLogin/
│  ├─ adminWordList/
│  ├─ adminWordSave/
│  ├─ adminWordDelete/
│  ├─ adminWordBatchImport/
│  ├─ adminUserList/
│  ├─ adminStats/
│  ├─ adminAddAdmin/
│  ├─ adminDisableAdmin/
│  ├─ getWordList/
│  ├─ getWordDetail/
│  ├─ toggleCollect/
│  ├─ markWordLearned/
│  ├─ getCollectedWords/
│  ├─ removeCollectedWord/
│  ├─ getChallengeWords/
│  ├─ submitChallenge/
│  ├─ getWrongWords/
│  ├─ removeWrongWord/
│  ├─ markWrongMastered/
│  ├─ createPkRoom/
│  ├─ joinPkRoom/
│  ├─ submitPkAnswer/
│  ├─ getPkRoom/
│  ├─ finishPk/
│  └─ closePkRoom/
└─ project.config.json
```

## 3. 云开发环境配置

### 3.1 创建云开发环境

1. 使用微信开发者工具打开项目根目录。
2. 确认 `project.config.json` 中的 `appid` 是当前小程序 AppID。
3. 点击开发者工具顶部的“云开发”。
4. 创建一个云开发环境。
5. 记录环境 ID。

当前代码中的环境 ID 为：

```text
cloud1-d9gfi3jpb27455cc1
```

如果你的云环境不同，需要修改 `miniprogram/app.js`：

```js
App({
  onLaunch() {
    this.globalData = {
      env: "你的云环境 ID",
      openid: "",
      userInfo: null,
      isAdmin: false,
    };

    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });
  },
});
```

注意：小程序端和云函数必须部署到同一个云环境。

### 3.2 基础库要求

- 建议使用微信开发者工具稳定版。
- 基础库建议不低于 `2.20.1`。
- 云开发基础库建议不低于 `2.2.3`。
- 如果出现 `FUNCTION_NOT_FOUND`，说明云函数尚未部署或部署到了其他环境。

## 4. 数据库集合

请在云开发控制台创建以下集合：

### users

```text
_id
openid
nickName
avatarUrl
isAdmin
createdAt
updatedAt
```

### words

```text
_id
word
phonetic
pos
meaning
explanation
level
letter
createdAt
updatedAt
```

其中 `level` 只能使用 `4` 或 `6`。

### user_word_progress

```text
_id
openid
wordId
level
learned
collected
updatedAt
```

### challenge_records

```text
_id
openid
level
score
totalScore
correctCount
wrongCount
duration
answers
createdAt
```

### wrong_words

```text
_id
openid
wordId
level
wrongCount
lastWrongAt
mastered
latestAnswer
updatedAt
```

### pk_rooms

```text
_id
roomCode
ownerOpenid
guestOpenid
level
status
questions
currentIndex
questionStartAt
ownerScore
guestScore
ownerAnswers
guestAnswers
winner
finishApplied
createdAt
updatedAt
```

`status` 常见值：

```text
waiting
playing
finished
closed
```

### admin_users

```text
_id
username
passwordHash
role
disabled
createdAt
updatedAt
```

`role` 使用：

```text
super
admin
```

## 5. 数据库索引

建议在云开发控制台创建以下索引：

| 集合 | 索引字段 | 用途 |
|---|---|---|
| `users` | `openid` 唯一索引 | 登录用户唯一记录 |
| `user_word_progress` | `openid`、`wordId` 联合唯一索引 | 保证一个用户对一个单词只有一条状态 |
| `wrong_words` | `openid`、`wordId` 联合唯一索引 | 保证一个用户对一个错词只有一条记录 |
| `pk_rooms` | `roomCode` 唯一索引 | 保证六位房间号不重复 |
| `admin_users` | `username` 唯一索引 | 保证管理员用户名不重复 |
| `words` | `level`、`word` | 提升词书查询和后台搜索速度 |

如果历史数据已经产生重复的 `user_word_progress` 或 `wrong_words`，当前收藏、学习和错题更新云函数会在访问时保留第一条并清理同一 `openid + wordId` 的重复记录。正式设置唯一索引前，建议先在控制台清理历史重复数据。

## 6. 数据库权限

推荐使用以下权限策略：

- `words`
  - 所有用户可读
  - 仅管理员相关云函数可写
- `pk_rooms`
  - 参与 PK 的用户可读
  - 仅 PK 云函数可写
- `users`
  - 普通客户端不可直接读写
  - 通过 `login` 和管理员云函数操作
- `user_word_progress`
  - 普通客户端不可直接读写
  - 通过云函数操作
- `challenge_records`
  - 普通客户端不可直接读写
  - 通过 `submitChallenge` 和管理员统计云函数操作
- `wrong_words`
  - 普通客户端不可直接读写
  - 通过错题、闯关和 PK 云函数操作
- `admin_users`
  - 所有客户端不可读写
  - 仅通过管理员云函数操作

云函数使用服务端权限访问数据库。不要把 `admin_users.passwordHash`、管理员 token 密钥或密码返回给小程序页面。

## 7. 云函数部署

在微信开发者工具中，右键 `cloudfunctions` 下每个云函数目录，选择：

```text
上传并部署：云端安装依赖
```

至少需要部署以下云函数：

```text
login
initAdmin
adminLogin
adminUserList
adminStats
adminAddAdmin
adminDisableAdmin
adminWordList
adminWordSave
adminWordDelete
adminWordBatchImport
getWordList
getWordDetail
toggleCollect
markWordLearned
getCollectedWords
removeCollectedWord
getChallengeWords
submitChallenge
getWrongWords
removeWrongWord
markWrongMastered
createPkRoom
joinPkRoom
submitPkAnswer
getPkRoom
finishPk
closePkRoom
```

批量导入云函数已经配置：

```text
cloudfunctions/adminWordBatchImport/config.json
timeout: 10
```

前端每批提交最多 90 条，避免一次请求和数据库操作过多导致超时。

## 8. 初始化超级管理员

首次部署 `initAdmin` 后，在云开发控制台调用云函数：

```json
{
  "openid": "当前超级管理员微信 openid"
}
```

请先使用该微信账号登录小程序，确保 `users` 集合中已经存在对应用户记录。

默认账号：

```text
用户名：admin
密码：123456
角色：super
```

如果配置了环境变量 `INIT_ADMIN_SECRET`，调用时必须传入：

```json
{
  "secret": "你的初始化密钥"
}
```

初始化成功后请立即通过管理员设置创建新的管理员，并及时修改或停用默认账号。生产环境不要长期使用 `123456`。

管理员登录 token 使用 HMAC 签名。生产环境建议配置以下云函数环境变量，并保持所有管理员云函数使用同一组值：

```text
ADMIN_PASSWORD_SALT=更换后的密码盐
ADMIN_TOKEN_SECRET=更换后的管理员 token 密钥
INIT_ADMIN_SECRET=初始化密钥
```

## 9. 批量导入词库

管理后台路径：

```text
我的 -> 管理后台 -> 单词批量导入
```

JSON 顶层必须是数组，示例：

```json
[
  {
    "no": 1,
    "word": "abandon",
    "phonetic": "/əˈbændən/",
    "pos": "v.",
    "meaning": "放弃；抛弃",
    "explanation": "v. 放弃；抛弃",
    "level": 4,
    "letter": "A"
  },
  {
    "no": 2,
    "word": "abandon",
    "phonetic": "/əˈbændən/",
    "pos": "v.",
    "meaning": "放弃；抛弃",
    "explanation": "v. 放弃；抛弃",
    "level": 6,
    "letter": "A"
  }
]
```

说明：

- `no` 是前端导入文件中的序号字段，数据库可以不保存。
- 四级和六级相同的 `word` 可以同时存在。
- 去重业务键是 `word + level`，不会因为四级已存在而阻止六级导入。
- 同一批次内部重复数据会跳过。
- 数据库中已经存在的 `word + level` 会跳过。
- `word`、`meaning`、`level` 是必填字段。
- `level` 只能为 `4` 或 `6`。
- 文件过大时请拆成多个 JSON 文件，前端会按每批 90 条依次上传。

## 10. 功能异常处理说明

### 词库和闯关

- 词库为空时提示：`暂无单词，请管理员导入`。
- 闯关从当前级别随机取最多 20 个单词。
- 当前级别不足 20 个时按实际数量开始。
- 单词释义不足时选项数量会减少，但保留正确答案。
- 没有题目时不会进入空白答题页。

### 生词本和错题本

- 收藏、学习状态使用 `openid + wordId` 作为唯一业务键。
- 重复收藏只保留一条状态记录。
- 重复错题更新最新错误答案、错误次数和时间。
- 生词本和错题本相互独立，不会互相写入。

### 好友 PK

- 创建房间使用六位房间号。
- 好友未加入时持续显示等待状态。
- 房主可点击“取消房间”。
- 用户主动离开房间或答题页时，客户端会调用 `closePkRoom`。
- 任一方断线或房间状态为 `closed` 时提示重新开始。
- 超时自动提交 0 分。
- 双方都提交当前题后，服务端才推进下一题。
- PK 错题在结算时写入错题本，并按用户和单词去重。

### 登录和云函数

- 需要登录的页面会检查本地 `beibeiUser.openid`。
- 未登录时提示 `请先登录` 并进入登录页。
- 云函数不存在时提示 `云函数未部署`。
- 云函数调用失败统一使用 toast 或 modal 提示。
- 管理后台还会校验管理员 token 是否过期、签名是否正确、账号是否被禁用。

## 11. 本地联调步骤

1. 打开微信开发者工具并导入项目。
2. 检查 `project.config.json` 的 AppID。
3. 检查 `miniprogram/app.js` 的云环境 ID。
4. 创建数据库集合和索引。
5. 部署全部云函数。
6. 调用 `initAdmin` 初始化超级管理员。
7. 使用普通微信登录。
8. 进入管理员登录页，使用管理员账号登录。
9. 导入至少一批四级和六级单词。
10. 测试词库搜索、字母筛选、收藏、已学状态和生词本。
11. 测试闯关：分别验证 1 个单词、少于 20 个单词和超过 20 个单词。
12. 测试错题写入、去重、移除和标记掌握。
13. 使用两个微信账号或两个开发者工具窗口测试好友 PK。
14. 测试 PK 等待、分享、加入、超时、退出、断线和结算。
15. 使用超级管理员测试管理员新增、禁用和启用。
16. 使用普通管理员确认只能管理单词和查看数据。

## 12. 最终检查清单

### 小程序配置

- [ ] `appid` 正确。
- [ ] `app.js` 云环境 ID 正确。
- [ ] `app.json` 页面路径没有重复。
- [ ] `app.json` tabBar 页面路径唯一。
- [ ] 所有页面均包含 `.js`、`.wxml`、`.wxss`、`.json`。
- [ ] 生产环境关闭不必要的调试日志。

### 云函数

- [ ] 所有云函数已经上传到同一个云环境。
- [ ] 云函数依赖已经选择“云端安装依赖”。
- [ ] `adminWordBatchImport` 超时为 10 秒。
- [ ] `closePkRoom` 已上传部署。
- [ ] 管理员云函数的 token 密钥一致。
- [ ] `initAdmin` 只执行一次或确认重复执行会跳过。

### 数据库

- [ ] 七个业务集合已经创建：`users`、`words`、`user_word_progress`、`challenge_records`、`wrong_words`、`pk_rooms`、`admin_users`。
- [ ] `users.openid` 唯一索引已创建。
- [ ] `user_word_progress.openid + wordId` 唯一索引已创建。
- [ ] `wrong_words.openid + wordId` 唯一索引已创建。
- [ ] `pk_rooms.roomCode` 唯一索引已创建。
- [ ] `admin_users.username` 唯一索引已创建。
- [ ] 数据库权限符合“客户端最小权限”原则。

### 关键流程

- [ ] 未登录访问词库时能进入登录页。
- [ ] 空词库提示管理员导入。
- [ ] 闯关不足 20 词时按实际题数运行。
- [ ] 选项不足 4 个时不会阻塞开始。
- [ ] 收藏重复时不会产生多条记录。
- [ ] 错题重复时会更新次数和最新答案。
- [ ] 管理员删除单词前有二次确认。
- [ ] PK 房间可以创建、分享、加入和取消。
- [ ] PK 超时得 0 分。
- [ ] PK 断线后能提示并重新开始。
- [ ] PK 结算只执行一次。
- [ ] 普通管理员无法添加或禁用管理员。
- [ ] 管理员 token 过期后会回到管理员登录页。

## 13. 发布前建议

- 生产环境更换 `ADMIN_PASSWORD_SALT`、`ADMIN_TOKEN_SECRET` 和 `INIT_ADMIN_SECRET`。
- 修改默认管理员密码，不要继续使用 `123456`。
- 清理测试用户、测试房间和测试闯关记录。
- 检查云数据库权限，避免把 `admin_users` 设置为客户端可读。
- 为 `words`、`pk_rooms` 和管理员云函数设置合理的日志与监控。
- 上线前使用真实微信账号完成一次全流程回归测试。

