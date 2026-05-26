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
