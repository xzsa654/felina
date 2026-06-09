import { AlertTriangle, Plus, Check, Circle, AlertCircle, GitFork, Ban, RefreshCw } from "lucide-react";
import type { ForkStatus, KnownProject, SkillTarget } from "$lib/types";
import type { LastSyncEntry } from "$lib/types/skills";
import type { DriftStatus } from "$lib/types";
import { classifyTarget, isTargetDisabled, STATUS_CONFIG, targetKey, type SyncStatus } from "./sync-status-utils";
import claudeIcon from "$lib/assets/claude.svg";
import codexIcon from "$lib/assets/codex.png";
import antigravityIcon from "$lib/assets/antigravity.png";
import { useLocaleStore } from "$lib/stores/locale";
import { t, type Locale } from "$lib/i18n";

const AGENT_ICON: Record<string, string> = {
  anthropic: claudeIcon,
  codex: codexIcon,
  gemini: antigravityIcon,
};

function AgentIcon({ agent }: { agent: string }) {
  const src = AGENT_ICON[agent];
  if (!src) return <span className="capitalize">{agent}</span>;
  return <img src={src} alt={agent} title={agent} className="h-3.5 w-3.5 shrink-0" />;
}

const DRIFT_TO_FORK: Partial<Record<DriftStatus, ForkStatus>> = {
  forkedClean: "clean",
  forkedEdited: "edited",
  forkedCanonicalAhead: "canonicalAhead",
  forkedDiverged: "diverged",
};

function driftStatusToForkStatus(drift: DriftStatus | undefined): ForkStatus | undefined {
  return drift ? DRIFT_TO_FORK[drift] : undefined;
}

const DRIFT_CHIP_CLASS = "text-warning border-warning/30 bg-warning/5";
const DISABLED_CHIP_CLASS = "text-text-secondary border-border bg-bg-secondary opacity-60";

interface Props {
  targets: SkillTarget[];
  lastSync: Record<string, LastSyncEntry>;
  knownProjects: KnownProject[];
  siblingsDirty: boolean;
  driftMap?: Record<string, DriftStatus>;
  onChipClick: (index: number) => void;
  onAdd: () => void;
}

function StatusIcon({ disabled, isDrifted, status }: { disabled: boolean; isDrifted: boolean; status: SyncStatus }) {
  if (disabled) return <Ban size={10} />;
  if (isDrifted) return <RefreshCw size={10} />;
  switch (status) {
    case "synced": return <Check size={10} />;
    case "pending": return <Circle size={8} fill="currentColor" />;
    case "missing": return <AlertCircle size={10} />;
    case "forked-clean":
    case "forked-edited":
    case "forked-ahead": 
    case "forked-diverged": return <GitFork size={10} />;
    default: return <Circle size={8} fill="currentColor" />;
  }
}

function getStatusTooltip(locale: Locale, disabled: boolean, isDrifted: boolean, status: SyncStatus): string {
  if (disabled) return t(locale, "skills.targets.detached");
  if (isDrifted) return t(locale, "skills.drift.drifted");
  if (status === "synced") return t(locale, "skills.syncInfoBar.synced");
  if (status === "pending") return t(locale, "skills.syncInfoBar.pending");
  if (status === "missing") return t(locale, "skills.syncInfoBar.missing");
  if (status.startsWith("forked-")) return t(locale, "skills.targets.forked");
  return "";
}

function chipLabel(target: SkillTarget, trailing: string) {
  let location = "global";
  if (target.scope === "project" && target.project) {
    const segments = target.project.replace(/\\/g, "/").split("/");
    location = segments.filter(Boolean).pop() ?? "project";
  }
  return (
    <span className="flex items-center gap-1">
      <AgentIcon agent={target.agent} />
      <span className="opacity-40">·</span>
      <span>{location}</span>
      <span className="opacity-40">·</span>
      <span>{trailing}</span>
    </span>
  );
}

export default function TargetChips({
  targets,
  lastSync,
  knownProjects,
  siblingsDirty,
  driftMap,
  onChipClick,
  onAdd,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {siblingsDirty && (
        <span className="inline-flex items-center text-warning text-xs" title="Siblings have unsaved changes">
          <AlertTriangle size={14} />
        </span>
      )}
      {targets.map((tgt, i) => {
        const key = targetKey(tgt);
        const entry = lastSync[key];
        const driftForkStatus = driftStatusToForkStatus(driftMap?.[key]);
        const status = classifyTarget(tgt, entry, knownProjects, driftForkStatus);
        const cfg = STATUS_CONFIG[status];
        // Disabled is an orthogonal axis: when off, it overrides drift/sync
        // styling because freshness is moot until the target is re-enabled.
        const disabled = isTargetDisabled(tgt);
        const isDrifted = !disabled && driftMap?.[key] === "drifted";
        const chipClass = disabled ? DISABLED_CHIP_CLASS : isDrifted ? DRIFT_CHIP_CLASS : cfg.chipClass;
        const trailing = disabled ? "disabled" : tgt.mode;
        const tooltip = getStatusTooltip(locale, disabled, isDrifted, status);
        return (
          <button
            key={`${tgt.agent}-${tgt.scope}-${tgt.project ?? ""}-${i}`}
            data-target-chip={i}
            type="button"
            onClick={() => onChipClick(i)}
            title={tooltip}
            className={`relative inline-flex items-center gap-1.5 px-2 py-0.5 mr-1 mb-1 rounded-full text-xs transition-colors ${chipClass} hover:opacity-80`}
          >
            {chipLabel(tgt, trailing)}
            <div className="absolute -bottom-1 -right-1.5 bg-bg-primary text-text-primary border border-border rounded-full shadow-sm flex items-center justify-center" style={{ padding: "1.5px" }}>
              <StatusIcon disabled={disabled} isDrifted={isDrifted} status={status} />
            </div>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center p-0.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
