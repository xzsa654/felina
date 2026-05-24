import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Download } from "lucide-react";
import { api } from "$lib/tauri/commands";
import type {
  AgentId,
  ImportCandidate,
  KnownProject,
  SkillListEntry,
} from "$lib/types";
import { normalizeProjectPath } from "$lib/utils/path";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";

interface Props {
  project: KnownProject | null;
  /** Called after an import so the page can re-stat projects. */
  onChanged: () => void;
}

const AGENTS: AgentId[] = ["anthropic", "codex", "gemini"];
const AGENT_CHIP_LABEL: Record<AgentId, string> = {
  anthropic: "claude",
  codex: "codex",
  gemini: "gemini",
};

interface InventoryRow {
  skillName: string;
  /** A global canonical master has a target pointing at this project. */
  managed: boolean;
  /** Agents whose on-disk agent dir under this project contains the skill. */
  agentsPresent: Set<AgentId>;
  /** Scan candidate (for the Import action); null when managed-only / deferred-absent. */
  candidate: ImportCandidate | null;
  /** Multi-source candidate that cannot be imported in this version. */
  deferred: boolean;
}

/** Agents a scan candidate covers: its multi-source list, or its single source. */
function candidateAgents(c: ImportCandidate): AgentId[] {
  return c.deferred ? c.deferred.agents : [c.sourceAgent];
}

/** A row's action kind, used as the secondary sort key. */
function actionRank(r: InventoryRow): number {
  if (!r.managed && !r.deferred) return 0; // import (Unmanaged, importable)
  if (r.managed) return 1; // edit (Managed → click to edit)
  return 2; // multi-source (deferred, not importable)
}

/**
 * Row order: status first (Managed before Unmanaged), then action
 * (import → edit → multi-source), then alphabetical by skill name.
 */
function compareRows(a: InventoryRow, b: InventoryRow): number {
  const statusA = a.managed ? 0 : 1;
  const statusB = b.managed ? 0 : 1;
  if (statusA !== statusB) return statusA - statusB;
  const actA = actionRank(a);
  const actB = actionRank(b);
  if (actA !== actB) return actA - actB;
  return a.skillName.localeCompare(b.skillName);
}

