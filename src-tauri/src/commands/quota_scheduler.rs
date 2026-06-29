//! Quota-window scheduler.
//!
//! During app runtime a background task ticks once a minute and, for each
//! enabled agent schedule whose local time has been reached and which has not
//! yet fired today, sends the configured trigger message. The most recent
//! attempt outcome per agent is held in memory only (never persisted).

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use chrono::{Local, Timelike};
use serde::Serialize;
use tauri::State;

use crate::commands::felina_settings::{self, QuotaWindowSchedule, QuotaWindowSchedules};
use crate::tokens::agent_message;

/// Outcome of a single trigger attempt for one agent.
#[derive(Serialize, Clone, Debug)]
pub struct QuotaTriggerResult {
    pub agent: String,
    /// RFC3339 local timestamp of the attempt.
    pub attempted_at: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Most-recent trigger outcome per supported agent.
#[derive(Serialize, Default)]
pub struct QuotaResults {
    pub claude: Option<QuotaTriggerResult>,
    pub codex: Option<QuotaTriggerResult>,
}

/// Combined config + last-result snapshot returned to the frontend.
#[derive(Serialize)]
pub struct QuotaScheduleState {
    pub claude: QuotaWindowSchedule,
    pub codex: QuotaWindowSchedule,
    pub results: QuotaResults,
}

#[derive(Default)]
struct SchedulerInner {
    last_result: HashMap<String, QuotaTriggerResult>,
    /// Slot ("YYYY-MM-DD HH:MM") of the last *auto* fire per agent — the date
    /// plus the scheduled time it fired for. Changing the scheduled time yields
    /// a new slot, so editing the time re-arms the trigger the same day.
    last_fired_slot: HashMap<String, String>,
}

/// Managed Tauri state holding the scheduler's in-memory record.
#[derive(Default)]
pub struct SchedulerState {
    inner: Mutex<SchedulerInner>,
}

impl SchedulerState {
    fn last_fired_slot(&self, agent: &str) -> Option<String> {
        self.inner
            .lock()
            .expect("scheduler mutex poisoned")
            .last_fired_slot
            .get(agent)
            .cloned()
    }

    /// Record the most recent trigger outcome (manual or auto) for display.
    fn record_result(&self, agent: &str, result: QuotaTriggerResult) {
        self.inner
            .lock()
            .expect("scheduler mutex poisoned")
            .last_result
            .insert(agent.to_string(), result);
    }

    /// Mark an auto schedule slot as fired so it does not re-fire each tick.
    fn record_fired_slot(&self, agent: &str, slot: &str) {
        self.inner
            .lock()
            .expect("scheduler mutex poisoned")
            .last_fired_slot
            .insert(agent.to_string(), slot.to_string());
    }

