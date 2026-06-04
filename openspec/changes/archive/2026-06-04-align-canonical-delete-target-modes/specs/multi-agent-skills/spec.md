## MODIFIED Requirements

### Requirement: Explicit Canonical Delete Policy

Deleting a canonical skill SHALL require the user to choose one of three policies: Cascade, Detach, or Cancel. Cascade SHALL delete the canonical skill and every agent-side skill directory that is resolved from the skill's current target list where the target is enabled and managed by Felina. An enabled managed target SHALL have mode `auto`, `manual`, or the legacy `tracked` alias. Cascade SHALL NOT delete agent-side directories for disabled, detached, or forked targets. The delete confirmation UI SHALL calculate its Cascade count, target summary, and Cascade availability using the same enabled managed target definition. When the current skill has zero enabled managed targets, the delete confirmation UI SHALL disable the Cascade option and SHALL still allow Detach or Cancel. Detach SHALL delete only the canonical skill directory and SHALL leave agent-side files on disk. Cancel SHALL leave both canonical and agent-side files unchanged. Cascade deletion SHALL isolate per-target deletion failures: one failed agent-side deletion SHALL NOT delete unrelated target directories, and the final result SHALL surface which paths were deleted and which failed.

#### Scenario: Detach delete leaves agent-side files

- **GIVEN** skill `shared-util` exists in canonical storage and has Anthropic and Codex targets with agent-side files on disk
- **WHEN** the user chooses Detach in the canonical delete confirmation
- **THEN** the canonical directory `~/.felina/skills/shared-util/` is deleted
- **AND** the Anthropic and Codex agent-side skill directories remain on disk

#### Scenario: Cascade delete removes enabled managed target directories

- **GIVEN** skill `shared-util` exists in canonical storage and has one enabled Auto Anthropic target, one enabled Manual Codex target, one disabled target, one detached target, and one forked target with resolvable agent-side skill directories
- **WHEN** the user chooses Cascade in the canonical delete confirmation
- **THEN** the system deletes the canonical directory
- **AND** the system attempts to delete the enabled Auto Anthropic and enabled Manual Codex agent-side skill directories
- **AND** the system does not delete the disabled, detached, or forked agent-side skill directories
- **AND** the result reports each deleted path and each failed path

#### Scenario: Legacy tracked target remains eligible for Cascade

- **GIVEN** skill `legacy-util` has an enabled target whose runtime mode is the legacy `tracked` alias
- **WHEN** the canonical delete confirmation opens
- **THEN** the target is included in the Cascade count and target summary
- **AND** the Cascade option is enabled

#### Scenario: Cascade delete unavailable when no enabled managed targets exist

- **GIVEN** skill `shared-util` exists in canonical storage and has only disabled, detached, or forked targets
- **WHEN** the canonical delete confirmation opens
- **THEN** the Cascade option is disabled
- **AND** the user can still choose Detach or Cancel

#### Scenario: Cancel delete leaves all files unchanged

- **GIVEN** skill `shared-util` exists in canonical storage and has agent-side files on disk
- **WHEN** the user chooses Cancel in the canonical delete confirmation
- **THEN** the canonical directory remains on disk
- **AND** all agent-side files remain unchanged
