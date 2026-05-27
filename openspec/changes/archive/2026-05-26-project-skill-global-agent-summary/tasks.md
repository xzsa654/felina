## 1. Baseline 與合併模型

- [x] 1.1 建立 baseline：執行 `npm run check` 並記錄目前 TypeScript gate 結果，完成條件是後續驗證可明確區分本 change 新增錯誤與既有狀態。
- [x] 1.2 實作 **Frontend-only inventory merge** 的純 row-building helper，讓 `Managed Inventory View` rows 由 project-local scan、project-targeted canonical、以及同名 canonical match 三種來源合併；完成條件是 helper 輸入 `ImportCandidate[]`、`SkillListEntry[]`、selected project path 後產生含 `managed`、`canonicalExists`、`canonicalId`、`agentsPresent`、`candidate`、`deferred` 的 row shape，並由 `npm run check` 驗證型別正確。
- [x] 1.3 在 helper 中落實 **Canonical directory identity is the matching key**，使用 `skillListEntryCanonicalId` 而非 parsed `skill.name` 比對同名 canonical；完成條件是 code review 可看到 parsed-name drift 不會成為 Projects page row/action 的主鍵，並由 `npm run check` 驗證。

## 2. Agent chip availability 與 row action

- [x] 2.1 實作 **Availability chips use local presence union enabled tracked targets**，讓 `Managed Inventory View` 的 per-agent chips 將 project-local presence 與同名 canonical 的 enabled/tracked target agents 聯集起來；完成條件是 disabled、detached、forked targets 不會讓 chip present，且 `npm run check` 通過。
- [x] 2.2 保留 **Managed label remains project-target ownership**，讓 `Managed` 只在 canonical target 指向 selected project 時成立；完成條件是同名 global-only canonical row 維持 Unmanaged，但 row 仍可導向 Skills page，並由 manual UI verification 驗證。
- [x] 2.3 更新 `ManagedInventory` rendering/action，使 Unmanaged + same-named canonical row 不再以正常 import button 作為 primary action，而是點擊 row 導向 `/skills?select=<canonicalId>`；完成條件是普通 local-only unmanaged row 仍顯示 Import to Global，而 same-named canonical row 可開啟 Skills page。

## 3. 驗證

- [x] 3.1 執行 `npm run check`，完成條件是 TypeScript gate 相對 baseline 無新增錯誤。
- [x] 3.2 執行 `spectra analyze project-skill-global-agent-summary --json` 與 `spectra validate project-skill-global-agent-summary`，完成條件是沒有 Critical/Warning findings 且 change 驗證通過。
- [x] 3.3 執行 `npm run tauri dev` 手動驗證 `Managed Inventory View`：建立或使用一個 project-local `foo` 與同名 global canonical `foo`，確認 project-local claude 加上 canonical codex/gemini enabled tracked targets 會讓三個 chips 都 present；確認 disabled/detached targets 不會 present；確認同名 canonical row 點擊後進入 Skills page 並選中該 canonical skill。
