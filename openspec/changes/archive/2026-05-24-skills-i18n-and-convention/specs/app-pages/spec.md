## ADDED Requirements

### Requirement: Page-Level i18n Coverage

All user-facing UI text in page components under `src/lib/components/skills/` and `src/lib/components/projects/` SHALL use the project's i18n system (`t(locale, key)` from `src/lib/i18n/index.ts`) instead of hardcoded string literals. The i18n dictionaries (`src/lib/i18n/locales/en.ts` and `src/lib/i18n/locales/zh-TW.ts`) SHALL contain a `skills` namespace and a `projects` namespace that cover all user-facing labels, tooltips, button text, status messages, confirmation dialogs, empty states, and error display text rendered by these components.

User/system data — including skill names, file paths, agent identifiers, project paths, timestamps, and backend error payloads — SHALL NOT be translated; they SHALL be rendered verbatim.

Each component SHALL read the active locale from `useLocaleStore` and pass it to `t()` for every user-facing string. The Tokens page (`src/lib/components/tokens/TokensPage.tsx`) and its `tokens` namespace in the i18n dictionaries serve as the implementation reference pattern.

#### Scenario: Language switch updates Skills page text

- **WHEN** the user switches the app language from English to zh-TW via the Settings language picker
- **THEN** all user-facing labels, tooltips, button text, status messages, and empty-state messages on the Skills page SHALL render in Traditional Chinese
- **AND** skill names, file paths, agent identifiers, and timestamps SHALL remain unchanged

#### Scenario: Language switch updates Projects page text

- **WHEN** the user switches the app language from English to zh-TW
- **THEN** all user-facing labels, tooltips, and status messages on the Projects page SHALL render in Traditional Chinese
- **AND** project paths, skill names, and agent chip labels SHALL remain unchanged

#### Scenario: Translation key completeness

- **WHEN** an inspector compares the `skills` and `projects` namespaces in `en.ts` against `zh-TW.ts`
- **THEN** every key present in `en.ts` SHALL have a corresponding entry in `zh-TW.ts`
- **AND** the TypeScript type system (`TranslationDict`) SHALL enforce structural parity at compile time

#### Scenario: No hardcoded UI text in Skills or Projects components

- **WHEN** an inspector searches for string literals used as JSX text content or prop values in `src/lib/components/skills/*.tsx` and `src/lib/components/projects/*.tsx`
- **THEN** no user-facing display text SHALL appear as a hardcoded string literal
- **AND** all such text SHALL be resolved through `t(locale, key)` calls

### Requirement: i18n Development Convention

The project's development instructions (CLAUDE.md Gotchas section) SHALL include a rule stating that all new or modified user-facing UI text MUST use `t(locale, key)` from the i18n system. Hardcoded user-facing string literals in page components SHALL be treated as a defect. This convention applies to all pages, not only Skills and Projects.

#### Scenario: Convention documented in project instructions

- **WHEN** an inspector reads the Gotchas section of CLAUDE.md
- **THEN** a rule SHALL be present stating that new or modified UI text MUST use `t(locale, key)` and that hardcoded user-facing strings are not allowed

#### Scenario: New component follows convention

- **WHEN** a developer adds a new page component with user-facing text
- **THEN** the component SHALL use `t(locale, key)` for all display text
- **AND** the corresponding translation keys SHALL be added to both `en.ts` and `zh-TW.ts`
