import { AlertTriangle, Plus } from "lucide-react";
import type { KnownProject, SkillTarget } from "$lib/types";
import type { LastSyncEntry } from "$lib/types/skills";
import type { DriftStatus } from "$lib/types";
import { classifyTarget, isTargetDisabled, STATUS_CONFIG, targetKey } from "./sync-status-utils";

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

/** Trailing segment: the localized "disabled" label when off, else the mode. */
function chipLabel(target: SkillTarget, trailing: string): string {
  let location = "global";
  if (target.scope === "project" && target.project) {
    const segments = target.project.replace(/\\/g, "/").split("/");
    location = segments.filter(Boolean).pop() ?? "project";
  }
  return [target.agent, location, trailing].join(" · ");
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
        const status = classifyTarget(tgt, entry, knownProjects);
        const cfg = STATUS_CONFIG[status];
        // Disabled is an orthogonal axis: when off, it overrides drift/sync
        // styling because freshness is moot until the target is re-enabled.
        const disabled = isTargetDisabled(tgt);
        const isDrifted = !disabled && driftMap?.[key] === "drifted";
        const chipClass = disabled ? DISABLED_CHIP_CLASS : isDrifted ? DRIFT_CHIP_CLASS : cfg.chipClass;
        const icon = disabled ? "∅" : isDrifted ? "⟳" : cfg.icon;
        const trailing = disabled ? "disabled" : tgt.mode;
        return (
          <button
            key={`${tgt.agent}-${tgt.scope}-${tgt.project ?? ""}-${i}`}
            data-target-chip={i}
            type="button"
            onClick={() => onChipClick(i)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${chipClass} hover:opacity-80`}
          >
            <span>{icon}</span>
            {chipLabel(tgt, trailing)}
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
