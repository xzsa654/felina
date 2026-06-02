import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Check, Download, GitMerge, Link2, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { api } from "$lib/tauri/commands";
import type { AgentId, ImportCandidate, KnownProject, SkillListEntry, SkillTarget } from "$lib/types";
import type { DiffHunk } from "$lib/types";
import { useLocaleStore } from "$lib/stores/locale";
import { t, type Locale } from "$lib/i18n";
import { normalizeProjectPath } from "$lib/utils/path";
import {
  buildInventoryRows,
  resolutionOptionsFor,
  type InventoryRow,
  type ResolutionOption,
} from "./managed-inventory";
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

interface PendingOverwrite {
  skillName: string;
  sourceIndex: number | null;
}

type DrawerMode = "import" | "link" | "overwrite";

interface DrawerState {
  skillName: string;
  selectedSourceIndex: number;
  mode: DrawerMode;
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

const NAME_INPUT_RE = /^[A-Za-z0-9_-]+$/;

function isProjectLocalSharedAgents(row: InventoryRow): boolean {
  return row.detectedSources.some((s) => s.sourcePath.includes(".agents/skills"));
}

function detectedAgentForRow(row: InventoryRow, sourceIndex: number | null): AgentId | null {
  if (sourceIndex !== null) {
    for (const src of row.detectedSources) {
      for (const att of src.attributions) {
        if (att.sourceIndex === sourceIndex) return att.agent;
      }
    }
  }
  return row.detectedSources[0]?.attributions[0]?.agent ?? null;
}

export default function ManagedInventory({ project, onChanged }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const navigate = useNavigate();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [pendingResolution, setPendingResolution] = useState<InventoryRow | null>(null);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<PendingOverwrite | null>(null);
  const [pendingRename, setPendingRename] = useState<InventoryRow | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<InventoryRow | null>(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
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
    if (!drawer) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawer(null);
    }
    function onClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawer(null);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [drawer]);

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

  // Same-name resolution dialog routing
  function openResolution(row: InventoryRow) {
    if (resolutionOptionsFor(row).length === 0) return;
    setPendingResolution(row);
  }

  function handleResolutionChoice(row: InventoryRow, option: ResolutionOption) {
    setPendingResolution(null);
    if (option === "link") {
      if (row.deferred) {
        setDrawer({
          skillName: row.skillName,
          selectedSourceIndex: firstSourceIndex(row) ?? 0,
          mode: "link",
        });
        return;
      }
      const sourceIndex = firstSourceIndex(row);
      const selected = linkConflictCandidate(row, sourceIndex);
      if (!selected?.conflict?.diffSummary) {
        setError(t(locale, "projects.inventory.link.missingDiff"));
        return;
      }
      setPendingLink({ skillName: row.skillName, sourceIndex });
    } else if (option === "overwrite") {
      if (row.deferred) {
        setDrawer({
          skillName: row.skillName,
          selectedSourceIndex: firstSourceIndex(row) ?? 0,
          mode: "overwrite",
        });
        return;
      }
      setPendingOverwrite({ skillName: row.skillName, sourceIndex: firstSourceIndex(row) });
    } else if (option === "rename") {
      setPendingRename(row);
    } else if (option === "discard") {
      setPendingDiscard(row);
    }
  }

