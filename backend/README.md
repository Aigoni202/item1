# 贝贝单词 · Spring Boot 2.7.18 + MyBatis-Plus + MySQL

## 文件清单

```text
../word.sql                         独立完整建表脚本，六张表
pom.xml                             仅Web、MyBatis-Plus、MySQL驱动三个直接依赖
src/main/resources/application.yml 数据库及微信配置
src/main/java/com/beibei/
  BeibeiApplication.java            启动类，可选JSON导入
  entity/
    Word.java                      单词
    User.java                      用户
    Vocabulary.java                生词本
    WrongWord.java                 错题
    Checkin.java                   打卡
    PkRecord.java                  PK记录
  mapper/
    WordMapper.java
    UserMapper.java
    VocabularyMapper.java
    WrongWordMapper.java
    CheckinMapper.java
    PkRecordMapper.java
  service/
    WordService.java               微信登录、词库、个人记录、数据导入
    PkService.java                 创建、加入、答题、结算
  controller/
    ApiController.java             接口入口与请求体
    ApiErrors.java                 统一错误处理
examples/request.js                复制为小程序utils/api.js
examples/page.js                   页面事件、PK轮询示例
nginx.conf.example                 宝塔反向代理片段
```

不引入安全框架、Redis、ORM以外的中间件、Lombok、Swagger或WebSocket。代码使用Java 8语法，可用JDK 8/11/17，建议JDK 17。
按需求采用openid作为用户标识，没有签发或校验额外登录凭证。个人接口直接接受客户端openid，知道别人的openid即可冒用，因此仅用于课程演示/受控环境，不是安全身份认证。HTTPS不能消除该风险。
Spring Boot 2.7属于旧版本系列，此版本为满足课程技术栈，不应据此认定具备最新生产安全维护。

## 数据库与配置

Navicat或宝塔中使用有建库权限的账号执行根目录 `word.sql`，自动创建数据库 `beibei_word` 和六张表：
`words`、`users`、`vocabulary`、`wrong_words`、`checkins`、`pk_records`。MySQL 5.7+/8.0，不是SQLite。
脚本不删表和清空数据；`CREATE TABLE IF NOT EXISTS`不会修改已有表结构。
openid使用大小写敏感的utf8mb4_bin，避免不同openid混淆。若已执行上一版SQL且已有users表，先备份再执行：

```sql
ALTER TABLE users MODIFY openid VARCHAR(64) COLLATE utf8mb4_bin NOT NULL;
```

`application.yml`默认连接本机MySQL的 `root` 用户，密码按用户确认配置。填写自己小程序的 `wechat.appid`、`wechat.secret`。
AppSecret只留在服务器，不能放进前端。生产/共享部署使用专用数据库账号，不要公开含密码的配置文件。
可通过标准环境变量覆盖 `SPRING_DATASOURCE_URL`、`SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD`、`WECHAT_APPID`、`WECHAT_SECRET`。

## Maven构建与启动

需要JDK与Maven 3.6+：

```powershell
cd D:\WeChat_item_xiaochengxu\miniprogram-1\backend
mvn clean package
java -jar target/beibei-word-1.0.0.jar
```

默认端口8081。测试公开接口：`http://127.0.0.1:8081/api/words?level=4`。
开发时也可以 `mvn spring-boot:run`，不使用Python启动命令。

## 单词数据导入

可导入UTF-8 JSON文件或目录，不开设公网导入接口：

```powershell
# 当前目录已有四、六级分片
java -jar target/beibei-word-1.0.0.jar --import-words=../word-import
# 如果你提供word.json，改用下面这一条
java -jar target/beibei-word-1.0.0.jar --import-words=../word.json
```

导入后继续启动服务。避免同时启动多个导入进程；同词同级更新，保留已有主键，事务内异常整批回滚。
支持顶层数组、`{"words":[]}`或`{"data":[]}`。必填字段为 `word`、数字 `level`(4/6)、`meaning`；
可选 `phonetic`、`pos`、`explanation`。来源中的 `no`、`_id`忽略，使用MySQL自增 `id`，首字母自动生成。

```json
[{"word":"abandon","level":4,"phonetic":"/əˈbændən/","pos":"v.","meaning":"遗弃；离开","explanation":"v. 遗弃；离开"}]
```

## 接口清单

登录接收JSON code，后端通过微信 `jscode2session` 获取真实openid，创建或更新用户，返回 `{"openid":"...","user":{...}}`，不返回微信session_key。
其余个人接口统一使用查询参数 `?openid=...`，包括POST/PUT/DELETE。请求体是JSON，无请求体接口不需要传业务字段。

