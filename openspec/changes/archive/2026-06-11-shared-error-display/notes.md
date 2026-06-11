# Notes — shared-error-display

- Task 4.3（npm run tauri dev 手動驗證 (a)–(f)）未逐項執行：使用者裁決提前歸檔（同 history-transcript-conversation-channel 前例）。若後續發現呈現問題，依 (a)–(f) 清單補驗。
- 靜態驗證皆通過：tsc 0 errors（與 baseline 一致）、`src/lib/components/` 內 `window.alert` 歸零、/felina-ui-guidelines 零須修正項（2 個 deviation 裁決接受：事件性錯誤回饋非常駐資訊列；`bg-danger-dim` 沿用語意 token 不另造毛玻璃風格）。
- 棄用 keys 已移除無殘留：`skills.deleteDialog.failed`、`projects.list.removeFailed`（en/zh-TW 同步移除，唯一使用站點已遷移）。
- Audit 紀律：ErrorNotice 對空/空白 detail 安全（trim 後不渲染空區塊）；detail 一律當純文字渲染（React text node，無 dangerouslySetInnerHTML），後端錯誤含 HTML 也不會注入。
