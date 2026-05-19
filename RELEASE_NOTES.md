## Glyphic v0.20.0 — React frontend + npm workflow

This release migrates the desktop frontend to React, TypeScript, and zustand, and switches the project tooling from Bun to npm.

### Changes

- Rebuilt the app entrypoint and page shell around React.
- Added React implementations for the main app pages, including analytics, context engine, skills, rules, plugins, git, pipelines, sessions, templates, terminal, token savings, and keybindings.
- Added shared React scaffolding for page headers, actions, stat cards, loading states, empty states, and error banners.
- Switched development, Tauri, documentation, and release workflow commands from Bun to npm.
- Replaced `bun.lock` with `package-lock.json`.

### Verification

- `npm run check`
- `npm run build`

### Downloads

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x86_64) |
| Windows | `.msi` installer |
| Linux | `.deb` package or `.AppImage` |

macOS builds are signed and notarized when the release workflow has the required signing secrets.