| 方法 | 路径 | 参数/作用 |
| --- | --- | --- |
| POST | `/api/login` | JSON：code，可选nickname、avatarUrl |
| GET | `/api/words` | level=4/6，page=1，pageSize=20，keyword可选 |
| GET | `/api/words/{id}` | 单词详情 |
| GET | `/api/books/vocabulary` | openid，page/pageSize，生词列表 |
| PUT | `/api/books/vocabulary/{id}` | openid，添加生词 |
| DELETE | `/api/books/vocabulary/{id}` | openid，移出生词 |
| GET | `/api/books/wrong_words` | openid，page/pageSize，错题列表 |
| PUT | `/api/books/wrong_words/{id}` | openid，标记错题 |
| DELETE | `/api/books/wrong_words/{id}` | openid，取消错题 |
| POST | `/api/checkins` | openid，北京时间当天打卡 |
| GET | `/api/checkins` | openid，page/pageSize，打卡记录 |
| POST | `/api/pk/rooms` | openid；JSON：level、count(1—20) |
| POST | `/api/pk/rooms/{code}/join` | openid，加入好友房间 |
| GET | `/api/pk/rooms/{code}` | openid，房间题目、分数、进度 |
| POST | `/api/pk/rooms/{code}/answers` | openid；JSON：index、choice，均从零开始 |
| GET | `/api/pk/records` | openid，page/pageSize，本人对战记录 |

列表返回 `list`、`total`、`page`、`pageSize`，page>=1，pageSize为1—100。
个人词本写入返回 `{"ok":true}`，重复添加/移除幂等；打卡每日仅一条。业务错误返回对应HTTP状态码及 `{"detail":"说明"}`。
JSON字段采用驼峰，例如 `avatarUrl`、`roomCode`、`ownerScore`，单词主键为 `id`，不是旧页面的 `_id`。

## 双人PK规则

房主创建 `waiting` → 好友加入 `playing` → 双方全部提交 `finished`。
双方各自从第0题依次提交，不需要逐题同步；一个房间只有两名玩家。正确一题一分，不接受客户端上报分数。
每题四个不同释义选项；题库至少有四种不同释义并满足题量。题目快照和双方答案存在PK表JSON列中。
结束前隐藏正确选项及对方答案，结束后题目增加 `correct`；公开词库可查，因此不具备竞赛级防作弊能力。
`winnerId`是获胜者的数据库用户ID，结束时为null表示平局；进行中为null不表示已平局。
创建后30分钟过期，访问时标为 `expired`，不自动选答案、不结算胜负。已完成记录不因过期而不可读。
事务与行锁处理并发加入和提交；同题同选项重试不重复计分，已提交答案不能改。
数据库唯一索引防房间码重复；极低概率碰撞会返回数据库错误，重新创建即可。
房间成员检查只是业务范围检查，在本openid直传方案中仍不能防止冒用。

## 小程序接入

将 `examples/request.js`复制为 `miniprogram/utils/api.js`，修改BASE_URL为自己的HTTPS域名。
`examples/page.js`演示登录、查词、收藏、打卡、创建PK、答题和轮询。好友加入后调用 `startPolling(room.roomCode)`。

```javascript
const api = require('../../utils/api');
// 放在async页面事件中，先点击登录
await api.login();
const result = await api.getWords(6, 1);
const id = result.list[0].id;
await api.addVocabulary(id);
await api.removeVocabulary(id);
await api.markWrong(id);
await api.cancelWrong(id);
await api.checkin();
const room = await api.createRoom(4, 10);
// 另一微信账号调用：await api.joinRoom(room.roomCode)
// 加入后双方顺序作答：await api.answer(room.roomCode, 0, 2)
```

请求示例仅使用wx.login和wx.request，不使用历史平台调用。前端只缓存openid及用户资料。
原小程序页面未自动覆盖，旧目录与历史代码保留；不代表原项目已全页面迁移。需替换全局初始化、登录、请求、PK监听和旧字段映射。
管理后台、已学进度、单人闯关不在本次六类数据需求内；旧个人数据不自动迁移。
真机的127.0.0.1指手机自身，正式版应配置HTTPS和request合法域名；不要把数据库密码或微信AppSecret写进小程序。

## 宝塔部署

1. 安装JDK 17、MySQL 5.7+/8.0、Nginx，执行word.sql，创建仅有本库读写权限的专用MySQL账号。
2. 本机构建jar，上传到服务器私有目录，如 `/www/wwwroot/beibei-api`；不要把源码或含密码配置暴露为静态网站文件。
3. 将application.yml复制到jar同目录并填写服务器数据库及微信配置，工作目录设为该目录。
4. 用宝塔Java项目或进程守护启动：`java -jar beibei-word-1.0.0.jar --server.address=127.0.0.1`。
   首次可附加 `--import-words=/私有目录/word.json`，导入完成后从启动命令去掉该参数。
5. 网站申请SSL，参考nginx.conf.example反向代理到127.0.0.1:8081，只开放必要80/443端口，不对公网开放MySQL或8081。
6. 配置微信request合法域名。此版本没有可靠身份认证，仅在受控课程环境使用，不能据此安全公开给任意用户。

## 验收与已知范围

需实际验证：导入两次无重复；4/6级分页正确；不存在openid返回404；重复添加生词不重复；重复打卡每天只有一条。
两个真实微信账号登录、创建/加入、各自答题后自动结算；非房间用户访问返回403；重复答案不加分。
本机若无JDK/Maven/MySQL/微信配置，只能检查结构与语法，不能宣称已编译或联调成功。
