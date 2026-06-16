## Context

Felina 既有 /hub 由 market-server（Fastify + Postgres + MinIO）支撐，已具備 email/密碼的 JWT 帳號、refresh token、rate limit，以及 skill 上架/下載路由。桌面端 src-tauri 透過 reqwest 以 Bearer token 與該 server 溝通（既有 publish/delete skill 流程），前端為 React 19 + React Query + Zustand + 雙語 i18n + glass UI。token 用量已由 token 聚合器（含先前導入的 merged source）提供全時段分析。本變更在此基礎上新增「用量排行榜」：用戶 opt-in 後上傳全時段摘要與每日序列，於公開排行榜排名。

## Goals / Non-Goals

**Goals:**

- 沿用既有 hub JWT 身分；排行榜僅顯示自選公開暱稱，絕不外露 email。
- 提供 Tokens / Cost / Active Days 三種可切換排序，預設 Tokens。
- 上傳「摘要 + 每日貢獻序列」，前端可展開單人貢獻圖。
- 明確 opt-in 與可 opt-out。
- 不新增 npm / Cargo 依賴；migration 為純新增。

**Non-Goals:**

- 不做月/週時間區間（v1 僅 All Time）。
- 不做 groups/teams、頭像、streak。
- 不做跨裝置去重（每帳號一列）。
- 不改既有 hub-auth 與 skill 路由行為。

## Decisions

- **每帳號一列 + upsert**：leaderboard_entries 以 user_id 為主鍵，重複送出視為更新並把 submit_count 加一；避免同一人灌多列。排序鍵 total_tokens 在送出時於 client 端先算好（input+output+cache_read+cache_write+reasoning），server 直接存，排序查詢用既有索引。
- **每日序列獨立表**：leaderboard_daily 以 (user_id, day) 為主鍵；送出時對該 user 先 DELETE 再批次 INSERT（沿用 token storage 取代式寫入的概念），語意明確且避免殘留舊日資料。
- **暱稱唯一（不分大小寫）**：以 lower(handle) 唯一索引防冒名；衝突回 409 由前端提示改暱稱。
- **身分只信任 token**：submit / opt-out 路由用既有 requireAuth，user 一律取自 token 的 sub；list / daily 為公開讀取，list 可選擇性解析 Bearer 以標記 isMe（沿用 GET /api/skills 的可選驗證寫法）。
- **payload 來源**：client 以聚合器 build_analytics（Daily 粒度、全時段、auto_dated→merged source）取得 time_series 與總計，組摘要與每日序列；active_days = token 總量 > 0 的天數。先取資料、釋放鎖、再進行非同步上傳，避免鎖跨 await。
- **rate limit**：submit 套用比全域更嚴格的每路由限制（如每小時 10 次），防止灌 submit_count。
- **暱稱本機記憶**：以 settings.json 記住上次暱稱（沿用 market server url 的 serde_json 讀寫法），僅供表單預填，不作為 opt-in 憑證。
- **v1 略過 streak**：排序不需要，Rust 端不移植 streak 計算以縮小範圍。

## Implementation Contract

- **Server 行為**：
  - `POST /api/leaderboard/submit`（requireAuth）：驗證 handle 符合 `^[A-Za-z0-9_-]{2,32}$`、數值有限且非負、daily 長度 ≤ 800、day 為 YYYY-MM-DD；upsert entry（submit_count+1、updated_at=now）並取代該 user 的 daily；回傳 `{ rank, submitCount }`；handle 衝突回 409；超量回 429；缺/無效 token 回 401；驗證失敗回 400。
  - `GET /api/leaderboard?sort=tokens|cost|active_days&limit&offset`（公開）：sort 僅接受白名單欄位，預設 tokens，依該欄位 DESC；回傳 `{ entries, aggregates }`，entries 含 handle/各統計/submit_count，且不含任何 email 欄位；帶有效 Bearer 時標記該列 isMe。
  - `GET /api/leaderboard/:handle/daily`（公開）：回傳該 handle 的每日 `{ day, tokens, cost }`；未知 handle 回 200 空序列。
  - `DELETE /api/leaderboard/me`（requireAuth）：刪除該 user 的 entry 與 daily。
- **資料結構（migration 005_leaderboard.sql）**：leaderboard_entries(user_id PK→users.id, handle, total_tokens, input/output/cache_read/cache_write/reasoning_tokens BIGINT, total_cost_usd DOUBLE PRECISION, event_count BIGINT, active_days INT, top_model TEXT, submit_count INT DEFAULT 1, first_submitted_at, updated_at) + lower(handle) 唯一索引 + total_tokens/total_cost_usd/active_days 各一索引；leaderboard_daily(user_id→users.id, day DATE, tokens BIGINT, cost_usd DOUBLE PRECISION, PK(user_id,day))。
- **db.js 方法**：upsertLeaderboardEntry、replaceLeaderboardDaily、listLeaderboard、getLeaderboardAggregates、getLeaderboardDailyByHandle、deleteLeaderboardEntry，並於檔尾 re-export，沿用既有 createDb() 風格。
- **桌面端指令（src-tauri/src/commands/leaderboard.rs）**：
  - submit_leaderboard_entry(handle, state)：回傳 `{ rank, submitCount }`；未登入回錯誤、401→重新登入訊息、409→暱稱已被使用訊息。
  - get_leaderboard(sort, limit, offset)、get_leaderboard_graph(handle)、remove_leaderboard_entry()、get_leaderboard_handle()/set_leaderboard_handle(handle)。
  - 於 commands/mod.rs 與 lib.rs 的 invoke_handler 註冊。
- **前端介面**：commands.ts 新增 leaderboard 區塊；types/leaderboard.ts 定義 LeaderboardEntry/LeaderboardAggregates/LeaderboardDaily/SubmitResult/LeaderboardSort；hooks 提供 useLeaderboard(sort) 查詢、useLeaderboardGraph(handle) 延遲查詢、useSubmitLeaderboard()/useRemoveEntry() mutation（settle 後 invalidate 清單）。
- **失敗模式**：server 端各狀態碼如上；前端以 ErrorNotice 顯示；未登入送出先走 hub LoginDialog。
- **Acceptance criteria**：
  - market-server `npm test` 通過新增的 app.test.js 案例（401/200+rank/排序順序/409/400/opt-out）。
  - src-tauri `cargo test` 通過新增的 leaderboard 測試（fake server 驗證 POST 路徑/Bearer/JSON body 與 401/409 映射）且既有測試全綠。
  - 端對端：登入→opt-in 送出→自身列高亮且數值正確→切換三種排序→展開看貢獻圖→移除自己；登出仍可瀏覽清單且全程不顯示 email；中英字串皆正確。
- **Scope 邊界**：
  - In scope：上述 server 路由/schema、桌面端指令、前端排行榜頁與導覽/路由/i18n。
  - Out of scope：時間區間篩選、teams/頭像/streak、跨裝置去重、既有 hub/skill 行為變更。

## Risks / Trade-offs

- **暱稱為公開資料**：以 UI 明確 opt-in 與隱私說明、且永不顯示 email 來緩解。
- **client 端先算 total_tokens 排序鍵**：信任桌面端送出的數值（無伺服器端重新核算）；可接受，因屬自我申報娛樂性排行，且每帳號一列。
- **每日序列上限 800**：超量回 400；對極長歷史可能截斷，於需要時再放寬（v1 以保護 payload 大小為先）。
- **migration**：純新增資料表，無破壞性；若 server 已有資料，套用後既有 skill/帳號不受影響。
