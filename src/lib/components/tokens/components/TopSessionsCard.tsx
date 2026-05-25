import { Link as LinkIcon } from "lucide-react";
import { useNavigate } from "react-router";
import type { DaySessionBreakdown } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatCostFull, formatNumber } from "$lib/utils/format";

interface TopSessionsCardProps {
  data: DaySessionBreakdown[];
  locale: Locale;
}

function shortSession(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}...` : id;
}

function projectName(raw: string | null, locale: Locale): string {
  if (!raw || raw === "(no project)") return t(locale, "tokens.dayDetail.noProject" as never);
  const parts = raw.replace(/^-+/, "").split("-").filter(Boolean);
  return parts.slice(-2).join("/") || raw;
}

export default function TopSessionsCard({ data, locale }: TopSessionsCardProps) {
  const navigate = useNavigate();
  const rows = data.slice(0, 5);

  if (rows.length === 0) return null;

  function openHistory(session: DaySessionBreakdown) {
    navigate(`/history?agent=${session.agent}&session=${encodeURIComponent(session.session_id)}`);
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">
            {t(locale, "tokens.topSessions.title" as never)}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {t(locale, "tokens.topSessions.subtitle" as never)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border/40">
              <th className="px-4 py-2 text-left font-medium">
                {t(locale, "tokens.dayDetail.colSession" as never)}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t(locale, "tokens.dayDetail.colProject" as never)}
              </th>
              <th className="px-3 py-2 text-left font-medium">Model</th>
              <th className="px-3 py-2 text-right font-medium">Tokens</th>
              <th className="px-3 py-2 text-right font-medium">Cost</th>
              <th className="px-4 py-2 text-right font-medium">
                {t(locale, "tokens.dayDetail.colAction" as never)}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((session) => (
              <tr
                key={`${session.agent}:${session.session_id}`}
                className="border-b border-border/20 last:border-0 hover:bg-bg-hover/60"
              >
                <td className="px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-mono text-text-primary truncate" title={session.session_id}>
                      {shortSession(session.session_id)}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">{session.agent}</div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-text-secondary truncate max-w-[160px]" title={session.project ?? ""}>
                  {projectName(session.project, locale)}
                </td>
                <td className="px-3 py-2.5 text-text-secondary truncate max-w-[180px]" title={session.model}>
                  {session.model}
                </td>
                <td className="px-3 py-2.5 text-right text-text-primary font-medium">
                  {formatNumber(session.tokens, locale)}
                </td>
                <td className="px-3 py-2.5 text-right text-text-primary font-medium">
                  {formatCostFull(session.cost_usd, locale)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => openHistory(session)}
                      title={t(locale, "tokens.topSessions.viewSession" as never)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded border border-border text-text-muted hover:text-text-primary hover:bg-bg-secondary"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
