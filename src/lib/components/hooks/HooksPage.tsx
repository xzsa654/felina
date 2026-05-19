import { useState, useEffect } from "react";
import { api } from "$lib/tauri/commands";
import { HOOK_EVENTS, HOOK_EVENT_DESCRIPTIONS } from "$lib/types";
import type { HookEvent, HookEventConfig, HookHandler, SettingsScope } from "$lib/types";
import HookCard from "./HookCard";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import { useProjectContextStore } from "$lib/stores/project-context";
import { Plus, Zap, LayoutGrid } from "lucide-react";
import TemplateGallery, { type Template } from "$lib/components/shared/TemplateGallery";

interface FlatHook {
  event: string;
  matcher: string | undefined;
  handler: HookHandler;
  configIndex: number;
  handlerIndex: number;
}

export default function HooksPage() {
  const { selectedProjectPath } = useProjectContextStore();
  const [rawHooks, setRawHooks] = useState<Record<string, HookEventConfig[]>>({});
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<SettingsScope>("global");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HookEvent | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FlatHook | null>(null);
  const [newMatcher, setNewMatcher] = useState("");
  const [newType, setNewType] = useState<HookHandler["type"]>("command");
  const [newValue, setNewValue] = useState("");

  const needsProject = scope !== "global";

  const eventHooks: FlatHook[] = (() => {
    if (!selectedEvent) return [];
    const configs = rawHooks[selectedEvent] ?? [];
    const result: FlatHook[] = [];
    for (let ci = 0; ci < configs.length; ci++) {
      for (let hi = 0; hi < configs[ci].hooks.length; hi++) {
        result.push({
          event: selectedEvent,
          matcher: configs[ci].matcher,
          handler: configs[ci].hooks[hi],
          configIndex: ci,
          handlerIndex: hi,
        });
      }
    }
    return result;
  })();

  function hookCount(event: string): number {
    return (rawHooks[event] ?? []).reduce((sum, c) => sum + c.hooks.length, 0);
  }

  async function loadHooks(s = scope, path = selectedProjectPath) {
    if (s !== "global" && !path) {
      setLoading(false);
      setRawHooks({});
      return;
    }
    setLoading(true);
    try {
      const hooks = (await api.hooks.get(
        s,
        s !== "global" ? (path ?? undefined) : undefined,
      )) as Record<string, HookEventConfig[]>;
      setRawHooks(hooks);
    } catch (e) {
      console.error("Failed:", e);
      setRawHooks({});
    } finally {
      setLoading(false);
    }
  }

  async function saveHooks() {
    setSaving(true);
    setSaveMessage(null);
    try {
      await api.hooks.set(
        scope,
        rawHooks,
        needsProject ? (selectedProjectPath ?? undefined) : undefined,
      );
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (e) {
      setSaveMessage(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  function addHook(event: string, matcher: string | undefined, handler: HookHandler) {
    setRawHooks((prev) => {
      const updated = { ...prev };
      if (!updated[event]) updated[event] = [];
      updated[event] = [
        ...updated[event],
        { matcher: matcher || undefined, hooks: [handler] },
      ];
      return updated;
    });
    setShowAddForm(false);
    setNewValue("");
    setNewMatcher("");
  }

  function addFromForm() {
    if (!selectedEvent) return;
    const handler: HookHandler = { type: newType };
    if (newType === "command") handler.command = newValue || "echo 'hook'";
    else if (newType === "http") handler.url = newValue || "http://localhost:8080/hook";
    else handler.prompt = newValue || "Validate this action";
    addHook(selectedEvent, newMatcher, handler);
  }

  function updateHandler(flat: FlatHook, handler: HookHandler) {
    setRawHooks((prev) => {
      const updated = { ...prev };
      const configs = [...(updated[flat.event] ?? [])];
      const config = { ...configs[flat.configIndex] };
      config.hooks = [...config.hooks];
      config.hooks[flat.handlerIndex] = handler;
      configs[flat.configIndex] = config;
      updated[flat.event] = configs;
      return updated;
    });
  }

  function confirmDeleteHook() {
    if (!deleteTarget) return;
    const flat = deleteTarget;
    setRawHooks((prev) => {
      const updated = { ...prev };
      const configs = [...(updated[flat.event] ?? [])];
      const config = { ...configs[flat.configIndex] };
      config.hooks = config.hooks.filter((_, i) => i !== flat.handlerIndex);
      if (config.hooks.length === 0) {
        configs.splice(flat.configIndex, 1);
      } else {
        configs[flat.configIndex] = config;
      }
      updated[flat.event] = configs.length > 0 ? configs : [];
      if (configs.length === 0) delete updated[flat.event];
      return updated;
    });
    setDeleteTarget(null);
  }

  useEffect(() => {
    loadHooks();
  }, []);

  return (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Hook"
        message="This hook will be removed. Save to apply changes."
        onconfirm={confirmDeleteHook}
        oncancel={() => setDeleteTarget(null)}
      />

      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
              {([{ id: "global" as const, label: "Global" }, { id: "project" as const, label: "Project" }]).map((tab) => (
                <button
                  key={tab.id}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${scope === tab.id ? "bg-bg-secondary text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
                  onClick={() => { setScope(tab.id); loadHooks(tab.id); }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {needsProject && <ProjectPicker onselect={() => loadHooks()} />}
          </div>
          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className={`text-xs ${saveMessage.startsWith("Error") ? "text-danger" : "text-success"}`}>
                {saveMessage}
              </span>
            )}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-secondary hover:border-accent/30 hover:text-accent transition-colors"
              onClick={() => setGalleryOpen(true)}
            >
              <LayoutGrid size={14} />
              Templates
            </button>
            <button
              className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors disabled:opacity-50"
              onClick={saveHooks}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {needsProject && !selectedProjectPath ? (
          <div className="flex items-center justify-center flex-1 text-sm text-text-muted">
            Select a project
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center flex-1 text-sm text-text-muted">
            Loading...
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            {/* Event Sidebar */}
            <div className="w-64 shrink-0 border-r border-border overflow-y-auto py-2">
              {HOOK_EVENTS.map((event) => {
                const count = hookCount(event);
                return (
                  <button
                    key={event}
                    className={`w-full flex items-center justify-between px-4 py-2 text-left transition-colors ${
                      selectedEvent === event
                        ? "bg-accent/10 text-accent border-r-2 border-accent"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    }`}
                    onClick={() => { setSelectedEvent(event); setShowAddForm(false); }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{event}</p>
                      <p className="text-[10px] text-text-muted truncate">
                        {HOOK_EVENT_DESCRIPTIONS[event]}
                      </p>
                    </div>
                    {count > 0 && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent shrink-0">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Panel */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!selectedEvent ? (
                <div className="flex flex-col items-center justify-center h-full text-text-muted">
                  <Zap size={32} className="opacity-20 mb-3" />
                  <p className="text-sm">Select an event to configure hooks</p>
                  <p className="text-xs mt-1">Hooks run automatically when events occur in Claude Code</p>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-base font-medium text-text-primary">{selectedEvent}</h3>
                    <p className="text-xs text-text-muted">{HOOK_EVENT_DESCRIPTIONS[selectedEvent]}</p>
                  </div>

                  <div className="space-y-3">
                    {eventHooks.map((flat, idx) => (
                      <HookCard
                        key={idx}
                        event={flat.event}
                        matcher={flat.matcher}
                        handler={flat.handler}
                        onupdate={(h) => updateHandler(flat, h)}
                        ondelete={() => setDeleteTarget(flat)}
                      />
                    ))}
                  </div>

                  {showAddForm ? (
                    <div className="bg-bg-secondary border border-accent/30 rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-xs text-text-muted">Matcher <span className="text-text-muted">(e.g. Bash, Edit, * for all)</span></span>
                          <input
                            type="text"
                            className="w-full mt-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary font-mono focus:outline-none focus:border-accent"
                            placeholder="*"
                            value={newMatcher}
                            onChange={(e) => setNewMatcher(e.target.value)}
                          />
                        </label>
                        <div>
                          <span className="text-xs text-text-muted">Type</span>
                          <div className="flex gap-1 mt-1" role="group" aria-label="Hook type">
                            {(["command", "http", "prompt", "agent"] as const).map((type) => (
                              <button
                                key={type}
                                className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${newType === type ? "bg-accent text-white" : "bg-bg-tertiary text-text-muted"}`}
                                onClick={() => setNewType(type)}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <label className="block">
                        <span className="text-xs text-text-muted">
                          {newType === "command" ? "Command" : newType === "http" ? "URL" : "Prompt"}
                        </span>
                        <input
                          type="text"
                          className="w-full mt-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary font-mono focus:outline-none focus:border-accent"
                          placeholder={
                            newType === "command" ? "/path/to/script.sh" : newType === "http" ? "https://..." : "Describe what to check..."
                          }
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          className="px-4 py-1.5 text-sm text-text-muted hover:text-text-secondary"
                          onClick={() => setShowAddForm(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md"
                          onClick={addFromForm}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg text-sm text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
                      onClick={() => setShowAddForm(true)}
                    >
                      <Plus size={16} />
                      Add Hook to {selectedEvent}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <TemplateGallery
        open={galleryOpen}
        defaultCategory="hook"
        onselect={(template: Template) => {
          const event = (template.event ?? selectedEvent ?? "PreToolUse") as HookEvent;
          if (!selectedEvent && template.event) {
            setSelectedEvent(event);
          }
          const matcher = template.matcher || undefined;
          const hookType = template.hookType ?? "command";
          const handler: HookHandler = { type: hookType };
          if (hookType === "command") handler.command = template.hookValue ?? "echo 'hook'";
          else if (hookType === "http") handler.url = template.hookValue ?? "http://localhost:8080/hook";
          else if (hookType === "prompt") handler.prompt = template.hookValue ?? "Validate this action";
          else handler.prompt = template.hookValue ?? "";
          addHook(event, matcher, handler);
        }}
        onclose={() => setGalleryOpen(false)}
      />
    </>
  );
}
