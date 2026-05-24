import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import type { CanonicalSkill } from "$lib/types";
import { api } from "$lib/tauri/commands";
import { useSkillsStore } from "$lib/stores/skills-store";

interface Props {
  /** `null` when creating a new skill; otherwise the skill being edited. */
  skill: CanonicalSkill | null;
  /** Called after a successful save with the updated/created skill name. May be async. */
  onSaved: (name: string) => void | Promise<void>;
  /** Cancel a new-skill draft (no-op for existing skills). */
  onCancel?: () => void;
  /** Optional delete callback for existing skills; renders in the header next to Save. */
  onDelete?: () => void;
}

interface ExtraRow {
  /** Local row id, distinct from the YAML key so the user can rename safely. */
  id: string;
  key: string;
  value: string;
}

let nextRowId = 0;
function makeRowId(): string {
  nextRowId += 1;
  return `row-${nextRowId}`;
}

/**
 * Visual frontmatter editor — by design, raw YAML is NEVER exposed.
 *
 * Properties block:
 *   - name (text input, disabled when editing an existing skill)
 *   - description (textarea, one-line conceptually but allow wrapping)
 *
 * Advanced block (collapsed by default per decision 4):
 *   - Free-form extra key/value rows. Values that parse as JSON (arrays,
 *     booleans, numbers) round-trip as YAML structures; everything else
 *     is a string. This is the visual representation of canonical
 *     `frontmatter_extras`.
 *
 * Body:
 *   - Plain textarea, no syntax highlighting (per Non-Goals).
 */
export default function SkillEditor({ skill, onSaved, onCancel, onDelete }: Props) {
  const upsertEntry = useSkillsStore((s) => s.upsertEntry);
  const loadEntries = useSkillsStore((s) => s.loadEntries);

  const isNew = skill === null;
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [body, setBody] = useState(skill?.body ?? "");
  const [extras, setExtras] = useState<ExtraRow[]>(() => initExtras(skill));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the parent swaps the selected skill, refresh local state.
  useEffect(() => {
    setName(skill?.name ?? "");
    setDescription(skill?.description ?? "");
    setBody(skill?.body ?? "");
    setExtras(initExtras(skill));
    setAdvancedOpen(false);
    setError(null);
  }, [skill?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameError = useMemo(() => validateName(name), [name]);
  const canSave =
    nameError === null && description.trim() !== "" && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const frontmatter: Record<string, unknown> = {
        name,
        description,
        agents: skill?.agents ?? [],
      };
      for (const row of extras) {
        const trimmedKey = row.key.trim();
        if (!trimmedKey) continue;
        if (trimmedKey === "name" || trimmedKey === "description" || trimmedKey === "agents") {
          continue; // never let extras shadow required fields
        }
        frontmatter[trimmedKey] = parseExtraValue(row.value);
      }
      await api.canonicalSkills.write(name, frontmatter, body);
      // Optimistically mark dirty=true so the pending-push bar shows up
      // immediately; loadEntries() below picks up the real sync-meta.
      const currentTargets = skill?.targets ?? [];
      upsertEntry({
        name,
        description,
        agents: skill?.agents ?? [],
        frontmatterExtras: {},
        body,
        dirty: currentTargets.some((t) => t.enabled && t.mode === "tracked"),
        lastSynced: skill?.lastSynced ?? null,
        targets: currentTargets,
        lastSync: skill?.lastSync ?? {},
      });
      await loadEntries();
      await onSaved(name);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* ------- Header: editor actions (Save + optional Delete) ------- */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="text-xs text-text-secondary truncate">
          {isNew
            ? "Creating new canonical skill"
            : `Editing ${skill?.name ?? ""}`}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isNew && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          )}
          {!isNew && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded text-red-400 hover:bg-red-500/10"
              title="Delete skill"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={12} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* ------- Properties ------- */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Properties
        </h3>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Name</span>
          <input
            type="text"
            value={name}
            disabled={!isNew}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-bg-primary border border-border text-sm focus:outline-none focus:border-accent disabled:opacity-60"
            placeholder="my-skill"
          />
          {nameError && <span className="text-xs text-red-400">{nameError}</span>}
          {!isNew && (
            <span className="text-xs text-text-secondary">
              Renaming requires delete + recreate (Phase 2).
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 rounded bg-bg-primary border border-border text-sm focus:outline-none focus:border-accent"
            placeholder="What does this skill do? Used by the model for auto-invocation."
          />
        </label>

      </section>

      {/* ------- Advanced (collapsed by default) ------- */}
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary"
        >
          {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Advanced fields
        </button>
        {advancedOpen && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-text-secondary">
              Extra frontmatter fields preserved verbatim into canonical
              storage. Values that look like JSON (arrays, booleans,
              numbers) round-trip as YAML structures.
            </p>
            {extras.map((row, idx) => (
              <div key={row.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) =>
                    setExtras((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)),
                    )
                  }
                  placeholder="effort"
                  className="px-2 py-1 rounded bg-bg-primary border border-border text-xs w-1/3"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) =>
                    setExtras((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)),
                    )
                  }
                  placeholder='high  /  ["Read","Edit"]  /  true'
                  className="px-2 py-1 rounded bg-bg-primary border border-border text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={() =>
                    setExtras((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="p-1 text-text-secondary hover:text-red-400"
                  title="Remove row"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setExtras((prev) => [...prev, { id: makeRowId(), key: "", value: "" }])
              }
              className="self-start inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent"
            >
              <Plus size={12} /> Add field
            </button>
          </div>
        )}
      </section>

      {/* ------- Body ------- */}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Body (Markdown)
        </h3>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          className="w-full block resize-y px-3 py-2 rounded bg-bg-primary border border-border text-sm font-mono focus:outline-none focus:border-accent"
          placeholder="# When to use this skill&#10;&#10;Describe the workflow."
        />
      </section>

    </div>
  );
}

function initExtras(skill: CanonicalSkill | null): ExtraRow[] {
  if (!skill) return [];
  const extras = skill.frontmatterExtras;
  if (!extras || typeof extras !== "object") return [];
  return Object.entries(extras as Record<string, unknown>).map(([key, value]) => ({
    id: makeRowId(),
    key,
    value: stringifyExtraValue(value),
  }));
}

function stringifyExtraValue(v: unknown): string {
  if (typeof v === "string") return v;
  // Arrays, objects, booleans, numbers — JSON-encode so the user can edit
  // them inline and we can parse the same shape back.
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function parseExtraValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  // Try JSON for arrays / booleans / numbers / null; fall back to a plain string.
  if (
    trimmed.startsWith("[") ||
    trimmed.startsWith("{") ||
    trimmed === "true" ||
    trimmed === "false" ||
    trimmed === "null" ||
    /^-?\d+(\.\d+)?$/.test(trimmed)
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Same allowlist as the Rust validator. Reject empty / leading-dot / non-alnum
 * (except `-` and `_`). Returns an error message or null.
 */
function validateName(name: string): string | null {
  if (name.length === 0) return "Name is required.";
  if (name.startsWith(".")) return "Name must not start with '.'.";
  for (const ch of name) {
    const ok = /[A-Za-z0-9_-]/.test(ch);
    if (!ok) return `Invalid character: '${ch}'. Allowed: A-Z a-z 0-9 - _`;
  }
  return null;
}
