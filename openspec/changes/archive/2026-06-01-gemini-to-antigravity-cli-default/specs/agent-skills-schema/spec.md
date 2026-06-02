## MODIFIED Requirements

### Requirement: Google Gemini Skills Format

UPDATE the discovery tiers to reflect the Antigravity CLI migration. The User skills global path SHALL change from `~/.gemini/skills/<skill-name>/SKILL.md` to `~/.gemini/antigravity-cli/skills/<skill-name>/SKILL.md`. The Workspace skills path SHALL change from `.gemini/skills/` to `.agents/skills/` (now primary, not alias). The product lineage note SHALL be updated to reflect that Antigravity CLI is now the active product.

#### Scenario: Gemini skill system exists

- **WHEN** the research confirms Google Gemini CLI provides a dedicated skill system
- **THEN** the spec SHALL document its discovery location, naming convention, frontmatter schema, body format, bundled file support, and load mechanism using the same scenario shape as Anthropic
  - **Discovery tiers (low → high precedence)**:
    1. Built-in skills (bundled with Antigravity CLI).
    2. Extension skills (from installed extensions).
    3. **User skills**: `~/.gemini/antigravity-cli/skills/<skill-name>/SKILL.md` or `~/.agents/skills/<skill-name>/SKILL.md` (alias).
    4. **Workspace skills**: `.agents/skills/<skill-name>/SKILL.md`.
