import { Fragment, useMemo } from "react";
import type { CanonicalSkill, KnownProject, SkillListEntry } from "$lib/types";
import { isProjectMissing } from "$lib/utils/path";

type SyncState = "synced" | "dirty" | "not-synced" | "disabled" | "no-target";

function cellSyncState(
  skill: CanonicalSkill,
  targetKey: string,
): SyncState {
  const target = skill.targets.find((t) => {
    const k =
      t.scope === "global"
        ? `${t.agent}:global`
        : `${t.agent}:project:${t.project ?? ""}`;
    return k === targetKey;
  });
  if (!target) return "no-target";
  if (!target.enabled) return "disabled";
  const entry = skill.lastSync[targetKey];
  if (!entry) return "not-synced";
  if (skill.dirty) return "dirty";
  return "synced";
}

const STATE_ICON: Record<SyncState, string> = {
  synced: "✓",
  dirty: "●",
  "not-synced": "—",
  disabled: "○",
  "no-target": "",
};

const STATE_CLASS: Record<SyncState, string> = {
  synced: "text-emerald-400",
  dirty: "text-amber-400",
  "not-synced": "text-text-secondary",
  disabled: "text-text-secondary opacity-50",
  "no-target": "",
};

interface ColumnDef {
  key: string;
  agent: string;
  label: string;
}

function buildColumns(skills: CanonicalSkill[]): ColumnDef[] {
  const seen = new Map<string, ColumnDef>();
  for (const skill of skills) {
    for (const t of skill.targets) {
      const key =
        t.scope === "global"
          ? `${t.agent}:global`
          : `${t.agent}:project:${t.project ?? ""}`;
      if (!seen.has(key)) {
        let label: string;
        if (t.scope === "global") {
          label = `${t.agent} / global`;
        } else {
          const segments = (t.project ?? "").replace(/\\/g, "/").split("/");
          const short = segments.filter(Boolean).pop() ?? t.project ?? "";
          label = `${t.agent} / ${short}`;
        }
        seen.set(key, { key, agent: t.agent, label });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
}

interface Props {
  entries: SkillListEntry[];
  knownProjects?: KnownProject[];
}

export default function CoverageMatrix({ entries, knownProjects }: Props) {
  const skills = useMemo(
    () =>
      entries
        .filter((e): e is Extract<SkillListEntry, { kind: "ok" }> => e.kind === "ok")
        .map((e) => e.skill)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [entries],
  );

  const columns = useMemo(() => buildColumns(skills), [skills]);

  if (skills.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-secondary p-8">
        No skills to display
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto text-xs">
      <div
        className="grid gap-px min-w-full"
        style={{
          gridTemplateColumns: `minmax(180px, 1.5fr) repeat(${columns.length}, minmax(80px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div className="sticky left-0 bg-bg-secondary px-2 py-1.5 font-semibold text-text-secondary border-b border-border z-10">
          Skill
        </div>
        {columns.map((col) => (
          <div
            key={col.key}
            className="px-2 py-1.5 font-semibold text-text-secondary text-center border-b border-border truncate"
            title={col.key}
          >
            {col.label}
          </div>
        ))}

        {/* Data rows */}
        {skills.map((skill) => (
          <Fragment key={skill.name}>
            <div
              className="sticky left-0 bg-bg-primary px-2 py-1 border-b border-border/50 truncate z-10"
              title={skill.name}
            >
              {skill.name}
            </div>
            {columns.map((col) => {
              const state = cellSyncState(skill, col.key);
              const isProjectNotFound =
                state !== "no-target" &&
                col.key.includes(":project:") &&
                knownProjects !== undefined &&
                isProjectMissing(
                  knownProjects,
                  col.key.split(":project:")[1] ?? "",
                );

              return (
                <div
                  key={`${skill.name}-${col.key}`}
                  className={`px-2 py-1 text-center border-b border-border/50 ${
                    isProjectNotFound
                      ? "text-red-400"
                      : STATE_CLASS[state]
                  }`}
                  title={
                    isProjectNotFound
                      ? "project not found"
                      : state
                  }
                >
                  {isProjectNotFound ? "!" : STATE_ICON[state]}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
