## Context

`hub-publish-enablement` makes Hub publish/install backed by real market-server storage, but the install command still owns its own tar.gz extraction and canonical directory writes. Skills page import has a separate import/apply path that already represents the product concept of bringing external Skill content into Felina canonical storage.

The user clarified the desired product model: Hub Skill install is logically the same as Skills page import. The source differs, but the result and validation semantics should not.

Hub UI currently uses a market-card grid. That works for a small prototype list, but does not scale to browsing and comparing internal Skills. The Skills page already has the desired interaction pattern: list on the left, selected content on the right.

## Goals / Non-Goals

**Goals:**

- Make Hub install share canonical package import/write semantics with Skills page import.
- Keep Hub package safety checks explicit and test-covered.
- Prevent publisher-local `.felina-sync-meta.json` from being copied into the installer environment.
- Change Hub browsing into a selectable list plus readonly preview layout after selection.
- Keep installed/up-to-date state synchronized between list and preview after install.

**Non-Goals:**

- Do not implement a market Skill editor.
- Do not add auth, attribution, install confirmation, uninstall, search ranking, or detail-route deep links.
- Do not change market-server schema or publish endpoint shape.
- Do not redesign Skills page import staging UI.

## Decisions

### Hub install is an import source

Treat Hub install as an import source that yields a canonical Skill directory. The backend should expose or extract a shared package import helper used by Hub install and, where practical, Skills import flows. The helper owns archive validation, canonical destination resolution, metadata filtering, and write behavior.

This avoids having one command write unpacked files directly while another command applies canonical import rules.

### Shared package helper, not UI coupling

The shared logic belongs in Rust backend command helpers, not in React. Hub frontend still calls `install_market_skill(name)`; the command internally downloads a package and delegates the import/write part.

### Readonly Hub preview

The Hub right pane should reuse the Skills page layout language and list/preview mental model, but it should not reuse `SkillEditor` directly. Market Skills are remote records, not local canonical files until installed. A dedicated `MarketSkillPreview` can show metadata, optional rendered markdown later, installed state, and actions without exposing editor behavior.

### Split view appears on selection

The initial Hub screen may remain a full list/grid for discoverability. Once the user clicks a Skill, the page switches to split browsing: list left, preview right. This matches the user's suggested flow and avoids forcing an empty preview pane before selection.

### Shared helper boundary: validation + write only

The shared `skill_package` helper SHALL own archive entry validation and canonical directory write. It SHALL NOT own archive format decoding — Hub install decodes tar.gz, Skills page import decodes zip, and each caller passes already-iterable entries (or pre-extracted file list) into the helper. This keeps the seam narrow and avoids forcing a single archive abstraction over two unrelated formats.

Concretely: the helper receives a stream of `(relative_path, file_kind, content_reader)` tuples plus destination root, runs the safety checks (symlink/hardlink/absolute/`..`/`.felina-sync-meta.json` filter), and writes. Format detection, header parsing, and tar/zip-specific error mapping stay in the caller.

### Hub refresh borrows SkillsPage interaction shape only

Hub refresh adopts the **interaction shape** of `SkillsPage.handleReload` — button position (PageHeader actions area), spinner + 250ms residual animation, `reloading` disabled state, and **preserve selection** across reload. It does NOT reuse the data pipeline: Hub is readonly, so refresh fetches market list (`GET /api/skills`) and re-derives installed state by recomputing `fan_out::directory_hash` for each listed skill. It MUST NOT call drift scan, import count refresh, or canonical entries reload — those are editor-preheating concerns that do not apply to a readonly browser.

### Installed state is derived, never cached

`install_market_skill` does NOT write `directoryHash` into `.felina-sync-meta.json`. The Hub installed-state badge is derived live by calling `get_skill_directory_hash(name)` (which now computes `fan_out::directory_hash` on demand — see `hub-publish-enablement` archive) and comparing against the market `contentHash`. This avoids a stale cache when the user edits the canonical SKILL.md after install.

After a successful install action, the Hub MUST recompute the local hash and re-derive installed state for that skill, not optimistically mark it up-to-date. If the recomputed hash does not match the server `contentHash`, the UI surfaces the mismatch (install button stays / warning) rather than silently lying.

## Implementation Contract

**Backend install/import behavior**

1. `install_market_skill(name)` validates name before network or filesystem access.
2. It downloads from the configured market server URL using the name-keyed endpoint.
3. It decodes the tar.gz package, iterates entries, and delegates each entry to the shared canonical package import helper (validation + write).
4. The helper rejects symlink, hard link, absolute path, and parent-directory traversal entries before writing file contents.
5. The helper writes under `~/.felina/skills/<top-level-package-dir>/`.
6. The helper filters out any `.felina-sync-meta.json` entry from the package.
7. `install_market_skill` does NOT write `directoryHash` into local `.felina-sync-meta.json`. Hub installed-state comparison is derived live via `get_skill_directory_hash`.
8. Backend tests cover: unsafe archive entry rejection, `.felina-sync-meta.json` filtering at root and nested depth, successful write produces a directory whose `fan_out::directory_hash` matches the package's content hash.

**Frontend Hub behavior**

1. `HubPage` keeps market skills keyed by `name`.
2. Selecting a market Skill sets selected name and renders a split layout.
3. The left pane lists market Skills with selected state and installed/up-to-date indicator.
4. The right pane renders `MarketSkillPreview` for the selected Skill.
5. `MarketSkillPreview` is readonly and provides install/update action only. It MUST NOT expose a delete action.
6. Successful install triggers a recompute: call `get_skill_directory_hash(name)` and compare against the market `contentHash`; update both list row and preview state from the recomputed result. Do NOT optimistically mark up-to-date.
7. Refresh button (PageHeader actions) re-runs the same fetch + recompute path with preserved selection; it does NOT clear the selected skill.
8. All new user-facing text uses `t(locale, key)`, with matching en and zh-TW keys.

## Acceptance Criteria

- Backend unit tests prove Hub install and package import reject unsafe archive entries.
- Backend unit tests prove packaged `.felina-sync-meta.json` is not copied into the canonical destination, at both root and nested depths.
- Backend unit tests prove successful Hub install produces a canonical directory whose `fan_out::directory_hash` matches the package's expected content hash.
- `install_market_skill` does NOT mutate `directoryHash` inside `.felina-sync-meta.json` (regression guard).
- `npm run check` passes.
- The Hub page shows split list/preview after selecting a market Skill.
- Installing from the preview recomputes local hash, compares to market `contentHash`, and updates list row + preview accordingly. If the hashes do not match after a successful install call, the UI does NOT show up-to-date.
- Refresh button preserves the current selection and re-derives installed state for the listed skills.

## Scope Boundaries

- In scope: Rust package import helper, `install_market_skill` refactor, Hub list/preview UI, i18n, tests.
- Out of scope: market-server storage/API changes, publish command changes, final Hub search/discoverability ranking, auth/attribution, install confirmation dialog.

## Risks / Trade-offs

- Import path refactor touches safety-sensitive archive code. Mitigation: write tests before moving logic and keep path traversal / link rejection explicit.
- Sharing too much of Skills page UI could accidentally expose editor controls for remote market content. Mitigation: create readonly Hub preview components and reuse only presentation patterns.
- Existing Hub install behavior writes directly and may differ subtly from import. Mitigation: preserve current successful install observable behavior while changing the internal write path.
