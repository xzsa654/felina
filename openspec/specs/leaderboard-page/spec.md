# leaderboard-page Specification

## Purpose

TBD - created by archiving change 'token-usage-leaderboard'. Update Purpose after archive.

## Requirements

### Requirement: Leaderboard tab in the Tokens page

The app SHALL present the leaderboard as a tab within the Tokens page (alongside Overview, Daily, and Models), reachable at the `tokens` route. The leaderboard SHALL NOT add a separate top-level sidebar destination or route. Date-range presets SHALL be hidden while the leaderboard tab is active, since they do not apply.

#### Scenario: Opening the leaderboard tab

- **WHEN** the user selects the Leaderboard tab in the Tokens page
- **THEN** the app renders the ranking content in place and hides the date-range presets


<!-- @trace
source: token-usage-leaderboard
updated: 2026-06-16
code:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/leaderboard/ElectricBorder.css
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - package.json
  - src/lib/components/leaderboard/LeaderboardPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - src/lib/components/leaderboard/StarBorder.tsx
  - market-server/src/db.js
  - src/lib/components/leaderboard/ElectricBorder.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/leaderboard/StarBorder.css
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/005_leaderboard.sql
  - src/lib/components/leaderboard/Prism.tsx
  - src/lib/components/leaderboard/LightRays.tsx
  - market-server/migrations/006_leaderboard_models.sql
  - market-server/src/app.js
  - src-tauri/src/commands/leaderboard.rs
  - src/lib/components/leaderboard/Prism.css
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - market-server/docker-compose.override.yml
  - src/lib/components/leaderboard/LightRays.css
  - src/lib/components/leaderboard/BorderGlow.tsx
  - src/lib/components/leaderboard/Silk.tsx
  - src/lib/components/leaderboard/BorderGlow.css
  - src/lib/types/leaderboard.ts
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Public ranking is viewable without login

The leaderboard page SHALL display the ranking and aggregate header statistics to all users, including those who are not logged in.

#### Scenario: Logged-out viewing

- **WHEN** a user who is not logged in opens the leaderboard page
- **THEN** the ranking and aggregate statistics load and display without prompting for login


<!-- @trace
source: token-usage-leaderboard
updated: 2026-06-16
code:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/leaderboard/ElectricBorder.css
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - package.json
  - src/lib/components/leaderboard/LeaderboardPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - src/lib/components/leaderboard/StarBorder.tsx
  - market-server/src/db.js
  - src/lib/components/leaderboard/ElectricBorder.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/leaderboard/StarBorder.css
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/005_leaderboard.sql
  - src/lib/components/leaderboard/Prism.tsx
  - src/lib/components/leaderboard/LightRays.tsx
  - market-server/migrations/006_leaderboard_models.sql
  - market-server/src/app.js
  - src-tauri/src/commands/leaderboard.rs
  - src/lib/components/leaderboard/Prism.css
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - market-server/docker-compose.override.yml
  - src/lib/components/leaderboard/LightRays.css
  - src/lib/components/leaderboard/BorderGlow.tsx
  - src/lib/components/leaderboard/Silk.tsx
  - src/lib/components/leaderboard/BorderGlow.css
  - src/lib/types/leaderboard.ts
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Ranking table is sortable by the three metrics

The page SHALL present a ranking table with rank, public handle, tokens, cost, active days, and submit count, and SHALL allow switching the sort among Tokens, Cost, and Active Days, defaulting to Tokens. The caller's own row SHALL be visually highlighted when present.

#### Scenario: Switching sort

- **WHEN** the user switches the sort control to Cost
- **THEN** the table reorders to rank by cost and the displayed ranks update accordingly

#### Scenario: Own row highlighted

- **WHEN** a logged-in user with an entry views the ranking
- **THEN** their row is visually distinguished from the others


<!-- @trace
source: token-usage-leaderboard
updated: 2026-06-16
code:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/leaderboard/ElectricBorder.css
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - package.json
  - src/lib/components/leaderboard/LeaderboardPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - src/lib/components/leaderboard/StarBorder.tsx
  - market-server/src/db.js
  - src/lib/components/leaderboard/ElectricBorder.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/leaderboard/StarBorder.css
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/005_leaderboard.sql
  - src/lib/components/leaderboard/Prism.tsx
  - src/lib/components/leaderboard/LightRays.tsx
  - market-server/migrations/006_leaderboard_models.sql
  - market-server/src/app.js
  - src-tauri/src/commands/leaderboard.rs
  - src/lib/components/leaderboard/Prism.css
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - market-server/docker-compose.override.yml
  - src/lib/components/leaderboard/LightRays.css
  - src/lib/components/leaderboard/BorderGlow.tsx
  - src/lib/components/leaderboard/Silk.tsx
  - src/lib/components/leaderboard/BorderGlow.css
  - src/lib/types/leaderboard.ts
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Per-user expanded detail

