# shared-error-display Specification

## Purpose

TBD - created by archiving change 'shared-error-display'. Update Purpose after archive.

## Requirements

### Requirement: Shared error notice component renders i18n title with verbatim detail

The frontend SHALL provide a shared error notice component at src/lib/components/shared/ErrorNotice.tsx that renders an error as a non-blocking inline block consisting of a localized title resolved via t(locale, key) and an optional verbatim detail string. The detail string SHALL be rendered exactly as provided, without translation, parsing, or truncation of its content, in a monospace, user-selectable text region.

#### Scenario: Error with backend detail

- **WHEN** a caller renders ErrorNotice with an i18n title key and a backend error payload as detail
- **THEN** the component displays the localized title and the backend payload verbatim, and the detail text is selectable for copying

#### Scenario: Error without detail

- **WHEN** a caller renders ErrorNotice with only an i18n title key and no detail
- **THEN** the component displays the localized title alone, without an empty detail region


<!-- @trace
source: shared-error-display
updated: 2026-06-11
code:
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/ideas-backlog.md
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/shared/ErrorNotice.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/skills/TargetPopover.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/hub/HubPage.tsx
  - src/lib/components/hub/LoginDialog.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/i18n/locales/en.ts
-->

---
### Requirement: Error notice uses semantic theme colors

ErrorNotice SHALL style itself exclusively with semantic theme tokens defined in app.css (such as text-danger, bg-danger-dim, border-danger/30) and SHALL NOT use raw Tailwind palette colors.

#### Scenario: Themed rendering

- **WHEN** ErrorNotice renders in either light or dark theme
- **THEN** its colors derive from the danger semantic tokens and adapt to the active theme


<!-- @trace
source: shared-error-display
updated: 2026-06-11
code:
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/ideas-backlog.md
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/shared/ErrorNotice.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/skills/TargetPopover.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/hub/HubPage.tsx
  - src/lib/components/hub/LoginDialog.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/i18n/locales/en.ts
-->

---
### Requirement: Long detail is collapsible

When the detail text exceeds the collapsed display area, ErrorNotice SHALL keep the title visible and SHALL provide a control to expand and collapse the full detail.

#### Scenario: Expanding a long detail

- **WHEN** the detail string is longer than the collapsed display area and the user activates the expand control
- **THEN** the full verbatim detail becomes visible, and activating the control again collapses it


<!-- @trace
source: shared-error-display
updated: 2026-06-11
code:
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/ideas-backlog.md
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/shared/ErrorNotice.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/skills/TargetPopover.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/hub/HubPage.tsx
  - src/lib/components/hub/LoginDialog.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/i18n/locales/en.ts
-->

---
### Requirement: Component code does not use window.alert for errors

Code under src/lib/components/ SHALL NOT call window.alert to present error messages. Error presentation SHALL use ErrorNotice or an equivalent non-blocking inline pattern that pairs a localized title with verbatim detail.

#### Scenario: Skill push failure

- **WHEN** a skill push preview or push confirm operation fails in the Skills page
- **THEN** the error is presented inline with a localized title and the backend error verbatim, and no blocking alert dialog appears

#### Scenario: Project removal failure

- **WHEN** removing a saved project fails in the Projects list
- **THEN** the error is presented inline with a localized title and the backend error verbatim, and no blocking alert dialog appears


<!-- @trace
source: shared-error-display
updated: 2026-06-11
code:
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/ideas-backlog.md
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/shared/ErrorNotice.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/skills/TargetPopover.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/hub/HubPage.tsx
  - src/lib/components/hub/LoginDialog.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/i18n/locales/en.ts
-->

---
### Requirement: Migrated error sites pair localized titles with verbatim detail

Error displays in the Skills target popover and target editor (fork preview, open folder), the Settings agent paths and skill library sections, the Hub login dialog and skill deletion flow, and the Tokens analytics query error banner SHALL present a localized title resolved via t(locale, key) together with the underlying error payload verbatim, instead of rendering the bare stringified error alone.

#### Scenario: Hub login failure

- **WHEN** logging in to the hub fails
- **THEN** the login dialog shows a localized failure title and the underlying error message verbatim

#### Scenario: Tokens analytics query failure

- **WHEN** the token analytics query fails on the Tokens page
- **THEN** the page shows a localized failure title and the query error verbatim

<!-- @trace
source: shared-error-display
updated: 2026-06-11
code:
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/ideas-backlog.md
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/shared/ErrorNotice.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/skills/TargetPopover.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/hub/HubPage.tsx
  - src/lib/components/hub/LoginDialog.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/i18n/locales/en.ts
-->