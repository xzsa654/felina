import { useState, useEffect } from "react";
import { api } from "$lib/tauri/commands";
import type { ProjectInfo, MemoryFile } from "$lib/types";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import MarkdownPreview from "$lib/components/shared/MarkdownPreview";
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

export default function MemoryPage() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
      console.error("Failed:", e);
    } finally {
      setLoading(false);
    }
  }

  async function selectProject(project: ProjectInfo) {
    setSelectedProject(project);
    setEditingFile(null);
    try {
      setMemoryFiles(await api.memory.listFiles(project.hash));
    } catch (e) {
      console.error("Failed:", e);
      setMemoryFiles([]);
    }
  }

  function openEditor(file: MemoryFile) {
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
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(null), 2000);
      const files = await api.memory.listFiles(selectedProject.hash);
      setMemoryFiles(files);
      if (showCreate) {
        setShowCreate(false);
        const found = files.find((f: MemoryFile) => f.filename === filename);
        if (found) openEditor(found);
      }
    } catch (e) {
      setSaveMessage(`Error: ${e}`);
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
    } catch (e) {
      console.error("Failed:", e);
    } finally {
      setDeleteDialogOpen(false);
    }
  }

  useEffect(() => { loadProjects(); }, []);

  const showEditor = editingFile || showCreate;

  return (
    <>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Memory File"
        message="This memory file will be permanently deleted."
        onconfirm={deleteFile}
        oncancel={() => setDeleteDialogOpen(false)}
      />

      <div className="flex flex-col h-full">
        <h1 className="text-xl font-semibold text-text-primary px-4 pt-4 pb-3">Memory</h1>
        <div className="flex flex-1 min-h-0">
        {/* Project Sidebar */}
        <div className="w-56 shrink-0 border-r border-border flex flex-col bg-bg-secondary">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-text-muted" />
              <input
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <p className="text-xs text-text-muted px-3 py-4 text-center">Loading...</p>
            ) : filteredProjects.length === 0 ? (
              <p className="text-xs text-text-muted px-3 py-4 text-center">No projects with memory</p>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.hash}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    selectedProject?.hash === project.hash
                      ? "bg-accent/10 text-accent border-r-2 border-accent"
                      : "text-text-secondary hover:bg-bg-hover"
                  }`}
                  onClick={() => selectProject(project)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{project.path.split("/").pop()}</p>
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
              <p className="text-sm">Select a project to browse its memory</p>
              <p className="text-xs mt-1">Only projects with memory files are shown</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-medium text-text-primary">
                    {selectedProject.path.split("/").pop()}
                  </h3>
                  <p className="text-xs text-text-muted font-mono">{selectedProject.path}</p>
                </div>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
                  onClick={startCreate}
                >
                  <Plus size={14} />
                  New Memory
                </button>
              </div>

              {memoryFiles.length === 0 && !showCreate ? (
                <div className="text-center py-12 text-sm text-text-muted">
                  No memory files in this project
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
                {showCreate ? "New Memory" : editingFile?.filename}
              </span>
              <div className="flex items-center gap-2">
                {saveMessage && (
                  <span className={`text-xs ${saveMessage.startsWith("Error") ? "text-danger" : "text-success"}`}>
                    {saveMessage}
                  </span>
                )}
                {editingFile && !showCreate && (
                  <button
                    className="p-1 text-text-muted hover:text-danger"
                    onClick={() => setDeleteDialogOpen(true)}
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  className="px-3 py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded-md disabled:opacity-50"
                  onClick={saveFile}
                  disabled={saving || (showCreate && !newFilename.trim())}
                >
                  {saving ? "..." : "Save"}
                </button>
                <button
                  className="p-1 text-text-muted hover:text-text-primary"
                  onClick={() => { setEditingFile(null); setShowCreate(false); }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-border space-y-2">
              {showCreate && (
                <label className="block">
                  <span className="text-xs text-text-muted">Filename</span>
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
                  <span className="text-xs text-text-muted">Name</span>
                  <input
                    type="text"
                    className="w-full mt-1 px-2 py-1 text-sm bg-bg-tertiary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-text-muted">Type</span>
                  <select
                    className="w-full mt-1 px-2 py-1 text-sm bg-bg-tertiary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                  >
                    <option value="">none</option>
                    <option value="user">user</option>
                    <option value="feedback">feedback</option>
                    <option value="project">project</option>
                    <option value="reference">reference</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-text-muted">Description</span>
                <input
                  type="text"
                  className="w-full mt-1 px-2 py-1 text-sm bg-bg-tertiary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                  placeholder="One-line description..."
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
                  Edit
                </button>
                <button
                  className={`px-3 py-1 text-xs rounded-md ${previewMode ? "bg-bg-secondary text-text-primary" : "text-text-muted"}`}
                  onClick={() => setPreviewMode(true)}
                >
                  Preview
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {previewMode ? (
                <MarkdownPreview markdown={editContent} />
              ) : (
                <textarea
                  className="w-full h-full px-3 py-2 text-sm bg-bg-tertiary border border-border rounded-lg text-text-primary font-mono resize-none focus:outline-none focus:border-accent"
                  placeholder="Memory content..."
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
