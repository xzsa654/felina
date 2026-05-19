import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save, Shield, Trash2 } from "lucide-react";
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
import type { RuleFile } from "$lib/types";

type Scope = "global" | "project";

export default function RulesPage() {
  const projectPath = useProjectContextStore((s) => s.selectedProjectPath);
  const [scope, setScope] = useState<Scope>("global");
  const [rules, setRules] = useState<RuleFile[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [paths, setPaths] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => rules.find((rule) => rule.name === selectedName) ?? null,
    [rules, selectedName],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await api.rules.list(scope, projectPath ?? undefined);
      setRules(list);
      const next = list.find((rule) => rule.name === selectedName) ?? list[0] ?? null;
      setSelectedName(next?.name ?? null);
      setFilename(next?.name ?? "");
      setPaths(next?.paths_filter?.join("\n") ?? "");
      setContent(next?.content ?? "");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [scope, projectPath]);

  function startNew() {
    setSelectedName(null);
    setFilename("new-rule.md");
    setPaths("");
    setContent("# Rule\n\n");
  }

  function choose(rule: RuleFile) {
    setSelectedName(rule.name);
    setFilename(rule.name);
    setPaths(rule.paths_filter?.join("\n") ?? "");
    setContent(rule.content);
  }

  async function save() {
    const name = filename.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await api.rules.write(
        scope,
        name,
        paths.split("\n").map((p) => p.trim()).filter(Boolean),
        content,
        projectPath ?? undefined,
      );
      setSelectedName(name);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await api.rules.delete(scope, selected.name, projectPath ?? undefined);
      setSelectedName(null);
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
        title="Rules"
        subtitle="Edit instruction rules and optional path filters"
        icon={Shield}
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
        <div className="flex gap-2 mb-4">
          {(["global", "project"] as Scope[]).map((value) => (
            <button
              key={value}
              className={`px-3 py-1.5 rounded-md text-sm capitalize ${
                scope === value ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary"
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
            ) : rules.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No rules" />
              </div>
            ) : (
              rules.map((rule) => (
                <button
                  key={rule.path}
                  className={`w-full px-3 py-2 text-left border-b border-border last:border-b-0 hover:bg-bg-hover ${
                    selectedName === rule.name ? "bg-accent/10 text-accent" : "text-text-secondary"
                  }`}
                  onClick={() => choose(rule)}
                >
                  <p className="text-sm truncate">{rule.name}</p>
                  {rule.paths_filter.length > 0 && (
                    <p className="text-[10px] text-text-muted truncate">
                      {rule.paths_filter.join(", ")}
                    </p>
                  )}
                </button>
              ))
            )}
          </aside>
          <section className="bg-bg-secondary border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 p-3 border-b border-border">
              <input
                className="px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="rule.md"
              />
              <input
                className="px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
                value={paths.replace(/\n/g, ", ")}
                onChange={(e) => setPaths(e.target.value.split(",").join("\n"))}
                placeholder="optional/path/**, another/**"
              />
              <ActionButton onClick={save} disabled={saving || !filename.trim()} variant="primary">
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
              placeholder="Rule content..."
            />
          </section>
        </div>
      </PageBody>
    </div>
  );
}