The page SHALL let the user expand a ranking row to view that user's detail, fetched on demand. The expanded detail SHALL include a summary card (total tokens, total cost, active days, submit count), a per-model breakdown grouped by model showing each model's tokens and cost sorted by tokens descending, and a GitHub-style daily contribution calendar (week columns, intensity by that day's tokens) whose per-day tooltip shows the day, tokens, and cost. The calendar SHALL be read-only (no date navigation) in this context. The detail SHALL NOT show a single "top model" stat.

#### Scenario: Expanding a row

- **WHEN** the user expands a ranking row
- **THEN** the page fetches that user's daily series and per-model breakdown and renders a summary card, a per-model token list sorted by tokens descending, and a GitHub-style contribution calendar with per-day tokens-and-cost tooltips


<!-- @trace
source: token-usage-leaderboard
updated: 2026-06-16
code:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/leaderboard/ElectricBorder.css
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - package.json
  - src/lib/components/leaderboard/LeaderboardPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - src/lib/components/leaderboard/StarBorder.tsx
  - market-server/src/db.js
  - src/lib/components/leaderboard/ElectricBorder.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/leaderboard/StarBorder.css
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/005_leaderboard.sql
  - src/lib/components/leaderboard/Prism.tsx
  - src/lib/components/leaderboard/LightRays.tsx
  - market-server/migrations/006_leaderboard_models.sql
  - market-server/src/app.js
  - src-tauri/src/commands/leaderboard.rs
  - src/lib/components/leaderboard/Prism.css
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - market-server/docker-compose.override.yml
  - src/lib/components/leaderboard/LightRays.css
  - src/lib/components/leaderboard/BorderGlow.tsx
  - src/lib/components/leaderboard/Silk.tsx
  - src/lib/components/leaderboard/BorderGlow.css
  - src/lib/types/leaderboard.ts
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Opt-in submission dialog never reveals email

Submitting SHALL open a dialog requiring a public handle input and an explicit opt-in confirmation before upload. If the user is not logged in, the existing hub login flow SHALL be presented first. The dialog and ranking SHALL never display the account email.

#### Scenario: Explicit opt-in required

- **WHEN** the user opens the submit dialog and has not confirmed the opt-in
- **THEN** the submit action remains unavailable until a handle is entered and opt-in is confirmed

#### Scenario: Login required before submitting

- **WHEN** a logged-out user initiates submission
- **THEN** the hub login flow is shown before the submit dialog proceeds

#### Scenario: Email is never shown

- **WHEN** the submit dialog or ranking renders for any user
- **THEN** no account email appears anywhere on the page


<!-- @trace
source: token-usage-leaderboard
updated: 2026-06-16
code:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/leaderboard/ElectricBorder.css
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - package.json
  - src/lib/components/leaderboard/LeaderboardPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - src/lib/components/leaderboard/StarBorder.tsx
  - market-server/src/db.js
  - src/lib/components/leaderboard/ElectricBorder.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/leaderboard/StarBorder.css
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/005_leaderboard.sql
  - src/lib/components/leaderboard/Prism.tsx
  - src/lib/components/leaderboard/LightRays.tsx
  - market-server/migrations/006_leaderboard_models.sql
  - market-server/src/app.js
  - src-tauri/src/commands/leaderboard.rs
  - src/lib/components/leaderboard/Prism.css
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - market-server/docker-compose.override.yml
  - src/lib/components/leaderboard/LightRays.css
  - src/lib/components/leaderboard/BorderGlow.tsx
  - src/lib/components/leaderboard/Silk.tsx
  - src/lib/components/leaderboard/BorderGlow.css
  - src/lib/types/leaderboard.ts
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Opt-out from the page

When the user already has an entry, the page SHALL offer an action to remove their entry from the leaderboard, refreshing the ranking afterward.

#### Scenario: Removing own entry

- **WHEN** a user with an entry triggers the remove action
- **THEN** their entry is removed and the ranking refreshes without it


<!-- @trace
source: token-usage-leaderboard
updated: 2026-06-16
code:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/leaderboard/ElectricBorder.css
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - package.json
  - src/lib/components/leaderboard/LeaderboardPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - src/lib/components/leaderboard/StarBorder.tsx
  - market-server/src/db.js
  - src/lib/components/leaderboard/ElectricBorder.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/leaderboard/StarBorder.css
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/005_leaderboard.sql
  - src/lib/components/leaderboard/Prism.tsx
  - src/lib/components/leaderboard/LightRays.tsx
  - market-server/migrations/006_leaderboard_models.sql
  - market-server/src/app.js
  - src-tauri/src/commands/leaderboard.rs
  - src/lib/components/leaderboard/Prism.css
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - market-server/docker-compose.override.yml
  - src/lib/components/leaderboard/LightRays.css
  - src/lib/components/leaderboard/BorderGlow.tsx
  - src/lib/components/leaderboard/Silk.tsx
  - src/lib/components/leaderboard/BorderGlow.css
  - src/lib/types/leaderboard.ts
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Time-range filter

The page SHALL offer range presets (All, 7, 30, 60, 90 days) that re-query the ranking for the selected window. Switching presets SHALL keep the previously loaded ranking visible until the new data arrives (no layout collapse), indicating refetch with a subtle opacity change rather than a blank/skeleton state.

#### Scenario: Switching range keeps prior rows during refetch

- **WHEN** the user switches the range preset
- **THEN** the current ranking stays rendered while the new window loads and is then replaced without the table collapsing


<!-- @trace
source: token-usage-leaderboard
updated: 2026-06-16
code:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/leaderboard/ElectricBorder.css
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - package.json
  - src/lib/components/leaderboard/LeaderboardPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - src/lib/components/leaderboard/StarBorder.tsx
  - market-server/src/db.js
  - src/lib/components/leaderboard/ElectricBorder.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/leaderboard/StarBorder.css
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/005_leaderboard.sql
  - src/lib/components/leaderboard/Prism.tsx
  - src/lib/components/leaderboard/LightRays.tsx
  - market-server/migrations/006_leaderboard_models.sql
  - market-server/src/app.js
  - src-tauri/src/commands/leaderboard.rs
  - src/lib/components/leaderboard/Prism.css
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - market-server/docker-compose.override.yml
  - src/lib/components/leaderboard/LightRays.css
  - src/lib/components/leaderboard/BorderGlow.tsx
  - src/lib/components/leaderboard/Silk.tsx
  - src/lib/components/leaderboard/BorderGlow.css
  - src/lib/types/leaderboard.ts
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Distinct top-3 visual treatment

The top three rows SHALL receive a distinct visual treatment that ranks 4 and below do not: a per-rank animated background in the expanded panel, a per-rank color scheme (cards, contribution palette, accents), and an animated border on the row and stat cards. Ranks 4 and below SHALL follow the standard theme system.

#### Scenario: Rank 4 uses the standard theme

- **WHEN** a rank-4-or-lower row is expanded
- **THEN** it renders with the standard themed surfaces and no animated background or per-rank color scheme


<!-- @trace
source: token-usage-leaderboard
updated: 2026-06-16
code:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/leaderboard/ElectricBorder.css
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - package.json
  - src/lib/components/leaderboard/LeaderboardPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - src/lib/components/leaderboard/StarBorder.tsx
  - market-server/src/db.js
  - src/lib/components/leaderboard/ElectricBorder.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/leaderboard/StarBorder.css
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/005_leaderboard.sql
  - src/lib/components/leaderboard/Prism.tsx
  - src/lib/components/leaderboard/LightRays.tsx
  - market-server/migrations/006_leaderboard_models.sql
  - market-server/src/app.js
  - src-tauri/src/commands/leaderboard.rs
  - src/lib/components/leaderboard/Prism.css
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - market-server/docker-compose.override.yml
  - src/lib/components/leaderboard/LightRays.css
  - src/lib/components/leaderboard/BorderGlow.tsx
  - src/lib/components/leaderboard/Silk.tsx
  - src/lib/components/leaderboard/BorderGlow.css
  - src/lib/types/leaderboard.ts
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Bilingual strings

All leaderboard user-facing text SHALL be provided in both English and Traditional Chinese locale dictionaries, following the app's type-checked i18n pattern.

#### Scenario: Locale rendering

- **WHEN** the app locale is Traditional Chinese
- **THEN** the leaderboard page renders its labels, table headers, and dialog copy in Traditional Chinese

<!-- @trace
source: token-usage-leaderboard
updated: 2026-06-16
code:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/leaderboard/ElectricBorder.css
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - package.json
  - src/lib/components/leaderboard/LeaderboardPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/leaderboard/hooks/useLeaderboardQueries.ts
  - src/lib/components/leaderboard/StarBorder.tsx
  - market-server/src/db.js
  - src/lib/components/leaderboard/ElectricBorder.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/leaderboard/StarBorder.css
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/005_leaderboard.sql
  - src/lib/components/leaderboard/Prism.tsx
  - src/lib/components/leaderboard/LightRays.tsx
  - market-server/migrations/006_leaderboard_models.sql
  - market-server/src/app.js
  - src-tauri/src/commands/leaderboard.rs
  - src/lib/components/leaderboard/Prism.css
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - market-server/docker-compose.override.yml
  - src/lib/components/leaderboard/LightRays.css
  - src/lib/components/leaderboard/BorderGlow.tsx
  - src/lib/components/leaderboard/Silk.tsx
  - src/lib/components/leaderboard/BorderGlow.css
  - src/lib/types/leaderboard.ts
tests:
  - market-server/src/app.test.js
-->