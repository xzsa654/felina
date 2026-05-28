import { Fragment, useMemo } from "react";
import type {
  CanonicalSkill,
  DriftStatus,
  KnownProject,
  SkillListEntry,
} from "$lib/types";
import { isProjectMissing } from "$lib/utils/path";
import { useLocaleStore } from "$lib/stores/locale";
import { useSkillsStore } from "$lib/stores/skills-store";
import { t, type Locale } from "$lib/i18n";

type SyncState =
  | "synced"
  | "dirty"
  | "not-synced"
  | "disabled"
  | "no-target"
  | "drifted";
type StateTranslationKey =
  | "skills.coverageMatrix.state.synced"
  | "skills.coverageMatrix.state.dirty"
  | "skills.coverageMatrix.state.notSynced"
  | "skills.coverageMatrix.state.disabled"
  | "skills.coverageMatrix.state.noTarget"
  | "skills.drift.drifted";

function cellSyncState(
  skill: CanonicalSkill,
  targetKey: string,
  driftMap: Record<string, Record<string, DriftStatus>>,
): SyncState {
  const target = skill.targets.find((tgt) => {
    const k =
      tgt.scope === "global"
        ? `${tgt.agent}:global`
        : `${tgt.agent}:project:${tgt.project ?? ""}`;
    return k === targetKey;
  });
  if (!target) return "no-target";
  if (!target.enabled) return "disabled";
  const entry = skill.lastSync[targetKey];
  if (!entry) return "not-synced";
  const drift = driftMap[skill.canonicalId]?.[targetKey];
  if (drift === "drifted") return "drifted";
  if (skill.dirty) return "dirty";
  return "synced";
}

const STATE_ICON: Record<SyncState, string> = {
  synced: "✓",
  dirty: "●",
  "not-synced": "—",
  disabled: "⦸",
  "no-target": "",
  drifted: "⚠",
};

const STATE_CLASS: Record<SyncState, string> = {
  synced: "text-success",
  dirty: "text-warning",
  "not-synced": "text-text-secondary",
  disabled: "text-text-secondary opacity-50",
  "no-target": "",
  drifted: "text-warning",
};

const STATE_TITLE: Record<SyncState, StateTranslationKey> = {
  synced: "skills.coverageMatrix.state.synced",
  dirty: "skills.coverageMatrix.state.dirty",
  "not-synced": "skills.coverageMatrix.state.notSynced",
  disabled: "skills.coverageMatrix.state.disabled",
  "no-target": "skills.coverageMatrix.state.noTarget",
  drifted: "skills.drift.drifted",
};

interface ColumnDef {
  key: string;
  agent: string;
  label: string;
}

function buildColumns(skills: CanonicalSkill[], locale: Locale): ColumnDef[] {
  const seen = new Map<string, ColumnDef>();
  for (const skill of skills) {
    for (const tgt of skill.targets) {
      const key =
        tgt.scope === "global"
          ? `${tgt.agent}:global`
          : `${tgt.agent}:project:${tgt.project ?? ""}`;
      if (!seen.has(key)) {
        let label: string;
        if (tgt.scope === "global") {
          label = `${tgt.agent} / ${t(locale, "skills.addTargetDialog.scopeGlobal")}`;
        } else {
          const segments = (tgt.project ?? "").replace(/\\/g, "/").split("/");
          const short = segments.filter(Boolean).pop() ?? tgt.project ?? "";
          label = `${tgt.agent} / ${short}`;
        }
        seen.set(key, { key, agent: tgt.agent, label });
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
  const locale = useLocaleStore((s) => s.locale);
  const driftMap = useSkillsStore((s) => s.driftMap);
  const skills = useMemo(
    () =>
      entries
        .filter((e): e is Extract<SkillListEntry, { kind: "ok" }> => e.kind === "ok")
        .map((e) => e.skill)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [entries],
  );

  const columns = useMemo(() => buildColumns(skills, locale), [skills, locale]);

  if (skills.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-secondary p-8">
        {t(locale, "skills.coverageMatrix.empty")}
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
          {t(locale, "skills.coverageMatrix.skillHeader")}
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
              const state = cellSyncState(skill, col.key, driftMap);
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
                      ? "text-danger"
                      : STATE_CLASS[state]
                  }`}
                  title={
                    isProjectNotFound
                      ? t(locale, "skills.projectNotFound")
                      : t(locale, STATE_TITLE[state])
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
