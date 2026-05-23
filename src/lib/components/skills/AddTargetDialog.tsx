import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AgentId, KnownProject, SkillScope, SkillTarget } from "$lib/types";
import { api } from "$lib/tauri/commands";

const AGENTS: AgentId[] = ["anthropic", "codex", "gemini"];

interface Props {
  scope: SkillScope;
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
  const [agent, setAgent] = useState<AgentId>("anthropic");
  const [targetScope, setTargetScope] = useState<"global" | "project">("global");
  const [selectedProject, setSelectedProject] = useState<string | null>(
    projectPath,
  );
  const [projects, setProjects] = useState<KnownProject[]>([]);

  useEffect(() => {
    void api.knownProjects
      .list(projectPath ?? undefined)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [projectPath]);

  const normalizedCurrent = projectPath?.replace(/\\/g, "/").toLowerCase() ?? "";

  const isDuplicate = existingTargets.some(
    (t) =>
      t.agent === agent &&
      t.scope === targetScope &&
      (targetScope === "global" ||
        (t.project ?? "").replace(/\\/g, "/").toLowerCase() ===
          (selectedProject ?? "").replace(/\\/g, "/").toLowerCase()),
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
          <h3 className="text-sm font-semibold">Add Target</h3>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Agent</span>
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
          <span className="text-text-secondary">Scope</span>
          <select
            value={targetScope}
            onChange={(e) => setTargetScope(e.target.value as "global" | "project")}
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-sm"
          >
            <option value="global">Global</option>
            <option value="project">Project</option>
          </select>
        </label>

        {targetScope === "project" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">Project</span>
            <select
              value={selectedProject ?? ""}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-2 py-1.5 rounded bg-bg-primary border border-border text-sm"
            >
              {projects.map((p) => {
                const norm = p.path.toLowerCase();
                const isCurrent = norm === normalizedCurrent;
                return (
                  <option key={p.path} value={p.path} disabled={!isCurrent}>
                    {p.path}
                    {!isCurrent ? " — cross-project: Phase 1.5 (b)" : ""}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        {isDuplicate && (
          <div className="text-xs text-amber-400">
            This target already exists.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDuplicate}
            onClick={handleConfirm}
            className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
