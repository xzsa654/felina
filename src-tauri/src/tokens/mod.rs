pub mod agent_message;
pub mod aggregator;
pub mod ccusage;
pub mod parsers;
pub mod pricing;
pub mod reconciliation;
pub mod scan_state;
pub mod scanner;
pub mod storage;
pub mod tokscale;
pub mod tokscale_ingestion;
pub mod types;

#[cfg(target_os = "windows")]
pub(crate) fn no_window_command(program: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    let mut cmd = std::process::Command::new(program);
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn no_window_command(program: &str) -> std::process::Command {
    std::process::Command::new(program)
}

/// Parse an ISO 8601 timestamp (e.g. "2026-05-20T08:06:21.911Z") to a Unix epoch second.
/// Returns `None` if the string is malformed or too short.
pub fn parse_iso8601_to_epoch(s: &str) -> Option<i64> {
    let b = s.as_bytes();
    if b.len() < 19 {
        return None;
    }
    let d2 = |i: usize| std::str::from_utf8(&b[i..i + 2]).ok()?.parse::<i64>().ok();
    let d4 = |i: usize| std::str::from_utf8(&b[i..i + 4]).ok()?.parse::<i64>().ok();

    let y = d4(0)?;
    let mo = d2(5)?;
    let d = d2(8)?;
    let h = d2(11)?;
    let mi = d2(14)?;
    let s = d2(17)?;

    // Howard Hinnant's days_from_civil algorithm
    let y_adj = if mo <= 2 { y - 1 } else { y };
    let era = if y_adj >= 0 {
        y_adj / 400
    } else {
        (y_adj - 399) / 400
    };
    let yoe = y_adj - era * 400;
    let doy = (153 * (if mo <= 2 { mo + 9 } else { mo - 3 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + doe - 719468;

    Some(days * 86400 + h * 3600 + mi * 60 + s)
}
