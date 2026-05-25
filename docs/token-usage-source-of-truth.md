# Token Usage Source of Truth

## Command

- Command: `glyphic_token_reconcile`
- Scope: start=None, end=None, agent=None, model=None

## Source Statuses

- felina_db: Ok, records=1, version=Some("3.45.0"), message=None
- felina_rescan: Ok, records=621, version=None, message=None
- tokscale_export: Ok, records=6, version=None, message=None

## Totals

- felina_db: 17829907 tokens across 84 events
- felina_rescan: 2076337915 tokens across 40191 events
- tokscale_export: 1161157714 tokens across 12459 events

## Top Mismatches

- agent `claude-code`: tokscale_export vs felina_rescan delta=883371585 classifications=[CumulativeAsIncrementalCandidate, OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- model `claude-code|anthropic|claude-sonnet-4-6`: tokscale_export vs felina_rescan delta=513389140 classifications=[CumulativeAsIncrementalCandidate, OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- model `claude-code|anthropic|claude-haiku-4-5-20251001`: felina_db vs felina_rescan delta=482430646 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- model `claude-code|anthropic|deepseek-v4-pro`: tokscale_export vs felina_rescan delta=-99640856 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- model `claude-code|anthropic|claude-opus-4-6`: tokscale_export vs felina_rescan delta=68501272 classifications=[CumulativeAsIncrementalCandidate, OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- agent `codex-cli`: tokscale_export vs felina_db delta=-56648446 classifications=[CacheTokenMappingMismatch, ReasoningTokenMappingMismatch]
- model `codex-cli|openai|gpt-5.5`: tokscale_export vs felina_db delta=-56648446 classifications=[CacheTokenMappingMismatch, ReasoningTokenMappingMismatch]
- session `claude-code|claude-opus-4-6|2026-04-22|3833e940-bc3d-45cb-a75d-941e7377d73b`: felina_db vs felina_rescan delta=47923806 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|claude-sonnet-4-6|2026-05-07|8cb7f9cd-3cf2-4906-a1a7-6e5c5ecbbf9c`: felina_db vs felina_rescan delta=45438278 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|deepseek-v4-pro|2026-05-22|d6df70fe-6d38-4fd3-a999-50eaa50fa066`: felina_db vs felina_rescan delta=45014714 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|claude-sonnet-4-6|2026-05-06|agent-acompact-399530759963ddbd`: felina_db vs felina_rescan delta=44690402 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|claude-sonnet-4-6|2026-04-30|agent-acompact-1e286f19a4588bff`: felina_db vs felina_rescan delta=41885312 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|deepseek-v4-pro|2026-05-22|02de233e-0db5-489e-baad-d23fabcbbce6`: felina_db vs felina_rescan delta=41592266 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|claude-sonnet-4-6|2026-05-06|b76f4075-9207-462e-aff4-2984ed566212`: felina_db vs felina_rescan delta=38411774 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|claude-opus-4-6|2026-03-11|agent-acompact-df72235a6ec747fc`: felina_db vs felina_rescan delta=37603818 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|claude-opus-4-6|2026-04-23|aeba227a-884a-4f2c-b831-32ff6ec534b1`: felina_db vs felina_rescan delta=37550640 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|claude-sonnet-4-6|2026-05-08|agent-acompact-6c45a42fadf1db59`: felina_db vs felina_rescan delta=34330912 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|claude-opus-4-6|2026-03-11|agent-acompact-2161e7fe989ee801`: felina_db vs felina_rescan delta=32847494 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- session `claude-code|claude-sonnet-4-6|2026-04-29|adcc4f54-a10d-4504-bbbf-5af1754dc610`: felina_db vs felina_rescan delta=32384592 classifications=[OverlappingSourceDirectoryCandidate, CacheTokenMappingMismatch]
- agent `codex-cli`: tokscale_export vs felina_rescan delta=31808616 classifications=[TruncatedJsonlCandidate, CacheTokenMappingMismatch, ReasoningTokenMappingMismatch]

## Tokscale Readiness

- Status: ReadyForMigrationProposal
- Reasons: []
- Field mappings: ["agent", "model", "input_tokens", "output_tokens", "timestamp_bucket"]

## Recommendation

- `propose_tokscale_backed_ingestion`

## Summary

Scope start=None end=None agent=None model=None.
Sources: felina_db=Ok, felina_rescan=Ok, tokscale_export=Ok.
Totals: felina_db=17829907, felina_rescan=2076337915, tokscale_export=1161157714.
Top mismatch count=50. Tokscale readiness=ReadyForMigrationProposal. Recommendation=propose_tokscale_backed_ingestion.
