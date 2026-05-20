<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" height="128" alt="Glyphic">
</p>

<h1 align="center">Glyphic</h1>

<p align="center">
  <strong>The desktop app for managing Claude Code</strong>
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="#screenshots">Screenshots</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/badge/built%20with-Tauri%20v2-orange" alt="Tauri">
  <img src="https://img.shields.io/badge/frontend-React%2019-blue" alt="React">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License">
</p>

---

Glyphic gives you a visual interface to configure, manage, and use [Claude Code](https://docs.anthropic.com/en/docs/claude-code) -- the AI coding assistant from Anthropic. Instead of editing JSON files and markdown by hand, Glyphic lets you manage everything through a modern desktop app.

## Screenshots

<p align="center">
  <img src="screenshots/skills.png" width="800" alt="Skills & Agents">
  <br><em>Skills & Agents — Detail view with config cards and connections</em>
</p>

<details>
<summary>View all screenshots</summary>

<p align="center">
  <img src="screenshots/settings.png" width="800" alt="Settings">
  <br><em>Settings — Global and project configuration with model selector</em>
</p>

<p align="center">
  <img src="screenshots/memory.png" width="800" alt="Memory">
  <br><em>Memory — Project memory browser with card grid and editor</em>
</p>

</details>

## Features

### Skills & Agents
Full-featured editor for SKILL.md and AGENT.md files. Detail view shows parsed frontmatter as visual cards (model, tools, permissions, memory, hooks, preloaded skills, inline MCP). Connection visualization shows relationships. 8 starter templates with proper frontmatter.

### Settings Editor
Visual editor for `settings.json` at global and project scope. Model selector, effort level, plan type (Max/Pro/API/Team/Free), toggle switches, permissions editor (allow/ask/deny rules), and environment variables. Project settings show shared (git-tracked) and local (gitignored) overrides side by side. Storage management with disk usage breakdown and one-click cleanup of safe-to-delete directories.

### Templates
Unified template gallery with pre-built configurations for skills and agents. Always accessible from every page. One-click to add.

### Memory Browser
Browse project memory files with a card-based UI. Each card shows type badge (user/feedback/project/reference), name, description, and content preview. Create new memory files with frontmatter editor.

### Other
- **System tray** — closing the window hides to tray instead of quitting; click the tray icon to restore; on macOS hides from Dock and Cmd+Tab when minimized
- **First-run onboarding** — guided setup for new users
- **Light/Dark theme** toggle with persisted preference
- **Command Palette** — Cmd+K / Ctrl+K fuzzy-search to jump between pages
- **Auto-updates** — notified of new versions, one-click update
- **Apple-signed** macOS builds — no Gatekeeper warnings
- **Storage maintenance** — disk usage breakdown with one-click cleanup

## Installation

### Download

Go to [Releases](https://github.com/caioricciuti/glyphic/releases) and download the latest version for your platform:

- **macOS (Apple Silicon)**: `Glyphic_x.x.x_aarch64.dmg`
- **macOS (Intel)**: `Glyphic_x.x.x_x64.dmg`
- **Windows**: `.msi` installer or `.exe` setup
- **Linux**: `.deb` package, `.AppImage`, or `.rpm`

macOS builds are **signed and notarized** with an Apple Developer certificate. Just download, drag to Applications, and open.

The app includes **auto-updates** — you'll be notified when a new version is available and can update in one click.

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) must be installed and configured (`claude` CLI available in PATH)

## Development

### Requirements

- [Rust](https://rustup.rs/) (1.70+)
- Node.js 18+ and npm
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
# Clone
git clone https://github.com/caioricciuti/glyphic.git
cd glyphic

# Install dependencies
npm install

# Run in development
npm run tauri dev

# Build for production
npm run tauri build
```

### Project Structure

```
glyphic/
├── src/                    # React + TypeScript frontend
│   ├── lib/
│   │   ├── components/     # React components and page modules
│   │   ├── stores/         # Zustand stores (navigation, project context, theme)
│   │   ├── tauri/          # Typed Tauri command wrappers
│   │   ├── types/          # TypeScript interfaces
│   │   └── utils/          # Formatting, parsing helpers
│   └── app.css             # Tailwind v4 + dark theme + markdown styles
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # Command modules (settings, memory, skills, ...)
│       └── paths.rs        # Smart path resolution for project hashes
└── static/                 # App icons
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri v2](https://v2.tauri.app/) |
| Frontend | [React 19](https://react.dev/) + [zustand](https://zustand-demo.pmnd.rs/) + [react-router](https://reactrouter.com/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Icons | [Lucide](https://lucide.dev/) |
| Markdown | [Marked](https://marked.js.org/) |
| Language | TypeScript (strict) + Rust |
| Package Manager | npm |

## How It Works

Glyphic reads and writes the same configuration files that Claude Code uses:

- `~/.claude/settings.json` -- global settings
- `~/.claude/CLAUDE.md` -- global instructions
- `~/.claude/projects/` -- per-project memory and config
- `.claude/settings.json` -- project settings (shared)
- `.claude/settings.local.json` -- local overrides (gitignored)
- `.claude/skills/`, `.claude/agents/` -- custom extensions

No server, no account, no telemetry. Everything runs locally on your machine.

## License

[AGPL-3.0](LICENSE)

## Credits

Built by [Caio Ricciuti](https://github.com/caioricciuti)
