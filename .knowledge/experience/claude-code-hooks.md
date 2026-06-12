# Claude Code Hooks

Claude Code hooks（settings.json）使用經驗：事件語意、防騷擾模式、驗證流程。

---

## Stop hook 防騷擾：工作週期 re-arm 模式
**ID:** exp-claude-code-hooks-stop-work-cycle
**Date:** 2026-06-12
**Updated:** 2026-06-12
**Status:** active
**Confidence:** confirmed
**Source:** session 2026-06-12（felina .claude/hooks/stop-handoff-check.sh，實際觸發兩次驗證）
**Skill:** update-config
**Context:** Stop hook 在「每個 assistant 回合結束」都觸發，不是 session 結束才觸發；天真實作會每回合騷擾。又因使用者一日多次 handoff（每 change 一次），「每 session 提醒一次」的 sentinel 會漏掉第二個 change 的收尾。
**Applies when:** 任何「收尾/同步提醒」類 Stop hook；或需要「事件後重新武裝」的一次性提醒。
**Lesson:**
- sentinel 檔（keyed by session_id 放 temp）擋重複；但判斷式是「sentinel 比目標狀態檔（handoff）mtime 新 → 靜默」，目標檔更新後 sentinel 自動失效 → 每個工作週期提醒一次。
- 加冷卻窗：目標檔 N 分鐘內剛寫過 → 視為剛收尾，跳過（find -mmin -10）。
- block 的 reason 要明確指示 model：「提醒使用者、勿自動執行、勿重複」——否則 model 可能直接跑 handoff。
- 驗證流程：echo '{"session_id":"test"}' | bash script 直測三條路徑（首次/靜默/re-arm），測完清 sentinel；真實觸發在下一回合自然發生。
- 治本優先：恆存的 dirty 檔（如多日未 commit 的 .knowledge）會讓條件恆真，先 commit 再談 hook 調參。
**Keywords:** stop hook, sentinel, re-arm, work cycle, anti-nag, session-handoff, mtime, cooldown
**Related:** kb-workflow-backlog-ownership
