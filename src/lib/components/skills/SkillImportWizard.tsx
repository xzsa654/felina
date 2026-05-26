import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type {
  ImportCandidate,
  ImportResolution,
  ImportSelection,
} from "$lib/types";
import { api } from "$lib/tauri/commands";
import { useSkillsStore } from "$lib/stores/skills-store";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";

interface Props {
  /** When set, scan that project's agent dirs and tag imported skills with a
   *  `scope=project` target pointing back at it. When `null`, scan global
   *  agent dirs and tag with `scope=global`. */
  projectPath: string | null;
  onClose: () => void;
}

interface RowState {
  resolution: ImportResolution;
  /** For Rename only — the user-supplied new canonical name. */
  renameTo: string;
}

/**
 * Modal-style import wizard. Loads candidates from `skill_import.scan` on
 * mount, lets the user pick a resolution per candidate (with diff summary
 * for conflicts), then calls `skill_import.apply`.
 *
 * Resolutions per design decision 6:
 *   - keepCanonical:  do nothing (only meaningful when there's a conflict)
 *   - overwriteCanonical:  copy candidate over the existing canonical skill
 *   - skip:  ignore this candidate
 *   - rename:  write the candidate under a different canonical name
 */
export default function SkillImportWizard({ projectPath, onClose }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const loadEntries = useSkillsStore((s) => s.loadEntries);
  const refreshImportCount = useSkillsStore((s) => s.refreshImportCount);

  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await api.skillImport.scan(projectPath ?? undefined);
        setCandidates(result);
        setRows(
          result.map<RowState>((c) => ({
            // Default: overwrite for clean cases, keep-canonical when there's a conflict
            // — the safer choice that requires explicit opt-in to overwrite.
            resolution: c.conflict
              ? { kind: "keepCanonical" }
              : { kind: "overwriteCanonical" },
            renameTo: c.skillName,
          })),
        );
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      const selections: ImportSelection[] = candidates
        // Multi-source skills are deferred. Validation-error candidates ARE
        // imported — they land as broken canonical skills (import-as-broken).
        .filter((c) => !c.deferred)
        .map((candidate) => {
          const idx = candidates.indexOf(candidate);
          const row = rows[idx];
          if (row.resolution.kind === "rename") {
            return {
              candidate,
              resolution: { kind: "rename", newName: row.renameTo.trim() || candidate.skillName },
            };
          }
          return { candidate, resolution: row.resolution };
        });
      await api.skillImport.apply(selections, projectPath ?? undefined);
      await loadEntries();
      await refreshImportCount();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-bg-primary border border-border rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{t(locale, "skills.importWizard.title")}</h2>
            <p className="text-xs text-text-secondary">
              {t(locale, "skills.importWizard.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
          {loading && <div className="text-sm text-text-secondary">{t(locale, "skills.importWizard.scanning")}</div>}
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {error}
            </div>
          )}
          {!loading && candidates.length === 0 && !error && (
            <div className="text-sm text-text-secondary py-6 text-center">
              {t(locale, "skills.importWizard.nothingToImport")}
            </div>
          )}
          {candidates.map((c, idx) => {
            const row = rows[idx];
            if (c.deferred) {
              return (
                <div
                  key={`${c.sourcePath}-${idx}`}
                  className="border border-border rounded p-3 flex flex-col gap-1 opacity-60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary">
                        {c.skillName}{" "}
                        <span className="text-xs font-normal text-text-secondary">
                          {t(locale, "skills.importWizard.foundIn", { agents: c.deferred.agents.join(", ") })}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 inline-flex items-center gap-1 text-xs text-text-secondary">
                      <AlertTriangle size={12} /> {t(locale, "skills.importWizard.deferred")}
                    </div>
                  </div>
                  <div className="text-xs text-text-secondary">{c.deferred.reason}</div>
                </div>
              );
            }
            return (
              <div
                key={`${c.sourcePath}-${idx}`}
                className="border border-border rounded p-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary">
                      {c.skillName}{" "}
                      <span className="text-xs font-normal text-text-secondary">
                        {t(locale, "skills.importWizard.from", { agent: c.sourceAgent })}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-text-secondary truncate">
                      {c.sourcePath}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {c.validationError && (
                      <div className="inline-flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle size={12} /> {t(locale, "skills.importWizard.validationError")}
                      </div>
                    )}
                    {c.conflict && (
                      <div className="inline-flex items-center gap-1 text-xs text-amber-400">
                        <AlertTriangle size={12} /> {t(locale, "skills.importWizard.conflict")}
                      </div>
                    )}
                  </div>
                </div>

                {c.validationError && (
                  <div className="text-xs bg-red-500/10 border border-red-500/30 rounded p-2 text-red-300">
                    <div className="font-medium mb-1">{t(locale, "skills.importWizard.importsAsBroken")}</div>
                    <div className="font-mono text-[10px] text-red-200/80">{c.validationError}</div>
                  </div>
                )}

                {c.conflict && (
                  <div className="text-xs bg-amber-500/10 border border-amber-500/30 rounded p-2 text-amber-200">
                    <div className="font-medium mb-1">{t(locale, "skills.importWizard.conflictTitle")}</div>
                    <div className="font-mono text-[10px] text-amber-100/80">
                      {c.conflict.canonicalPath}
                    </div>
                    <div className="mt-1">{c.conflict.diffSummary}</div>
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap text-xs">
                  {(c.conflict
                    ? (["keepCanonical", "overwriteCanonical", "skip", "rename"] as const)
                    : (["overwriteCanonical", "skip", "rename"] as const)
                  ).map((kind) => (
                    <label key={kind} className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`resolution-${idx}`}
                        checked={row.resolution.kind === kind}
                        onChange={() =>
                          setRows((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? {
                                    ...r,
                                    resolution:
                                      kind === "rename"
                                        ? { kind: "rename", newName: r.renameTo || c.skillName }
                                        : { kind },
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                      {kind === "keepCanonical" && t(locale, "skills.importWizard.keepCanonical")}
                      {kind === "overwriteCanonical" && (c.conflict ? t(locale, "skills.importWizard.overwriteCanonical") : t(locale, "skills.importWizard.import"))}
                      {kind === "skip" && t(locale, "skills.importWizard.skip")}
                      {kind === "rename" && t(locale, "skills.importWizard.rename")}
                    </label>
                  ))}
                  {row.resolution.kind === "rename" && (
                    <input
                      type="text"
                      value={row.renameTo}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  renameTo: e.target.value,
                                  resolution: { kind: "rename", newName: e.target.value },
                                }
                              : r,
                          ),
                        )
                      }
                      placeholder={t(locale, "skills.importWizard.renamePlaceholder")}
                      className="px-2 py-0.5 rounded bg-bg-primary border border-border text-xs"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary"
          >
            {t(locale, "skills.importWizard.cancel")}
          </button>
          <button
            type="button"
            disabled={applying || loading || candidates.every((c) => c.deferred)}
            onClick={handleApply}
            className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {applying ? t(locale, "skills.importWizard.applying") : t(locale, "skills.importWizard.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
