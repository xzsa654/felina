pub fn validate_skill_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("skill name must not be empty".into());
    }
    if name.contains("..") {
        return Err("invalid skill name: '..' is not allowed".into());
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(
            "invalid skill name: only alphanumeric, hyphens, underscores, and dots allowed".into(),
        );
    }
    Ok(())
}