  // Localonly multi-source import path (unchanged shape, drawer mode="import")
  function handleImport(row: InventoryRow) {
    if (!row.candidate || !projectPath) return;
    if (row.deferred) {
      setDrawer({
        skillName: row.skillName,
        selectedSourceIndex: firstSourceIndex(row) ?? 0,
        mode: "import",
      });
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

  async function performOverwrite(row: InventoryRow, sourceIndex: number | null) {
    if (!row.candidate || !projectPath) return;
    setImporting(row.skillName);
    try {
      if (row.deferred && sourceIndex !== null) {
        await api.skillImport.apply(
          [{ candidate: row.candidate, resolution: { kind: "selectSource", sourceIndex } }],
          projectPath,
        );
      } else {
        await api.skillImport.apply(
          [{ candidate: row.candidate, resolution: { kind: "overwriteCanonical" } }],
          projectPath,
        );
      }
      setPendingOverwrite(null);
      setDrawer(null);
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
    setImporting(row.skillName);
    try {
      await api.skillImport.apply(
        [{ candidate: row.candidate, resolution: { kind: "selectSource", sourceIndex } }],
        projectPath,
      );
      setDrawer(null);
      await load();
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(null);
    }
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
      setDrawer(null);
      await load();
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(null);
    }
  }

  async function performRename(row: InventoryRow, newName: string): Promise<string | null> {
    if (!projectPath) return null;
    const agent = detectedAgentForRow(row, firstSourceIndex(row));
    if (!agent) return "missing agent";
    setImporting(row.skillName);
    try {
      await api.projectLocalSkills.rename(projectPath, agent, row.skillName, newName);
      setPendingRename(null);
      await load();
      onChanged();
      return null;
    } catch (e) {
      return String(e);
    } finally {
      setImporting(null);
    }
  }

  async function performDiscard(row: InventoryRow): Promise<string | null> {
    if (!projectPath) return null;
    const agent = detectedAgentForRow(row, firstSourceIndex(row));
    if (!agent) return "missing agent";
    setImporting(row.skillName);
    try {
      await api.projectLocalSkills.delete(projectPath, agent, row.skillName);
      setPendingDiscard(null);
      await load();
      onChanged();
      return null;
    } catch (e) {
      return String(e);
    } finally {
      setImporting(null);
    }
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
              onOpenSkill={() => openSkill(row.canonicalId ?? row.skillName)}
              onImport={() => handleImport(row)}
              onOpenResolution={() => openResolution(row)}
            />
          ))}
        </div>
      )}

      <SameNameResolutionDialog
        row={pendingResolution}
        locale={locale}
        onCancel={() => setPendingResolution(null)}
        onSelect={(opt) => pendingResolution && handleResolutionChoice(pendingResolution, opt)}
      />

      <RenameProjectLocalDialog
        row={pendingRename}
        projectPath={projectPath}
        locale={locale}
        importing={importing}
        onCancel={() => setPendingRename(null)}
        onConfirm={(newName) =>
          pendingRename ? performRename(pendingRename, newName) : Promise.resolve(null)
        }
      />

      <DiscardProjectLocalDialog
        row={pendingDiscard}
        projectPath={projectPath}
        locale={locale}
        importing={importing}
        onCancel={() => setPendingDiscard(null)}
        onConfirm={() =>
          pendingDiscard ? performDiscard(pendingDiscard) : Promise.resolve(null)
        }
      />

      <OverwriteConflictDialog
        pending={pendingOverwrite}
        rows={rows}
        locale={locale}
        importing={importing}
        onCancel={() => setPendingOverwrite(null)}
        onConfirm={() => {
          if (!pendingOverwrite) return;
          const row = rows.find((r) => r.skillName === pendingOverwrite.skillName);
          if (row) void performOverwrite(row, pendingOverwrite.sourceIndex);
        }}
      />

      <LinkConflictDialog
        pending={pendingLink}
        rows={rows}
        locale={locale}
        importing={importing}
        onCancel={() => setPendingLink(null)}
        onConfirm={() => {
          if (!pendingLink) return;
          const row = rows.find((r) => r.skillName === pendingLink.skillName);
          if (row) void confirmLink(row, pendingLink.sourceIndex);
        }}
      />

      <MultiSourceDrawer
        drawer={drawer}
        rows={rows}
        locale={locale}
        importing={importing}
        drawerRef={drawerRef}
        onCancel={() => setDrawer(null)}
        onSelectSource={(idx) =>
          setDrawer((s) => (s ? { ...s, selectedSourceIndex: idx } : s))
        }
        onConfirm={() => {
          if (!drawer) return;
          const row = rows.find((r) => r.skillName === drawer.skillName);
          if (!row) return;
          if (drawer.mode === "import") {
            void performMultiSourceImport(row, drawer.selectedSourceIndex);
          } else if (drawer.mode === "link") {
            setDrawer(null);
            setPendingLink({
              skillName: row.skillName,
              sourceIndex: drawer.selectedSourceIndex,
            });
          } else {
            setDrawer(null);
            setPendingOverwrite({
              skillName: row.skillName,
              sourceIndex: drawer.selectedSourceIndex,
            });
          }
        }}
      />
    </div>
  );
}

