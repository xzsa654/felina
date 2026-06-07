# Tauri

Tauri v2 plugin, capability, and scope gotchas for the Felina desktop app.

---

## tauri-plugin-shell `open` rejects filesystem paths by default
**ID:** kb-tauri-shell-open-scope
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** Session 2 (2026-05-25) handoff; commit 314a2f8; src-tauri/tauri.conf.json
**Context:** "Open in folder" buttons (raw skill editor header + per-target rows) silently failed for every path.
**Applies when:** Calling `@tauri-apps/plugin-shell`'s `open()` (or `app.shell().open()`) on a filesystem path/directory rather than a URL.
**Lesson:**
- The `shell:allow-open` capability permission is necessary but NOT sufficient. The plugin also validates the argument against an *open scope* regex.
- The default open scope (`tauri_plugin_shell::init()` with `plugins.shell.open` unset or `true`) is URL-only: `^((mailto:\w+)|(tel:\w+)|(https?://\w+)).+`. Any `C:\...` or `/...` path fails validation and the call rejects.
- Fix: set `tauri.conf.json > plugins > shell > open` to a regex that also allows absolute paths, e.g. `((mailto:\w+|tel:\w+|https?://\w+).+|[A-Za-z]:[\\/].*|/.*)`.
- The plugin wraps the provided regex in `^...$`, so an alternation MUST be wrapped in an outer group `(a|b|c)`. Otherwise `^a|b|c$` mis-anchors (precedence binds `^` to the first branch and `$` to the last only) and most paths silently fail.
- Editing `tauri.conf.json` triggers a `tauri dev` rebuild/restart; a stale already-running binary won't pick up config (or newly-registered commands) until it relaunches.
- The rejection surfaces in the webview console (IPC error), not the `tauri dev` terminal stdout — add a `.catch` on the `open()` call to see the actual validation error while debugging.
**Keywords:** tauri, tauri-plugin-shell, shell open, open scope, capability, shell:allow-open, open in folder, tauri.conf.json, plugins.shell
**Related:** platform.md (cross-platform path handling)

---

## Tauri async command 中禁用 reqwest::blocking
**ID:** kb-tauri-reqwest-blocking-deadlock
**Date:** 2026-06-05
**Updated:** 2026-06-05
**Status:** active
**Confidence:** confirmed
**Source:** Session 1 (2026-06-05) handoff; local-skill-market-prototype change
**Context:** `install_market_skill` Tauri command 使用 `reqwest::blocking::get` 包在 `tokio::task::spawn_blocking` 裡，呼叫後永久掛住（前端按鈕停在「安裝中」不返回）。
**Applies when:** 在 `#[tauri::command] pub async fn` 中需要發 HTTP 請求時。
**Lesson:**
- `reqwest::blocking` 內部會建立自己的 tokio runtime。在 Tauri 的 tokio multi-thread runtime 中使用會造成 deadlock，即使用 `tokio::task::spawn_blocking` 包裝也不保險。
- 解法：直接使用 async `reqwest::get().await`，完全避免 blocking client。
- 症狀：Tauri command 被 invoke 後永遠不返回（前端 Promise 不 resolve 也不 reject），沒有錯誤訊息。
**Keywords:** tauri, reqwest, blocking, deadlock, tokio, async, spawn_blocking, HTTP
**Related:** kb-tauri-shell-open-scope

---

## Tauri CSP connect-src 對外部 localhost URL 的要求
**ID:** kb-tauri-csp-connect-src
**Date:** 2026-06-05
**Updated:** 2026-06-05
**Status:** active
**Confidence:** confirmed
**Source:** Session 1 (2026-06-05) handoff; local-skill-market-prototype change
**Context:** Hub 頁面 `fetch("http://localhost:3100/api/skills")` 失敗，錯誤訊息 "Failed to fetch"，無更具體的 CSP violation 提示。
**Applies when:** 前端 webview 需要對非 `'self'` 的 URL 發 fetch/XHR 請求時。
**Lesson:**
- Tauri webview 是 Chromium WebView2（Windows）/ WebKit（macOS），即使是桌面 app 也會執行 CSP 規則。
- `tauri.conf.json` 的 `security.csp` 中 `connect-src` 沒列的 origin，fetch 一律被擋。
- 錯誤訊息只有 "Failed to fetch"，不會明確說是 CSP 擋的——容易誤判為 CORS 或 server 問題。
- 修改 CSP 後需要重啟 `npm run tauri dev`（Rust 重新編譯），因為 CSP 在 Rust 編譯階段注入。
- 同時也需要 server 端設定 CORS（如 `@fastify/cors`），CSP 和 CORS 是兩道獨立的關卡。
**Keywords:** tauri, CSP, connect-src, fetch, webview, localhost, CORS, security
**Related:** kb-tauri-reqwest-blocking-deadlock
