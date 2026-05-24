import { useState } from "react";
import { X } from "lucide-react";
import { api } from "$lib/tauri/commands";
import type { MigrationAction, MigrationCandidate } from "$lib/types";

interface Props {
  projectPath: string;
  candidates: MigrationCandidate[];
  onClose: () => void;
  onApplied: () => void | Promise<void>;
}

type Choice = "keep" | "overwrite" | "skip";

/**
 * Migration modal for one project's legacy `.felina/skills/*` masters.
 * Each candidate gets a per-row action. Non-conflicting candidates offer
 * keep/skip; conflicting ones additionally offer overwrite. Applying never
 * deletes the legacy directory (backend guarantee).
 */
export default function MigrationPanel({ projectPath, candidates, onClose, onApplied }: Props) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(candidates.map((c) => [c.skillName, "keep" as Choice])),
  );
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      const items: MigrationAction[] = candidates.map((c) => ({
        projectPath: c.projectPath,
        name: c.skillName,
        action: choices[c.skillName] ?? "keep",
      }));
      await api.migration.apply(items);
      await onApplied();
    } catch (e) {
      setError(String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-bg-primary border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">
            Migrate legacy project skills → global
          </h3>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 text-xs text-text-secondary border-b border-border">
          來源：<code>{projectPath}</code> 的 <code>.felina/skills/</code>。Migrate
          後主檔出現在 global（<code>~/.felina/skills/</code>）並指向此 project；原資料夾不會被刪除。
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted border-b border-border">
                <th className="text-left font-medium px-4 py-2">Skill</th>
                <th className="text-left font-medium px-4 py-2 w-28">Global conflict</th>
                <th className="text-right font-medium px-4 py-2 w-56">Action</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const choices_: Choice[] = c.conflict
                  ? ["keep", "overwrite", "skip"]
                  : ["keep", "skip"];
                return (
                  <tr key={c.skillName} className="border-b border-border/40">
                    <td className="px-4 py-2 font-mono text-text-primary">{c.skillName}</td>
                    <td className="px-4 py-2">
                      {c.conflict ? (
                        <span className="text-amber-400">conflict</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="inline-flex rounded border border-border overflow-hidden float-right">
                        {choices_.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setChoices((cur) => ({ ...cur, [c.skillName]: opt }))
                            }
                            className={`px-2 py-1 ${
                              (choices[c.skillName] ?? "keep") === opt
                                ? "bg-accent text-white"
                                : "bg-bg-primary text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {c_conflict_note(candidates)}
        </div>

        {error && (
          <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-t border-red-500/30">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={applying}
            onClick={() => void handleApply()}
            className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {applying ? "Migrating…" : "Apply migration"}
          </button>
        </div>
      </div>
    </div>
  );
}

function c_conflict_note(candidates: MigrationCandidate[]) {
  if (!candidates.some((c) => c.conflict)) return null;
  return (
    <p className="px-4 py-2 text-[11px] text-text-muted">
      conflict = global 已有同名主檔。<code>keep</code> 會跳過（保留 global 原檔），
      <code>overwrite</code> 會用 project 版本覆寫 global。
    </p>
  );
}
