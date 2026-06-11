## Felina UI Guidelines Review

Scope: `<TokenImportProgress>` and the first-run rendering branch in `TokensPage`.

- Guideline hit: `PageHeader` / `PageBody` remain the top-level page scaffold; no raw page padding or alternate page shell was introduced.
- Guideline hit: the import progress UI uses the existing token-page compact panel language (`bg-bg-secondary`, `border-border`, padding-led layout, lucide icon) and does not introduce a new visual system.
- Guideline hit: the first-run state is task-oriented and replaces the loading skeleton only while import is required; normal analytics layout remains unchanged after completion.
- Prohibited pattern check: no HTML table, hard grid, nested cards, or standalone warning/info bar was added.
- Deviation: none.
