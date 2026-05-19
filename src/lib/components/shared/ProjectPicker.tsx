import { useState, useEffect } from "react";
import { useProjectContextStore } from "$lib/stores/project-context";
import { FolderOpen } from "lucide-react";

interface Props {
  onselect?: () => void;
}

export default function ProjectPicker({ onselect }: Props) {
  const { selectedProjectPath, projects, loaded, selectProject, loadProjects } =
    useProjectContextStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCustomPath, setShowCustomPath] = useState(false);
  const [customPath, setCustomPath] = useState("");

  const selectedName = selectedProjectPath
    ? (selectedProjectPath.split("/").pop() ?? selectedProjectPath)
    : "";

  useEffect(() => {
    if (!loaded) loadProjects();
  }, [loaded, loadProjects]);

  const filtered = projects.filter((p) => {
    if (!search) return true;
    return p.path.toLowerCase().includes(search.toLowerCase());
  });

  function pick(path: string) {
    selectProject(path);
    setOpen(false);
    setSearch("");
    setShowCustomPath(false);
    onselect?.();
  }

  function submitCustomPath() {
    const p = customPath.trim();
    if (p) {
      pick(p);
      setCustomPath("");
    }
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md hover:border-border-light transition-colors max-w-xs"
        onClick={() => setOpen(!open)}
      >
        {selectedProjectPath ? (
          <>
            <span className="w-2 h-2 rounded-full bg-success shrink-0" />
            <span className="truncate text-text-primary">{selectedName}</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-text-muted shrink-0" />
            <span className="text-text-muted">Select project...</span>
          </>
        )}
        <svg
          className="w-3 h-3 text-text-muted shrink-0"
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setShowCustomPath(false);
            }}
            aria-label="Close project picker"
          />
          <div className="absolute top-full left-0 mt-1 w-[420px] bg-bg-secondary border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                type="text"
                className="w-full px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="max-h-72 overflow-y-auto">
              {filtered.map((project) => (
                <button
                  key={project.path}
                  className={`w-full text-left px-3 py-2 hover:bg-bg-hover transition-colors flex items-center gap-2 ${
                    selectedProjectPath === project.path ? "bg-accent/10" : ""
                  } ${!project.exists ? "opacity-50" : ""}`}
                  onClick={() => pick(project.path)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">
                      {project.path.split("/").pop()}
                    </p>
                    <p className="text-xs text-text-muted truncate font-mono">
                      {project.path}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!project.exists && (
                      <span className="text-[10px] text-text-muted">moved</span>
                    )}
                    {project.has_memory && (
                      <span className="text-[10px] text-accent">mem</span>
                    )}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-text-muted text-center">
                  {search ? "No matching projects" : "No projects discovered"}
                </p>
              )}
            </div>

            <div className="border-t border-border p-2">
              {showCustomPath ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
                    placeholder="/path/to/project"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitCustomPath()}
                  />
                  <button
                    className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-md"
                    onClick={submitCustomPath}
                  >
                    Open
                  </button>
                </div>
              ) : (
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
                  onClick={() => setShowCustomPath(true)}
                >
                  <FolderOpen size={14} />
                  <span>Open folder...</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
