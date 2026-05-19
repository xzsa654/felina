import { useState, useEffect } from "react";
import { api, type SessionSummary } from "$lib/tauri/commands";
import { useNavigate } from "react-router";
import { History, DollarSign, MessageSquare, Wrench, RefreshCw } from "lucide-react";

function formatTime(ts: string | null): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function SessionMonitor() {
  const navigate = useNavigate();
  const [activeSessions, setActiveSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRecent() {
    try {
      const result = await api.sessions.list(5, 0);
      setActiveSessions(result.sessions);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecent();
    const timer = setInterval(loadRecent, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <History size={14} />
          Recent Sessions
        </h3>
        <button
          className="p-1 text-text-muted hover:text-text-primary"
          onClick={loadRecent}
          aria-label="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="space-y-2">
        {activeSessions.map((session) => (
          <button
            key={session.id}
            className="w-full text-left px-3 py-2 bg-bg-tertiary rounded-md hover:bg-bg-hover transition-colors"
            onClick={() => navigate("/sessions")}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-primary truncate">
                {session.project_path.split("/").pop()}
              </span>
              <span className="text-[10px] text-text-muted shrink-0">
                {formatTime(session.first_timestamp)}
              </span>
            </div>
            {session.first_message && (
              <p className="text-[10px] text-text-muted truncate mt-0.5">
                &ldquo;{session.first_message}&rdquo;
              </p>
            )}
            <div className="flex gap-3 mt-1 text-[10px] text-text-muted">
              <span className="flex items-center gap-0.5">
                <MessageSquare size={8} />
                {session.user_messages}
              </span>
              <span className="flex items-center gap-0.5">
                <Wrench size={8} />
                {session.tool_calls}
              </span>
              <span className="flex items-center gap-0.5">
                <DollarSign size={8} />~${(session.entry_count * 0.01).toFixed(2)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
