# Design Backlog

框架 / 工具 / 跨 session 的設計議題。與「產品功能 roadmap」(`.session/product-backlog.md`)區隔:這裡放 session-* / spectra-* / git 等**工具本身**的設計問題,不放產品 feature。

維護規則:
- 每條註明 `flagged: YYYY-MM-DD`(首次登錄)與 `last-seen: YYYY-MM-DD`(最近一次 session 確認仍要做)。
- 不放具體 bug / 一次性任務;放需要跨 session 思考的設計取捨。
- 解決後移到 `## Resolved`,標 `resolved: YYYY-MM-DD` + `resolved-by:`。
- 寫入用 sibling lock `.session/design-backlog.md.lock`。
- 不被 daily handoff 繼承(session-start 每次主動掃描呈現)。

---

## Session Skills

- **統一 session-* / spectra-* / git skill 的單一來源(A)**
  flagged: 2026-05-21 / last-seen: 2026-05-21
  現況:這套 skill 是**每個 project 各自一份 copy** 在 `<project>/.claude/skills/`,使用者有 6 個 project(felina / hhr-architecture / tmec-gen-v2 / tmec-item-generation / izumi-notes / foodmap),且在 felina 是 gitignored、無版控、無 master 來源。後果:改一份只惠及一個 project,memory 也是 per-project 無法 generalize。
  方向:收斂成單一來源——升到 user-level `~/.claude/skills/`(所有 project 繼承,改一次全生效),或建一個 skills repo 同步進各 project。確認:skill 用相對路徑 / git-root 解析,移到 global 後行為仍 per-project(已驗證 session-claim 的 Handoff Root Resolution 用 `git rev-parse` 解析,不會因 global 而誤判)。使用者表示「後續會統一來源」。

- **session-claim Fast Path 原型 — 驗證 + 遷移到 master**
  flagged: 2026-05-21 / last-seen: 2026-05-21
  felina 的 `session-claim/SKILL.md` 已加:Fast Path(暖路徑 delta 更新 vs 冷/衝突路徑全跑)、`allowed-tools` frontmatter、Codex 三點修正(gate 補 checkout-occupied / lock 後 re-read+revalidate / parked change 不誤判 stale)、Output `next:` 條件式(Spectra vs non-Spectra)。這是 felina-only 原型。
  待辦:(1) A 完成後把這份 diff 遷到 master;(2) 跑幾次真實 claim 驗證四條路徑(warm clean / cold start / conflict / parked-escalate)行為符合預期;(3) lock 解鎖目前用 `rm -f`,每次 claim 會跳權限提示,若覺得煩,治本是改解鎖機制(不用 rm)而非放寬 `Bash(rm:*)`。

- **`allowed-tools` 原則套用到其他 skill**
  flagged: 2026-05-21 / last-seen: 2026-05-21
  原則(session-claim 已套):**唯讀工具全放 / 寫入綁路徑(如 `Edit(.session/**)`)/ 破壞性(rm)與狀態變更(spectra unpark/archive/apply)留使用者同意**。可在 A 統一來源時一併套到其他 session-* / spectra-* skill 的 frontmatter。
  附帶:遷移到 master 前,掃一遍所有 skill 確認沒有寫死的絕對路徑 / `~`-anchored handoff 路徑(會破壞 global 安裝後的 per-project 解析)。

## Spectra Workflow

(無)

## Git / Worktree

(無)

## Gen Code Workflow

(無)

## Resolved

(無)
