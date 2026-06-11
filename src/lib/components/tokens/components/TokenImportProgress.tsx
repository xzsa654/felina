import { Database, Loader2 } from "lucide-react";
import { formatNumberFull } from "$lib/utils/format";
import { useScanProgress } from "../hooks/useTokenQueries";

function phaseLabel(phase: string | undefined) {
  switch (phase) {
    case "tokscale":
      return "tokscale";
    case "parser":
      return "parser";
    default:
      return "準備匯入";
  }
}

export default function TokenImportProgress() {
  const progress = useScanProgress();
  const hasProgress = progress !== null;
  const filesTotal = progress?.files_total ?? 0;
  const filesScanned = progress?.files_scanned ?? 0;
  const pct = filesTotal > 0 ? Math.min(100, Math.round((filesScanned / filesTotal) * 100)) : 0;

  return (
    <div className="bg-bg-secondary border border-border rounded-lg px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-md bg-bg-tertiary border border-border flex items-center justify-center shrink-0">
            {hasProgress ? (
              <Database size={17} className="text-info" />
            ) : (
              <Loader2 size={17} className="text-info animate-spin" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">首次匯入 token 歷史</p>
            <p className="text-xs text-text-muted mt-0.5">
              {hasProgress ? `${phaseLabel(progress.phase)} 掃描中` : "等待掃描進度"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span className="px-2 py-1 rounded bg-bg-tertiary border border-border">
            檔案 {formatNumberFull(filesScanned, "zh-TW")} / {formatNumberFull(filesTotal, "zh-TW")}
          </span>
          <span className="px-2 py-1 rounded bg-bg-tertiary border border-border">
            事件 {formatNumberFull(progress?.events_ingested ?? 0, "zh-TW")}
          </span>
        </div>
      </div>

      <div className="mt-4 h-2 bg-bg-tertiary rounded-full overflow-hidden">
        {hasProgress && filesTotal > 0 ? (
          <div
            className="h-full bg-info rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/3 bg-info rounded-full animate-pulse" />
        )}
      </div>
    </div>
  );
}
