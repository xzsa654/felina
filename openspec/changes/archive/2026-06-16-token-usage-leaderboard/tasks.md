## 1. Server 資料層

- [x] 1.1 [P] 新增 market-server/migrations/005_leaderboard.sql 建立 leaderboard_entries（user_id PK→users.id、handle、各類 token BIGINT、total_cost_usd、event_count、active_days、top_model、submit_count DEFAULT 1、時間戳）與 leaderboard_daily（PK(user_id,day)），含 lower(handle) 唯一索引與 total_tokens/total_cost_usd/active_days 索引。驗證：對含 users/skills 的 DB 跑 migrate.js 後兩表建立、既有表未變更、schema_migrations 記錄該檔。涵蓋需求：Leaderboard data schema。
- [x] 1.2 [P] 在 market-server/src/db.js 新增並於檔尾 re-export：upsertLeaderboardEntry（ON CONFLICT(user_id) 更新且 submit_count+1）、replaceLeaderboardDaily（先 DELETE 再批次 INSERT）、listLeaderboard({sort,limit,offset})、getLeaderboardAggregates、getLeaderboardDailyByHandle、deleteLeaderboardEntry，支撐 Submit validates and persists usage 與 Public ranking listing 的資料存取。驗證：在 app.test.js 以測試 DB 呼叫各方法回傳預期列（隨 2.x 一併綠）。

## 2. Server 路由與測試

- [x] 2.1 在 market-server/src/app.js 新增四路由並滿足 Submitting usage requires authentication、Submit validates and persists usage、Handle uniqueness is enforced、Submit is rate limited、Public ranking listing、Public per-user contribution series、Opt-out removes the entry：POST /api/leaderboard/submit（requireAuth、驗證 handle 與數值與 daily≤800、upsert+取代每日、回 {rank,submitCount}、409 衝突、429 限流、每路由 rate limit）、GET /api/leaderboard（公開、sort 白名單預設 tokens、回 {entries,aggregates} 且無 email、可選 Bearer 標 isMe）、GET /api/leaderboard/:handle/daily（公開）、DELETE /api/leaderboard/me（requireAuth）。驗證：手動 curl 走完 register→submit→list→daily→opt-out 流程狀態碼正確。
- [x] 2.2 在 market-server/src/app.test.js 新增案例覆蓋上述路由：無 Bearer submit→401；有效 submit→200 含 rank；三種 sort 排序順序正確；重複 handle→409；非法 handle/超量 daily→400；opt-out 後清單不含該列。驗證：cd market-server && npm test 全綠。

## 3. 桌面端指令

- [x] 3.1 新增 src-tauri/src/commands/leaderboard.rs，滿足 Submission gathers all-time usage from the aggregator、Submission requires login and explicit opt-in、Submission maps server errors to actionable messages、Read and opt-out commands、Handle is remembered locally：submit_leaderboard_entry(handle,state) 以 build_analytics(Daily, 全時段, auto_dated) 組摘要與每日序列（active_days=token>0 天數），先取資料釋鎖再以 Bearer 上傳，回 {rank,submitCount}，401→重新登入訊息、409→暱稱已被使用訊息、未登入→提示登入；另含 get_leaderboard、get_leaderboard_graph、remove_leaderboard_entry、get_leaderboard_handle/set_leaderboard_handle（沿用 market_server.rs 的 settings 讀寫）。驗證：cargo build 通過且型別正確。
- [x] 3.2 在 src-tauri/src/commands/mod.rs 與 src-tauri/src/lib.rs 的 invoke_handler 註冊全部新指令。驗證：cargo build 通過，前端 invoke 名稱可解析。
- [x] 3.3 為 leaderboard.rs 新增測試：以本機 fake TCP server 斷言 submit 的 POST 路徑、Authorization: Bearer 標頭與 JSON body 形狀，並斷言 401/409 回應映射到對應錯誤訊息。驗證：cd src-tauri && cargo test 新測試與既有測試全綠。

## 4. 前端

