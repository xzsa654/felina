import { useState, useEffect } from "react";
import { api } from "$lib/tauri/commands";
import type { InstructionFile } from "$lib/types";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import { useProjectContextStore } from "$lib/stores/project-context";
import { marked } from "marked";
import { X, FileText, ExternalLink } from "lucide-react";

const SCOPE_LABELS: Record<string, string> = {
  global: "~/.claude/CLAUDE.md",
  project: "./CLAUDE.md",
  "project-dot": "./.claude/CLAUDE.md",
  local: "./CLAUDE.local.md",
};

const TABS = [
  { id: "global" as const, label: "Global" },
  { id: "project" as const, label: "Project" },
  { id: "project-dot" as const, label: "Project (.claude/)" },
  { id: "local" as const, label: "Local (gitignored)" },
];

type Scope = "global" | "project" | "project-dot" | "local";

export default function InstructionsPage() {
  const { selectedProjectPath } = useProjectContextStore();
  const [activeScope, setActiveScope] = useState<Scope>("global");
  const [file, setFile] = useState<InstructionFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [content, setContent] = useState("");

  const [refOpen, setRefOpen] = useState(false);
  const [refName, setRefName] = useState("");
  const [refContent, setRefContent] = useState("");
  const [refLoading, setRefLoading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  const needsProject = activeScope !== "global";

  async function loadInstructions(scope = activeScope, path = selectedProjectPath) {
    if (scope !== "global" && !path) {
      setLoading(false);
      setFile(null);
      setContent("");
      return;
    }
    setLoading(true);
    try {
      const f = await api.instructions.read(scope, scope !== "global" ? (path ?? undefined) : undefined);
      setFile(f);
      setContent(f.content);
    } catch (e) {
      console.error("Failed to load:", e);
      setFile(null);
      setContent("");
    } finally {
      setLoading(false);
    }
  }

  async function saveInstructions() {
    setSaving(true);
    setSaveMessage(null);
    try {
      await api.instructions.write(activeScope, content, needsProject ? (selectedProjectPath ?? undefined) : undefined);
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (e) {
      setSaveMessage(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  async function openReference(ref: string) {
    if (!file?.path) return;
    setRefName(ref);
    setRefOpen(true);
    setRefLoading(true);
    setRefError(null);
    setRefContent("");
    try {
      const c = await api.instructions.readReference(file.path, ref);
      setRefContent(c);
    } catch (e) {
      setRefError(`${e}`);
    } finally {
      setRefLoading(false);
    }
  }

  function handleScopeChange(scope: Scope) {
    setActiveScope(scope);
    loadInstructions(scope);
  }

  useEffect(() => {
    loadInstructions();
  }, []);

  return (
    <>
      <div className="p-6 overflow-y-auto h-full flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    activeScope === tab.id
                      ? "bg-bg-secondary text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                  onClick={() => handleScopeChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {needsProject && <ProjectPicker onselect={() => loadInstructions()} />}
          </div>

          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className={`text-xs ${saveMessage.startsWith("Error") ? "text-danger" : "text-success"}`}>
                {saveMessage}
              </span>
            )}
            <button
              className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors disabled:opacity-50"
              onClick={saveInstructions}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <p className="text-xs text-text-muted font-mono">{SCOPE_LABELS[activeScope]}</p>

        {needsProject && !selectedProjectPath ? (
          <div className="flex items-center justify-center h-48 text-sm text-text-muted">
            Select a project to edit instructions
          </div>
        ) : loading ? (
          <p className="text-sm text-text-muted">Loading...</p>
        ) : (
          <>
            {file?.imports && file.imports.length > 0 && (
              <div className="bg-bg-secondary border border-border rounded-lg p-3">
                <p className="text-xs text-text-muted mb-2">Referenced imports:</p>
                <div className="flex flex-wrap gap-2">
                  {file.imports.map((imp) => (
                    <button
                      key={imp}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-accent/10 text-accent rounded-md font-mono hover:bg-accent/20 transition-colors"
                      onClick={() => openReference(imp)}
                    >
                      <FileText size={12} />
                      @{imp}
                      <ExternalLink size={10} className="opacity-50" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1 w-fit">
              <button
                className={`px-3 py-1 text-xs rounded-md transition-colors ${!previewMode ? "bg-bg-secondary text-text-primary" : "text-text-muted"}`}
                onClick={() => setPreviewMode(false)}
              >
                Edit
              </button>
              <button
                className={`px-3 py-1 text-xs rounded-md transition-colors ${previewMode ? "bg-bg-secondary text-text-primary" : "text-text-muted"}`}
                onClick={() => setPreviewMode(true)}
              >
                Preview
              </button>
            </div>

            {!file?.exists && !previewMode && (
              <div className="bg-bg-secondary border border-border rounded-lg p-4 text-center">
                <p className="text-sm text-text-muted mb-2">This file doesn't exist yet</p>
                <p className="text-xs text-text-muted">Start typing below to create it</p>
              </div>
            )}

            {previewMode ? (
              <div
                className="flex-1 w-full px-6 py-4 bg-bg-secondary border border-border rounded-lg overflow-y-auto md-preview"
                dangerouslySetInnerHTML={{ __html: marked(content || "") as string }}
              />
            ) : (
              <textarea
                className="flex-1 w-full px-4 py-3 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono resize-none"
                placeholder="# Instructions for Claude Code..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            )}
          </>
        )}
      </div>

      {refOpen && (
        <>
          <button
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setRefOpen(false)}
            aria-label="Close reference"
          />
          <div className="fixed top-0 right-0 h-full w-[500px] bg-bg-secondary border-l border-border z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-accent" />
                <span className="text-sm font-medium text-text-primary font-mono">@{refName}</span>
              </div>
              <button
                className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
                onClick={() => setRefOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {refLoading ? (
                <p className="text-sm text-text-muted">Loading...</p>
              ) : refError ? (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3">
                  <p className="text-sm text-danger">{refError}</p>
                </div>
              ) : (
                <div
                  className="md-preview"
                  dangerouslySetInnerHTML={{ __html: marked(refContent) as string }}
                />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
