# 贝贝单词首页 UI 覆盖 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在原生微信小程序中复现已确认的白底文具风首页，同时保留全部旧业务入口和数据。

**Architecture:** 只替换首页视图、首页作用域样式与首页展示数据；继续复用现有学习级别缓存、请求封装和导航函数。本轮不调整 tabBar，不新增 AI 请求。

**Tech Stack:** 微信小程序原生 JavaScript、WXML、WXSS

**Spec:** `docs/superpowers/specs/2026-11-25-home-ui-redesign-design.md`

## Global Constraints

- 不删除或重构词库、生词本、错题本、闯关、PK 页面。
- 页面底色为 `#FFFFFF`，主色为 `#147D73`。
- 动画只使用 `transform` 和 `opacity`，反馈不超过 200ms。
- 不显示伪造的个人学习数据。
- 本轮保留当前 tabBar，导航改造待学习页和 AI 页视觉确认后实施。

## Review Focus

- 未登录：首页不请求个人错词接口，并明确显示登录提示。
- 空词库：主单词卡显示空状态，继续按钮不可进入空学习流程。
- 四六级切换：重新加载当前级别摘要，入口参数同步变化。
- 请求失败：保留可重试状态，不回填演示单词和数字。
- 旧入口：词库、生词本、错题本、好友 PK、闯关仍使用原路由。

---

### Task 1: 首页数据与旧入口保护

**Files:**
- Modify: `miniprogram/pages/index/index.js`
- Create: `tools/test-home-navigation.js`

**Interfaces:**
- Consumes: `getSelectedLevel()`、`setSelectedLevel()`、`callApi()`、`isLoggedIn()`、`requireLogin()`
- Produces: `loadHomeSummary()`、`retryHomeSummary()` 与首页展示字段

- [ ] 写导航检查，断言词库、学习、生词本、错题本、闯关、PK 仍进入原路由。
- [ ] 运行 `node tools/test-home-navigation.js`，确认旧实现不能满足新的首页字段与入口检查。
- [ ] 实现首页摘要：未学总数、已学总数、首个未学单词，以及登录后的错词总数。
- [ ] 四六级切换后重新加载摘要；失败时记录明确错误状态。
- [ ] 运行导航检查并确认通过。

### Task 2: 复现已批准首页

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/pages/index/index.json`

**Interfaces:**
- Consumes: Task 1 的首页展示字段与原 `onFeatureTap()`
- Produces: 白底文具风首页视图

- [ ] 用层叠单词卡、真实摘要、2×2 功能卡和 AI 条替换旧首页结构。
- [ ] 所有新样式限定在 `.home-page`，不修改旧页面全局样式。
- [ ] 添加只使用 `transform`、`opacity` 的出现与点击反馈。
- [ ] 将首页标题统一为“贝贝单词”。
- [ ] 运行 `node tools/test-home-navigation.js`、`node tools/test-custom-tabbar.js`。
- [ ] 检查 WXML 中不存在 emoji、旧占位页和旧三列功能网格。

