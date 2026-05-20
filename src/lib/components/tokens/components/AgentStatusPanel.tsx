import type { AgentStatus } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumberFull } from "$lib/utils/format";
import RefreshButton from "./RefreshButton";
import { Check, X } from "lucide-react";

export default function AgentStatusPanel({
  agents,
  loading,
  onRefresh,
  locale,
}: {
  agents: AgentStatus[];
  loading: boolean;
  onRefresh: () => void;
  locale: Locale;
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">
          {t(locale, "tokens.agents.title")}
        </h3>
        <RefreshButton loading={loading} onClick={onRefresh} locale={locale} />
      </div>
      <div className="space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.agent}
            className="flex items-center justify-between px-3 py-2 bg-bg-tertiary rounded-md"
          >
            <div className="flex items-center gap-2">
              {agent.available ? (
                <Check size={14} className="text-green-500" />
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
