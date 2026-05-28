## ADDED Requirements

### Requirement: Push Preview Reuses Shared Drift Check

The push preview flow SHALL use the shared `check_drift` function for its initial hash comparison step instead of inline hash logic. The preview SHALL continue to perform full rendering and operation classification after drift check. Observable push behavior SHALL remain unchanged.

#### Scenario: Preview uses check_drift then renders

- **WHEN** the user triggers a push preview for a skill
- **THEN** the preview SHALL call `check_drift` for each enabled tracked target
- **AND** the preview SHALL proceed to render canonical content and classify operations as before
- **AND** the resulting preview items SHALL have the same operations as before this change
