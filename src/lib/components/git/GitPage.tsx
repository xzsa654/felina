import { useEffect, useState } from "react";
import { GitBranch, GitCommit, RefreshCw, Terminal } from "lucide-react";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingLine,
  PageBody,
  PageHeader,
  StatCard,
} from "$lib/components/shared/PageScaffold";
import { api, type GitLogEntry, type GitStatus } from "$lib/tauri/commands";
import { useProjectContextStore } from "$lib/stores/project-context";

export default function GitPage() {
  const projectPath = useProjectContextStore((s) => s.selectedProjectPath);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const [diff, setDiff] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!projectPath) return;
    setLoading(true);
    setError(null);
    try {
      const [nextStatus, nextLog, nextDiff] = await Promise.all([
        api.git.status(projectPath),
        api.git.log(projectPath, 20),
        api.git.diff(projectPath),
      ]);
      setStatus(nextStatus);
      setLog(nextLog);
      setDiff(nextDiff);
    } catch (e) {
      setError(String(e));
      setStatus(null);
      setLog([]);
      setDiff("");
    } finally {
      setLoading(false);
      setBusy(null);
    }
  }

  useEffect(() => {
    void load();
  }, [projectPath]);

  async function run(action: "pull" | "push" | "commit" | "terminal") {
    if (!projectPath) return;
    setBusy(action);
    setError(null);
    try {
      if (action === "pull") await api.git.pull(projectPath);
      if (action === "push") await api.git.push(projectPath);
      if (action === "terminal") await api.git.openInTerminal(projectPath);
      if (action === "commit") {
        const trimmed = message.trim();
        if (!trimmed) return;
        await api.git.commit(projectPath, trimmed);
        setMessage("");
      }
      await load();
    } catch (e) {
      setError(String(e));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Git"
        subtitle="Repository status, history, and common actions"
        icon={GitBranch}
        actions={
          <>
            <ProjectPicker />
            <ActionButton onClick={load} disabled={!projectPath || loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </ActionButton>
            <ActionButton onClick={() => void run("terminal")} disabled={!projectPath || !!busy}>
              <Terminal size={14} />
              Terminal
            </ActionButton>
          </>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        {!projectPath ? (
          <EmptyState title="Select a project" detail="Git actions run in the selected project." />
        ) : loading ? (
          <LoadingLine />
        ) : !status?.is_repo ? (
          <EmptyState title="Not a git repository" detail={projectPath} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Branch" value={status.branch} />
              <StatCard label="State" value={status.clean ? "Clean" : "Changed"} />
              <StatCard label="Ahead" value={status.ahead} />
              <StatCard label="Behind" value={status.behind} />
            </div>
            <section className="bg-bg-secondary border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Commit message"
                />
                <ActionButton onClick={() => void run("commit")} disabled={!!busy || !message.trim()} variant="primary">
                  <GitCommit size={14} />
                  Commit
                </ActionButton>
                <ActionButton onClick={() => void run("pull")} disabled={!!busy}>Pull</ActionButton>
                <ActionButton onClick={() => void run("push")} disabled={!!busy}>Push</ActionButton>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h2 className="text-sm font-medium text-text-secondary mb-2">Changed Files</h2>
                  {status.files.length === 0 ? (
                    <EmptyState title="No file changes" />
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                      {status.files.map((file) => (
                        <div key={`${file.status}:${file.path}`} className="px-3 py-2 text-sm flex gap-3">
                          <span className="text-accent font-mono w-8">{file.status}</span>
                          <span className="text-text-primary truncate">{file.path}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-medium text-text-secondary mb-2">Recent Commits</h2>
                  <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                    {log.map((entry) => (
                      <div key={entry.hash} className="px-3 py-2">
                        <p className="text-sm text-text-primary truncate">{entry.message}</p>
                        <p className="text-xs text-text-muted">
                          {entry.hash.slice(0, 8)} · {entry.author} · {entry.date}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            {diff && (
              <pre className="bg-bg-secondary border border-border rounded-lg p-4 text-xs overflow-auto max-h-80 text-text-secondary">
                {diff}
              </pre>
            )}
          </div>
        )}
      </PageBody>
    </div>
  );
}
