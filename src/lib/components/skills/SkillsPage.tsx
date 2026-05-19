import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save, Trash2, Users, WandSparkles } from "lucide-react";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingLine,
  PageBody,
  PageHeader,
} from "$lib/components/shared/PageScaffold";
import { api } from "$lib/tauri/commands";
import { useProjectContextStore } from "$lib/stores/project-context";
import type { SkillInfo } from "$lib/types";

type Scope = "global" | "project";
type Kind = "skills" | "agents";

const DEFAULT_CONTENT = "# New Skill\n\nDescribe when to use this skill and the workflow to follow.\n";

export default function SkillsPage() {
  const projectPath = useProjectContextStore((s) => s.selectedProjectPath);
  const [scope, setScope] = useState<Scope>("global");
  const [kind, setKind] = useState<Kind>("skills");
  const [items, setItems] = useState<SkillInfo[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.name === selectedName) ?? null,
    [items, selectedName],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list =
        kind === "skills"
          ? await api.skills.list(scope, projectPath ?? undefined)
          : await api.agents.list(scope, projectPath ?? undefined);
      setItems(list);
      const next = list.find((item) => item.name === selectedName) ?? list[0] ?? null;
      setSelectedName(next?.name ?? null);
      setDraftName(next?.name ?? "");
      setContent(next?.content ?? "");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [scope, kind, projectPath]);

  function startNew() {
    setSelectedName(null);
    setDraftName(kind === "skills" ? "new-skill" : "new-agent");
    setContent(DEFAULT_CONTENT);
  }

  function choose(item: SkillInfo) {
    setSelectedName(item.name);
    setDraftName(item.name);
    setContent(item.content);
  }

  async function save() {
    const name = draftName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === "skills") {
        await api.skills.write(scope, name, content, projectPath ?? undefined);
      } else {
        await api.agents.write(scope, name, content, projectPath ?? undefined);
      }
      setSelectedName(name);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const name = selected?.name;
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === "skills") {
        await api.skills.delete(scope, name, projectPath ?? undefined);
      } else {
        await api.agents.delete(scope, name, projectPath ?? undefined);
      }
      setSelectedName(null);
      setDraftName("");
      setContent("");
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Skills & Agents"
        subtitle="Manage reusable Codex skills and agent instructions"
        icon={WandSparkles}
        actions={
          <>
            <ProjectPicker />
            <ActionButton onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </ActionButton>
            <ActionButton onClick={startNew} variant="primary">
              <Plus size={14} />
              New
            </ActionButton>
          </>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        <div className="flex items-center gap-2 mb-4">
          {(["skills", "agents"] as Kind[]).map((value) => (
            <button
              key={value}
              className={`px-3 py-1.5 rounded-md text-sm capitalize ${
                kind === value ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary"
              }`}
              onClick={() => setKind(value)}
            >
              {value}
            </button>
          ))}
          {(["global", "project"] as Scope[]).map((value) => (
            <button
              key={value}
              className={`px-3 py-1.5 rounded-md text-sm capitalize ${
                scope === value ? "bg-bg-tertiary text-text-primary" : "text-text-muted"
              }`}
              onClick={() => setScope(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-4 min-h-[560px]">
          <aside className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-4">
                <LoadingLine />
              </div>
            ) : items.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No entries" detail="Create one to get started." />
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.path}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-border last:border-b-0 hover:bg-bg-hover ${
                    selectedName === item.name ? "bg-accent/10 text-accent" : "text-text-secondary"
                  }`}
                  onClick={() => choose(item)}
                >
                  <Users size={14} className="shrink-0" />
                  <span className="truncate text-sm">{item.name}</span>
                </button>
              ))
            )}
          </aside>
          <section className="bg-bg-secondary border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <input
                className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Name"
              />
              <ActionButton onClick={save} disabled={saving || !draftName.trim()} variant="primary">
                <Save size={14} />
                Save
              </ActionButton>
              <ActionButton onClick={remove} disabled={saving || !selected} variant="danger">
                <Trash2 size={14} />
                Delete
              </ActionButton>
            </div>
            <textarea
              className="flex-1 min-h-[500px] resize-none bg-bg-primary p-4 font-mono text-sm text-text-primary focus:outline-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write instructions..."
            />
          </section>
        </div>
      </PageBody>
    </div>
  );
}
