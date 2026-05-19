import { useState } from "react";
import type { HookHandler, HookEvent } from "$lib/types";
import { HOOK_EVENT_DESCRIPTIONS } from "$lib/types";
import { Zap, Globe, MessageSquare, Bot, Trash2, ChevronDown } from "lucide-react";

interface Props {
  event: string;
  matcher: string | undefined;
  handler: HookHandler;
  onupdate: (handler: HookHandler) => void;
  ondelete: () => void;
}

const TYPE_ICONS = {
  command: Zap,
  http: Globe,
  prompt: MessageSquare,
  agent: Bot,
} as const;

const TYPE_LABELS = {
  command: "Shell Command",
  http: "HTTP Webhook",
  prompt: "AI Prompt",
  agent: "Agent",
} as const;

export default function HookCard({ event, matcher, handler, onupdate, ondelete }: Props) {
  const [expanded, setExpanded] = useState(true);

  const Icon = TYPE_ICONS[handler.type] ?? Zap;
  const description = HOOK_EVENT_DESCRIPTIONS[event as HookEvent] ?? "";

  function updateField<K extends keyof HookHandler>(key: K, value: HookHandler[K]) {
    onupdate({ ...handler, [key]: value });
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-bg-hover/50 transition-colors"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
      >
        <div className="w-7 h-7 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{event}</span>
            {matcher && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted font-mono">
                {matcher}
              </span>
            )}
            <span className="text-xs text-text-muted">· {TYPE_LABELS[handler.type]}</span>
          </div>
          <p className="text-xs text-text-muted truncate">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="text-xs px-2 py-1 rounded text-text-muted hover:text-danger transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              ondelete();
            }}
            aria-label="Delete hook"
          >
            <Trash2 size={14} />
          </button>
          <ChevronDown
            size={14}
            className={`text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted w-14 shrink-0">Type</span>
            <div className="flex gap-1" role="group" aria-label="Hook type">
              {(["command", "http", "prompt", "agent"] as const).map((type) => (
                <button
                  key={type}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    handler.type === type
                      ? "bg-accent text-white"
                      : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                  }`}
                  onClick={() => updateField("type", type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-xs text-text-muted w-14 shrink-0 pt-2">
              {handler.type === "command" ? "Command" : handler.type === "http" ? "URL" : "Prompt"}
            </span>
            {handler.type === "command" ? (
              <input
                type="text"
                aria-label="Command"
                className="flex-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary font-mono focus:outline-none focus:border-accent"
                placeholder="/path/to/script.sh or shell command"
                value={handler.command ?? ""}
                onChange={(e) => updateField("command", e.target.value)}
              />
            ) : handler.type === "http" ? (
              <input
                type="text"
                aria-label="URL"
                className="flex-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary font-mono focus:outline-none focus:border-accent"
                placeholder="https://example.com/webhook"
                value={handler.url ?? ""}
                onChange={(e) => updateField("url", e.target.value)}
              />
            ) : (
              <textarea
                aria-label="Prompt"
                className="flex-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary font-mono focus:outline-none focus:border-accent resize-y"
                rows={2}
                placeholder="Describe what to validate or check..."
                value={handler.prompt ?? ""}
                onChange={(e) => updateField("prompt", e.target.value)}
              />
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Timeout</span>
              <input
                type="number"
                aria-label="Timeout seconds"
                className="w-16 px-2 py-1 text-xs bg-bg-tertiary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                placeholder="600"
                value={handler.timeout ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateField("timeout", isNaN(val) ? undefined : val);
                }}
              />
              <span className="text-xs text-text-muted">s</span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-text-muted">Status</span>
              <input
                type="text"
                aria-label="Status message"
                className="flex-1 px-2 py-1 text-xs bg-bg-tertiary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                placeholder="Validating..."
                value={handler.statusMessage ?? ""}
                onChange={(e) =>
                  updateField("statusMessage", e.target.value || undefined)
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