export default function ManagedInventory({ project, onChanged }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const navigate = useNavigate();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  // Names of existing global canonical masters — used to detect collisions
  // before a per-row import silently overwrites one.
  const [globalNames, setGlobalNames] = useState<Set<string>>(new Set());
  const [pendingImport, setPendingImport] = useState<InventoryRow | null>(null);

  const projectPath = project?.path ?? null;
  const projectExists = project?.exists ?? false;

  const load = useCallback(async () => {
    if (!projectPath || !projectExists) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [scan, canonical] = await Promise.all([
        api.skillImport.scan(projectPath),
        api.canonicalSkills.list(),
      ]);

      // Managed names: canonical masters with a target at this project.
      // Also collect ALL global master names for import collision detection.
      const want = normalizeProjectPath(projectPath);
      const managedNames = new Set<string>();
      const allGlobalNames = new Set<string>();
      for (const e of canonical as SkillListEntry[]) {
        if (e.kind !== "ok") continue;
        allGlobalNames.add(e.skill.name);
        const hit = e.skill.targets.some(
          (tgt) => tgt.scope === "project" && normalizeProjectPath(tgt.project ?? "") === want,
        );
        if (hit) managedNames.add(e.skill.name);
      }

      // Per-agent on-disk presence + importable candidate, from the scan.
      const presence = new Map<string, Set<AgentId>>();
      const candMap = new Map<string, ImportCandidate>();
      for (const c of scan) {
        candMap.set(c.skillName, c);
        const set = presence.get(c.skillName) ?? new Set<AgentId>();
        for (const a of candidateAgents(c)) set.add(a);
        presence.set(c.skillName, set);
      }

      // Union of scan names ∪ managed names.
      const names = new Set<string>([...presence.keys(), ...managedNames]);
      const built: InventoryRow[] = [...names].map((skillName) => {
        const cand = candMap.get(skillName) ?? null;
        return {
          skillName,
          managed: managedNames.has(skillName),
          agentsPresent: presence.get(skillName) ?? new Set<AgentId>(),
          candidate: cand,
          deferred: cand?.deferred != null,
        };
      });
      built.sort(compareRows);

      setRows(built);
      setGlobalNames(allGlobalNames);
    } catch (e) {
      setError(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectPath, projectExists]);

  useEffect(() => {
    void load();
  }, [load]);

  // Entry point: if a global master with the same name already exists,
  // importing would overwrite it — confirm first instead of silently
  // clobbering. Otherwise import directly.
  function handleImport(row: InventoryRow) {
    if (!row.candidate || row.deferred || !projectPath) return;
    if (globalNames.has(row.skillName)) {
      setPendingImport(row);
      return;
    }
    void performImport(row);
  }

  async function performImport(row: InventoryRow) {
    if (!row.candidate || row.deferred || !projectPath) return;
    setImporting(row.skillName);
    try {
      await api.skillImport.apply(
        [{ candidate: row.candidate, resolution: { kind: "overwriteCanonical" } }],
        projectPath,
      );
      await load();
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(null);
    }
  }

  function openSkill(name: string) {
    navigate(`/skills?select=${encodeURIComponent(name)}`);
  }

  if (!project) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        {t(locale, "projects.selectProject")}
      </div>
    );
  }

  if (!projectExists) {
    return (
      <div className="p-6 text-sm text-red-400">
        {t(locale, "projects.notFoundMessage", { path: project.path })}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {error && (
        <div className="m-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-4 text-sm text-text-secondary">{t(locale, "projects.loadingInventory")}</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-text-secondary">
          {t(locale, "projects.emptyInventory")}
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border">
              <th className="text-left font-medium px-3 py-2">{t(locale, "projects.inventory.skill")}</th>
              <th className="text-left font-medium px-3 py-2 w-24">{t(locale, "projects.inventory.status")}</th>
              <th className="text-left font-medium px-3 py-2 w-40">{t(locale, "projects.inventory.agents")}</th>
              <th className="text-right font-medium px-3 py-2 w-40">{t(locale, "projects.inventory.action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.skillName}
                className={`border-b border-border/40 ${
                  row.managed ? "cursor-pointer hover:bg-bg-secondary" : ""
                }`}
                onClick={row.managed ? () => openSkill(row.skillName) : undefined}
              >
                <td className="px-3 py-2 font-mono text-text-primary">{row.skillName}</td>
                <td className="px-3 py-2">
                  {row.managed ? (
                    <span className="text-emerald-400">{t(locale, "projects.inventory.managed")}</span>
                  ) : (
                    <span className="text-text-muted">{t(locale, "projects.inventory.unmanaged")}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {AGENTS.map((a) => {
                      const present = row.agentsPresent.has(a);
                      return (
                        <span
                          key={a}
                          title={`${AGENT_CHIP_LABEL[a]}: ${present ? t(locale, "projects.inventory.present") : t(locale, "projects.inventory.absent")}`}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            present
                              ? "bg-accent/15 border-accent/40 text-accent"
                              : "bg-bg-secondary border-border text-text-muted opacity-50"
                          }`}
                        >
                          {AGENT_CHIP_LABEL[a]}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  {row.managed ? (
                    <span className="inline-flex items-center gap-1 text-text-muted">
                      {t(locale, "projects.inventory.edit")} <ArrowRight size={12} />
                    </span>
                  ) : row.deferred ? (
                    <span className="text-text-muted italic" title={t(locale, "projects.inventory.multiSourceTitle")}>
                      {t(locale, "projects.inventory.multiSource")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleImport(row);
                      }}
                      disabled={importing === row.skillName}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-60"
                    >
                      <Download size={12} />
                      {importing === row.skillName
                        ? t(locale, "projects.inventory.importing")
                        : t(locale, "projects.inventory.importToGlobal")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={pendingImport !== null}
        title={t(locale, "projects.importConflictDialog.title")}
        message={
          pendingImport
            ? t(locale, "projects.importConflictDialog.message", { name: pendingImport.skillName })
            : ""
        }
        confirmLabel={t(locale, "projects.importConflictDialog.confirm")}
        onconfirm={() => {
          const row = pendingImport;
          setPendingImport(null);
          if (row) void performImport(row);
        }}
        oncancel={() => setPendingImport(null)}
      />
    </div>
  );
}
