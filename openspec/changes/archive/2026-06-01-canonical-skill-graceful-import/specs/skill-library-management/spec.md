## MODIFIED Requirements

### Requirement: Canonical Skill Parsing

UPDATE the parsing rules to treat the `agents` frontmatter field as optional. When `agents` is missing from a SKILL.md frontmatter, the parser SHALL return a valid skill with an empty agents list instead of returning an error. The skill SHALL be surfaced in the UI with a visual indicator that agent configuration is needed.

#### Scenario: SKILL.md without agents field

- **GIVEN** a SKILL.md file exists under `~/.felina/skills/<name>/` with valid `name` and `description` frontmatter but no `agents` field
- **WHEN** the canonical skill list is loaded
- **THEN** the skill SHALL appear in the skill list within the Action Required group
  - The skill SHALL be openable and editable in SkillEditor
  - The skill SHALL display a prompt banner guiding the user to configure target agents
  - Fan-out SHALL be skipped for this skill (no target agents = no push destinations)

##### Example:

- **GIVEN** a SKILL.md with frontmatter containing only `name: "my-skill"` and `description: "A useful skill"`
- **WHEN** `parse_skill_md` is called
- **THEN** it returns `Ok(CanonicalSkill { name: "my-skill", agents: [], ... })`
- **AND** the skill appears in SkillList under Action Required with a "no agents configured" indicator
