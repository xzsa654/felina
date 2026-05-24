import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Download, PackageOpen } from "lucide-react";
import { api } from "$lib/tauri/commands";
import type {
  AgentId,
  ImportCandidate,
  KnownProject,
  MigrationCandidate,
  SkillListEntry,
} from "$lib/types";
import { normalizeProjectPath } from "$lib/utils/path";
import MigrationPanel from "./MigrationPanel";

interface Props {
  project: KnownProject | null;
  /** Called after an import / migration so the page can re-stat projects. */
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

export default function ManagedInventory({ project, onChanged }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [legacyCandidates, setLegacyCandidates] = useState<MigrationCandidate[]>([]);
  const [migrationOpen, setMigrationOpen] = useState(false);

  const projectPath = project?.path ?? null;
  const projectExists = project?.exists ?? false;

  const load = useCallback(async () => {
    if (!projectPath || !projectExists) {
      setRows([]);
      setLegacyCandidates([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [scan, canonical, legacy] = await Promise.all([
        api.skillImport.scan(projectPath),
        api.canonicalSkills.list(),
        api.migration.scan(),
      ]);

      // Managed names: canonical masters with a target at this project.
      const want = normalizeProjectPath(projectPath);
      const managedNames = new Set<string>();
      for (const e of canonical as SkillListEntry[]) {
        if (e.kind !== "ok") continue;
        const hit = e.skill.targets.some(
          (t) => t.scope === "project" && normalizeProjectPath(t.project ?? "") === want,
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
      const built: InventoryRow[] = [...names].sort().map((skillName) => {
        const cand = candMap.get(skillName) ?? null;
        return {
          skillName,
          managed: managedNames.has(skillName),
          agentsPresent: presence.get(skillName) ?? new Set<AgentId>(),
          candidate: cand,
          deferred: cand?.deferred != null,
        };
      });

      setRows(built);
      setLegacyCandidates(
        legacy.filter((l) => normalizeProjectPath(l.projectPath) === want),
      );
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

  async function handleImport(row: InventoryRow) {
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

  const hasLegacy = legacyCandidates.length > 0;

  if (!project) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Select a project on the left to see its skill inventory.
      </div>
    );
  }

  if (!projectExists) {
    return (
      <div className="p-6 text-sm text-red-400">
        找不到該 project 資料夾（{project.path}）。請還原資料夾，或在 Known
        Projects 中移除此條目。
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {hasLegacy && (
        <div className="m-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-amber-300">
              此 project 有 {legacyCandidates.length} 個舊版 project 主檔（
              <code>.felina/skills/</code>），可一鍵 migrate 到 global。
            </span>
            <button
              type="button"
              onClick={() => setMigrationOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shrink-0"
            >
              <PackageOpen size={12} /> Migrate…
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="m-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-4 text-sm text-text-secondary">Loading inventory…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-text-secondary">
          此 project 沒有任何已納管或散落的 skill。
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border">
              <th className="text-left font-medium px-3 py-2">Skill</th>
              <th className="text-left font-medium px-3 py-2 w-24">Status</th>
              <th className="text-left font-medium px-3 py-2 w-40">Agents</th>
              <th className="text-right font-medium px-3 py-2 w-40">Action</th>
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
                    <span className="text-emerald-400">Managed</span>
                  ) : (
                    <span className="text-text-muted">Unmanaged</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {AGENTS.map((a) => {
                      const present = row.agentsPresent.has(a);
                      return (
                        <span
                          key={a}
                          title={`${AGENT_CHIP_LABEL[a]}: ${present ? "present" : "absent"}`}
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
                      Edit <ArrowRight size={12} />
                    </span>
                  ) : row.deferred ? (
                    <span className="text-text-muted italic" title="多來源 skill，import 由後續 change 處理">
                      multi-source
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
                      {importing === row.skillName ? "Importing…" : "Import to global"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {migrationOpen && projectPath && (
        <MigrationPanel
          projectPath={projectPath}
          candidates={legacyCandidates}
          onClose={() => setMigrationOpen(false)}
          onApplied={async () => {
            setMigrationOpen(false);
            await load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