    fn results(&self) -> QuotaResults {
        let g = self.inner.lock().expect("scheduler mutex poisoned");
        QuotaResults {
            claude: g.last_result.get("claude").cloned(),
            codex: g.last_result.get("codex").cloned(),
        }
    }
}

/// The auto-fire slot key for a schedule on a given local date.
fn schedule_slot(now_date: &str, schedule: &QuotaWindowSchedule) -> String {
    format!("{now_date} {}", schedule.time)
}

/// Parse a validated `HH:MM` into `(hour, minute)`. Returns `None` for any
/// malformed value (reusing the settings validator as the single source).
fn parse_hhmm(time: &str) -> Option<(u32, u32)> {
    if !felina_settings::is_valid_hhmm(time) {
        return None;
    }
    Some((time[0..2].parse().ok()?, time[3..5].parse().ok()?))
}

/// Pure decision: should this schedule fire right now? `true` only when the
/// schedule is enabled, the current local time has reached the configured
/// time, and this date+time slot has not already fired. Keying on the slot
/// (not just the date) means editing the scheduled time re-arms it same-day.
pub fn should_trigger(
    now_hour: u32,
    now_minute: u32,
    now_date: &str,
    schedule: &QuotaWindowSchedule,
    last_fired_slot: Option<&str>,
) -> bool {
    if !schedule.enabled {
        return false;
    }
    let Some((sh, sm)) = parse_hhmm(&schedule.time) else {
        return false;
    };
    let reached = now_hour > sh || (now_hour == sh && now_minute >= sm);
    reached && last_fired_slot != Some(&schedule_slot(now_date, schedule))
}

fn send_for_agent(agent: &str, message: &str) -> Result<(), String> {
    match agent {
        "claude" => agent_message::send_claude_message(message),
        other => Err(format!("unsupported agent '{other}'")),
    }
}

/// Send the message and build the outcome record. Pure of scheduler state.
fn perform_trigger(agent: &str, message: &str) -> QuotaTriggerResult {
    let attempted_at = Local::now().to_rfc3339();
    let outcome = send_for_agent(agent, message);
    QuotaTriggerResult {
        agent: agent.to_string(),
        attempted_at,
        success: outcome.is_ok(),
        error: outcome.err(),
    }
}

/// One scheduler tick: fire any due schedules. Idempotent within a slot — once
/// a (date + scheduled-time) slot fires it won't fire again until the slot
/// changes (next day, or the user edits the time). A failed attempt still marks
/// the slot so it doesn't retry every minute.
pub fn run_tick(state: &SchedulerState) {
    let schedules = felina_settings::read_quota_window_schedules();
    let now = Local::now();
    let date = now.format("%Y-%m-%d").to_string();
    let (hour, minute) = (now.hour(), now.minute());

    for (agent, schedule) in [("claude", &schedules.claude)] {
        let last = state.last_fired_slot(agent);
        if should_trigger(hour, minute, &date, schedule, last.as_deref()) {
            let result = perform_trigger(agent, &schedule.message);
            state.record_result(agent, result);
            state.record_fired_slot(agent, &schedule_slot(&date, schedule));
        }
    }
}

// ── Tauri commands ──────────────────────────────────────────────────────────

/// Return current schedules plus the most recent trigger outcome per agent.
#[tauri::command]
pub fn get_quota_window_schedules(state: State<'_, Arc<SchedulerState>>) -> QuotaScheduleState {
    let QuotaWindowSchedules { claude, codex } = felina_settings::read_quota_window_schedules();
    QuotaScheduleState {
        claude,
        codex,
        results: state.results(),
    }
}

/// Persist one agent's schedule. Validation lives in `felina_settings`.
#[tauri::command]
pub fn set_quota_window_schedule(
    agent: String,
    enabled: bool,
    time: String,
    message: String,
) -> Result<(), String> {
    felina_settings::write_quota_window_schedule(&agent, enabled, &time, &message)
}

/// Immediately trigger the configured message for `agent`, independent of the
/// scheduled time. Records the outcome for display but does NOT consume the
/// auto-fire slot, so a manual test won't suppress the day's scheduled trigger.
#[tauri::command]
pub fn trigger_quota_window_now(
    state: State<'_, Arc<SchedulerState>>,
    agent: String,
) -> QuotaTriggerResult {
    let schedules = felina_settings::read_quota_window_schedules();
    let message = match agent.as_str() {
        "claude" => schedules.claude.message,
        // Unknown agent: send an empty message so send_for_agent reports the
        // unsupported-agent error in the result.
        _ => String::new(),
    };
    let result = perform_trigger(&agent, &message);
    state.record_result(&agent, result.clone());
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sched(enabled: bool, time: &str) -> QuotaWindowSchedule {
        QuotaWindowSchedule {
            enabled,
            time: time.into(),
            message: "早安".into(),
        }
    }

    #[test]
    fn decision_table_from_spec() {
        let s = sched(true, "09:00");
        // not yet reached
        assert!(!should_trigger(8, 59, "2026-06-16", &s, None));
        // exactly reached, slot not yet fired → due
        assert!(should_trigger(9, 0, "2026-06-16", &s, None));
        // later same day, this slot already fired → no duplicate
        assert!(!should_trigger(
            9,
            30,
            "2026-06-16",
            &s,
            Some("2026-06-16 09:00")
        ));
        // next day, last fired slot was yesterday's → due again
        assert!(should_trigger(
            9,
            0,
            "2026-06-17",
            &s,
            Some("2026-06-16 09:00")
        ));
    }

    #[test]
    fn editing_time_rearms_same_day() {
        // User already fired 09:58 today, then changes the schedule to 10:04.
        // At 10:05 the new slot has not fired → it must trigger.
        let s = sched(true, "10:04");
        assert!(should_trigger(
            10,
            5,
            "2026-06-18",
            &s,
            Some("2026-06-18 09:58")
        ));
        // Once that slot fires, it won't re-fire the same minute.
        assert!(!should_trigger(
            10,
            5,
            "2026-06-18",
            &s,
            Some("2026-06-18 10:04")
        ));
    }

    #[test]
    fn disabled_never_triggers() {
        let s = sched(false, "09:00");
        assert!(!should_trigger(9, 0, "2026-06-16", &s, None));
    }

    #[test]
    fn malformed_time_never_triggers() {
        let s = sched(true, "9:0");
        assert!(!should_trigger(23, 59, "2026-06-16", &s, None));
    }

    #[test]
    fn well_past_time_triggers_when_not_sent() {
        let s = sched(true, "09:00");
        assert!(should_trigger(18, 0, "2026-06-16", &s, None));
    }
}
