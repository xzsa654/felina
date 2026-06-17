import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, FolderTree, Plus, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { api } from "$lib/tauri/commands";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import { useProjectContextStore } from "$lib/stores/project-context";
import type { AgentId, AgentPathPair, AgentPathsConfig, SkillScope } from "$lib/types";
import Modal from "$lib/components/shared/Modal";
import AddAgentPathDialog from "./AddAgentPathDialog";
import RemoveAgentPathDialog from "./RemoveAgentPathDialog";

const BUILTIN_AGENTS = ["anthropic", "codex", "gemini"] as const;

const AGENT_LABELS: Record<string, string> = {
  anthropic: "Anthropic Claude",
  codex: "OpenAI Codex CLI",
  gemini: "Google Gemini / Antigravity",
};

const AGENT_HINTS: Record<string, string> = {
  anthropic: "Anthropic Claude reads ~/.claude/skills/ and project .claude/skills/.",
  codex: "Codex reads ~/.agents/skills/ and project .agents/skills/.",
  gemini:
    "Antigravity CLI uses ~/.gemini/antigravity-cli/skills/. Override here if needed.",
};

const DEFAULTS_FALLBACK: AgentPathsConfig = {
  agents: {
    anthropic: { global: "~/.claude/skills", projectRelative: ".claude/skills" },
    codex: { global: "~/.agents/skills", projectRelative: ".agents/skills" },
    gemini: { global: "~/.gemini/antigravity-cli/skills", projectRelative: ".agents/skills" },
  },
};

/**
 * Settings → Agent Paths. Collapsible by default; three agents × two paths
 * (global + project-relative) = 6 editable fields. Each agent shows a
 * detected-skill-count badge so the user can verify their override is
 * actually pointing somewhere with skills.
 *
 * Per decision 8 this exposes exactly three agents (no UI for a fourth);
 * canonical `agents` storage allows expansion but Settings does not.
 */
export default function AgentPathsSection() {
  const locale = useLocaleStore((s) => s.locale);
  const projectPath = useProjectContextStore((s) => s.selectedProjectPath);
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AgentPathsConfig | null>(null);
  const [original, setOriginal] = useState<AgentPathsConfig | null>(null);
  const [counts, setCounts] = useState<{
    global: Record<string, number>;
    project: Record<string, number>;
  }>({
    global: {},
    project: {},
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  async function reload() {
    try {
      const cfg = await api.agentPaths.get();
      setConfig(cfg);
      setOriginal(cfg);
    } catch (e) {
      setError({ title: t(locale, "felinaSettings.agentPaths.loadFailed"), detail: String(e) });
      setConfig(DEFAULTS_FALLBACK);
      setOriginal(DEFAULTS_FALLBACK);
    }
    await reloadCounts();
  }

  async function reloadCounts() {
    try {
      const g = await api.skillImport.scanQuick();
      setCounts((prev) => ({
        ...prev,
        global: { anthropic: g.anthropic, codex: g.codex, gemini: g.gemini },
      }));
    } catch {
      // ignore — counts are advisory
    }
    if (projectPath) {
      try {
        const p = await api.skillImport.scanQuick(projectPath);
        setCounts((prev) => ({
          ...prev,
          project: { anthropic: p.anthropic, codex: p.codex, gemini: p.gemini },
        }));
      } catch {
        // ignore
      }
    } else {
      setCounts((prev) => ({
        ...prev,
        project: { anthropic: 0, codex: 0, gemini: 0 },
      }));
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  if (!config) {
    return (
      <section className="rounded-lg border border-border bg-bg-secondary p-4">
        <div className="text-sm text-text-secondary">Loading agent paths…</div>
      </section>
    );
  }

  const dirty = original !== null && JSON.stringify(config) !== JSON.stringify(original);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.agentPaths.set(config);
      setOriginal(config);
      setInfo("Saved. New paths take effect immediately.");
      await reloadCounts();
    } catch (e) {
      setError({ title: t(locale, "felinaSettings.agentPaths.validationFailed"), detail: String(e) });
    } finally {
      setSaving(false);
    }
  }

  function resetToOriginal() {
    if (original) setConfig(original);
    setError(null);
    setInfo(null);
  }

  return (
    <section className="rounded-lg border border-border bg-bg-secondary">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <FolderTree size={16} className="text-accent" />
        <span className="text-sm font-semibold">Agent paths</span>
        <span className="text-xs text-text-secondary">
          Where each agent looks for skills
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-4 flex flex-col gap-4">
          {info && (
            <div className="text-xs text-success bg-success-dim border border-success/30 rounded px-3 py-2">
              {info}
            </div>
          )}

          {sortedAgentKeys(config).map((agent) => {
            const isBuiltin = BUILTIN_AGENTS.includes(agent as typeof BUILTIN_AGENTS[number]);
            return (
              <AgentPathRow
                key={agent}
                agent={agent}
                pair={config.agents[agent]}
                isBuiltin={isBuiltin}
                globalCount={counts.global[agent] ?? 0}
                projectCount={counts.project[agent] ?? 0}
                onChange={(pair) => setConfig({
                  ...config,
                  agents: { ...config.agents, [agent]: pair },
                })}
                onDelete={isBuiltin ? undefined : () => setRemoveTarget(agent)}
              />
            );
          })}

          <button
            type="button"
            onClick={() => setAddDialogOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-dashed border-border text-text-secondary hover:text-text-primary hover:border-accent w-full justify-center"
          >
            <Plus size={14} /> {t(locale, "felinaSettings.agentPaths.addButton")}
          </button>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => void reloadCounts()}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary"
            >
              <RefreshCw size={12} /> Re-scan
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={resetToOriginal}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              <RotateCcw size={12} /> Revert
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              <Save size={12} /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/*
        Validation-error modal: persistent until the user explicitly
        confirms. Backdrop is non-clickable (no dismiss-on-outside) and the
        full error message is shown verbatim so the user can copy the
        rejected segment.
      */}
      <Modal open={error !== null} onClose={() => setError(null)} size="md">
        <div className="p-6 flex flex-col gap-4" role="alertdialog" aria-labelledby="agent-paths-error-title">
          <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-dim flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="agent-paths-error-title"
                  className="text-base font-semibold text-text-primary"
                >
                  {error?.title}
                </h3>
                <p className="text-xs text-text-secondary mt-2 whitespace-pre-wrap break-words font-mono select-text">
                  {error?.detail}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setError(null)}
                autoFocus
                className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
        </div>
      </Modal>
      <AddAgentPathDialog
        open={addDialogOpen}
        existingKeys={config ? Object.keys(config.agents) : []}
        onAdd={(key, global, projectRelative, label, icon) => {
          if (!config) return;
          const newPair: AgentPathPair = { global, projectRelative, label, icon };
          const updated: AgentPathsConfig = {
            agents: { ...config.agents, [key]: newPair },
          };
          setConfig(updated);
          setAddDialogOpen(false);
        }}
        onClose={() => setAddDialogOpen(false)}
      />

      <RemoveAgentPathDialog
        open={removeTarget !== null}
        agentKey={removeTarget ?? ""}
        onRemoved={() => {
          setRemoveTarget(null);
          void reload();
        }}
        onClose={() => setRemoveTarget(null)}
      />
    </section>
  );
}

