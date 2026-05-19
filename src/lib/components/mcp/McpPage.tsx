import { useState, useEffect } from "react";
import { api } from "$lib/tauri/commands";
import type { SettingsScope } from "$lib/types";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { useProjectContextStore } from "$lib/stores/project-context";
import { Server, Plus, Cloud, Terminal, Globe, Trash2, Edit3, X, LayoutGrid } from "lucide-react";
import TemplateGallery, { type Template } from "$lib/components/shared/TemplateGallery";

interface ServerEntry {
  name: string;
  config: Record<string, unknown>;
}

const SCOPE_LABEL: Record<string, string> = {
  desktop: "Claude Desktop",
  global: "Claude Code (user)",
  "mcp-local": "Project (.mcp.json)",
  project: "Project (.claude/settings.json)",
};

const TABS = [
  { id: "desktop" as const, label: "Desktop" },
  { id: "global" as const, label: "Global" },
  { id: "mcp-local" as const, label: "Local" },
  { id: "project" as const, label: "Project" },
];

export default function McpPage() {
  const { selectedProjectPath } = useProjectContextStore();
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [cloudMcps, setCloudMcps] = useState<string[]>([]);
  const [scope, setScope] = useState<SettingsScope>("desktop");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [editing, setEditing] = useState<ServerEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"stdio" | "sse">("stdio");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formUrl, setFormUrl] = useState("");

  const [deletingServerName, setDeletingServerName] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const needsProject = scope === "project" || scope === "mcp-local";

  async function loadServers(s = scope, path = selectedProjectPath) {
    if ((s === "project" || s === "mcp-local") && !path) {
      setLoading(false);
      setServers([]);
      return;
    }
    setLoading(true);
    try {
      const pp = (s === "project" || s === "mcp-local") ? (path ?? undefined) : undefined;
      const [raw, cloud] = await Promise.all([
        api.mcp.list(s, pp) as Promise<Record<string, Record<string, unknown>>>,
        api.mcp.getCloudMcps(),
      ]);
      setServers(Object.entries(raw).map(([name, config]) => ({ name, config })));
      setCloudMcps(cloud);
    } catch (e) {
      console.error("Failed:", e);
      setServers([]);
    } finally {
      setLoading(false);
    }
  }

  function editServer(server: ServerEntry) {
    setEditing(server);
    setIsNew(false);
    setFormName(server.name);
    if ("url" in server.config) {
      setFormType("sse");
      setFormUrl((server.config.url as string) ?? "");
      setFormCommand("");
      setFormArgs("");
    } else {
      setFormType("stdio");
      setFormCommand((server.config.command as string) ?? "");
      setFormArgs(((server.config.args as string[]) ?? []).join(" "));
      setFormUrl("");
    }
  }

  function newServer(template?: { name: string; type: "stdio" | "sse"; command: string; args: string }) {
    setEditing({ name: "", config: {} });
    setIsNew(true);
    setFormName(template?.name ?? "");
    setFormType(template?.type ?? "stdio");
    setFormCommand(template?.command ?? "");
    setFormArgs(template?.args ?? "");
    setFormUrl("");
  }

  async function saveServer() {
    if (!formName.trim()) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const pp = needsProject ? (selectedProjectPath ?? undefined) : undefined;
      const config = formType === "stdio"
        ? { command: formCommand, args: formArgs.split(/\s+/).filter(Boolean) }
        : { url: formUrl };
      await api.mcp.upsert(scope, formName.trim(), config, pp);
      await loadServers();
      setEditing(null);
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (e) {
      setSaveMessage(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteServer(name: string) {
    try {
      const pp = needsProject ? (selectedProjectPath ?? undefined) : undefined;
      await api.mcp.delete(scope, name, pp);
      await loadServers();
      if (editing?.name === name) setEditing(null);
    } catch (e) {
      console.error("Failed:", e);
    } finally {
      setDeletingServerName(null);
    }
  }

  useEffect(() => { loadServers(); }, []);

  const serverTypes = [
    { id: "stdio" as const, label: "Command (stdio)", Icon: Terminal },
    { id: "sse" as const, label: "URL (SSE/HTTP)", Icon: Globe },
  ];

  return (
    <>
      <ConfirmDialog
        open={deletingServerName !== null}
        title="Delete Server"
        message={`The server '${deletingServerName}' will be permanently removed.`}
        onconfirm={() => { if (deletingServerName) deleteServer(deletingServerName); }}
        oncancel={() => setDeletingServerName(null)}
      />

      <div className="flex h-full">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                      scope === tab.id ? "bg-bg-secondary text-text-primary" : "text-text-muted hover:text-text-secondary"
                    }`}
                    onClick={() => { setScope(tab.id); setEditing(null); loadServers(tab.id); }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {needsProject && <ProjectPicker onselect={() => loadServers()} />}
            </div>
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className={`text-xs ${saveMessage.startsWith("Error") ? "text-danger" : "text-success"}`}>
                  {saveMessage}
                </span>
              )}
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded-md text-text-secondary hover:border-accent/30 hover:text-accent transition-colors"
                onClick={() => setGalleryOpen(true)}
              >
                <LayoutGrid size={14} />
                Templates
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
                onClick={() => newServer()}
              >
                <Plus size={14} />
                Add Server
              </button>
            </div>
          </div>

          {needsProject && !selectedProjectPath ? (
            <div className="flex items-center justify-center h-48 text-sm text-text-muted">
              Select a project
            </div>
          ) : loading ? (
            <p className="text-sm text-text-muted">Loading...</p>
          ) : (
            <>
              {cloudMcps.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Cloud size={12} />
                    Cloud (configured at claude.ai)
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {cloudMcps.map((name) => (
                      <div key={name} className="bg-bg-secondary border border-border rounded-lg p-3 flex items-center gap-3 opacity-70">
                        <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                          <Cloud size={16} className="text-info" />
                        </div>
                        <div>
                          <p className="text-sm text-text-primary">{name}</p>
                          <p className="text-xs text-text-muted">Managed via claude.ai</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Terminal size={12} />
                  {SCOPE_LABEL[scope] ?? scope}
                </h3>

                {servers.length > 0 ? (
                  <div className="space-y-2">
                    {servers.map((server) => {
                      const isStdio = "command" in server.config;
                      return (
                        <div
                          key={server.name}
                          className={`bg-bg-secondary border rounded-lg p-4 flex items-center gap-4 group cursor-pointer transition-colors hover:border-accent/30 ${
                            editing?.name === server.name ? "border-accent/50" : "border-border"
                          }`}
                          role="button"
                          tabIndex={0}
                          onClick={() => editServer(server)}
                          onKeyDown={(e) => e.key === "Enter" && editServer(server)}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isStdio ? "bg-success/10" : "bg-accent/10"}`}>
                            {isStdio
                              ? <Terminal size={18} className="text-success" />
                              : <Globe size={18} className="text-accent" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary">{server.name}</p>
                            <p className="text-xs text-text-muted font-mono truncate">
                              {isStdio
                                ? `${server.config.command} ${((server.config.args as string[]) ?? []).join(" ")}`
                                : String(server.config.url)
                              }
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-1.5 rounded hover:bg-bg-hover text-text-muted"
                              onClick={(e) => { e.stopPropagation(); editServer(server); }}
                              aria-label="Edit"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-danger"
                              onClick={(e) => { e.stopPropagation(); setDeletingServerName(server.name); }}
                              aria-label="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-bg-secondary border border-border rounded-lg p-8 text-center">
                    <Server size={24} className="mx-auto mb-3 opacity-20 text-text-muted" />
                    <p className="text-sm text-text-muted mb-1">No MCP servers configured</p>
                    <p className="text-xs text-text-muted">Add a server or browse templates</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {editing && (
          <div className="w-[400px] shrink-0 border-l border-border flex flex-col bg-bg-secondary">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium text-text-primary">
                {isNew ? "Add Server" : `Edit: ${editing.name}`}
              </span>
              <button className="p-1 text-text-muted hover:text-text-primary" onClick={() => setEditing(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <label className="block">
                <span className="text-xs text-text-muted">Server Name</span>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary font-mono focus:outline-none focus:border-accent"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={!isNew}
                />
              </label>

              <div>
                <span className="text-xs text-text-muted">Type</span>
                <div className="flex gap-1 mt-1" role="group" aria-label="Server type">
                  {serverTypes.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors flex-1 ${
                        formType === id ? "bg-accent text-white" : "bg-bg-tertiary text-text-muted"
                      }`}
                      onClick={() => setFormType(id)}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {formType === "stdio" ? (
                <>
                  <label className="block">
                    <span className="text-xs text-text-muted">Command</span>
                    <input
                      type="text"
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary font-mono focus:outline-none focus:border-accent"
                      placeholder="npx, node, python..."
                      value={formCommand}
                      onChange={(e) => setFormCommand(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-text-muted">Arguments</span>
                    <input
                      type="text"
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary font-mono focus:outline-none focus:border-accent"
                      placeholder="-y @modelcontextprotocol/server-..."
                      value={formArgs}
                      onChange={(e) => setFormArgs(e.target.value)}
                    />
                    <p className="text-[10px] text-text-muted mt-1">Space-separated arguments</p>
                  </label>
                </>
              ) : (
                <label className="block">
                  <span className="text-xs text-text-muted">URL</span>
                  <input
                    type="text"
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary font-mono focus:outline-none focus:border-accent"
                    placeholder="http://localhost:8000/sse"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                  />
                </label>
              )}
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button className="px-4 py-1.5 text-sm text-text-muted hover:text-text-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors disabled:opacity-50"
                onClick={saveServer}
                disabled={saving || !formName.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      <TemplateGallery
        open={galleryOpen}
        defaultCategory="mcp"
        onselect={async (template: Template) => {
          const name = template.name.toLowerCase().replace(/\s+/g, "-");
          if (template.mcpUrl) {
            const pp = needsProject ? (selectedProjectPath ?? undefined) : undefined;
            await api.mcp.upsert(scope, name, { url: template.mcpUrl }, pp);
            await loadServers();
          } else {
            newServer({
              name,
              type: (template.mcpType ?? "stdio") as "stdio" | "sse",
              command: template.mcpCommand ?? "",
              args: template.mcpArgs ?? "",
            });
          }
        }}
        onclose={() => setGalleryOpen(false)}
      />
    </>
  );
}
