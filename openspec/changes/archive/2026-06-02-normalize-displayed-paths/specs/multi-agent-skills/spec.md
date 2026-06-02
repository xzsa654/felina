## ADDED Requirements

### Requirement: Backend Display-Path Normalization

Any Tauri command whose response carries a filesystem path String intended for display in the UI (as opposed to identity / deduplication keying) SHALL normalize that String before returning. The normalization SHALL:

1. Replace every backslash `\` with forward slash `/`
2. Trim trailing forward slashes
3. Preserve original character case (no casefold)

This requirement covers `skill_import_scan` (each `ImportCandidate.source_path` and `ConflictInfo.canonical_path`), `canonical_skills_list` (each broken entry `path`), `skill_sync_one` / `skill_sync_all` (each `SyncResult.target_path` returned in the push result dialog), `skill_sync_preview` / `skill_sync_all_preview` (each `SkillSyncPreview` row's `target_dir`, `skill_dir`, `skill_md_path`), `skill_target_dir_resolve` (`TargetDirInfo.path`), `canonical_skill_delete` (`CanonicalSkillDeleteResult.canonical_path`), and `delete_skill_dir_result` (`DeletePathResult.path`).

This normalization SHALL NOT apply to identity / deduplication paths such as `KnownProject.path`, which continue to use the existing `known_projects::normalize_path` (which additionally casefolds on Windows for stable matching).

#### Scenario: Windows path with backslashes is normalized for display
- **GIVEN** the operating system is Windows and the on-disk skill source path is `C:\Users\alice\.claude\skills\foo\SKILL.md`
- **WHEN** `skill_import_scan` returns the corresponding `ImportCandidate`
- **THEN** the `source_path` field SHALL equal `C:/Users/alice/.claude/skills/foo/SKILL.md`

##### Example:
- GIVEN on-disk path `C:\Users\alice\.claude\skills\foo\SKILL.md`
- WHEN scan returns `ImportCandidate`
- THEN `source_path` = `C:/Users/alice/.claude/skills/foo/SKILL.md`

#### Scenario: Case is preserved
- **GIVEN** the source path is `C:\MyProject\Pershing\Felina\.claude\skills\Bar\SKILL.md` (mixed case)
- **WHEN** `skill_import_scan` returns the candidate
- **THEN** the `source_path` SHALL preserve the original case, equalling `C:/MyProject/Pershing/Felina/.claude/skills/Bar/SKILL.md`

##### Example:
- GIVEN on-disk path `C:\MyProject\Pershing\Felina\.claude\skills\Bar\SKILL.md`
- WHEN scan returns candidate
- THEN `source_path` = `C:/MyProject/Pershing/Felina/.claude/skills/Bar/SKILL.md` (NOT lowercase)

#### Scenario: Broken canonical entry path is normalized
- **GIVEN** a canonical skill directory exists at `C:\Users\alice\.felina\skills\bad-skill` and contains a malformed `SKILL.md`
- **WHEN** `canonical_skills_list` returns the entry for `bad-skill`
- **THEN** the broken entry's `path` SHALL equal `C:/Users/alice/.felina/skills/bad-skill/SKILL.md`

##### Example:
- GIVEN broken SKILL.md on disk at `C:\Users\alice\.felina\skills\bad-skill\SKILL.md`
- WHEN `canonical_skills_list` returns entries
- THEN broken entry `path` = `C:/Users/alice/.felina/skills/bad-skill/SKILL.md`

#### Scenario: Conflict canonical path is normalized
- **GIVEN** a skill source has a same-name canonical conflict and the canonical SKILL.md lives at `C:\Users\alice\.felina\skills\foo\SKILL.md`
- **WHEN** `skill_import_scan` returns the candidate with `conflict` populated
- **THEN** the `conflict.canonical_path` SHALL equal `C:/Users/alice/.felina/skills/foo/SKILL.md`

##### Example:
- GIVEN canonical SKILL.md at `C:\Users\alice\.felina\skills\foo\SKILL.md`
- WHEN scan returns candidate with conflict
- THEN `conflict.canonical_path` = `C:/Users/alice/.felina/skills/foo/SKILL.md`

#### Scenario: Push result target path is normalized
- **GIVEN** the operating system is Windows and a push writes to a skill target at `C:\Users\alice\.claude\skills\foo`
- **WHEN** `skill_sync_one` returns the corresponding `SyncResult`
- **THEN** the `target_path` field SHALL equal `C:/Users/alice/.claude/skills/foo`

##### Example:
- GIVEN target skill dir `C:\Users\alice\.claude\skills\foo`
- WHEN `skill_sync_one` returns SyncResult
- THEN `target_path` = `C:/Users/alice/.claude/skills/foo`

#### Scenario: Target dir resolve returns normalized path
- **GIVEN** `skill_target_dir_resolve` is called for an Anthropic project-scope target whose resolved dir is `C:\MyProject\.claude\skills\bar`
- **WHEN** it returns `TargetDirInfo`
- **THEN** the `path` SHALL equal `C:/MyProject/.claude/skills/bar` (forward slashes, case preserved)

##### Example:
- GIVEN resolved dir `C:\MyProject\.claude\skills\bar`
- WHEN `skill_target_dir_resolve` returns
- THEN `TargetDirInfo.path` = `C:/MyProject/.claude/skills/bar`

#### Scenario: KnownProject identity path is unaffected
- **GIVEN** a known project root at `C:\MyProject\Pershing\Felina` (mixed case)
- **WHEN** `known_projects_list` returns the project entry
- **THEN** the `path` SHALL remain `c:/myproject/pershing/felina` (casefolded for identity matching, NOT affected by the display normalization rule)

##### Example:
- GIVEN project root at `C:\MyProject\Pershing\Felina`
- WHEN `known_projects_list` returns entry
- THEN `KnownProject.path` = `c:/myproject/pershing/felina` (lowercase, identity-stable)
