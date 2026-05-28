## 1. Baseline

- [x] 1.1 Run baseline `npm run check` and `cargo test` from `src-tauri/`; record results for comparison against final verification.

## 2. Import Wizard Candidate Ordering and Collapse

- [x] 2.1 Add a sorting function in `src/lib/components/skills/SkillImportWizard.tsx` that orders candidates by decision priority: multi-source deferred first, then single-source with conflict, then validation error, then clean single-source; within each group alphabetical by `skillName`; verification is the wizard displaying candidates in the specified order when loaded with mixed-type test data in `npm run tauri dev`.
- [x] 2.2 Change the default rendering of each candidate row in `src/lib/components/skills/SkillImportWizard.tsx` to collapsed state: show only skill name, source agent label, and status indicators (conflict/validation-error/multi-source badges); body preview and diff summary SHALL be hidden behind an expand toggle; verification is manual Tauri validation that rows start collapsed and expand on click.

## 3. Multi-Source Inline Source Selection

- [x] [P] 3.1 Replace the greyed-out multi-source text in `src/lib/components/projects/ManagedInventory.tsx` with an expandable row that shows each source's agent label, file path, and a radio/select control; when a source is selected, enable the import button; verification is manual Tauri validation that multi-source rows expand and allow source selection.
- [x] [P] 3.2 Wire the selected source import in `src/lib/components/projects/ManagedInventory.tsx` to call `api.skillImport.apply` with `ImportResolution.SelectSource` using the chosen source index; verification is that importing a multi-source skill from the Project page writes the selected source content to canonical and refreshes the inventory.

## 4. Import Button Label Accuracy

- [x] [P] 4.1 Change the `importToGlobal` i18n key value in `src/lib/i18n/locales/en.ts` from "Import to global" to "Import to Felina" and in `src/lib/i18n/locales/zh-TW.ts` from "匯入至 Global" to "匯入至 Felina"; verification is `npm run check` passing and the button label reading "Import to Felina" / "匯入至 Felina" in Tauri dev.

## 5. Skills Page Browse Project Import

- [x] 5.1 Add a Browse project import entry point on `src/lib/components/skills/SkillsPage.tsx` that opens a project picker showing known projects from `api.knownProjects.list()`; verification is manual Tauri validation that the picker appears and lists known projects.
- [x] 5.2 After the user selects a project, render the `ManagedInventory` component for that project (passing the selected project path); the import flow SHALL reuse the same component and logic as the Projects page; verification is manual Tauri validation that the browsed project inventory displays and imports work identically to the Projects page.
- [x] 5.3 Add i18n keys for the Browse entry point label and empty state in `src/lib/i18n/locales/en.ts` and `src/lib/i18n/locales/zh-TW.ts`; verification is `npm run check` confirming TranslationDict parity.

## 6. Verification

- [x] 6.1 Run `npm run check` and compare with baseline; verification is no new TypeScript errors.
- [x] 6.2 Run `cargo test` from `src-tauri/` and compare with baseline; verification is no new test failures.
- [x] 6.3 Run `npm run tauri dev` and manually verify: (a) Import Wizard shows candidates sorted by priority and collapsed by default, (b) Project page multi-source rows expand and import works, (c) button label reads "Import to Felina", (d) Skills page Browse project import shows inventory and imports; verification is a short manual checklist.
