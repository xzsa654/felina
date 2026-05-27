import { useEffect, useState } from "react";
import { X, FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { AgentId, KnownProject, SkillTarget } from "$lib/types";
import { api } from "$lib/tauri/commands";
import { normalizeProjectPath } from "$lib/utils/path";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";

const AGENTS: AgentId[] = ["anthropic", "codex", "gemini"];

// known_projects_list returns normalized paths; the raw projectPath prop and
// the OS dialog return un-normalized paths. A controlled <select> only matches
// an <option> on exact string equality, so we must map a raw/desired path back
// to the exact value present in the list — otherwise the select silently shows
// its first option while state holds an unmatched value.
function matchOption(
  projects: KnownProject[],
  want: string | null,
): string | null {
  if (want != null) {
    const w = normalizeProjectPath(want);
    const hit = projects.find((p) => normalizeProjectPath(p.path) === w);
    if (hit) return hit.path;
  }
  return projects[0]?.path ?? null;
}

/**
 * Add a `SkillTarget` to the currently-edited canonical skill. The dialog
 * picks the target's agent and push destination (`global` or a specific
 * project). After `scope-model-simplification`, this is the only place
 * "scope" appears in the UI — and it refers to push destination, not to a
 * canonical-storage location.
 */
interface Props {
  /** Default project for new project-scope targets (typically the current cwd). */
  projectPath: string | null;
  existingTargets: SkillTarget[];
  onAdd: (target: SkillTarget) => void;
  onClose: () => void;
}

export default function AddTargetDialog({
  projectPath,
  existingTargets,
  onAdd,
  onClose,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [agent, setAgent] = useState<AgentId>("anthropic");
  const [targetScope, setTargetScope] = useState<"global" | "project">("global");
  const [selectedProject, setSelectedProject] = useState<string | null>(
    projectPath,
  );
  const [projects, setProjects] = useState<KnownProject[]>([]);

  useEffect(() => {
    void api.knownProjects
      .list(projectPath ?? undefined)
      .then((ps) => {
        setProjects(ps);
        setSelectedProject((cur) => matchOption(ps, cur ?? projectPath));
      })
      .catch(() => setProjects([]));
  }, [projectPath]);

  const isDuplicate = existingTargets.some(
    (tgt) =>
      tgt.agent === agent &&
      tgt.scope === targetScope &&
      (targetScope === "global" ||
        normalizeProjectPath(tgt.project ?? "") ===
          normalizeProjectPath(selectedProject ?? "")),
  );

  function handleConfirm() {
    if (isDuplicate) return;
    const target: SkillTarget = {
      agent,
      scope: targetScope,
      enabled: true,
      mode: "tracked",
    };
    if (targetScope === "project") {
      target.project = selectedProject ?? projectPath ?? "";
    }
    onAdd(target);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-bg-secondary border border-border rounded-lg shadow-lg w-96 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t(locale, "skills.addTargetDialog.title")}</h3>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">{t(locale, "skills.addTargetDialog.agent")}</span>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value as AgentId)}
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-sm"
          >
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">{t(locale, "skills.addTargetDialog.scope")}</span>
          <select
            value={targetScope}
            onChange={(e) => setTargetScope(e.target.value as "global" | "project")}
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-sm"
          >
            <option value="global">{t(locale, "skills.addTargetDialog.scopeGlobal")}</option>
            <option value="project">{t(locale, "skills.addTargetDialog.scopeProject")}</option>
          </select>
        </label>

        {targetScope === "project" && (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">{t(locale, "skills.addTargetDialog.project")}</span>
            <div className="flex gap-1.5">
              <select
                value={selectedProject ?? ""}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 rounded bg-bg-primary border border-border text-sm"
              >
                {projects.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.path}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  const dir = await open({ directory: true });
                  if (!dir) return;
                  await api.knownProjects.add(dir);
                  const refreshed = await api.knownProjects.list(projectPath ?? undefined);
                  setProjects(refreshed);
                  setSelectedProject(matchOption(refreshed, dir));
                }}
                className="px-2 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary hover:bg-bg-primary shrink-0"
                title={t(locale, "skills.addTargetDialog.browseTitle")}
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </div>
        )}

        {isDuplicate && (
          <div className="text-xs text-warning">
            {t(locale, "skills.addTargetDialog.duplicate")}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary"
          >
            {t(locale, "skills.addTargetDialog.cancel")}
          </button>
          <button
            type="button"
            disabled={isDuplicate}
            onClick={handleConfirm}
            className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t(locale, "skills.addTargetDialog.add")}
          </button>
        </div>
      </div>
    </div>
  );
}
