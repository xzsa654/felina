## Why

Felina 已有 /hub 頁面與一套 Fastify + Postgres + MinIO 的 market-server（含 email/密碼 JWT 帳號）。我們要參考 tokscale.ai/leaderboard，讓用戶「主動選擇加入（opt-in）」後，把自己的全時段 token 用量發佈到共用伺服器並查看公開排行榜，藉此提升黏著度並讓用戶互相比較用量。身分沿用既有 hub JWT，但排行榜上只顯示「用戶自選的公開暱稱」，絕不外露公司 email（如 …@pershing.com.tw）。

## What Changes

- **Server（market-server/）**：新增 migration 建立 leaderboard_entries（每位用戶一列、可 upsert）與 leaderboard_daily（每日貢獻序列）兩張表；新增 db 方法與四個路由：
  - POST /api/leaderboard/submit（需 JWT；驗證暱稱與數值；upsert 摘要 + 取代每日序列；回傳名次與 submit 次數；暱稱衝突回 409；附加每路由 rate limit）
  - GET /api/leaderboard（公開；sort = tokens | cost | active_days；回傳排名清單與整體統計；可選 Bearer 標記 isMe）
  - GET /api/leaderboard/:handle/daily（公開；單一用戶的每日貢獻序列）
  - DELETE /api/leaderboard/me（需 JWT；退出排行榜）
- **Client backend（src-tauri/）**：新增 leaderboard 指令模組，沿用既有 hub auth 與 reqwest 的 Bearer 上傳模式；submit 時從 token 聚合器取得全時段分析，組出摘要（各類 token、cost、event 數、active days、top model）與每日序列後上傳；另提供讀取排行榜、讀取單人貢獻圖、退出、以及在本機 settings 記住暱稱的指令。
- **Frontend（src/）**：新增 Leaderboard 頁面（導覽列項目 + 路由 + 雙語 i18n）、React Query hooks、可切換排序（Tokens / Cost / Active Days）的排名表、展開列顯示個人貢獻圖、需明確勾選 opt-in 的送出對話框（未登入先走既有 hub 登入流程）、以及退出排行榜動作。

## Non-Goals (optional)

- 不做月/週等時間區間篩選（v1 只做 All Time）。
- 不做 groups/teams 檢視、頭像、streak 指標。
- 不做跨裝置送出的伺服器端去重（每個帳號維持一列）。
- 不修改既有 hub-auth、market-server 既有 skill 相關路由的行為。

## Capabilities

### New Capabilities

- `leaderboard-server-api`: market-server 的排行榜資料表、db 方法與 submit / list / daily / opt-out 路由，含驗證與 rate limit。
- `leaderboard-submission`: 桌面端從 token 聚合器產生摘要與每日序列，經 opt-in 暱稱以 JWT 上傳，並提供退出與本機暱稱記憶。
- `leaderboard-page`: 前端排行榜頁面，含導覽列入口、可切換排序的排名表、個人貢獻圖、opt-in 送出對話框與雙語字串。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 leaderboard-server-api、leaderboard-submission、leaderboard-page 三個 capability。
- Affected code:
  - New:
    - market-server/migrations/005_leaderboard.sql
    - src-tauri/src/commands/leaderboard.rs
    - src/lib/types/leaderboard.ts
    - src/lib/components/leaderboard/LeaderboardPage.tsx
    - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - Modified:
    - market-server/src/db.js
    - market-server/src/app.js
    - market-server/src/app.test.js
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/lib/tauri/commands.ts
    - src/lib/stores/navigation.ts
    - src/lib/components/layout/Sidebar.tsx
    - src/router.tsx
    - src/lib/i18n/locales/en.ts
    - src/lib/i18n/locales/zh-TW.ts
  - Removed: (none)
- 依賴：不新增 npm / Cargo 依賴（沿用既有 fastify、pg、reqwest、React Query）。
- 風險：新增 migration 005_leaderboard.sql 為純新增資料表，對既有 schema 無破壞性；排行榜暱稱為公開資料，需在 UI 明確標示 opt-in 與隱私；無跨 change 依賴。
