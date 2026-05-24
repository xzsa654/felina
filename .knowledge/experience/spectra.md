# Spectra CLI Experience

Reusable lessons about using the Spectra CLI (`spectra propose / apply / ingest / analyze / validate / archive`) on this project.

---

## `spectra analyze` Consistency check uses literal keyword matching against task descriptions
**ID:** exp-spectra-analyze-keyword-coverage
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** session entry 2026-05-25 (S9 ingest, harden-skill-import-frontmatter-validation)
**Skill:** spectra-ingest, spectra-propose, spectra-apply
**Context:** `spectra analyze` flagged three Consistency warnings of the form "Design topic 'X' not referenced in tasks", even though new tasks 9.x/10.x demonstrably covered the new Decisions added to design.md.
**Applies when:** Ingesting or proposing a Spectra change where design.md gets new Decision headings (e.g. "## Stable canonical-id actions across read, push, repair, delete, and target mutation", "## Broken canonical skill deletion from raw repair mode"), and the new tasks describe coverage in their own wording without quoting the Decision title verbatim.
**Lesson:**
- The Consistency dimension scans task descriptions (in `tasks.md`) for literal substring matches of design topic titles. It does NOT do semantic matching; "implement broken-skill delete from raw editor" does not satisfy the topic "Broken canonical skill deletion from raw repair mode" even though they mean the same thing.
- Fix: add a parenthetical `(addresses Decision: <exact-title>)` early in each task that covers a Decision topic. Use the exact Decision heading words. Example: `- [ ] 10.1 Implement **Broken canonical skill deletion from raw repair mode** (addresses Decision: Broken canonical skill deletion from raw repair mode) so ...`
- Multi-word Decision titles with quoted substrings (e.g. `"Open in folder"`) need careful escaping but match by substring — the analyzer accepts the literal sequence including the quotes.
- This is a tool quirk worth knowing because the analyzer's wording sounds like a real coverage gap. Don't restructure tasks looking for missing scope before checking whether the keyword reference is just absent from the task line.
- The same pattern works for Coverage/Ambiguity/Gaps dimensions: if the analyzer complains about missing coverage, first try adding the literal keyword reference; only restructure if a substantive gap remains.
**Keywords:** spectra, spectra analyze, Consistency dimension, keyword matching, design topic, tasks coverage, false positive, ingest, propose
**Related:**
