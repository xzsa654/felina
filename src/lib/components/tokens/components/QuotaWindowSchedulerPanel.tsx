import { useState } from "react";
import { AlarmClock, Send, Info } from "lucide-react";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import type {
  JesseContextPayload,
  QuotaScheduleConfig,
  QuotaTriggerResult,
  SchedulerAgent,
} from "$lib/types";
import {
  useQuotaSchedules,
  useSetQuotaSchedule,
  useTriggerQuotaNow,
} from "../hooks/useTokenQueries";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";
import { TokenUsageSkeleton } from "./TokensPageSkeleton";

const AGENTS: { id: SchedulerAgent; label: string }[] = [
  { id: "claude", label: "Claude Code" },
];

type SchedulerDrafts = Partial<Record<SchedulerAgent, QuotaScheduleConfig>>;

const CLAUDE_CODE_WINDOW_HOURS = 5;

function boundSchedulerMessage(message: string): {
  text: string;
  truncated: boolean;
} {
  const trimmed = message.trim();
  const text = trimmed.slice(0, 500);
  return {
    text,
    truncated: trimmed.length > text.length,
  };
}

function formatTimeAfterHours(time: string, hours: number): string {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return time;
  }

  const dayMinutes = 24 * 60;
  const startMinutes = hour * 60 + minute;
  const nextMinutes = (startMinutes + hours * 60) % dayMinutes;
  const nextHour = Math.floor(nextMinutes / 60);
  const nextMinute = nextMinutes % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

export function buildSchedulerJesseContext({
  title,
  stored,
  draft,
  lastResult,
}: {
  title: string;
  stored: QuotaScheduleConfig;
  draft: QuotaScheduleConfig;
  lastResult: QuotaTriggerResult | null;
}): JesseContextPayload {
  const message = boundSchedulerMessage(draft.message);
  const exampleResetAt = formatTimeAfterHours(draft.time, CLAUDE_CODE_WINDOW_HOURS);
  const purpose =
    `${title} lets you set when Claude Code should automatically send the first quota-management message so the quota/billing window starts at that time.`;
  const example =
    `Example: first scheduled Claude Code message at ${draft.time} -> about ${exampleResetAt} reset after ${CLAUDE_CODE_WINDOW_HOURS} hours.`;
  const hasUnsavedChanges =
    stored.enabled !== draft.enabled ||
    stored.time !== draft.time ||
    stored.message !== draft.message;

  return {
    kind: "token-overview",
    title,
    source: "tokens.scheduler",
    capturedAt: new Date().toISOString(),
    summary: `${purpose} Current draft is ${draft.enabled ? "enabled" : "disabled"} at ${draft.time}. ${example}`,
    metrics: {
      agent: "claude",
      purpose,
      enabled: draft.enabled,
      time: draft.time,
      message: message.text,
      messageLength: draft.message.length,
      messageTruncated: message.truncated,
      hasUnsavedChanges,
      storedEnabled: stored.enabled,
      storedTime: stored.time,
      storedMessageLength: stored.message.length,
      lastSuccess: lastResult?.success ?? null,
      lastAttemptedAt: lastResult?.attempted_at ?? null,
      windowHours: CLAUDE_CODE_WINDOW_HOURS,
      exampleFirstMessageAt: draft.time,
      exampleResetAt,
      example,
    },
  };
}

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("button,input,select,textarea"));
}

function formatResult(locale: Locale, result: QuotaTriggerResult | null): {
  text: string;
  tone: "muted" | "success" | "error";
} {
  if (!result) {
    return { text: t(locale, "tokens.scheduler.lastNever"), tone: "muted" };
  }
  const when = new Date(result.attempted_at).toLocaleString();
  if (result.success) {
    return {
      text: t(locale, "tokens.scheduler.lastSuccess", { time: when }),
      tone: "success",
    };
  }
  return {
    text: t(locale, "tokens.scheduler.lastFailure", {
      time: when,
      error: result.error ?? "",
    }),
    tone: "error",
  };
}

