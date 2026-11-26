# 词库分页和自定义底部导航

## 词库

原api.js对字母筛选会拉取整本词库再本地过滤，登录后还会重复拉取全部生词；已改为单次服务端筛选分页。
请求示例：`GET /api/words?level=4&letter=A&page=1&pageSize=30`。
服务端先按字母、关键词、个人状态过滤再COUNT与LIMIT，返回精确total和当前页。
收藏状态仅查当前页单词，不返回完整词本。关键词搜索优先于字母。

词库固定每页30条；切换字母、级别、筛选或搜索清空列表、page重置为1。
触底追加，追加setData仅使用list[n]路径，不重复传已有数组。请求版本号防止快速点击时旧数据覆盖新字母。
列表wx:key为id；请求中防重复加载，失败释放锁，无更多数据时停止，卸载后不更新页面。
短时间切换tab不重复加载，超过30秒或登录账号变更时刷新。
已学仍是本设备状态，使用ID传给后端完成分页，不再下载整本词库；非常大量已学ID时应进一步迁移到服务端进度表。

## 自定义导航

`miniprogram/custom-tab-bar/index.{js,json,wxml,wxss}`为微信自定义tabBar组件，app.json已设置custom:true。
无需每个页面手动插入组件；保留原tab列表和图标，继续使用wx.switchTab。
文字32rpx（改index.wxss的.tab-label即可调节），选中绿色、加粗及高亮图标。
四个tab页面onShow同步真实路由，程序跳转、直达及失败回退不误高亮。
组件包含安全区padding，四个页面底部预留空间，非tab页面不显示导航。

## 验证

```text
node tools/test-wordbook-pagination.js
node tools/test-http-frontend.js
node tools/test-custom-tabbar.js
```

Java后端已重新构建，须重启backend/target/beibei-word-1.0.0.jar才会启用letter筛选和分页新逻辑。
微信开发者工具重新编译，检查Network每次词库请求pageSize=30，字母切换page=1，触底page递增。
实际渲染帧率、iOS/Android安全区与点击体验仍需在开发者工具及真机确认，mock测试不替代渲染测量。
