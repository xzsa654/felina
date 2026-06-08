## MODIFIED Requirements

### Requirement: Skill Package Upload

The market server SHALL accept skill package uploads via PUT /api/skills/:name. After a successful upsert, if the database returns a non-null `previous_storage_key`, the server SHALL delete the old MinIO object. The upsert response SHALL include `previous_storage_key` in the RETURNING clause. All other upload behavior (auth, validation, storage, frontmatter parsing) remains unchanged.
