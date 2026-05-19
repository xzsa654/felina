import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Activity, Plus, Play, RefreshCw, Save, Square, Trash2 } from "lucide-react";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingLine,
  PageBody,
  PageHeader,
  StatCard,
} from "$lib/components/shared/PageScaffold";
import {
  cancelPipelineRun,
  clearResults,
  startPipelineRun,
  type RustPipelineFormat,
  usePipelineExecutionStore,
} from "$lib/stores/pipeline-execution";

function nowIso() {
  return new Date().toISOString();
}

function newPipeline(): RustPipelineFormat {
  const ts = nowIso();
  return {
    id: crypto.randomUUID(),
    name: "Untitled Pipeline",
    nodes: [],
    connections: [],
    created_at: ts,
    updated_at: ts,
  };
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<RustPipelineFormat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RustPipelineFormat>(() => newPipeline());
  const [rawJson, setRawJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = usePipelineExecutionStore((s) => s.running);
  const results = usePipelineExecutionStore((s) => s.results);

  const active = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === activeId) ?? null,
    [pipelines, activeId],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await invoke<RustPipelineFormat[]>("list_pipelines");
      setPipelines(list);
      const next = list.find((pipeline) => pipeline.id === activeId) ?? list[0] ?? null;
      if (next) select(next);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function select(pipeline: RustPipelineFormat) {
    setActiveId(pipeline.id);
    setDraft(pipeline);
    setRawJson(JSON.stringify(pipeline, null, 2));
  }

  function create() {
    const pipeline = newPipeline();
    setActiveId(pipeline.id);
    setDraft(pipeline);
    setRawJson(JSON.stringify(pipeline, null, 2));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parsed = JSON.parse(rawJson) as RustPipelineFormat;
      const pipeline = { ...parsed, updated_at: nowIso() };
      await invoke("save_pipeline", { pipeline });
      setDraft(pipeline);
      setActiveId(pipeline.id);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!activeId) return;
    setSaving(true);
    setError(null);
    try {
      await invoke("delete_pipeline", { id: activeId });
      setActiveId(null);
      setDraft(newPipeline());
      setRawJson("");
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function run() {
    setError(null);
    try {
      const parsed = JSON.parse(rawJson) as RustPipelineFormat;
      await startPipelineRun(parsed);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Pipelines"
        subtitle="Create, edit, and run automation pipelines"
        icon={Activity}
        actions={
          <>
            <ActionButton onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </ActionButton>
            <ActionButton onClick={create} variant="primary">
              <Plus size={14} />
              New
            </ActionButton>
          </>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Pipelines" value={pipelines.length} />
          <StatCard label="Nodes" value={draft.nodes.length} />
          <StatCard label="Connections" value={draft.connections.length} />
        </div>
        <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-4 min-h-[560px]">
          <aside className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-4">
                <LoadingLine />
              </div>
            ) : pipelines.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No pipelines yet" />
              </div>
            ) : (
              pipelines.map((pipeline) => (
                <button
                  key={pipeline.id}
                  className={`w-full text-left px-3 py-3 border-b border-border last:border-b-0 hover:bg-bg-hover ${
                    activeId === pipeline.id ? "bg-accent/10" : ""
                  }`}
                  onClick={() => select(pipeline)}
                >
                  <p className="text-sm text-text-primary truncate">{pipeline.name}</p>
                  <p className="text-xs text-text-muted">
                    {pipeline.nodes.length} nodes · {pipeline.connections.length} edges
                  </p>
                </button>
              ))
            )}
          </aside>
          <section className="bg-bg-secondary border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <input
                className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
                value={draft.name}
                onChange={(e) => {
                  const next = { ...draft, name: e.target.value };
                  setDraft(next);
                  try {
                    const parsed = JSON.parse(rawJson || "{}") as RustPipelineFormat;
                    setRawJson(JSON.stringify({ ...parsed, name: e.target.value }, null, 2));
                  } catch {
                    setRawJson(JSON.stringify(next, null, 2));
                  }
                }}
              />
              {running ? (
                <ActionButton onClick={() => void cancelPipelineRun()} variant="danger">
                  <Square size={14} />
                  Stop
                </ActionButton>
              ) : (
                <ActionButton onClick={run} variant="primary">
                  <Play size={14} />
                  Run
                </ActionButton>
              )}
              <ActionButton onClick={save} disabled={saving}>
                <Save size={14} />
                Save
              </ActionButton>
              <ActionButton onClick={remove} disabled={saving || !active} variant="danger">
                <Trash2 size={14} />
                Delete
              </ActionButton>
            </div>
            <div className="grid grid-cols-2 min-h-[500px] flex-1">
              <textarea
                className="resize-none bg-bg-primary p-4 font-mono text-xs text-text-primary focus:outline-none border-r border-border"
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                placeholder="Pipeline JSON"
              />
              <div className="overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-text-secondary">Run Results</h2>
                  <button className="text-xs text-text-muted hover:text-text-primary" onClick={clearResults}>
                    Clear
                  </button>
                </div>
                {results.length === 0 ? (
                  <EmptyState title="Run a pipeline to see results" />
                ) : (
                  <div className="space-y-3">
                    {results.map((result, index) => (
                      <div key={`${result.nodeId}:${index}`} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="text-sm font-medium text-text-primary">{result.label}</span>
                          <span className={`text-xs ${result.status === "error" ? "text-danger" : "text-success"}`}>
                            {result.status}
                          </span>
                        </div>
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap max-h-40 overflow-auto">
                          {result.output}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </PageBody>
    </div>
  );
}
