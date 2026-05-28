import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ChevronDown, ChevronRight, Download } from "lucide-react";
import { api } from "$lib/tauri/commands";
import type { AgentId, KnownProject } from "$lib/types";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { buildInventoryRows, type InventoryRow } from "./managed-inventory";

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
  const [expandedMulti, setExpandedMulti] = useState<Record<string, boolean>>({});
  const [selectedSource, setSelectedSource] = useState<Record<string, number>>({});

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

      const built = buildInventoryRows(projectPath, scan, canonical);

      const allGlobalNames = new Set<string>();
      for (const e of canonical) {
        if (e.kind === "ok") allGlobalNames.add(e.skill.name);
      }

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

  async function performMultiSourceImport(row: InventoryRow, sourceIndex: number) {
    if (!row.candidate?.deferred || !projectPath) return;
    const source = row.candidate.deferred.candidates[sourceIndex];
    if (!source) return;
    setImporting(row.skillName);
    try {
      await api.skillImport.apply(
        [{ candidate: row.candidate, resolution: { kind: "selectSource", sourceIndex } }],
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
      <div className="p-6 text-sm text-danger">
        {t(locale, "projects.notFoundMessage", { path: project.path })}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {error && (
        <div className="m-3 text-xs text-danger bg-danger-dim border border-danger/30 rounded px-3 py-2">
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
            {rows.map((row) => {
              const clickable = row.managed || row.canonicalExists;
              const navTarget = row.canonicalId ?? row.skillName;
              const multiExpanded = row.deferred && row.candidate?.deferred && expandedMulti[row.skillName];
              const multiSources = row.candidate?.deferred?.candidates ?? [];
              const chosenSource = selectedSource[row.skillName];
              return (
              <Fragment key={row.skillName}>
              <tr
                className={`border-b border-border/40 ${
                  clickable ? "cursor-pointer hover:bg-bg-secondary" : ""
                }`}
                onClick={clickable ? () => openSkill(navTarget) : undefined}
              >
                <td className="px-3 py-2 font-mono text-text-primary">{row.skillName}</td>
                <td className="px-3 py-2">
                  {row.managed ? (
                    <span className="text-success">{t(locale, "projects.inventory.managed")}</span>
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
                  ) : row.canonicalExists ? (
                    <span className="inline-flex items-center gap-1 text-text-muted">
                      {t(locale, "projects.inventory.edit")} <ArrowRight size={12} />
                    </span>
                  ) : row.deferred && row.candidate?.deferred ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedMulti((prev) => ({ ...prev, [row.skillName]: !prev[row.skillName] }));
                      }}
                      className="inline-flex items-center gap-1 text-accent hover:text-accent-hover"
                    >
                      {expandedMulti[row.skillName] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {t(locale, "projects.inventory.multiSource")}
                    </button>
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
              {multiExpanded && (
                <tr className="border-b border-border/40 bg-bg-secondary">
                  <td colSpan={4} className="px-3 py-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      {multiSources.map((source, si) => (
                        <label
                          key={`${source.sourcePath}-${si}`}
                          className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border cursor-pointer ${
                            chosenSource === si
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border bg-bg-primary text-text-secondary hover:border-accent/60"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`ms-${row.skillName}`}
                            checked={chosenSource === si}
                            onChange={() => setSelectedSource((prev) => ({ ...prev, [row.skillName]: si }))}
                          />
                          {AGENT_CHIP_LABEL[source.sourceAgent] ?? source.sourceAgent}
                          <span className="font-mono text-[10px] text-text-muted truncate max-w-[12rem]" title={source.sourcePath}>
                            {source.sourcePath}
                          </span>
                        </label>
                      ))}
                      <button
                        type="button"
                        disabled={chosenSource === undefined || importing === row.skillName}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (chosenSource !== undefined) void performMultiSourceImport(row, chosenSource);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-60 text-xs"
                      >
                        <Download size={12} />
                        {importing === row.skillName
                          ? t(locale, "projects.inventory.importing")
                          : t(locale, "projects.inventory.importToGlobal")}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
              );
            })}
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
