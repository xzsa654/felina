import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { Plus, Terminal as TerminalIcon, X } from "lucide-react";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import { ActionButton } from "$lib/components/shared/PageScaffold";
import { useProjectContextStore } from "$lib/stores/project-context";
import {
  attachToContainer,
  closeSession,
  createSession,
  detachFromContainer,
  fitActiveSession,
  getActiveSession,
  useTerminalStore,
} from "$lib/stores/terminal";

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const projectPath = useProjectContextStore((s) => s.selectedProjectPath);
  const sessions = useTerminalStore((s) => s.sessions);
  const activeId = useTerminalStore((s) => s.activeSessionId);
  const switchSession = useTerminalStore((s) => s.switchSession);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectName = projectPath ? (projectPath.split("/").pop() ?? projectPath) : "";

  async function startNew() {
    if (!projectPath || starting) return;
    setStarting(true);
    setError(null);
    try {
      await createSession(projectPath, projectName);
      requestAnimationFrame(() => {
        if (containerRef.current) attachToContainer(containerRef.current);
      });
    } catch (e) {
      setError(`Failed to start: ${e}`);
    } finally {
      setStarting(false);
    }
  }

  function selectSession(id: string) {
    detachFromContainer();
    switchSession(id);
    requestAnimationFrame(() => {
      if (containerRef.current) attachToContainer(containerRef.current);
    });
  }

  async function close(id: string) {
    await closeSession(id);
    requestAnimationFrame(() => {
      if (containerRef.current && getActiveSession()) {
        attachToContainer(containerRef.current);
      }
    });
  }

  useEffect(() => {
    const onResize = () => window.setTimeout(fitActiveSession, 100);
    window.addEventListener("resize", onResize);
    if (containerRef.current && getActiveSession()) {
      requestAnimationFrame(() => {
        if (containerRef.current) attachToContainer(containerRef.current);
      });
    }
    return () => {
      window.removeEventListener("resize", onResize);
      detachFromContainer();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          <ProjectPicker />
          <ActionButton onClick={startNew} disabled={!projectPath || starting} variant="primary">
            <Plus size={14} />
            {starting ? "Starting..." : "New Session"}
          </ActionButton>
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>

      {sessions.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-bg-secondary/50 shrink-0 overflow-x-auto">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className={`flex items-center gap-1.5 pl-3 pr-1 py-1 text-xs rounded-md transition-colors shrink-0 ${
                activeId === session.id
                  ? "bg-bg-tertiary text-text-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
              }`}
              onClick={() => selectSession(session.id)}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${session.alive ? "bg-success" : "bg-text-muted"}`}
              />
              <span className="max-w-32 truncate">{session.projectName}</span>
              <span
                role="button"
                tabIndex={0}
                className="ml-1 p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-danger"
                onClick={(event) => {
                  event.stopPropagation();
                  void close(session.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.stopPropagation();
                    void close(session.id);
                  }
                }}
                aria-label="Close session"
              >
                <X size={12} />
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 relative bg-[#0d1117]">
        {sessions.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted">
            <TerminalIcon size={56} className="mb-4 opacity-20" />
            <p className="text-sm mb-1">
              {projectPath ? "Click New Session to start" : "Select a project first"}
            </p>
            <p className="text-xs text-text-muted">Sessions persist when you navigate away</p>
          </div>
        )}
        <div
          ref={containerRef}
          className={`absolute inset-0 ${sessions.length === 0 ? "hidden" : ""}`}
        />
      </div>
    </div>
  );
}
