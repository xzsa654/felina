/* eslint-disable -- retained-for-reference: sync status now shown in Target Chips via sync-status-utils.ts */
import { useMemo, useState } from "react";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";
import type { KnownProject, SkillTarget } from "$lib/types";
import type { LastSyncEntry } from "$lib/types/skills";
import {
  classifyTarget,
  STATUS_CONFIG,
  STATUS_ORDER,
  targetKey,
  type SyncStatus,
} from "./sync-status-utils";

interface StatusGroup {
  status: SyncStatus;
  targets: { target: SkillTarget; entry: LastSyncEntry | undefined; key: string }[];
}

export default function SyncInfoBar({
  skillName,
  targets,
  lastSync,
  knownProjects,
  locale,
  siblingsDirty,
}: {
  skillName: string;
  targets: SkillTarget[];
  lastSync: Record<string, LastSyncEntry>;
  knownProjects: KnownProject[];
  locale: Locale;
  siblingsDirty?: boolean;
}) {
  const groups = useMemo<StatusGroup[]>(() => {
    const map = new Map<SyncStatus, StatusGroup["targets"]>();
    for (const tgt of targets) {
      const key = targetKey(tgt);
      const entry = lastSync[key];
      const status = classifyTarget(tgt, entry, knownProjects);
      if (!map.has(status)) map.set(status, []);
      map.get(status)!.push({ target: tgt, entry, key });
    }
    return STATUS_ORDER.filter((s) => map.has(s)).map((status) => ({
      status,
      targets: map.get(status)!,
    }));
  }, [targets, lastSync, knownProjects]);

  const [expanded, setExpanded] = useState<Record<SyncStatus, boolean>>(() => {
    const init: Record<SyncStatus, boolean> = { synced: false, pending: false, missing: false };
    for (const g of groups) {
      if (g.status === "pending" || g.status === "missing") init[g.status] = true;
    }
    return init;
  });

  const toggle = (status: SyncStatus) =>
    setExpanded((prev) => ({ ...prev, [status]: !prev[status] }));

  if (targets.length === 0) return null;

  return (
    <div className="mb-4 text-xs rounded border border-border bg-bg-secondary px-3 py-2">
      <div className="text-text-secondary mb-1.5">
        {t(locale, "skills.syncInfo")}{" "}
        <span className="text-text-primary font-mono">{skillName}</span>
      </div>
      {siblingsDirty && (
        <div className="text-warning text-xs mb-1.5">
          {t(locale, "skills.syncInfoBar.siblingsDirty")}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mb-1">
        {groups.map((g) => {
          const cfg = STATUS_CONFIG[g.status];
          const label = t(locale, `skills.syncInfoBar.${g.status}` as `skills.syncInfoBar.${"synced" | "pending" | "missing"}`);
          return (
            <button
              key={g.status}
              type="button"
              onClick={() => toggle(g.status)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer select-none ${cfg.chipClass}`}
            >
              <span>{cfg.icon}</span>
              <span>{g.targets.length}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {groups.map(
        (g) =>
          expanded[g.status] && (
            <ul key={g.status} className="flex flex-col gap-1 mt-1">
              {g.targets.map((item, i) => (
                <li
                  key={`${item.key}-${i}`}
                  className="grid grid-cols-[1rem_5rem_4rem_1fr] gap-3 items-center"
                >
                  <span className={STATUS_CONFIG[g.status].chipClass.split(" ")[0]}>
                    {STATUS_CONFIG[g.status].icon}
                  </span>
                  <span className="capitalize">{item.target.agent}</span>
                  <span className="text-text-secondary">
                    {item.target.scope === "project"
                      ? t(locale, "skills.addTargetDialog.scopeProject")
                      : t(locale, "skills.addTargetDialog.scopeGlobal")}
                  </span>
                  <span className={g.status === "missing" ? "text-danger" : "text-text-secondary"}>
                    {g.status === "missing"
                      ? t(locale, "skills.projectNotFound")
                      : item.entry
                        ? formatLocalTime(item.entry.at)
                        : t(locale, "skills.notSynced")}
                  </span>
                </li>
              ))}
            </ul>
          ),
      )}
    </div>
  );
}

function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
