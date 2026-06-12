import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { api } from "$lib/tauri/commands";
import type { ProjectInfo, MemoryFile } from "$lib/types";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import ErrorNotice from "$lib/components/shared/ErrorNotice";
import MarkdownPreview from "$lib/components/shared/MarkdownPreview";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import {
  PageBody,
  PageHeader,
  glassListRowClass,
  glassListSelectedRowClass,
  glassListSurfaceClass,
} from "$lib/components/shared/PageScaffold";
import { X, Plus, Brain, User, MessageSquare, FolderOpen, BookOpen, Search, Trash2 } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  user: "bg-info/10 text-info",
  feedback: "bg-warning/10 text-warning",
  project: "bg-success/10 text-success",
  reference: "bg-accent/10 text-accent",
};

const TYPE_ICONS: Record<string, React.ComponentType<{ size: number }>> = {
  user: User,
  feedback: MessageSquare,
  project: FolderOpen,
  reference: BookOpen,
};

/** Display-only basename; backslash-normalized so Windows paths show the last segment. */
function projectDisplayName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || path;
}

export default function MemoryPage() {
  const locale = useLocaleStore((s) => s.locale);
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkRestored = useRef(false);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageError, setPageError] = useState<{ title: string; detail: string } | null>(null);

  const [editingFile, setEditingFile] = useState<MemoryFile | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newFilename, setNewFilename] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const filteredProjects = projects
    .filter((p) => p.has_memory)
    .filter((p) => !searchQuery || p.path.toLowerCase().includes(searchQuery.toLowerCase()));

  async function loadProjects() {
    setLoading(true);
    try {
      setProjects(await api.projects.list());
    } catch (e) {
      setPageError({ title: t(locale, "memory.loadProjectsFailed"), detail: String(e) });
    } finally {
      setLoading(false);
    }
  }

  function updateMemorySearchParams(next: { project?: string; file?: string | null }) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next.project) params.set("project", next.project);
      if (next.file === null) params.delete("file");
      else if (next.file) params.set("file", next.file);
      return params;
    });
  }

  async function selectProject(project: ProjectInfo): Promise<MemoryFile[]> {
    setSelectedProject(project);
    setEditingFile(null);
    updateMemorySearchParams({ project: project.hash, file: null });
    try {
      const files = await api.memory.listFiles(project.hash);
      setMemoryFiles(files);
      return files;
    } catch (e) {
      setPageError({ title: t(locale, "memory.loadFilesFailed"), detail: String(e) });
      setMemoryFiles([]);
      return [];
    }
  }

  function openEditor(file: MemoryFile) {
    updateMemorySearchParams({ file: file.filename });
    setEditingFile(file);
    setEditContent(file.content);
    setEditName(file.name ?? "");
    setEditDescription(file.description ?? "");
    setEditType(file.memory_type ?? "");
    setPreviewMode(false);
    setShowCreate(false);
  }

  function startCreate() {
    setShowCreate(true);
    setEditingFile(null);
    updateMemorySearchParams({ file: null });
    setEditContent("");
    setEditName("");
    setEditDescription("");
    setEditType("project");
    setNewFilename("");
    setPreviewMode(false);
  }

  async function saveFile() {
    if (!selectedProject) return;
    const filename = showCreate
      ? newFilename.endsWith(".md") ? newFilename : newFilename + ".md"
      : editingFile?.filename;
    if (!filename) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await api.memory.writeFile(
        selectedProject.hash, filename,
        editName || null, editDescription || null, editType || null, editContent,
      );
      setSaveMessage(t(locale, "memory.saved"));
      setTimeout(() => setSaveMessage(null), 2000);
      const files = await api.memory.listFiles(selectedProject.hash);
      setMemoryFiles(files);
      if (showCreate) {
        setShowCreate(false);
        const found = files.find((f: MemoryFile) => f.filename === filename);
        if (found) openEditor(found);
      }
    } catch (e) {
      setPageError({ title: t(locale, "memory.saveFailed"), detail: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function deleteFile() {
    if (!selectedProject || !editingFile) return;
    try {
      await api.memory.deleteFile(selectedProject.hash, editingFile.filename);
      setMemoryFiles((prev) => prev.filter((f) => f.filename !== editingFile!.filename));
      setEditingFile(null);
      updateMemorySearchParams({ file: null });
    } catch (e) {
      setPageError({ title: t(locale, "memory.deleteFailed"), detail: String(e) });
    } finally {
      setDeleteDialogOpen(false);
    }
  }

  useEffect(() => { loadProjects(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // One-shot deep-link restore once the project list is ready; unmatched params are silently ignored.
  useEffect(() => {
    if (deepLinkRestored.current || projects.length === 0) return;
    deepLinkRestored.current = true;
    const projectParam = searchParams.get("project");
    if (!projectParam) return;
    const project = projects.find((p) => p.has_memory && p.hash === projectParam);
    if (!project) return;
    const fileParam = searchParams.get("file");
    void selectProject(project).then((files) => {
      if (!fileParam) return;
      const file = files.find((f) => f.filename === fileParam);
      if (file) openEditor(file);
    });
  }, [projects, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const showEditor = editingFile || showCreate;

  return (
    <>
      <ConfirmDialog
        open={deleteDialogOpen}
        title={t(locale, "memory.deleteDialogTitle")}
        message={t(locale, "memory.deleteDialogMessage")}
        confirmLabel={t(locale, "memory.deleteConfirm")}
        onconfirm={deleteFile}
        oncancel={() => setDeleteDialogOpen(false)}
      />

      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <PageHeader title={t(locale, "memory.title")} icon={Brain} />
        <PageBody>
          {pageError && (
            <ErrorNotice
              title={pageError.title}
              detail={pageError.detail}
              onDismiss={() => setPageError(null)}
              className="mb-3"
            />
          )}
          <div className="flex h-full min-h-0 overflow-hidden">
        {/* Project Sidebar */}
        <div className={`w-56 shrink-0 border-r flex flex-col ${glassListSurfaceClass}`}>
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-text-muted" />
              <input
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                placeholder={t(locale, "memory.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <p className="text-xs text-text-muted px-3 py-4 text-center">{t(locale, "common.loading")}</p>
            ) : filteredProjects.length === 0 ? (
              <p className="text-xs text-text-muted px-3 py-4 text-center">{t(locale, "memory.noProjects")}</p>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.hash}
                  className={`mx-2 mb-1 w-[calc(100%-1rem)] rounded-lg border px-3 py-2 text-left transition-colors ${
                    selectedProject?.hash === project.hash
                      ? `${glassListSelectedRowClass} text-accent`
                      : `${glassListRowClass} text-text-secondary`
                  }`}
                  onClick={() => selectProject(project)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{projectDisplayName(project.path)}</p>
                    <Brain size={12} className="text-accent shrink-0" />
                  </div>
                  <p className="text-[10px] text-text-muted truncate font-mono">{project.path}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedProject ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <Brain size={32} className="opacity-20 mb-3" />
              <p className="text-sm">{t(locale, "memory.selectPrompt")}</p>
              <p className="text-xs mt-1">{t(locale, "memory.selectHint")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-medium text-text-primary">
                    {projectDisplayName(selectedProject.path)}
                  </h3>
                  <p className="text-xs text-text-muted font-mono">{selectedProject.path}</p>
                </div>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
                  onClick={startCreate}
                >
                  <Plus size={14} />
                  {t(locale, "memory.newMemory")}
                </button>
              </div>

              {memoryFiles.length === 0 && !showCreate ? (
                <div className="text-center py-12 text-sm text-text-muted">
                  {t(locale, "memory.noFiles")}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {memoryFiles.map((file) => {
                    const typeColor = TYPE_COLORS[file.memory_type ?? ""] ?? "bg-bg-tertiary text-text-muted";
                    const TypeIcon = TYPE_ICONS[file.memory_type ?? ""] ?? Brain;
                    return (
                      <button
                        key={file.filename}
                        className={`text-left p-4 bg-bg-secondary border rounded-lg transition-colors hover:border-accent/30 ${
                          editingFile?.filename === file.filename ? "border-accent/50 bg-accent/5" : "border-border"
                        }`}
                        onClick={() => openEditor(file)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${typeColor}`}>
                              <TypeIcon size={12} />
                            </div>
                            {file.memory_type && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeColor}`}>
                                {file.memory_type}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-medium text-text-primary truncate">
                          {file.name || file.filename}
                        </p>
                        {file.description && (
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{file.description}</p>
                        )}
                        <p className="text-xs text-text-muted mt-2 line-clamp-2 font-mono opacity-50">
                          {file.content.slice(0, 100)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Editor Sheet */}
        {showEditor && (
          <div className="w-[450px] shrink-0 border-l border-border flex flex-col bg-bg-secondary">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-sm font-medium text-text-primary truncate">
                {showCreate ? t(locale, "memory.newMemory") : editingFile?.filename}
              </span>
              <div className="flex items-center gap-2">
                {saveMessage && (
                  <span className="text-xs text-success">{saveMessage}</span>
                )}
                {editingFile && !showCreate && (
                  <button
                    className="p-1 text-text-muted hover:text-danger"
                    onClick={() => setDeleteDialogOpen(true)}
                    aria-label={t(locale, "memory.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  className="px-3 py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded-md disabled:opacity-50"
                  onClick={saveFile}
                  disabled={saving || (showCreate && !newFilename.trim())}
                >
                  {saving ? "..." : t(locale, "memory.save")}
                </button>
                <button
                  className="p-1 text-text-muted hover:text-text-primary"
                  onClick={() => { setEditingFile(null); setShowCreate(false); updateMemorySearchParams({ file: null }); }}
                  aria-label={t(locale, "common.close")}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-border space-y-2">
              {showCreate && (
                <label className="block">
                  <span className="text-xs text-text-muted">{t(locale, "memory.filename")}</span>
                  <input
                    type="text"
                    className="w-full mt-1 px-2 py-1 text-sm bg-bg-tertiary border border-border rounded text-text-primary font-mono focus:outline-none focus:border-accent"
                    placeholder="my-memory.md"
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                  />
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-text-muted">{t(locale, "memory.name")}</span>
                  <input
                    type="text"
                    className="w-full mt-1 px-2 py-1 text-sm bg-bg-tertiary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-text-muted">{t(locale, "memory.type")}</span>
                  <select
                    className="w-full mt-1 px-2 py-1 text-sm bg-bg-tertiary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                  >
                    <option value="">{t(locale, "memory.typeNone")}</option>
                    <option value="user">user</option>
                    <option value="feedback">feedback</option>
                    <option value="project">project</option>
                    <option value="reference">reference</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-text-muted">{t(locale, "memory.description")}</span>
                <input
                  type="text"
                  className="w-full mt-1 px-2 py-1 text-sm bg-bg-tertiary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                  placeholder={t(locale, "memory.descriptionPlaceholder")}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </label>
            </div>

            <div className="px-4 pt-3 pb-1">
              <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1 w-fit">
                <button
                  className={`px-3 py-1 text-xs rounded-md ${!previewMode ? "bg-bg-secondary text-text-primary" : "text-text-muted"}`}
                  onClick={() => setPreviewMode(false)}
                >
                  {t(locale, "memory.edit")}
                </button>
                <button
                  className={`px-3 py-1 text-xs rounded-md ${previewMode ? "bg-bg-secondary text-text-primary" : "text-text-muted"}`}
                  onClick={() => setPreviewMode(true)}
                >
                  {t(locale, "memory.preview")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {previewMode ? (
                <MarkdownPreview markdown={editContent} />
              ) : (
                <textarea
                  className="w-full h-full px-3 py-2 text-sm bg-bg-tertiary border border-border rounded-lg text-text-primary font-mono resize-none focus:outline-none focus:border-accent"
                  placeholder={t(locale, "memory.contentPlaceholder")}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              )}
            </div>
          </div>
        )}
        </div>
        </PageBody>
      </div>
    </>
  );
}