- [x] 4.1 [P] 新增 src/lib/types/leaderboard.ts 定義 LeaderboardEntry、LeaderboardAggregates、LeaderboardDaily、SubmitResult、LeaderboardSort。驗證：tsc 型別檢查通過、被 hooks/page 匯入無誤。
- [x] 4.2 在 src/lib/tauri/commands.ts 的 market 區塊旁新增 leaderboard 區塊，包裝 submit/list/graph/remove/getHandle/setHandle 等 invoke。驗證：tsc 通過且名稱對應 3.2 註冊的指令。
- [x] 4.3 新增 src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts：query-key 工廠 + useLeaderboard(sort) 查詢、useLeaderboardGraph(handle) 延遲查詢、useSubmitLeaderboard()/useRemoveEntry() mutation（settle 後 invalidate 清單）。驗證：tsc 通過；切換 sort 觸發重新查詢。
- [x] 4.4 新增 src/lib/components/leaderboard/LeaderboardPanel.tsx，滿足 Public ranking is viewable without login、Ranking table is sortable by the three metrics、Per-user expanded detail、Opt-in submission dialog never reveals email、Opt-out from the page：整體統計 StatCard、Tokens/Cost/Active Days 排序切換、排名表（rank/handle/tokens/cost/active days/submits、自身列高亮）、展開列以 useLeaderboardGraph 呈現「摘要卡 + 每日長條圖（tooltip 含成本、首末日期標籤）」、送出對話框（handle 輸入 + 明確 opt-in 勾選；未登入先走 hub LoginDialog）、退出排行榜動作、錯誤以 ErrorNotice 呈現。驗證：端對端見 5.x。
- [x] 4.5 [P] 滿足 Leaderboard tab in the Tokens page：在 src/lib/components/tokens/TokensPage.tsx 的 TABS 加入 leaderboard 分頁、parseTab 接受 leaderboard、leaderboard 分頁隱藏日期區間預設並渲染 LeaderboardPanel；i18n tokens.tabs.leaderboard。驗證：Tokens 頁出現排行榜分頁且點擊渲染面板，無獨立側邊欄入口/路由。
- [x] 4.6 [P] 滿足 Bilingual strings：在 src/lib/i18n/locales/en.ts 與 zh-TW.ts 新增 leaderboard 區段（標題、副標、排序標籤、表頭、送出對話框含 opt-in/隱私文案、成功/錯誤）。驗證：tsc 型別檢查通過，兩語系 key 對齊。

## 5. 端對端驗證

- [x] 5.1 啟動 market-server（docker-compose）與 Felina app，完成：登入→opt-in 送出→自身列高亮且 tokens/cost/active days 正確→切換三種排序→展開貢獻圖→移除自己；登出仍可瀏覽且全程未顯示 email；中英字串皆正確。驗證：依上述逐項人工確認通過。

## 6. 每模型用量明細

- [x] 6.1 滿足 Per-user model breakdown storage and listing：新增 market-server/migrations/006_leaderboard_models.sql 與 db.js 的 replaceLeaderboardModels/getLeaderboardModelsByHandle，submit 路由接收並驗證 models（空名稱/負值→400、長度上限），新增公開路由 GET /api/leaderboard/:handle/models 依 tokens 由大到小回傳。驗證：market-server npm test 全綠 + 真實 Postgres e2e（migration 006 套用、models 寫入/讀回排序正確）。
- [x] 6.2 滿足 Reading a user's model breakdown：Rust build_submission 從聚合器 model_breakdown 帶入 models（每模型 tokens=各類型總和）、新增 get_leaderboard_models 指令並註冊；前端新增 LeaderboardModel 型別、api.leaderboard.models、useLeaderboardModels，展開卡移除「主要模型」小卡改以 model 分組顯示 tokens/cost（依 tokens 排序）。驗證：cargo test 與 npm run check 全綠。

## 7. 時間區間與前三名視覺

- [x] 7.1 滿足 Windowed ranking by time range：market-server db.js 新增 listLeaderboardWindowed/getLeaderboardAggregatesWindowed（由 leaderboard_daily 開窗加總、排除窗內無活躍者），app.js 的 GET /api/leaderboard 收 days=7/30/60/90 走窗化、其餘走全時段；Rust get_leaderboard 透傳 days；前端加 全部/7/30/60/90 篩選並以 keepPreviousData 避免跳動。驗證：app.test.js 窗化案例綠 + 真實 Postgres e2e（days=7 僅含近 7 天活躍者）。
- [x] 7.2 滿足 Distinct top-3 visual treatment 與 Time-range filter：前三名展開背景（#1 Prism / #2 Silk / #3 LightRays）、per-rank 色調（金/藍紫/白）、ElectricBorder + StarBorder 動畫邊框；切換篩選保留前一筆並以 opacity 提示。驗證：npm run check 通過、GUI 實測前三名與第 4 名差異、切換區間不塌陷。
