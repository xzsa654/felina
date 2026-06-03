import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FolderOpen, X } from "lucide-react";
import Modal from "$lib/components/shared/Modal";
import { open } from "@tauri-apps/plugin-dialog";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { api } from "$lib/tauri/commands";
import { useSkillsStore } from "$lib/stores/skills-store";
import type { ImportCandidate } from "$lib/types";
import SkillStagingCard from "./SkillStagingCard";
import {
  createStagingItem,
  hasUnresolved,
  resolveStagingConflict,
  selectSource,
  type StagingItem,
} from "./staging-logic";

interface Props {
  projectPath: string | null;
  onClose: () => void;
}

export default function ImportStagingDialog({ projectPath, onClose }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const loadEntries = useSkillsStore((s) => s.loadEntries);
  const refreshImportCount = useSkillsStore((s) => s.refreshImportCount);

  const [discovered, setDiscovered] = useState<ImportCandidate[]>([]);
  const [staging, setStaging] = useState<StagingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dragCountStaging = useRef(0);
  const dragCountDiscovered = useRef(0);
  const [dragOverStaging, setDragOverStaging] = useState(false);
  const [dragOverDiscovered, setDragOverDiscovered] = useState(false);

  const existingNames = useMemo(() => {
    const names = new Set<string>();
    const entries = useSkillsStore.getState().entries;
    for (const e of entries) {
      if (e.kind === "ok") names.add(e.skill.name);
    }
    return names;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await api.skillImport.scan(projectPath ?? undefined);
        setDiscovered(raw);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [projectPath]);

  const moveToStaging = useCallback(
    (candidate: ImportCandidate) => {
      setDiscovered((prev) => prev.filter((c) => c.sourcePath !== candidate.sourcePath));
      setStaging((prev) => [...prev, createStagingItem(candidate, existingNames)]);
    },
    [existingNames],
  );

  const moveToDiscovered = useCallback((item: StagingItem) => {
    setStaging((prev) => prev.filter((s) => s.candidate.sourcePath !== item.candidate.sourcePath));
    setDiscovered((prev) => [...prev, item.candidate]);
  }, []);

  const handleResolve = useCallback(
    (index: number, resolution: "overwrite" | "rename", newName?: string) => {
      setStaging((prev) =>
        prev.map((item, i) => (i === index ? resolveStagingConflict(item, resolution, newName) : item)),
      );
    },
    [],
  );

  const handleSelectSource = useCallback(
    (index: number, sourceIndex: number) => {
      setStaging((prev) =>
        prev.map((item, i) => (i === index ? selectSource(item, sourceIndex, existingNames) : item)),
      );
    },
    [existingNames],
  );

  const handleImport = useCallback(async () => {
    setImporting(true);
    setError(null);
    try {
      const selections = staging.map((item) => {
        if (item.candidate.deferred && item.selectedSourceIndex !== null) {
          const base = item.resolution === "rename"
            ? { kind: "selectSource" as const, sourceIndex: item.selectedSourceIndex, newName: item.resolvedName }
            : { kind: "selectSource" as const, sourceIndex: item.selectedSourceIndex };
          return { candidate: item.candidate, resolution: base };
        }
        if (item.resolution === "rename") {
          return { candidate: item.candidate, resolution: { kind: "rename" as const, newName: item.resolvedName } };
        }
        return { candidate: item.candidate, resolution: { kind: "overwriteCanonical" as const } };
      });
      await api.skillImport.apply(selections, projectPath ?? undefined);
      await loadEntries();
      await refreshImportCount();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }, [staging, projectPath, loadEntries, refreshImportCount, onClose]);

  const handleBrowseFiles = useCallback(async () => {
    try {
      const path = await open({
        filters: [{ name: "ZIP", extensions: ["zip"] }],
        multiple: false,
        directory: false,
      });
      if (!path) return;
      const zipCandidates = await api.skillImport.scanZip(path as string);
      // ZIP 是使用者明確選擇匯入的來源,直接進右邊 Staging,不必再拖一次。
      // 同名衝突由 SkillStagingCard 內建的 overwrite/rename UI 處理。
      setStaging((prev) => {
        const seen = new Set(prev.map((s) => s.candidate.sourcePath));
        const fresh = zipCandidates
          .filter((c) => !seen.has(c.sourcePath))
          .map((c) => createStagingItem(c, existingNames));
        return [...prev, ...fresh];
      });
    } catch (e) {
      setError(String(e));
    }
  }, [existingNames]);

  const canImport = staging.length > 0 && !hasUnresolved(staging) && !importing;

  function handleDragStart(e: React.DragEvent, sourcePath: string, from: "discovered" | "staging") {
    e.dataTransfer.setData("application/x-felina-skill", JSON.stringify({ sourcePath, from }));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDropOnStaging(e: React.DragEvent) {
    e.preventDefault();
    dragCountStaging.current = 0;
    setDragOverStaging(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/x-felina-skill")) as { sourcePath: string; from: string };
      if (data.from !== "discovered") return;
      const candidate = discovered.find((c) => c.sourcePath === data.sourcePath);
      if (candidate) moveToStaging(candidate);
    } catch { /* ignore invalid drag data */ }
  }

  function handleDropOnDiscovered(e: React.DragEvent) {
    e.preventDefault();
    dragCountDiscovered.current = 0;
    setDragOverDiscovered(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/x-felina-skill")) as { sourcePath: string; from: string };
      if (data.from !== "staging") return;
      const item = staging.find((s) => s.candidate.sourcePath === data.sourcePath);
      if (item) moveToDiscovered(item);
    } catch { /* ignore invalid drag data */ }
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="flex flex-col h-[80vh]">
        {/* Own header (Modal title prop intentionally not used — fixed-height
            layout below assumes the full Modal box; an additional Modal
            title bar would push the footer past max-h-[85vh] on small
            viewports). */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">
            {t(locale, "skills.importDialog.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 text-xs text-danger bg-danger-dim border border-danger/30 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* Split view */}
        <div className="flex-1 flex gap-4 px-5 py-4 min-h-0 overflow-hidden">
          {/* Left: Discovered */}
          <div
            className={`flex-1 flex flex-col border border-border rounded-lg overflow-hidden transition-colors ${
              dragOverDiscovered ? "border-accent/60 bg-accent/5" : ""
            }`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDragEnter={(e) => { e.preventDefault(); dragCountDiscovered.current++; setDragOverDiscovered(true); }}
            onDragLeave={() => { dragCountDiscovered.current--; if (dragCountDiscovered.current <= 0) { dragCountDiscovered.current = 0; setDragOverDiscovered(false); } }}
            onDrop={handleDropOnDiscovered}
          >
            <div className="px-3 py-2 border-b border-border bg-bg-secondary/30">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                {t(locale, "skills.importDialog.discovered")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {loading && (
                <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
                  Scanning…
                </div>
              )}
              {!loading && discovered.length === 0 && (
                <div className="text-xs text-text-muted py-4 text-center">
                  {t(locale, "skills.importDialog.emptyDiscovered")}
                </div>
              )}
              {discovered.map((c) => (
                <div
                  key={c.sourcePath}
                  draggable
                  onDragStart={(e) => handleDragStart(e, c.sourcePath, "discovered")}
                  onDoubleClick={() => moveToStaging(c)}
                  className="bg-bg-secondary/30 border border-border rounded p-3 cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-text-primary truncate">{c.skillName}</span>
                    {c.deferred && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-info/15 text-info">
                        multi-source
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-text-muted mt-1 truncate">
                    {c.deferred ? c.deferred.agents.join(", ") : c.sourceAgent} · {c.sourcePath}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-border">
              <button
                type="button"
                onClick={handleBrowseFiles}
                className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
              >
                <FolderOpen size={12} />
                {t(locale, "skills.importDialog.browseFiles")}
              </button>
            </div>
          </div>

          {/* Right: Staging */}
          <div
            className={`flex-1 flex flex-col border border-border rounded-lg overflow-hidden transition-colors ${
              dragOverStaging ? "border-accent/60 bg-accent/5" : ""
            }`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDragEnter={(e) => { e.preventDefault(); dragCountStaging.current++; setDragOverStaging(true); }}
            onDragLeave={() => { dragCountStaging.current--; if (dragCountStaging.current <= 0) { dragCountStaging.current = 0; setDragOverStaging(false); } }}
            onDrop={handleDropOnStaging}
          >
            <div className="px-3 py-2 border-b border-border bg-bg-secondary/30">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                {t(locale, "skills.importDialog.staging")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {staging.length === 0 && (
                <div className="text-xs text-text-muted py-4 text-center">
                  {t(locale, "skills.importDialog.emptyStaging")}
                </div>
              )}
              {staging.map((item, idx) => (
                <SkillStagingCard
                  key={item.candidate.sourcePath}
                  item={item}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.candidate.sourcePath, "staging")}
                  onDoubleClick={() => moveToDiscovered(item)}
                  onResolve={(res, newName) => handleResolve(idx, res, newName)}
                  onSelectSource={(si) => handleSelectSource(idx, si)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary"
          >
            {t(locale, "skills.importDialog.cancel")}
          </button>
          <button
            type="button"
            disabled={!canImport}
            onClick={handleImport}
            className="inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <Download size={12} />
            {importing
              ? t(locale, "skills.importDialog.importing")
              : t(locale, "skills.importDialog.import")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
