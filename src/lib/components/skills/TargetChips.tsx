import { Plus } from "lucide-react";
import type { SkillTarget } from "$lib/types";

interface Props {
  targets: SkillTarget[];
  onExpand: () => void;
  onAdd: () => void;
}

function chipLabel(target: SkillTarget): string {
  let location = "global";
  if (target.scope === "project" && target.project) {
    const segments = target.project.replace(/\\/g, "/").split("/");
    location = segments.filter(Boolean).pop() ?? "project";
  }
  return [target.agent, location, target.mode].join(" · ");
}

export default function TargetChips({ targets, onExpand, onAdd }: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {targets.map((t, i) => (
        <button
          key={`${t.agent}-${t.scope}-${t.project ?? ""}-${i}`}
          type="button"
          onClick={onExpand}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-secondary text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        >
          {chipLabel(t)}
        </button>
      ))}
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
