import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Check, Download, Link2, RefreshCw } from "lucide-react";
import { api } from "$lib/tauri/commands";
import type { AgentId, ImportCandidate, KnownProject, SkillListEntry, SkillTarget } from "$lib/types";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { useLocaleStore } from "$lib/stores/locale";
import { t, type Locale } from "$lib/i18n";
import { normalizeProjectPath } from "$lib/utils/path";
import { buildInventoryRows, type InventoryRow } from "./managed-inventory";
import claudeIcon from "$lib/assets/claude.svg";
import codexIcon from "$lib/assets/codex.png";
import antigravityIcon from "$lib/assets/antigravity.png";

interface Props {
  project: KnownProject | null;
  onChanged: () => void;
}

interface PendingLink {
  skillName: string;
  sourceIndex: number | null;
}

const AGENT_ICON: Record<AgentId, string> = {
  anthropic: claudeIcon,
  codex: codexIcon,
  gemini: antigravityIcon,
};

const RELATIONSHIP_CLASS: Record<InventoryRow["relationship"], string> = {
  managedProject: "text-success",
  canonicalGlobalOnly: "text-warning",
  canonicalExistsUnlinked: "text-info",
  localOnly: "text-text-muted",
};

export default function ManagedInventory({ project, onChanged }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const navigate = useNavigate();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<InventoryRow | null>(null);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [linkErrorBySkill, setLinkErrorBySkill] = useState<Record<string, string>>({});
  const [drawerSkill, setDrawerSkill] = useState<string | null>(null);
  const [drawerSelectedSourceIndex, setDrawerSelectedSourceIndex] = useState<number>(0);
  const drawerRef = useRef<HTMLDivElement>(null);

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

      setRows(buildInventoryRows(projectPath, scan, canonical));
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

  useEffect(() => {
    if (!drawerSkill) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerSkill(null);
    }
    function onClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerSkill(null);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [drawerSkill]);

  const managedCount = useMemo(
    () => rows.filter((row) => row.relationship === "managedProject").length,
    [rows],
  );
  const actionableCount = rows.length - managedCount;
  const projectName = useMemo(() => {
    if (!projectPath) return "";
    const segs = projectPath.replace(/\\/g, "/").split("/").filter(Boolean);
    return segs[segs.length - 1] ?? projectPath;
  }, [projectPath]);

  function openSkill(name: string) {
    navigate(`/skills?select=${encodeURIComponent(name)}`);
  }

  function sourceCandidate(row: InventoryRow, sourceIndex: number | null): ImportCandidate | null {
    if (!row.candidate) return null;
    if (!row.candidate.deferred || sourceIndex === null) return row.candidate;
    return row.candidate.deferred.candidates[sourceIndex] ?? null;
  }

  function firstSourceIndex(row: InventoryRow): number | null {
    return row.detectedSources[0]?.attributions[0]?.sourceIndex ?? null;
  }

  function linkConflictCandidate(row: InventoryRow, sourceIndex: number | null): ImportCandidate | null {
    const selected = sourceCandidate(row, sourceIndex);
    if (selected?.conflict?.diffSummary) return selected;
    if (row.candidate?.conflict?.diffSummary) return row.candidate;
    return null;
  }

  function handleImport(row: InventoryRow) {
    if (!row.candidate || !projectPath) return;
    if (row.deferred) {
      toggleDrawer(row);
      return;
    }
    if (row.canonicalExists) {
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
      setDrawerSkill(null);
      await load();
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(null);
    }
  }

  function handleLink(row: InventoryRow) {
    const sourceIndex = firstSourceIndex(row);
    const selected = linkConflictCandidate(row, sourceIndex);
    if (!selected?.conflict?.diffSummary) {
      setPendingLink(null);
      setLinkErrorBySkill((prev) => ({
        ...prev,
        [row.skillName]: t(locale, "projects.inventory.link.missingDiff"),
      }));
      return;
    }
    setLinkErrorBySkill((prev) => {
      const next = { ...prev };
      delete next[row.skillName];
      return next;
    });
    setPendingLink({ skillName: row.skillName, sourceIndex });
  }

  async function confirmLink(row: InventoryRow, sourceIndex: number | null) {
    if (!projectPath || !row.canonicalId) return;
    const selected = sourceCandidate(row, sourceIndex);
    if (!selected) return;

    setImporting(row.skillName);
    try {
      const canonical = await api.canonicalSkills.list();
      const entry = findCanonicalEntry(canonical, row.canonicalId, row.skillName);
      if (!entry || entry.kind !== "ok") {
        setError(t(locale, "projects.inventory.link.canonicalMissing"));
        setPendingLink(null);
        await load();
        return;
      }

      const normalizedProject = normalizeProjectPath(projectPath);
      const nextTarget: SkillTarget = {
        agent: selected.sourceAgent,
        scope: "project",
        project: projectPath,
        enabled: true,
        mode: "manual",
      };
      const exists = entry.skill.targets.some(
        (target) =>
          target.agent === nextTarget.agent &&
          target.scope === "project" &&
          normalizeProjectPath(target.project ?? "") === normalizedProject,
      );
      const targets = exists ? entry.skill.targets : [...entry.skill.targets, nextTarget];

      if (!exists) {
        await api.skillTargets.set(row.canonicalId, targets);
      }
      setPendingLink(null);
      await load();
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(null);
    }
  }

  function toggleDrawer(row: InventoryRow) {
    if (drawerSkill === row.skillName) {
      setDrawerSkill(null);
      return;
    }
    const sourceIndex = firstSourceIndex(row) ?? 0;
    setDrawerSkill(row.skillName);
    setDrawerSelectedSourceIndex(sourceIndex);
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
    <div className="flex h-full flex-col overflow-y-auto">
      {error && (
        <div className="m-3 rounded bg-danger-dim px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      <div className="px-4 pb-2 pt-4">
        <h2 className="truncate text-xl font-bold">{projectName}</h2>
        <p className="mt-0.5 text-sm text-text-secondary">
          {managedCount} {t(locale, "projects.inventory.sectionManaged")} / {actionableCount}{" "}
          {t(locale, "projects.inventory.sectionDiscovered")}
        </p>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-text-secondary">{t(locale, "projects.loadingInventory")}</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-text-secondary">
          {t(locale, "projects.emptyInventory")}
        </div>
      ) : (
        <div className="flex flex-col gap-1 px-4 pb-4 text-xs">
          {rows.map((row) => (
            <InventoryListRow
              key={row.skillName}
              row={row}
              locale={locale}
              importing={importing}
              linkError={linkErrorBySkill[row.skillName] ?? null}
              onOpenSkill={() => openSkill(row.canonicalId ?? row.skillName)}
              onImport={() => handleImport(row)}
              onOverwrite={() => setPendingImport(row)}
              onLink={() => handleLink(row)}
              onToggleDrawer={() => toggleDrawer(row)}
            />
          ))}
        </div>
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

      <ActionDialogs
        locale={locale}
        importing={importing}
        pendingLink={pendingLink}
        drawerSkill={drawerSkill}
        drawerSelectedSourceIndex={drawerSelectedSourceIndex}
        rows={rows}
        onCancelLink={() => setPendingLink(null)}
        onConfirmLink={(sourceIndex) => {
          const row = rows.find((r) => r.skillName === pendingLink?.skillName);
          if (row) void confirmLink(row, sourceIndex);
        }}
        onSelectSource={setDrawerSelectedSourceIndex}
        onCancelMultiSource={() => setDrawerSkill(null)}
        onConfirmMultiSource={() => {
          const row = rows.find((r) => r.skillName === drawerSkill);
          if (row) void performMultiSourceImport(row, drawerSelectedSourceIndex);
        }}
      />
    </div>
  );
}

function InventoryListRow({
  row,
  locale,
  importing,
  linkError,
  onOpenSkill,
  onImport,
  onOverwrite,
  onLink,
  onToggleDrawer,
}: {
  row: InventoryRow;
  locale: Locale;
  importing: string | null;
  linkError: string | null;
  onOpenSkill: () => void;
  onImport: () => void;
  onOverwrite: () => void;
  onLink: () => void;
  onToggleDrawer: () => void;
}) {
  const rowClick = row.relationship === "managedProject" ? onOpenSkill : undefined;

  return (
    <div className="rounded px-3 py-2 hover:bg-bg-secondary/20">
      <div
        className={`flex flex-col gap-2 md:flex-row md:items-start md:justify-between ${
          rowClick ? "cursor-pointer" : ""
        }`}
        onClick={rowClick}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className={`flex shrink-0 items-center gap-1 text-[11px] font-medium ${RELATIONSHIP_CLASS[row.relationship]}`}>
              {row.relationship === "managedProject" && <Check size={12} />}
              <span>{t(locale, `projects.inventory.relationship.${row.relationship}`)}</span>
            </div>

            <span className="min-w-0 truncate font-mono text-sm font-medium text-text-primary">
              {row.skillName}
            </span>

            <div className="flex shrink-0 items-center gap-1 text-[11px] text-text-muted">
              {Array.from(new Set(row.detectedSources.flatMap((s) => s.agents))).map((agent) => (
                <AgentIcon key={agent} agent={agent as AgentId} />
              ))}
            </div>

            {row.deferred && (
              <span className="shrink-0 text-[11px] text-accent">
                {t(locale, "projects.inventory.multiSource")}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 md:justify-end" onClick={(e) => e.stopPropagation()}>
          {row.relationship === "managedProject" ? (
            <button
              type="button"
              onClick={onOpenSkill}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-text-muted hover:bg-bg-secondary/40 hover:text-text-primary"
            >
              <Check size={12} />
              {t(locale, "projects.inventory.edit")}
              <ArrowRight size={12} />
            </button>
          ) : row.relationship === "canonicalGlobalOnly" || row.relationship === "canonicalExistsUnlinked" ? (
            <>
              <button
                type="button"
                onClick={onLink}
                disabled={importing === row.skillName || !row.candidate}
                className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-white hover:bg-accent-hover disabled:opacity-60"
              >
                <Link2 size={12} />
                {importing === row.skillName
                  ? t(locale, "projects.inventory.linking")
                  : t(locale, "projects.inventory.linkToProject")}
              </button>
              {row.candidate && !row.deferred && (
                <button
                  type="button"
                  onClick={onOverwrite}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-text-muted hover:bg-bg-secondary/40 hover:text-text-primary"
                >
                  <RefreshCw size={12} />
                  {t(locale, "projects.inventory.overwriteSecondary")}
                </button>
              )}
            </>
          ) : row.deferred ? (
            <button
              type="button"
              onClick={onToggleDrawer}
              className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-white hover:bg-accent-hover"
            >
              <Download size={12} />
              {t(locale, "projects.inventory.importToGlobal")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onImport}
              disabled={importing === row.skillName}
              className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-white hover:bg-accent-hover disabled:opacity-60"
            >
              <Download size={12} />
              {importing === row.skillName
                ? t(locale, "projects.inventory.importing")
                : t(locale, "projects.inventory.importToGlobal")}
            </button>
          )}
        </div>
      </div>

      {linkError && (
        <div className="mt-2 rounded bg-danger-dim px-3 py-2 text-xs text-danger">{linkError}</div>
      )}
    </div>
  );
}



function AgentIcon({ agent }: { agent: AgentId }) {
  return <img src={AGENT_ICON[agent]} alt={agent} title={agent} className="h-3.5 w-3.5 shrink-0" />;
}



function linkCandidateForRow(row: InventoryRow, sourceIndex: number | null): ImportCandidate | null {
  if (!row.candidate) return null;
  if (!row.candidate.deferred || sourceIndex === null) return row.candidate;
  return row.candidate.deferred.candidates[sourceIndex] ?? null;
}

function linkConflictCandidateForRow(row: InventoryRow, sourceIndex: number | null): ImportCandidate | null {
  const selected = linkCandidateForRow(row, sourceIndex);
  if (selected?.conflict?.diffSummary) return selected;
  if (row.candidate?.conflict?.diffSummary) return row.candidate;
  return null;
}

function findCanonicalEntry(
  entries: SkillListEntry[],
  canonicalId: string,
  skillName: string,
): SkillListEntry | null {
  return (
    entries.find((entry) => entry.canonicalId === canonicalId) ??
    entries.find((entry) => entry.kind === "ok" && entry.skill.name === skillName) ??
    entries.find((entry) => entry.kind === "broken" && entry.name === skillName) ??
    null
  );
}

function ActionDialogs({
  locale,
  importing,
  pendingLink,
  drawerSkill,
  drawerSelectedSourceIndex,
  rows,
  onCancelLink,
  onConfirmLink,
  onSelectSource,
  onCancelMultiSource,
  onConfirmMultiSource,
}: {
  locale: Locale;
  importing: string | null;
  pendingLink: PendingLink | null;
  drawerSkill: string | null;
  drawerSelectedSourceIndex: number;
  rows: InventoryRow[];
  onCancelLink: () => void;
  onConfirmLink: (sourceIndex: number | null) => void;
  onSelectSource: (index: number) => void;
  onCancelMultiSource: () => void;
  onConfirmMultiSource: () => void;
}) {
  const linkRow = pendingLink ? rows.find((r) => r.skillName === pendingLink.skillName) : null;
  const linkCandidate = linkRow && pendingLink ? linkConflictCandidateForRow(linkRow, pendingLink.sourceIndex) : null;
  
  const drawerRow = drawerSkill ? rows.find((r) => r.skillName === drawerSkill) : null;

  return (
    <>
      {pendingLink && linkCandidate?.conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 cursor-default bg-black/50" onClick={onCancelLink} aria-label="Close dialog" />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-text-primary">{t(locale, "projects.inventory.link.title")}</h3>
            <div className="mt-4 flex flex-1 flex-col overflow-hidden text-sm text-text-secondary">
              <p className="mb-3 whitespace-pre-wrap">{t(locale, "projects.inventory.link.message", { name: pendingLink.skillName })}</p>
              <div className="mb-2 truncate font-mono text-xs text-text-muted" title={linkCandidate.conflict.canonicalPath}>
                {linkCandidate.conflict.canonicalPath}
              </div>
              {linkCandidate.conflict.hunks.length > 0 ? (
                <div className="mb-2 flex items-center gap-3 text-[11px] text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-sm bg-danger-dim" />
                    <span>− {t(locale, "projects.inventory.link.diffBase")}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-sm bg-success-dim" />
                    <span>+ {t(locale, "projects.inventory.link.diffIncoming")}</span>
                  </span>
                </div>
              ) : null}
              {linkCandidate.conflict.hunks.length > 0 ? (
                <div className="flex-1 overflow-y-auto rounded border border-border bg-bg-secondary">
                  {linkCandidate.conflict.hunks.map((hunk, hi) => (
                    <div key={hi} className="border-b border-border last:border-b-0">
                      <div className="bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-muted">
                        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
                      </div>
                      {hunk.lines.map((line, li) => (
                        <div
                          key={li}
                          className={`whitespace-pre-wrap break-all px-2 font-mono text-xs ${
                            line.kind === "delete"
                              ? "bg-danger-dim text-text-primary"
                              : line.kind === "add"
                                ? "bg-success-dim text-text-primary"
                                : "text-text-secondary"
                          }`}
                        >
                          <span className="inline-block w-4 select-none text-text-muted">
                            {line.kind === "delete" ? "−" : line.kind === "add" ? "+" : " "}
                          </span>
                          {line.content.replace(/\n$/, "")}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded bg-bg-tertiary p-3 font-mono text-xs text-text-muted">
                  {linkCandidate.conflict.diffSummary}
                </div>
              )}
            </div>
            <div className="mt-6 flex shrink-0 justify-end gap-2">
              <button
                type="button"
                onClick={onCancelLink}
                className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
              >
                {t(locale, "common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => onConfirmLink(pendingLink.sourceIndex)}
                disabled={importing === pendingLink.skillName}
                className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-60"
              >
                <Link2 size={16} />
                {t(locale, "projects.inventory.link.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {drawerRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 cursor-default bg-black/50" onClick={onCancelMultiSource} aria-label="Close dialog" />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-text-primary">{t(locale, "projects.inventory.drawer.selectSource")}</h3>
            <div className="mt-4 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-3">
                {drawerRow.detectedSources.map((source) => (
                  <div key={source.sourcePath} className="rounded-lg border border-border bg-bg-tertiary p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {source.attributions.length > 1
                          ? t(locale, "projects.inventory.sharedSource")
                          : t(locale, "projects.inventory.source")}
                      </span>
                      {source.agents.map((agent) => (
                        <AgentIcon key={agent} agent={agent} />
                      ))}
                    </div>
                    <div className="mb-3 truncate font-mono text-xs text-text-muted" title={source.sourcePath}>
                      {source.sourcePath}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {source.attributions.map((attribution) => (
                        <button
                          type="button"
                          key={`${source.sourcePath}-${attribution.sourceIndex}`}
                          onClick={() => onSelectSource(attribution.sourceIndex)}
                          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                            drawerSelectedSourceIndex === attribution.sourceIndex
                              ? "bg-accent text-white"
                              : "bg-bg-hover text-text-secondary hover:bg-bg-secondary/70"
                          }`}
                        >
                          <AgentIcon agent={attribution.agent} />
                          {t(locale, "projects.inventory.attribution", { agent: attribution.agent })}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex shrink-0 justify-end gap-2">
              <button
                type="button"
                onClick={onCancelMultiSource}
                className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
              >
                {t(locale, "common.cancel")}
              </button>
              <button
                type="button"
                disabled={importing === drawerRow.skillName}
                onClick={onConfirmMultiSource}
                className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-60"
              >
                <Download size={16} />
                {importing === drawerRow.skillName
                  ? t(locale, "projects.inventory.importing")
                  : t(locale, "projects.inventory.drawer.confirmImport")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
