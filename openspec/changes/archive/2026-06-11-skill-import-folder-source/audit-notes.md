# Audit Notes — skill_import_scan_dir（2026-06-11）

/spectra-audit 回報 2 Critical + 1 Medium，逐項裁決如下。Threat model：本機單使用者桌面 app，路徑由使用者經原生 dialog 明確選取，程式權限等同使用者權限，無伺服器/無跨信任邊界。

| Finding | 裁決 | 理由 |
|---|---|---|
| Symlink following（Critical） | **接受（不修）** | 使用者自選路徑；讀取範圍受 OS 權限限制；預覽僅回顯給同一使用者；既有 `skill_import_scan` agent 目錄掃描同樣跟隨 symlink，行為一致；拒絕 symlink 會破壞「skill repo 以 symlink 掛載」正當用法 |
| 無 canonicalize / home 白名單（Critical） | **否決建議** | home 白名單會擋掉其他磁碟/網路位置的正當匯入；無權限提升向量（app = user 權限）；落盤仍走既有 apply 驗證層（`skill_package::import_entries` 拒絕 symlink/絕對路徑/`..` entries） |
| Unbounded collection（Medium） | **接受（不修）** | 掃描僅第一層 readdir 不遞迴；`body_preview_from` 已截斷 preview；對自己選取的目錄自我 DoS 非真實威脅 |

已驗證的安全行為：

- 非目錄 / 不存在路徑 → 明確 `Err`（單元測試 `skill_import_scan_dir_rejects_missing_or_non_directory_path`）
- 權限不足 → `fs::read_dir` Err 安全略過，回 `Ok([])`
- 無解壓步驟，無 Zip-Slip 類路徑遍歷面
- `.felina-sync-meta.json` 不隨 candidate 載入，apply 產生乾淨 sync metadata（沿用既有路徑）