function AgentRow({
  locale,
  agent,
  label,
  config,
  onConfigChange,
  result,
}: {
  locale: Locale;
  agent: SchedulerAgent;
  label: string;
  config: QuotaScheduleConfig;
  onConfigChange: (config: QuotaScheduleConfig) => void;
  result: QuotaTriggerResult | null;
}) {
  const saveMutation = useSetQuotaSchedule();
  const triggerMutation = useTriggerQuotaNow();

  const messageInvalid = config.message.trim().length === 0;
  const status = formatResult(locale, result);
  const statusColor =
    status.tone === "success"
      ? "text-green-500"
      : status.tone === "error"
        ? "text-red-500"
        : "text-text-muted";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onConfigChange({ ...config, enabled: e.target.checked })}
            className="h-3.5 w-3.5 accent-blue-500"
          />
          {t(locale, "tokens.scheduler.enabled")}
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          {t(locale, "tokens.scheduler.time")}
          <input
            type="time"
            value={config.time}
            onChange={(e) => onConfigChange({ ...config, time: e.target.value })}
            className="h-7 px-2 text-xs bg-bg-tertiary border border-border rounded text-text-secondary focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[10px] text-text-muted min-w-[140px]">
          {t(locale, "tokens.scheduler.message")}
          <input
            type="text"
            value={config.message}
            onChange={(e) => onConfigChange({ ...config, message: e.target.value })}
            className="h-7 px-2 text-xs bg-bg-tertiary border border-border rounded text-text-secondary focus:outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          disabled={messageInvalid || saveMutation.isPending}
          onClick={() => saveMutation.mutate({ agent, ...config })}
          className="h-7 px-3 text-xs font-medium rounded border border-border bg-bg-secondary text-text-secondary shadow-sm transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveMutation.isPending
            ? t(locale, "tokens.scheduler.saving")
            : t(locale, "tokens.scheduler.save")}
        </button>
        <button
          type="button"
          disabled={triggerMutation.isPending}
          onClick={() => triggerMutation.mutate(agent)}
          title={t(locale, "tokens.scheduler.triggerNow")}
          className="inline-flex h-7 items-center gap-1 px-3 text-xs font-medium rounded border border-border bg-bg-secondary text-text-secondary shadow-sm transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={12} />
          {triggerMutation.isPending
            ? t(locale, "tokens.scheduler.triggering")
            : t(locale, "tokens.scheduler.triggerNow")}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className={`text-[10px] ${statusColor}`}>{status.text}</p>
        {saveMutation.isError && (
          <p className="text-[10px] text-red-500">
            {t(locale, "tokens.scheduler.saveError", {
              error: String(saveMutation.error),
            })}
          </p>
        )}
      </div>
    </div>
  );
}

export default function QuotaWindowSchedulerPanel({ locale }: { locale: Locale }) {
  const schedulesQuery = useQuotaSchedules();
  const [drafts, setDrafts] = useState<SchedulerDrafts>({});

  const data = schedulesQuery.data;
  const title = t(locale, "tokens.scheduler.title");
  const claudeDraft = data ? (drafts.claude ?? data.claude) : null;
  const dragData = data && claudeDraft
    ? buildJesseContextDragData(buildSchedulerJesseContext({
        title,
        stored: data.claude,
        draft: claudeDraft,
        lastResult: data.results.claude,
      }))
    : null;

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlarmClock size={15} className="text-text-muted" />
          <h3
            className={dragData ? "inline-block cursor-grab text-sm font-semibold text-text-primary active:cursor-grabbing" : "text-sm font-semibold text-text-primary"}
            draggable={Boolean(dragData)}
            onDragStart={(event) => {
              if (!dragData) return;
              if (isInteractiveDragTarget(event.target)) {
                event.preventDefault();
                return;
              }
              setJesseContextDragData(event.dataTransfer, dragData, t(locale, "tokens.scheduler.title"));
            }}
            title={dragData ? "Drag to Jesse" : undefined}
          >
            {t(locale, "tokens.scheduler.title")}
          </h3>
        </div>
      </div>

      <p className="text-xs text-text-muted mb-1">
        {t(locale, "tokens.scheduler.description")}
      </p>
      <div className="flex items-start gap-1.5 mb-4 text-[10px] text-amber-500">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          {t(locale, "tokens.scheduler.runtimeNote")}{" "}
          {t(locale, "tokens.scheduler.quotaWarning")}
        </span>
      </div>

      {schedulesQuery.isPending ? (
        <TokenUsageSkeleton />
      ) : !data ? (
        <p className="text-[10px] text-text-muted italic">
          {t(locale, "tokens.scheduler.unavailable")}
        </p>
      ) : (
        <div className="space-y-5">
          {AGENTS.map(({ id, label }, i) => (
            <div
              key={id}
              className={i > 0 ? "pt-5 border-t border-border" : undefined}
            >
              <AgentRow
                locale={locale}
                agent={id}
                label={label}
                config={drafts[id] ?? data[id]}
                onConfigChange={(config) =>
                  setDrafts((current) => ({ ...current, [id]: config }))
                }
                result={data.results[id]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