function InventoryListRow({
  row,
  locale,
  importing,
  onOpenSkill,
  onImport,
  onOpenResolution,
}: {
  row: InventoryRow;
  locale: Locale;
  importing: string | null;
  onOpenSkill: () => void;
  onImport: () => void;
  onOpenResolution: () => void;
}) {
  const rowClick = row.relationship === "managedProject" ? onOpenSkill : undefined;
  const isConflict =
    row.relationship === "canonicalGlobalOnly" ||
    row.relationship === "canonicalExistsUnlinked";

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
          ) : isConflict ? (
            <button
              type="button"
              onClick={onOpenResolution}
              disabled={importing === row.skillName || !row.candidate}
              className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-text-secondary hover:border-text-muted hover:text-text-primary disabled:opacity-60"
            >
              <GitMerge size={12} />
              {t(locale, "projects.inventory.resolutionEntry")}
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
    </div>
  );
}

function AgentIcon({ agent }: { agent: AgentId }) {
  return <img src={AGENT_ICON[agent]} alt={agent} title={agent} className="h-3.5 w-3.5 shrink-0" />;
}

function linkConflictCandidateForRow(row: InventoryRow, sourceIndex: number | null): ImportCandidate | null {
  if (!row.candidate) return null;
  const selected =
    row.candidate.deferred && sourceIndex !== null
      ? row.candidate.deferred.candidates[sourceIndex] ?? null
      : row.candidate;
  if (selected?.conflict?.diffSummary) return selected;
  if (row.candidate.conflict?.diffSummary) return row.candidate;
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

// ---------------------------------------------------------------------------
// Shared diff view — direction-aware. Backend hunks are fixed direction
// (old=project source, new=canonical). For Link, base=project / incoming=
// canonical → flip add/delete. For Overwrite, base=canonical / incoming=
// project → render backend direction as-is.
// ---------------------------------------------------------------------------

export function flipHunkLines(hunks: DiffHunk[]): DiffHunk[] {
  return hunks.map((h) => ({
    ...h,
    lines: h.lines.map((l) =>
      l.kind === "add"
        ? { ...l, kind: "delete" as const }
        : l.kind === "delete"
          ? { ...l, kind: "add" as const }
          : l,
    ),
  }));
}

function ConflictDiffView({
  hunks,
  diffSummary,
  canonicalPath,
  direction,
  locale,
}: {
  hunks: DiffHunk[];
  diffSummary: string;
  canonicalPath: string;
  direction: "link" | "overwrite";
  locale: Locale;
}) {
  const rendered = direction === "link" ? flipHunkLines(hunks) : hunks;
  const baseKey =
    direction === "link"
      ? "projects.inventory.link.diffBase"
      : "projects.importConflictDialog.diffBase";
  const incomingKey =
    direction === "link"
      ? "projects.inventory.link.diffIncoming"
      : "projects.importConflictDialog.diffIncoming";

  return (
    <>
      <div className="mb-2 truncate font-mono text-xs text-text-muted" title={canonicalPath}>
        {canonicalPath}
      </div>
      {rendered.length > 0 ? (
        <>
          <div className="mb-2 flex items-center gap-3 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-danger-dim" />
              <span>− {t(locale, baseKey)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-success-dim" />
              <span>+ {t(locale, incomingKey)}</span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto rounded border border-border bg-bg-secondary">
            {rendered.map((hunk, hi) => (
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
        </>
      ) : (
        <div className="rounded bg-bg-tertiary p-3 font-mono text-xs text-text-muted">
          {diffSummary}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Same-Name Resolution Dialog: single entry point that branches into
// link / overwrite / rename / discard per relationship.
// ---------------------------------------------------------------------------

function SameNameResolutionDialog({
  row,
  locale,
  onCancel,
  onSelect,
}: {
  row: InventoryRow | null;
  locale: Locale;
  onCancel: () => void;
  onSelect: (opt: ResolutionOption) => void;
}) {
  if (!row) return null;
  const options = resolutionOptionsFor(row);
  if (options.length === 0) return null;

  const labels: Record<ResolutionOption, { label: string; desc: string; Icon: typeof Link2 }> = {
    link: {
      label: t(locale, "projects.inventory.resolution.linkLabel"),
      desc: t(locale, "projects.inventory.resolution.linkDescription"),
      Icon: Link2,
    },
    overwrite: {
      label: t(locale, "projects.inventory.resolution.overwriteLabel"),
      desc: t(locale, "projects.inventory.resolution.overwriteDescription"),
      Icon: RefreshCw,
    },
    rename: {
      label: t(locale, "projects.inventory.resolution.renameLabel"),
      desc: t(locale, "projects.inventory.resolution.renameDescription"),
      Icon: Pencil,
    },
    discard: {
      label: t(locale, "projects.inventory.resolution.discardLabel"),
      desc: t(locale, "projects.inventory.resolution.discardDescription"),
      Icon: Trash2,
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 cursor-default bg-black/50" onClick={onCancel} aria-label="Close dialog" />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-text-primary">
          {t(locale, "projects.inventory.resolution.title")}
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          {t(locale, "projects.inventory.resolution.subtitle", { name: row.skillName })}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {options.map((opt) => {
            const { label, desc, Icon } = labels[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onSelect(opt)}
                className="flex items-start gap-3 rounded-lg border border-border bg-bg-tertiary px-4 py-3 text-left hover:bg-bg-hover"
              >
                <Icon size={16} className="mt-0.5 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary">{label}</div>
                  <div className="mt-0.5 text-xs text-text-secondary">{desc}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
          >
            {t(locale, "common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rename / Discard / Link / Overwrite dialogs.
// ---------------------------------------------------------------------------

function RenameProjectLocalDialog({
  row,
  projectPath,
  locale,
  importing,
  onCancel,
  onConfirm,
}: {
  row: InventoryRow | null;
  projectPath: string | null;
  locale: Locale;
  importing: string | null;
  onCancel: () => void;
  onConfirm: (newName: string) => Promise<string | null>;
}) {
  const [newName, setNewName] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setNewName("");
    setServerError(null);
  }, [row?.skillName]);

  if (!row) return null;
  const agent = row.detectedSources[0]?.attributions[0]?.agent ?? null;
  const sharedAgents =
    isProjectLocalSharedAgents(row) && (agent === "codex" || agent === "gemini");

  let validationError: string | null = null;
  if (newName.length > 0) {
    if (newName.startsWith(".")) {
      validationError = t(locale, "projects.inventory.rename.errorInvalid");
    } else if (!NAME_INPUT_RE.test(newName)) {
      validationError = t(locale, "projects.inventory.rename.errorInvalid");
    } else if (newName === row.skillName) {
      validationError = t(locale, "projects.inventory.rename.errorSame");
    }
  }
  const canSubmit = newName.length > 0 && !validationError && importing !== row.skillName;

  async function submit() {
    if (!canSubmit) return;
    setServerError(null);
    const err = await onConfirm(newName);
    if (err) setServerError(err);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 cursor-default bg-black/50" onClick={onCancel} aria-label="Close dialog" />
      <div className="relative z-10 flex w-full max-w-md flex-col rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-text-primary">
          {t(locale, "projects.inventory.rename.title")}
        </h3>
        <div className="mt-4 space-y-3 text-sm text-text-secondary">
          <div className="font-mono text-xs text-text-muted">{row.skillName}</div>
          <div className="text-xs text-text-muted">
            {agent && <AgentIcon agent={agent} />} {projectPath}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">
              {t(locale, "projects.inventory.rename.input")}
            </span>
            <input
              type="text"
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) void submit();
              }}
              className="rounded border border-border bg-bg-tertiary px-2 py-1.5 font-mono text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          {validationError && (
            <div className="text-xs text-danger">{validationError}</div>
          )}
          {serverError && (
            <div className="rounded bg-danger-dim px-2 py-1.5 text-xs text-danger">
              {serverError}
            </div>
          )}
          {sharedAgents && (
            <div className="rounded bg-warning-dim px-2 py-1.5 text-xs text-warning">
              {t(locale, "projects.inventory.rename.sharedAgentsWarning")}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
          >
            {t(locale, "common.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-60"
          >
            <Pencil size={16} />
            {importing === row.skillName
              ? t(locale, "projects.inventory.rename.renaming")
              : t(locale, "projects.inventory.rename.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function DiscardProjectLocalDialog({
  row,
  projectPath,
  locale,
  importing,
  onCancel,
  onConfirm,
}: {
  row: InventoryRow | null;
  projectPath: string | null;
  locale: Locale;
  importing: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<string | null>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setServerError(null);
  }, [row?.skillName]);

  if (!row) return null;
  const agent = row.detectedSources[0]?.attributions[0]?.agent ?? null;
  const sharedAgents =
    isProjectLocalSharedAgents(row) && (agent === "codex" || agent === "gemini");
  // Canonical lives under ~/.felina/skills/<name>/ — Claude's read path falls
  // back to the global agent dir; display the canonical equivalent so the
  // user understands the fallback location.
  const fallbackPath = `~/.claude/skills/${row.skillName}/`;

  async function submit() {
    setServerError(null);
    const err = await onConfirm();
    if (err) setServerError(err);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 cursor-default bg-black/50" onClick={onCancel} aria-label="Close dialog" />
      <div className="relative z-10 flex w-full max-w-md flex-col rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-text-primary">
          {t(locale, "projects.inventory.discard.title")}
        </h3>
        <div className="mt-4 space-y-3 text-sm text-text-secondary">
          <div className="font-mono text-xs text-text-muted">{row.skillName}</div>
          <div className="text-xs text-text-muted">
            {agent && <AgentIcon agent={agent} />} {projectPath}
          </div>
          <div className="rounded bg-info-dim px-2 py-1.5 text-xs text-info">
            {t(locale, "projects.inventory.discard.fallbackNote", { path: fallbackPath })}
          </div>
          {sharedAgents && (
            <div className="rounded bg-warning-dim px-2 py-1.5 text-xs text-warning">
              {t(locale, "projects.inventory.discard.sharedAgentsWarning")}
            </div>
          )}
          {serverError && (
            <div className="rounded bg-danger-dim px-2 py-1.5 text-xs text-danger">
              {serverError}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
          >
            {t(locale, "common.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={importing === row.skillName}
            className="inline-flex items-center gap-1 rounded-lg bg-danger px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
          >
            <Trash2 size={16} />
            {importing === row.skillName
              ? t(locale, "projects.inventory.discard.discarding")
              : t(locale, "projects.inventory.discard.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkConflictDialog({
  pending,
  rows,
  locale,
  importing,
  onCancel,
  onConfirm,
}: {
  pending: PendingLink | null;
  rows: InventoryRow[];
  locale: Locale;
  importing: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!pending) return null;
  const row = rows.find((r) => r.skillName === pending.skillName);
  if (!row) return null;
  const candidate = linkConflictCandidateForRow(row, pending.sourceIndex);
  if (!candidate?.conflict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 cursor-default bg-black/50" onClick={onCancel} aria-label="Close dialog" />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-text-primary">
          {t(locale, "projects.inventory.link.title")}
        </h3>
        <div className="mt-4 flex flex-1 flex-col overflow-hidden text-sm text-text-secondary">
          <p className="mb-3 whitespace-pre-wrap">
            {t(locale, "projects.inventory.link.message", { name: pending.skillName })}
          </p>
          <ConflictDiffView
            hunks={candidate.conflict.hunks}
            diffSummary={candidate.conflict.diffSummary}
            canonicalPath={candidate.conflict.canonicalPath}
            direction="link"
            locale={locale}
          />
        </div>
        <div className="mt-6 flex shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
          >
            {t(locale, "common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={importing === pending.skillName}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-60"
          >
            <Link2 size={16} />
            {t(locale, "projects.inventory.link.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function OverwriteConflictDialog({
  pending,
  rows,
  locale,
  importing,
  onCancel,
  onConfirm,
}: {
  pending: PendingOverwrite | null;
  rows: InventoryRow[];
  locale: Locale;
  importing: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!pending) return null;
  const row = rows.find((r) => r.skillName === pending.skillName);
  if (!row) return null;
  const candidate = linkConflictCandidateForRow(row, pending.sourceIndex);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 cursor-default bg-black/50" onClick={onCancel} aria-label="Close dialog" />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-text-primary">
          {t(locale, "projects.importConflictDialog.title")}
        </h3>
        <div className="mt-4 flex flex-1 flex-col overflow-hidden text-sm text-text-secondary">
          <p className="mb-3 whitespace-pre-wrap">
            {t(locale, "projects.importConflictDialog.message")}
          </p>
          {candidate?.conflict ? (
            <ConflictDiffView
              hunks={candidate.conflict.hunks}
              diffSummary={candidate.conflict.diffSummary}
              canonicalPath={candidate.conflict.canonicalPath}
              direction="overwrite"
              locale={locale}
            />
          ) : null}
        </div>
        <div className="mt-6 flex shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
          >
            {t(locale, "common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={importing === pending.skillName}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-60"
          >
            <RefreshCw size={16} />
            {t(locale, "projects.importConflictDialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function MultiSourceDrawer({
  drawer,
  rows,
  locale,
  importing,
  drawerRef,
  onCancel,
  onSelectSource,
  onConfirm,
}: {
  drawer: DrawerState | null;
  rows: InventoryRow[];
  locale: Locale;
  importing: string | null;
  drawerRef: React.RefObject<HTMLDivElement | null>;
  onCancel: () => void;
  onSelectSource: (idx: number) => void;
  onConfirm: () => void;
}) {
  if (!drawer) return null;
  const row = rows.find((r) => r.skillName === drawer.skillName);
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 cursor-default bg-black/50" onClick={onCancel} aria-label="Close dialog" />
      <div
        ref={drawerRef}
        className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl"
      >
        <h3 className="text-base font-semibold text-text-primary">
          {t(locale, "projects.inventory.drawer.selectSource")}
        </h3>
        <div className="mt-4 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3">
            {row.detectedSources.map((source) => (
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
                        drawer.selectedSourceIndex === attribution.sourceIndex
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
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
          >
            {t(locale, "common.cancel")}
          </button>
          <button
            type="button"
            disabled={importing === row.skillName}
            onClick={onConfirm}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-60"
          >
            <Download size={16} />
            {importing === row.skillName
              ? t(locale, "projects.inventory.importing")
              : t(locale, "projects.inventory.drawer.confirmImport")}
          </button>
        </div>
      </div>
    </div>
  );
}
