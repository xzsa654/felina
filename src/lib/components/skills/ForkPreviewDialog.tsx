import { useState } from "react";
import { Info } from "lucide-react";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import type { ForkDiffPreview, ForkStatus } from "$lib/types";
import Modal from "$lib/components/shared/Modal";
import MarkdownPreview from "$lib/components/shared/MarkdownPreview";
import { STATUS_CONFIG, type SyncStatus } from "./sync-status-utils";

interface Props {
  open: boolean;
  skillName: string;
  targetKey: string;
  diff: ForkDiffPreview | null;
  onClose: () => void;
}

type Tab = "preview" | "raw" | "diff";

const TAB_LABELS = {
  preview: "skills.fork.tabPreview",
  raw: "skills.fork.tabRaw",
  diff: "skills.fork.tabDiff",
} as const;

const FORK_STATUS_MAP: Record<ForkStatus, SyncStatus> = {
  clean: "forked-clean",
  edited: "forked-edited",
  canonicalAhead: "forked-ahead",
  diverged: "forked-diverged",
};

const FORK_STATUS_LABEL = {
  clean: "skills.fork.statusClean",
  edited: "skills.fork.statusEdited",
  canonicalAhead: "skills.fork.statusAhead",
  diverged: "skills.fork.statusDiverged",
} as const;

export default function ForkPreviewDialog({ open, skillName, targetKey, diff, onClose }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("preview");

  if (!open || !diff) return null;

  const syncStatus = FORK_STATUS_MAP[diff.forkStatus];
  const cfg = STATUS_CONFIG[syncStatus];

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
          <span className={`text-sm ${cfg.chipClass.split(" ")[0]}`}>{cfg.icon}</span>
          <h2 className="text-sm font-semibold text-text-primary">
            {t(locale, "skills.fork.dialogTitle", { skill: skillName, target: targetKey })}
          </h2>
          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${cfg.chipClass}`}>
            {t(locale, FORK_STATUS_LABEL[diff.forkStatus])}
          </span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 px-5 border-b border-border shrink-0">
          {(["preview", "raw", "diff"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-2 text-xs border-b-2 transition-colors ${
                tab === id
                  ? "border-text-primary text-text-primary font-medium"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {t(locale, TAB_LABELS[id])}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "preview" && (
            <MarkdownPreview markdown={diff.forkedBody} />
          )}

          {tab === "raw" && (
            <pre className="text-xs font-mono whitespace-pre-wrap break-all text-text-primary bg-bg-secondary rounded p-3 border border-border">
              {diff.forkedBody}
            </pre>
          )}

          {tab === "diff" && (
            <>
              {!diff.hasBase && (
                <div className="flex items-center gap-1.5 text-xs text-info mb-3">
                  <Info size={14} className="shrink-0" />
                  <span>{t(locale, "skills.fork.noBase")}</span>
                </div>
              )}
              {diff.hunks.length > 0 ? (
                <div className="rounded border border-border bg-bg-secondary">
                  {diff.hunks.map((hunk, hi) => (
                    <div key={hi} className="border-b border-border last:border-b-0">
                      <div className="text-[10px] text-text-muted px-2 py-0.5 bg-bg-tertiary font-mono">
                        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
                      </div>
                      {hunk.lines.map((line, li) => (
                        <div
                          key={li}
                          className={`px-2 font-mono text-xs whitespace-pre-wrap break-all ${
                            line.kind === "delete"
                              ? "bg-danger-dim text-text-primary"
                              : line.kind === "add"
                                ? "bg-success-dim text-text-primary"
                                : "text-text-secondary"
                          }`}
                        >
                          <span className="inline-block w-4 text-text-muted select-none">
                            {line.kind === "delete" ? "−" : line.kind === "add" ? "+" : " "}
                          </span>
                          {line.content.replace(/\n$/, "")}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">
                  {t(locale, "skills.fork.statusClean")}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:text-text-primary"
          >
            {t(locale, "skills.targets.contentClose")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
