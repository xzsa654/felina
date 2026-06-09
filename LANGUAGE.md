# Language Guide

專案術語的中文對照。用於 i18n、文件、commit message、對話。

| English | 中文 | 備註 |
|---|---|---|
| canonical (skill) | 主檔 | `~/.felina/skills/` 下的 source of truth |
| agent-side (file) | agent 端（副本） | fan-out 產出，位於 `.claude/skills/` 等 agent 目錄 |
| fan-out / push | 推送 | 主檔 → agent 端 |
| pull | 拉回 | agent 端 → 主檔 |
| forked | Forked（不翻譯） | agent 端保留客製，push 跳過 |
| drift | 異動 / 偏移 | agent 端與上次推送不一致 |
| target | 同步目標 | 一筆 agent + scope + project 的推送目的地 |
| sibling (file) | 附屬檔案 | SKILL.md 以外的同目錄檔案（scripts/、references/） |
