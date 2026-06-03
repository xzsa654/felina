# Gemini / Antigravity 開發規範與備忘錄

本文件為 Gemini 專屬的開發指令與工具鏈行為規範。Gemini 在啟動時會自動載入此檔案，請務必嚴格遵守。

## ⚠️ Windows PowerShell 管道編碼陷阱 (PowerShell Pipeline Encoding Trap)

當你在 Windows 環境下使用 `run_command` 工具，並需要將非 ASCII 內容（包含繁體中文、中點符號 `·` 等）透過 PowerShell 管道（Pipeline `|`）傳遞給外部二進位程式的標準輸入（如 `spectra` CLI 的 `--stdin`）時：

- **致命問題**：PowerShell 會自動使用內建的 ASCII/ANSI（CP950）重新解碼和編碼管道流，將所有 UTF-8 漢字與特殊符號全部永久替換成問號 `?`。
- **嚴格禁止**：禁止使用 `Get-Content ... | spectra ...` 或字串管道傳輸非 ASCII 內容。
- **解決方案**：必須使用 Node.js 子進程傳輸 (Child Process Stdin write) 來安全寫入，這能 100% 確保原始 UTF-8 字串流不失真。

### 💡 Node.js UTF-8 安全寫入範例：
```bash
node -e "const fs = require('fs'); const { spawn } = require('child_process'); const content = fs.readFileSync('temp_file.md', 'utf8'); const child = spawn('spectra', ['new', 'artifact', 'proposal', '--change', 'change-name', '--stdin', '--force'], { stdio: ['pipe', 'inherit', 'inherit'] }); child.stdin.write(content); child.stdin.end();"
```
