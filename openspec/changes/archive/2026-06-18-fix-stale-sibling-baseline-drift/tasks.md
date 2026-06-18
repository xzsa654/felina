## 1. Baseline

- [x] 1.1 執行 npm run check 並記錄現有 TypeScript 靜態檢查狀態，確保本 change 沒有引入前端型別或 lint regression。驗證：npm run check 的結果與實作前 baseline 比對，若有失敗需標明是否為 pre-existing。

## 2. 測試先行

- [x] 2.1 在 src-tauri/src/commands/fan_out/mod.rs 新增 Rust 單元測試，重現 Batch Drift Scan Handles Stale Sibling Baselines：recorded sibling baseline 舊、canonical sibling 與 agent-side sibling 相同時，skill_drift_scan 不回報 Drifted。驗證：先確認新增測試在修正前會失敗，失敗原因為 stale baseline 被誤判成 Drifted。
- [x] 2.2 [P] 補強 Rust 單元測試，確認 agent-side sibling 與 canonical sibling 不同時仍回報 Drifted，避免修正誤吞真正外部修改。驗證：測試案例明確涵蓋 agent-side 修改或新增 canonical 不存在的 sibling file。

## 3. 核心實作

- [x] 3.1 修改 batch drift scan 的 sibling 判定，使 Auto/Manual target 以 recorded baseline、canonical sibling hashes、agent-side sibling hashes 做三方比較；當 canonical 與 agent-side 相同時，不因 recorded baseline stale 回報 Drifted。驗證：task 2.1 的 stale baseline 測試通過。
- [x] 3.2 保留既有 check_drift 對 Shared Drift Check Function 的行為，讓直接 recorded-vs-agent 的 helper 測試仍可偵測 sibling 修改、刪除、新增與 legacy None。驗證：既有 fan_out sibling drift 相關單元測試通過，且 task 2.2 的真 drift 測試通過。

## 4. 驗證與審查

- [x] 4.1 執行 cargo test --lib 於 src-tauri/，確認新增 Rust 測試與既有後端測試全數通過。驗證：cargo test --lib exit code 0。
- [x] 4.2 執行 cargo build 於 src-tauri/，確認 Rust backend 編譯通過。驗證：cargo build exit code 0。
- [x] 4.3 執行 spectra validate fix-stale-sibling-baseline-drift，確認 Spectra artifacts 與 drift-detection delta spec 有效。驗證：spectra validate exit code 0。
- [x] 4.4 執行 /spectra-audit 檢查本 change 對本機檔案 drift 判定的安全與誤判風險，確認沒有把真正 agent-side sibling 修改誤判為 synced。驗證：audit 結論記錄於交付摘要或 archive notes，且若有 High/Critical finding 必須先修正。
