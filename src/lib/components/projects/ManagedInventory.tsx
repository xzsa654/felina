import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Check, ChevronDown, ChevronRight, Download, HelpCircle } from "lucide-react";
import { api } from "$lib/tauri/commands";
import type { AgentId, KnownProject } from "$lib/types";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import InfoDialog from "$lib/components/shared/InfoDialog";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { buildInventoryRows, type InventoryRow } from "./managed-inventory";
import claudeIcon from "$lib/assets/claude.svg";
import codexIcon from "$lib/assets/codex.png";
import antigravityIcon from "$lib/assets/antigravity.png";

interface Props {
  project: KnownProject | null;
  onChanged: () => void;
}

const AGENTS: AgentId[] = ["anthropic", "codex", "gemini"];
const AGENT_ICON: Record<AgentId, string> = {
  anthropic: claudeIcon,
  codex: codexIcon,
  gemini: antigravityIcon,
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
  const [helpOpen, setHelpOpen] = useState(false);

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

  const discovered = useMemo(() => rows.filter((r) => r.candidate && !r.managed), [rows]);
  const managed = useMemo(() => rows.filter((r) => r.managed), [rows]);
  const projectName = useMemo(() => {
    if (!projectPath) return "";
    const segs = projectPath.replace(/\\/g, "/").split("/").filter(Boolean);
    return segs[segs.length - 1] ?? projectPath;
  }, [projectPath]);

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
    <div className="flex flex-col h-full overflow-y-auto">
      {error && (
        <div className="m-3 text-xs text-danger bg-danger-dim border border-danger/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* --- Project Summary Header --- */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold truncate">{projectName}</h2>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="p-0.5 text-text-muted hover:text-text-secondary shrink-0"
            aria-label={t(locale, "projects.inventory.help.title")}
          >
            <HelpCircle size={14} />
          </button>
        </div>
        <p className="text-sm text-text-secondary mt-0.5">
          {discovered.length} {t(locale, "projects.inventory.sectionDiscovered")} · {managed.length} {t(locale, "projects.inventory.sectionManaged")}
        </p>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-text-secondary">{t(locale, "projects.loadingInventory")}</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-text-secondary">
          {t(locale, "projects.emptyInventory")}
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 pb-4 text-xs">
          {/* --- Discovered Section --- */}
          {discovered.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
                {t(locale, "projects.inventory.sectionDiscovered")}
              </h4>
              <div className="flex flex-col gap-1">
                {discovered.map((row) => {
                  const multiExpanded = row.deferred && row.candidate?.deferred && expandedMulti[row.skillName];
                  const multiSources = row.candidate?.deferred?.candidates ?? [];
                  const chosenSource = selectedSource[row.skillName];
                  return (
                    <div key={row.skillName}>
                      <div className="grid items-center px-3 py-2 hover:bg-bg-secondary/50 rounded" style={{ gridTemplateColumns: "auto 1fr 5rem 9rem", gap: "0.75rem" }}>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/15 text-info">{t(locale, "projects.inventory.badgeNew")}</span>
                        <span className="font-mono text-text-primary truncate">{row.skillName}</span>
                        <div className="flex gap-1 justify-center">
                          {AGENTS.map((a) => {
                            if (!row.agentsPresent.has(a)) return null;
                            return (
                              <img key={a} src={AGENT_ICON[a]} alt={a} className="w-4 h-4" title={a} />
                            );
                          })}
                        </div>
                        <div className="justify-self-end">
                        {row.deferred && row.candidate?.deferred ? (
                          <button
                            type="button"
                            onClick={() => setExpandedMulti((prev) => ({ ...prev, [row.skillName]: !prev[row.skillName] }))}
                            className="inline-flex items-center gap-1 text-accent hover:text-accent-hover"
                          >
                            {expandedMulti[row.skillName] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {t(locale, "projects.inventory.multiSource")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleImport(row)}
                            disabled={importing === row.skillName}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-60"
                          >
                            <Download size={12} />
                            {importing === row.skillName
                              ? t(locale, "projects.inventory.importing")
                              : t(locale, "projects.inventory.importToGlobal")}
                          </button>
                        )}
                        </div>
                      </div>
                      {multiExpanded && (
                        <div className="ml-6 mt-1 mb-2 flex flex-wrap gap-2 items-center">
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
                              <img src={AGENT_ICON[source.sourceAgent] ?? ""} alt={source.sourceAgent} className="w-3.5 h-3.5" />
                              <span className="font-mono text-[10px] text-text-muted truncate max-w-[12rem]" title={source.sourcePath}>
                                {source.sourcePath}
                              </span>
                            </label>
                          ))}
                          <button
                            type="button"
                            disabled={chosenSource === undefined || importing === row.skillName}
                            onClick={() => { if (chosenSource !== undefined) void performMultiSourceImport(row, chosenSource); }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-60 text-xs"
                          >
                            <Download size={12} />
                            {importing === row.skillName
                              ? t(locale, "projects.inventory.importing")
                              : t(locale, "projects.inventory.importToGlobal")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- Managed Section --- */}
          {managed.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
                {t(locale, "projects.inventory.sectionManaged")}
              </h4>
              <div className="flex flex-col gap-1">
                {managed.map((row) => {
                  const navTarget = row.canonicalId ?? row.skillName;
                  return (
                    <div
                      key={row.skillName}
                      className="grid items-center px-3 py-2 hover:bg-bg-secondary/50 rounded cursor-pointer"
                      style={{ gridTemplateColumns: "auto 1fr 5rem 9rem", gap: "0.75rem" }}
                      onClick={() => openSkill(navTarget)}
                    >
                      <Check size={12} className="text-success" />
                      <span className="font-mono text-text-primary truncate">{row.skillName}</span>
                      <div className="flex gap-1 justify-center">
                        {AGENTS.map((a) => {
                          if (!row.agentsPresent.has(a)) return null;
                          return (
                            <img key={a} src={AGENT_ICON[a]} alt={a} className="w-4 h-4" title={a} />
                          );
                        })}
                      </div>
                      <span className="inline-flex items-center gap-1 text-text-muted justify-self-end">
                        {t(locale, "projects.inventory.edit")} <ArrowRight size={12} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <InfoDialog
        open={helpOpen}
        title={t(locale, "projects.inventory.help.title")}
        onClose={() => setHelpOpen(false)}
        content={
          (() => {
            const text = t(locale, "projects.inventory.help.multiSource");
            const dashIdx = text.indexOf("—");
            if (dashIdx === -1) return <p>{text}</p>;
            return (
              <p>
                <strong>{text.slice(0, dashIdx).trim()}</strong>
                {" — "}
                {text.slice(dashIdx + 1).trim()}
              </p>
            );
          })()
        }
      />
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
