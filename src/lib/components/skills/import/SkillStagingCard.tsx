import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import type { StagingItem } from "./staging-logic";
import claudeIcon from "$lib/assets/claude.svg";
import codexIcon from "$lib/assets/codex.png";
import antigravityIcon from "$lib/assets/antigravity.png";
import type { AgentId } from "$lib/types";

const AGENT_ICON: Record<AgentId, string> = {
  anthropic: claudeIcon,
  codex: codexIcon,
  gemini: antigravityIcon,
};

interface Props {
  item: StagingItem;
  onResolve: (resolution: "overwrite" | "rename", newName?: string) => void;
  onSelectSource: (sourceIndex: number) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDoubleClick?: () => void;
}

export default function SkillStagingCard({ item, onResolve, onSelectSource, draggable, onDragStart, onDoubleClick }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [renameValue, setRenameValue] = useState(item.candidate.skillName);
  const isConflict = item.status === "conflict" && item.resolution === null;
  const isPendingSource = item.status === "pending-source";
  const sources = item.candidate.deferred?.candidates ?? [];

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDoubleClick={onDoubleClick}
      className={`bg-bg-secondary/30 border rounded p-3 select-none ${
        isConflict ? "border-warning/50" : isPendingSource ? "border-info/50" : "border-border"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-text-primary truncate">{item.resolvedName}</span>
        {isPendingSource ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-info/15 text-info">
            multi-source
          </span>
        ) : isConflict ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-warning-dim text-warning">
            <AlertTriangle size={10} />
            {t(locale, "skills.importDialog.conflict")}
          </span>
        ) : (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success">
            {t(locale, "skills.importDialog.ready")}
          </span>
        )}
      </div>

      {!isPendingSource && (
        <div className="text-[10px] text-text-muted mt-1 truncate" title={item.candidate.sourcePath}>
          {item.selectedSourceIndex !== null && sources[item.selectedSourceIndex]
            ? `${sources[item.selectedSourceIndex].sourceAgent} · ${sources[item.selectedSourceIndex].sourcePath}`
            : `${item.candidate.sourceAgent} · ${item.candidate.sourcePath}`}
        </div>
      )}

      {isPendingSource && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-[10px] text-text-secondary">Choose source:</p>
          {sources.map((source, si) => (
            <button
              type="button"
              key={`${source.sourcePath}-${si}`}
              onClick={(e) => { e.stopPropagation(); onSelectSource(si); }}
              className={`flex items-center gap-2 text-left p-2 rounded border transition-colors ${
                item.selectedSourceIndex === si
                  ? "border-accent ring-1 ring-accent bg-accent/5"
                  : "border-border hover:border-accent/60"
              }`}
            >
              <img src={AGENT_ICON[source.sourceAgent] ?? ""} alt={source.sourceAgent} className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-text-primary">{source.sourceAgent}</span>
                <span className="block font-mono text-[9px] text-text-muted truncate">{source.sourcePath}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {isConflict && (
        <div className="mt-2 border-t border-warning/20 pt-2">
          <p className="text-[10px] text-warning mb-2">{t(locale, "skills.importDialog.conflictMessage")}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onResolve("overwrite")}
              className="text-[10px] px-2 py-1 rounded border border-warning/40 text-warning hover:bg-warning-dim"
            >
              {t(locale, "skills.importDialog.overwrite")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (renameValue && renameValue !== item.candidate.skillName) {
                  onResolve("rename", renameValue);
                }
              }}
              disabled={!renameValue || renameValue === item.candidate.skillName}
              className="text-[10px] px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-40"
            >
              {t(locale, "skills.importDialog.rename")}
            </button>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={t(locale, "skills.importDialog.renamePlaceholder")}
              className="flex-1 min-w-0 text-[10px] px-2 py-1 rounded bg-bg-primary border border-border"
            />
          </div>
        </div>
      )}

      {item.resolution === "overwrite" && (
        <div className="mt-1 text-[10px] text-text-muted">→ {t(locale, "skills.importDialog.overwrite")}</div>
      )}
      {item.resolution === "rename" && (
        <div className="mt-1 text-[10px] text-text-muted">→ {item.resolvedName}</div>
      )}
    </div>
  );
}
