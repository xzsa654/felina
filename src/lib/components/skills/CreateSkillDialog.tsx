import { useEffect, useMemo, useState } from "react";
import { FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { AgentId, KnownProject, SkillTarget } from "$lib/types";
import { api } from "$lib/tauri/commands";
import { normalizeProjectPath } from "$lib/utils/path";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import Modal from "$lib/components/shared/Modal";

const AGENTS: AgentId[] = ["anthropic", "codex", "gemini"];

type InitialTarget = "none" | "global" | "project";

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

function validateName(name: string, locale: import("$lib/i18n").Locale): string | null {
  if (name.length === 0) return t(locale, "skills.createDialog.nameRequired");
  if (name.startsWith(".")) return t(locale, "skills.createDialog.nameNoDot");
  for (const ch of name) {
    if (!/[A-Za-z0-9_-]/.test(ch)) return t(locale, "skills.createDialog.nameInvalidChar", { ch });
  }
  return null;
}

interface Props {
  projectPath: string | null;
  onCreated: (name: string) => void;
  onClose: () => void;
}

export default function CreateSkillDialog({ projectPath, onCreated, onClose }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [name, setName] = useState("");
  const [initialTarget, setInitialTarget] = useState<InitialTarget>("global");
  const [agent, setAgent] = useState<AgentId>("anthropic");
  const [selectedProject, setSelectedProject] = useState<string | null>(projectPath);
  const [projects, setProjects] = useState<KnownProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.knownProjects
      .list(projectPath ?? undefined)
      .then((ps) => {
        setProjects(ps);
        setSelectedProject((cur) => matchOption(ps, cur ?? projectPath));
      })
      .catch(() => setProjects([]));
  }, [projectPath]);

  const nameError = useMemo(() => validateName(name, locale), [name, locale]);
  const canSubmit = nameError === null && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api.canonicalSkills.write(
        name,
        { name, description: "", agents: [] },
        "",
      );

      if (initialTarget !== "none") {
        const target: SkillTarget = {
          agent,
          scope: initialTarget === "global" ? "global" : "project",
          enabled: true,
          mode: "tracked",
        };
        if (initialTarget === "project") {
          target.project = selectedProject ?? projectPath ?? "";
        }
        try {
          await api.skillTargets.set(name, [target]);
        } catch (e) {
          setError(t(locale, "skills.createDialog.targetFailed", { error: String(e) }));
          onCreated(name);
          return;
        }
      }

      onCreated(name);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t(locale, "skills.createDialog.title")} size="sm">
      <div className="p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">{t(locale, "skills.createDialog.name")}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, "skills.createDialog.namePlaceholder")}
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-sm"
            autoFocus
          />
          {name.length > 0 && nameError && (
            <span className="text-xs text-danger">{nameError}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">{t(locale, "skills.createDialog.initialTarget")}</span>
          <select
            value={initialTarget}
            onChange={(e) => setInitialTarget(e.target.value as InitialTarget)}
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-sm"
          >
            <option value="global">{t(locale, "skills.createDialog.targetGlobal")}</option>
            <option value="project">{t(locale, "skills.createDialog.targetProject")}</option>
            <option value="none">{t(locale, "skills.createDialog.targetNone")}</option>
          </select>
        </label>

        {initialTarget !== "none" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">{t(locale, "skills.createDialog.agent")}</span>
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value as AgentId)}
              className="px-2 py-1.5 rounded bg-bg-primary border border-border text-sm"
            >
              {AGENTS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
        )}

        {initialTarget === "project" && (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">{t(locale, "skills.createDialog.project")}</span>
            <div className="flex gap-1.5">
              <select
                value={selectedProject ?? ""}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 rounded bg-bg-primary border border-border text-sm"
              >
                {projects.map((p) => (
                  <option key={p.path} value={p.path}>{p.path}</option>
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
                title={t(locale, "skills.createDialog.browseTitle")}
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary"
          >
            {t(locale, "skills.createDialog.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? t(locale, "skills.createDialog.creating") : t(locale, "skills.createDialog.create")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
