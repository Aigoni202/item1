# Learning Progress Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist logged-in users' learned-word state and wrong-word mastery in local MySQL while preserving the existing word bank and UI.

**Architecture:** Add a dedicated `user_word_progress` relation and mastery fields on `wrong_words`. Keep the existing frontend operation names, but route them to REST endpoints and make MySQL the sole source of truth; PK and challenge remain the only wrong-word producers.

**Tech Stack:** WeChat Mini Program (WXML/WXSS/JavaScript), Java 8, Spring Boot 2.7.18, MyBatis-Plus 3.5.5, MySQL 5.7+/8.0, Maven, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-25-learning-progress-design.md`

## Global Constraints

- Use local database `word_db`; backend stays on port `8081`.
- Do not migrate device-local learned/mastered cache; preserve the CET-4/CET-6 `words` data and existing server-side business data.
- Wrong words come only from PK and challenge wrong answers; ordinary word learning never inserts a wrong word.
- Mastered wrong words remain stored, while homepage/profile wrong counts include only unmastered rows.
- Do not change the approved UI, add AI, add SRS, or refactor unrelated code.
- MySQL write success is the source of truth; failed writes must not update visible frontend state.
- Current openid query authentication is local-development-only and must not be presented as production-ready.
- The workspace is not currently a Git repository, so this plan does not initialize Git or create commits without separate user authorization.

## Review Focus

- Repeating learned/unlearned writes must be idempotent and leave one or zero rows, covered in Task 2 service tests.
- A user must never read or mutate another user's progress, covered in Task 2 and Task 3 service tests.
- Re-answering a previously mastered word incorrectly must reset it to unmastered, covered in Task 3 mapper/service tests.
- Empty, malformed, or missing login identity must fail explicitly rather than return fake empty personal data, covered in Task 2 controller tests and Task 4 client tests.
- Pagination totals must remain correct for CET level plus learned/mastered filters, covered in Task 2 and Task 3 tests.

---

### Task 1: Safe MySQL Schema Migration

**Files:**
- Create: `backend/sql/2026-11-26-learning-progress.sql`
- Create: `backend/sql/verify-learning-progress.sql`
- Modify: `word.sql`

**Interfaces:**
- Consumes: existing `users(id)`, `words(id)`, and `wrong_words(user_id, word_id)`.
- Produces: `user_word_progress(user_id, word_id, learned_at, updated_at)` and `wrong_words.mastered`, `wrong_words.mastered_at`.

- [x] **Step 1: Capture the pre-migration database facts**

Run read-only SQL for `DATABASE()`, table names, `COUNT(*)` for `words`, `users`, `vocabulary`, `wrong_words`, `checkins`, and `pk_records`, and current `wrong_words` columns. Save the command output in the task log; do not change data.

- [x] **Step 2: Write the migration and verification scripts**

`2026-11-26-learning-progress.sql` creates `user_word_progress` with its composite primary key and cascading foreign keys, then adds `mastered TINYINT(1) NOT NULL DEFAULT 0` and nullable `mastered_at` to `wrong_words`. `verify-learning-progress.sql` asserts the expected columns/keys through `information_schema` and reports preserved row counts.

- [x] **Step 3: Update the clean-install schema**

Change `word.sql` to create/use `word_db`, add the final `user_word_progress` definition, and include the final wrong-word columns. Do not edit or regenerate the large historical SQL dumps in this task.

- [x] **Step 4: Execute the migration once against local MySQL**

Expected: migration exits successfully; `words` row count is unchanged; all six existing tables still exist; all existing wrong-word rows have `mastered=0`.

- [x] **Step 5: Run the verification script**

Expected: exactly one `user_word_progress` table, both new wrong-word columns, valid primary/foreign keys, and unchanged pre-existing table counts except for no intentional row mutations.

### Task 2: Backend Learned-Word Persistence

**Files:**
- Modify: `backend/pom.xml`
- Create: `backend/src/main/java/com/beibei/entity/UserWordProgress.java`
- Create: `backend/src/main/java/com/beibei/mapper/UserWordProgressMapper.java`
- Modify: `backend/src/main/java/com/beibei/service/WordService.java`
- Modify: `backend/src/main/java/com/beibei/controller/ApiController.java`
- Create: `backend/src/test/java/com/beibei/service/WordServiceProgressTest.java`
- Create: `backend/src/test/java/com/beibei/controller/ProgressControllerTest.java`

**Interfaces:**
- Consumes: schema from Task 1 and existing `WordService.userId(String)` identity lookup.
- Produces: `Map<String,Object> WordService.setLearned(String openid, Long wordId, boolean learned)`, `Map<String,Object> WordService.listWords(int level, int page, int size, String keyword, String letter, String filter, String openid)`, `Map<String,Object> WordService.detail(Long wordId, String openid)`, `PUT /api/progress/{wordId}`, and `DELETE /api/progress/{wordId}`.

- [x] **Step 1: Add the backend test dependency and failing service tests**

Add test-scoped `spring-boot-starter-test`. Tests assert add, duplicate add, delete, repeated delete, missing word, user isolation, CET-4/CET-6 learned filtering, unlearned filtering, and correct filtered totals.

- [x] **Step 2: Run the focused service test and verify RED**

Run: `mvn -f backend/pom.xml -Dtest=WordServiceProgressTest test`

Expected: FAIL because `UserWordProgressMapper` and `setLearned` do not exist and `listWords` still accepts device IDs.

- [x] **Step 3: Implement the progress entity, mapper, and service methods**

Mapper signatures: `void add(Long uid, Long wid)`, `void remove(Long uid, Long wid)`, `long count(Long uid, Integer level)`, `List<Long> wordIds(Long uid, List<Long> ids)`. `add` is an upsert; `remove` is idempotent. Replace the old eight-argument `listWords` with the seven-argument signature above, use `user_word_progress` for learned/unlearned filtering, and include a `learned` boolean in list/detail responses for logged-in users.

- [x] **Step 4: Run the focused service test and verify GREEN**

Run: `mvn -f backend/pom.xml -Dtest=WordServiceProgressTest test`

Expected: PASS with zero failures and zero errors.

- [x] **Step 5: Write failing controller contract tests**

Tests assert `PUT` and `DELETE` route arguments, missing/empty openid rejection, invalid word 404, and idempotent success responses containing the final `learned` boolean.

- [x] **Step 6: Run the controller test and verify RED**

Run: `mvn -f backend/pom.xml -Dtest=ProgressControllerTest test`

Expected: FAIL with unmapped `/api/progress/{wordId}` routes.

- [x] **Step 7: Add the two controller routes and update word endpoints**

`PUT` calls `setLearned(openid, wordId, true)`; `DELETE` calls it with `false`. Remove the `learnedIds` request parameter from `GET /api/words`; make `GET /api/words/{id}` accept optional openid so detail responses expose the same learned state.

- [x] **Step 8: Run all backend tests**

Run: `mvn -f backend/pom.xml test`

Expected: all tests PASS.

### Task 3: Backend Wrong-Word Mastery, PK/Challenge Sources, and Statistics

**Files:**
- Modify: `backend/src/main/java/com/beibei/entity/WrongWord.java`
- Modify: `backend/src/main/java/com/beibei/mapper/WrongWordMapper.java`
- Modify: `backend/src/main/java/com/beibei/service/WordService.java`
- Modify: `backend/src/main/java/com/beibei/service/PkService.java`
- Modify: `backend/src/main/java/com/beibei/controller/FrontendController.java`
- Modify: `backend/src/main/java/com/beibei/controller/ApiController.java`
- Create: `backend/src/test/java/com/beibei/service/WrongWordMasteryTest.java`
- Create: `backend/src/test/java/com/beibei/service/PkWrongWordTest.java`

**Interfaces:**
- Consumes: existing wrong-word insert/remove flow and progress counts from Task 2.
- Produces: DB-backed mastered filters, `Map<String,Object> WordService.setWrongMastered(String openid, Long wordId, boolean mastered)`, `Map<String,Object> WordService.stats(String openid)`, `PUT /api/wrong_words/{wordId}/mastered`, and `GET /api/stats`.

- [x] **Step 1: Write failing mastery and statistics tests**

Assert all/unmastered/mastered list filtering with correct totals, 404 for a non-member word, user isolation, mastered timestamp behavior, unmastered-only wrong count, and learned/total/collected stats from server tables.

- [x] **Step 2: Write the PK wrong-word regression test**

Assert an incorrect PK answer inserts the current user's word, a correct answer does not insert, duplicate wrong answers do not duplicate rows, and a new wrong answer resets an existing mastered row to unmastered.

- [x] **Step 3: Run both focused test classes and verify RED**

Run: `mvn -f backend/pom.xml -Dtest=WrongWordMasteryTest,PkWrongWordTest test`

Expected: FAIL because mastery fields, filters, reset behavior, and stats endpoint are missing.

- [x] **Step 4: Implement mapper and service behavior**

Change `WrongWordMapper.add(uid,wid)` upsert to reset `mastered=0, mastered_at=NULL`. Add `long count(Long uid, Integer level, Boolean mastered)`, `List<Map<String,Object>> list(Long uid, Integer level, Boolean mastered, int size, long offset)`, `boolean exists(Long uid, Long wid)`, and `void setMastered(Long uid, Long wid, boolean mastered)`. Return word fields plus `mastered` and `masteredAt`. Add `WordService.stats(openid)` using progress, vocabulary, and unmastered wrong counts.

- [x] **Step 5: Add mastery, filtered list, and stats endpoints**

Extend `GET /api/wrong_words` with optional `level` and `mastered`; add `PUT /api/wrong_words/{wordId}/mastered` with `MasteredBody { Boolean mastered; }` and reject `null`; add `GET /api/stats`. Keep PK using `wrong.add`; confirm challenge submission still adds wrong words through the same backend operation.

- [x] **Step 6: Run backend tests and verify GREEN**

Run: `mvn -f backend/pom.xml test`

Expected: all tests PASS.

### Task 4: Frontend API Uses MySQL as the Sole Source of Truth

**Files:**
- Modify: `miniprogram/utils/api.js`
- Modify: `miniprogram/utils/request.js` only if request parameter handling needs a narrowly scoped correction
- Create: `tests/api-progress.test.js`
- Modify: `miniprogram/pages/word-card/word-card.js` only if the existing success-after-response flow needs correction
- Modify: `miniprogram/pages/wrong-book/wrong-book.js` only if filtered response handling needs correction

**Interfaces:**
- Consumes: Task 2/3 REST endpoints.
- Produces: unchanged frontend operation names `markWordLearned`, `markWrongMastered`, `getWordList`, `getWrongWords`, and `getUserStats`, all backed by HTTP/MySQL.

- [x] **Step 1: Write failing Node client tests**

Stub only the `wx.request` boundary. Assert `markWordLearned` uses `PUT` or `DELETE /api/progress/{id}`, `getWordList` never sends `learnedIds`, `markWrongMastered` sends the strict boolean body, wrong-word filters reach the server, stats use `/api/stats`, challenge submission inserts only incorrect answers into `/api/wrong_words`, and failed writes leave page state unchanged.

- [x] **Step 2: Run the client tests and verify RED**

Run: `node --test tests/api-progress.test.js`

Expected: FAIL because learned/mastered state is still written to local storage and stats are assembled client-side.

- [x] **Step 3: Replace local learned/mastered storage with REST calls**

Remove `states`, `setState`, and `learnedIds` behavior for learned/mastered state. Keep challenge question context storage under a dedicated key. Preserve existing `callApi` operation names so page UI files need minimal or no changes.

- [x] **Step 4: Verify page behavior at the HTTP boundary**

Confirm word card and wrong-book pages update `setData` only after `callApi` resolves, retain their previous visible value on rejection, and continue prompting guests before personal writes.

- [x] **Step 5: Run all frontend tests**

Run: `node --test tests/*.test.js`

Expected: all tests PASS.

### Task 5: Full Local Integration and Regression

**Files:**
- Modify only files directly implicated by a failing acceptance check.
- Update checkboxes in this plan as evidence is collected.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: a locally verified end-to-end basic learning-progress feature ready for user acceptance in WeChat DevTools.

- [x] **Step 1: Run clean backend and frontend verification**

Run: `mvn -f backend/pom.xml clean test package` and `node --test tests/*.test.js`.

Expected: both exit 0; no failing tests.

- [ ] **Step 2: Start the Java backend on 8081 and verify health through real endpoints**

Verify login prerequisites, word list, learned add/delete, learned/unlearned totals, wrong mastered/unmastered filters, and stats against local `word_db`. Do not leave the backend running if the user asks to start it themselves.

- [ ] **Step 3: Execute the two-user isolation acceptance check**

Using two existing test users, confirm user A's learned/mastered state is absent from user B. Do not fabricate production identities; use local test records only.

- [ ] **Step 4: Execute WeChat DevTools acceptance flow**

Login → choose CET level → mark learned → switch filters → restart/recompile → verify persistence → answer challenge wrong → answer PK wrong → verify unmastered wrong count → mark mastered → verify history retained and count decremented.

- [ ] **Step 5: Regression-check preserved features**

Verify word-bank row count, collection add/remove, wrong-word removal, challenge submission, check-in, PK room/game, homepage summary, profile statistics, and the approved UI/navigation visuals.

- [ ] **Step 6: Stop and hand off for user acceptance**

Report exact test commands, pass counts, database migration result, any unverified DevTools-only steps, and the next single feature proposed. Do not start AI work.

