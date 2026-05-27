import { useState } from "react";
import type { AgentStatus, RefreshResult } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumberFull } from "$lib/utils/format";
import RefreshButton from "./RefreshButton";
import { Check, X, AlertTriangle, ChevronDown } from "lucide-react";

export default function AgentStatusPanel({
  agents,
  loading,
  onRefresh,
  lastResult,
  locale,
}: {
  agents: AgentStatus[];
  loading: boolean;
  onRefresh: () => void;
  lastResult: RefreshResult | null;
  locale: Locale;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasErrors =
    Boolean(lastResult && (lastResult.status !== "ok" || lastResult.errors.length > 0)) ||
    agents.some((agent) => agent.last_error);
  const showDiagnostics = expanded || hasErrors;

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-secondary">
            {t(locale, "tokens.agents.sourceStatus")}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-text-muted">
            {lastResult ? (
              <>
                <span className="px-2 py-1 rounded bg-bg-tertiary border border-border text-text-primary">
                  {lastResult.active_source}
                </span>
                <span
                  className={`px-2 py-1 rounded border ${
                    lastResult.status === "ok"
                      ? "bg-success-dim border-success/30 text-success"
                      : "bg-warning-dim border-warning/30 text-warning"
                  }`}
                >
                  {lastResult.status}
                </span>
                {lastResult.fallback_used && (
                  <span className="px-2 py-1 rounded bg-warning-dim border border-warning/30 text-warning">
                    {t(locale, "tokens.agents.fallbackUsed")}
                  </span>
                )}
                {lastResult.last_successful_source && (
                  <span>
                    {t(locale, "tokens.agents.lastSuccessfulSource", {
                      source: lastResult.last_successful_source,
                    })}
                  </span>
                )}
              </>
            ) : (
              <span>{t(locale, "tokens.agents.noRefreshYet")}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
          >
            {t(locale, "tokens.agents.diagnostics")}
            <ChevronDown
              size={14}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          <RefreshButton loading={loading} onClick={onRefresh} locale={locale} />
        </div>
      </div>

      {showDiagnostics && lastResult && (
        <div className="mt-3 px-3 py-2 bg-bg-tertiary rounded-md text-xs text-text-muted space-y-1">
          <div>
            {t(locale, "tokens.agents.scanCoverage")}:{" "}
            {t(locale, "tokens.agents.coverageValues", {
              scanned: formatNumberFull(lastResult.files_scanned, locale),
              skipped: formatNumberFull(lastResult.files_skipped, locale),
            })}
          </div>
          <div>
            {t(locale, "tokens.agents.eventsParsed")}:{" "}
            {formatNumberFull(lastResult.events_parsed, locale)},{" "}
            {t(locale, "tokens.agents.eventsInserted")}:{" "}
            {formatNumberFull(lastResult.events_inserted, locale)}
          </div>
          {lastResult.errors.length > 0 && (
            <div className="flex items-start gap-1 text-warning">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                {lastResult.errors.length} {t(locale, "tokens.agents.errors")}
                {lastResult.errors.length === 1 && (
                  <>: {lastResult.errors[0].agent} - {lastResult.errors[0].message}</>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-2 mt-3">
        {agents.map((agent) => (
          <div
            key={agent.agent}
            className="flex items-center justify-between px-3 py-2 bg-bg-tertiary rounded-md"
          >
            <div className="flex items-center gap-2">
              {agent.available ? (
                <Check size={14} className="text-success" />
              ) : (
                <X size={14} className="text-text-muted" />
              )}
              <span className="text-sm text-text-primary capitalize">
                {agent.agent}
              </span>
            </div>
            <div className="text-xs text-text-muted">
              {agent.available ? (
                <>
                  {t(locale, "tokens.agents.events", { n: formatNumberFull(agent.event_count, locale) })}
                  {agent.last_scanned && (
                    <span className="ml-2">
                      {t(locale, "tokens.agents.lastScanned", {
                        date: new Date(
                          parseInt(agent.last_scanned) * 1000,
                        ).toLocaleDateString(
                          locale === "zh-TW" ? "zh-TW" : "en-US",
                          { month: "numeric", day: "numeric" },
                        ),
                      })}
                    </span>
                  )}
                  {agent.last_error && (
                    <span className="ml-2 text-warning" title={agent.last_error}>
                      <AlertTriangle size={10} className="inline mb-0.5" />{" "}
                      {agent.last_error.length > 40
                        ? agent.last_error.slice(0, 40) + "..."
                        : agent.last_error}
                    </span>
                  )}
                </>
              ) : (
                t(locale, "tokens.agents.notInstalled")
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