function sortedAgentKeys(config: AgentPathsConfig): string[] {
  const keys = Object.keys(config.agents);
  const builtinOrder = BUILTIN_AGENTS.filter((b) => keys.includes(b));
  const custom = keys.filter((k) => !BUILTIN_AGENTS.includes(k as typeof BUILTIN_AGENTS[number])).sort();
  return [...builtinOrder, ...custom];
}

interface RowProps {
  agent: AgentId;
  pair: AgentPathPair;
  isBuiltin: boolean;
  globalCount: number;
  projectCount: number;
  onChange: (pair: AgentPathPair) => void;
  onDelete?: () => void;
}

function AgentPathRow({ agent, pair, isBuiltin, globalCount, projectCount, onChange, onDelete }: RowProps) {
  return (
    <div className="rounded border border-border p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{pair.label ?? AGENT_LABELS[agent] ?? agent}</div>
          <div className="text-xs text-text-secondary">{AGENT_HINTS[agent] ?? (isBuiltin ? "" : agent)}</div>
        </div>
        {!isBuiltin && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-text-tertiary hover:text-danger p-1 rounded"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <PathInput
        scope="global"
        label="Global"
        value={pair.global}
        count={globalCount}
        onChange={(v) => onChange({ ...pair, global: v })}
        placeholder="~/.claude/skills"
      />
      <PathInput
        scope="project"
        label="Project-relative"
        value={pair.projectRelative}
        count={projectCount}
        onChange={(v) => onChange({ ...pair, projectRelative: v })}
        placeholder=".claude/skills"
      />
    </div>
  );
}

interface PathInputProps {
  scope: SkillScope;
  label: string;
  value: string;
  count: number;
  placeholder: string;
  onChange: (v: string) => void;
}

function PathInput({ scope, label, value, count, placeholder, onChange }: PathInputProps) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary">{label}</span>
        <span className="text-[10px] text-text-secondary">
          {scope === "global" ? "global" : "project"} • {count} skill{count === 1 ? "" : "s"} detected
        </span>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="px-2 py-1.5 rounded bg-bg-primary border border-border text-xs font-mono focus:outline-none focus:border-accent"
      />
    </label>
  );
}
