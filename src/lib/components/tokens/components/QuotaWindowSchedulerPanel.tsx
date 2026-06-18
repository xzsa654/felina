import { useState } from "react";
import { AlarmClock, Send, Info } from "lucide-react";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import type {
  QuotaScheduleConfig,
  QuotaTriggerResult,
  SchedulerAgent,
} from "$lib/types";
import {
  useQuotaSchedules,
  useSetQuotaSchedule,
  useTriggerQuotaNow,
} from "../hooks/useTokenQueries";
import { TokenUsageSkeleton } from "./TokensPageSkeleton";

const AGENTS: { id: SchedulerAgent; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "codex", label: "Codex CLI" },
];

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
  result,
}: {
  locale: Locale;
  agent: SchedulerAgent;
  label: string;
  config: QuotaScheduleConfig;
  result: QuotaTriggerResult | null;
}) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [time, setTime] = useState(config.time);
  const [message, setMessage] = useState(config.message);

  const saveMutation = useSetQuotaSchedule();
  const triggerMutation = useTriggerQuotaNow();

  const messageInvalid = message.trim().length === 0;
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
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
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
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-7 px-2 text-xs bg-bg-tertiary border border-border rounded text-text-secondary focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[10px] text-text-muted min-w-[140px]">
          {t(locale, "tokens.scheduler.message")}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="h-7 px-2 text-xs bg-bg-tertiary border border-border rounded text-text-secondary focus:outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          disabled={messageInvalid || saveMutation.isPending}
          onClick={() => saveMutation.mutate({ agent, enabled, time, message })}
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

  const data = schedulesQuery.data;

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlarmClock size={15} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">
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
                key={`${id}:${JSON.stringify(data[id])}`}
                locale={locale}
                agent={id}
                label={label}
                config={data[id]}
                result={data.results[id]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
