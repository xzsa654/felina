import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, Plus, Save, Trash2 } from "lucide-react";
import type { CanonicalSkill } from "$lib/types";
import { api } from "$lib/tauri/commands";
import { openPath } from "$lib/tauri/shell";
import { useSkillsStore } from "$lib/stores/skills-store";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import MarkdownPreview from "$lib/components/shared/MarkdownPreview";

interface Props {
  /** `null` when creating a new skill; otherwise the skill being edited. */
  skill: CanonicalSkill | null;
  /** When set, the editor opens in raw repair mode for a broken skill: a plain
   *  textarea over the raw `SKILL.md`, re-validated on save. Takes precedence
   *  over the structured editor. `name` is the canonical directory identity;
   *  `path` is the on-disk `SKILL.md` absolute path (for the open-in-folder
   *  affordance). */
  brokenRaw?: { name: string; content: string; path?: string } | null;
  /** Called after a successful save with the updated/created skill name.
   *  `normalizedFrom` is set when the YAML `name` was corrected to match
   *  the canonical directory identity. */
  onSaved: (name: string, normalizedFrom?: string) => void | Promise<void>;
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
export default function SkillEditor({ skill, brokenRaw, onSaved, onCancel, onDelete }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const upsertEntry = useSkillsStore((s) => s.upsertEntry);
  const loadEntries = useSkillsStore((s) => s.loadEntries);

  const isNew = skill === null;
  const canonicalId = skill?.canonicalId ?? "";
  // The disabled name field for an existing skill shows the parsed
  // `frontmatter.name` (matching ManagedInventory's row label). Storage and all
  // app actions key on `canonicalId`; display and identity are decoupled.
  const [name, setName] = useState(isNew ? "" : (skill?.name ?? ""));
  const [description, setDescription] = useState(skill?.description ?? "");
  const [body, setBody] = useState(skill?.body ?? "");
  const [bodyMode, setBodyMode] = useState<"edit" | "preview">("edit");
  const [extras, setExtras] = useState<ExtraRow[]>(() => initExtras(skill));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawContent, setRawContent] = useState(brokenRaw?.content ?? "");

  // When the parent swaps the selected skill, refresh local state.
  useEffect(() => {
    setName(isNew ? "" : (skill?.name ?? ""));
    setDescription(skill?.description ?? "");
    setBody(skill?.body ?? "");
    setBodyMode("edit");
    setExtras(initExtras(skill));
    setAdvancedOpen(false);
    setError(null);
  }, [skill?.canonicalId, isNew]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the parent swaps the broken skill being repaired, reload its raw text.
  useEffect(() => {
    setRawContent(brokenRaw?.content ?? "");
    setError(null);
  }, [brokenRaw?.name, brokenRaw?.content]);

  async function handleRawSave() {
    if (!brokenRaw) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.canonicalSkills.writeRaw(brokenRaw.name, rawContent);
      try {
        await api.canonicalSkills.read(brokenRaw.name);
      } catch (parseErr) {
        await loadEntries();
        setError(t(locale, "skills.editor.rawStillBroken", { error: String(parseErr) }));
        return;
      }
      await onSaved(brokenRaw.name, result.normalizedFrom ?? undefined);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const nameError = useMemo(() => validateName(name, locale), [name, locale]);
  // The name field is editable only for new skills; an existing skill's
  // disabled, display-only name must not gate Save (a parsed name with e.g. a
  // space would otherwise wedge the editor — storage uses the canonical id).
  const canSave =
    (isNew ? nameError === null : true) && description.trim() !== "" && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const dirName = isNew ? name : canonicalId;
      const frontmatter: Record<string, unknown> = {
        name: dirName,
        description,
        agents: skill?.agents ?? [],
      };
      for (const row of extras) {
        const trimmedKey = row.key.trim();
        if (!trimmedKey) continue;
        if (trimmedKey === "name" || trimmedKey === "description" || trimmedKey === "agents") {
          continue;
        }
        frontmatter[trimmedKey] = parseExtraValue(row.value);
      }
      await api.canonicalSkills.write(dirName, frontmatter, body);
      const currentTargets = skill?.targets ?? [];
      upsertEntry({
        canonicalId: dirName,
        name: dirName,
        description,
        agents: skill?.agents ?? [],
        frontmatterExtras: {},
        body,
        dirty: currentTargets.some((tgt) => tgt.enabled && tgt.mode === "tracked"),
        lastSynced: skill?.lastSynced ?? null,
        targets: currentTargets,
        lastSync: skill?.lastSync ?? {},
      });
      await loadEntries();
      // Structured save also normalizes a mismatched `frontmatter.name` to the
      // canonical directory identity (the backend rewrites it). Surface the
      // same advisory the raw-repair path shows when that happens.
      const normalizedFrom =
        !isNew && skill && skill.name !== dirName ? skill.name : undefined;
      await onSaved(dirName, normalizedFrom);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  // ------- Raw repair mode (broken skill) -------
  if (brokenRaw) {
    const canonicalDir = brokenRaw.path
      ? brokenRaw.path.replace(/[\\/]+SKILL\.md$/i, "")
      : null;
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
          <div className="text-xs text-danger truncate">
            {t(locale, "skills.editor.rawTitle", { name: brokenRaw.name })}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded text-danger hover:bg-danger-dim"
                title={t(locale, "skills.editor.deleteTitle")}
              >
                <Trash2 size={12} /> {t(locale, "skills.editor.delete")}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleRawSave()}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={12} />
              {saving ? t(locale, "skills.editor.saving") : t(locale, "skills.editor.save")}
            </button>
          </div>
        </div>

        {canonicalDir && (
          <div className="flex items-center gap-2 text-[10px] text-text-secondary">
            <span className="font-mono truncate flex-1" title={brokenRaw.path}>
              {brokenRaw.path}
            </span>
            <button
              type="button"
              onClick={() => {
                openPath(canonicalDir).catch((e) => setError(String(e)));
              }}
              title={t(locale, "skills.editor.openFolder")}
              className="shrink-0 inline-flex items-center p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
            >
              <FolderOpen size={12} />
            </button>
          </div>
        )}

        <p className="text-xs text-text-secondary">{t(locale, "skills.editor.rawHint")}</p>

        {error && (
          <div className="text-xs text-danger bg-danger-dim border border-danger/30 rounded px-3 py-2 whitespace-pre-wrap">
            {error}
          </div>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {t(locale, "skills.editor.rawLabel")}
          </h3>
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            rows={22}
            spellCheck={false}
            className="w-full block resize-y px-3 py-2 rounded bg-bg-primary border border-border text-sm font-mono focus:outline-none focus:border-accent"
          />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* ------- Header: editor actions (Save + optional Delete) ------- */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="text-xs text-text-secondary truncate">
          {isNew
            ? t(locale, "skills.editor.creatingNew")
            : t(locale, "skills.editor.editing", { name: skill?.name ?? "" })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isNew && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary"
            >
              {t(locale, "skills.editor.cancel")}
            </button>
          )}
          {!isNew && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded text-danger hover:bg-danger-dim"
              title={t(locale, "skills.editor.deleteTitle")}
            >
              <Trash2 size={12} /> {t(locale, "skills.editor.delete")}
            </button>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={12} />
            {saving ? t(locale, "skills.editor.saving") : t(locale, "skills.editor.save")}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger-dim border border-danger/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* ------- Properties ------- */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {t(locale, "skills.editor.properties")}
        </h3>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">{t(locale, "skills.editor.name")}</span>
          <input
            type="text"
            value={name}
            disabled={!isNew}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-bg-primary border border-border text-sm focus:outline-none focus:border-accent disabled:opacity-60"
            placeholder={t(locale, "skills.editor.namePlaceholder")}
          />
          {isNew && nameError && <span className="text-xs text-danger">{nameError}</span>}
          {!isNew && (
            <span className="text-xs text-text-secondary">
              {t(locale, "skills.editor.renameHint")}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">{t(locale, "skills.editor.description")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 rounded bg-bg-primary border border-border text-sm focus:outline-none focus:border-accent"
            placeholder={t(locale, "skills.editor.descriptionPlaceholder")}
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
          {t(locale, "skills.editor.advancedFields")}
        </button>
        {advancedOpen && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-text-secondary">
              {t(locale, "skills.editor.advancedHint")}
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
                  placeholder={t(locale, "skills.editor.keyPlaceholder")}
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
                  placeholder={t(locale, "skills.editor.valuePlaceholder")}
                  className="px-2 py-1 rounded bg-bg-primary border border-border text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={() =>
                    setExtras((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="p-1 text-text-secondary hover:text-danger"
                  title={t(locale, "skills.editor.removeRow")}
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
              <Plus size={12} /> {t(locale, "skills.editor.addField")}
            </button>
          </div>
        )}
      </section>

      {/* ------- Body ------- */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {t(locale, "skills.editor.bodyLabel")}
          </h3>
          <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
            <button
              type="button"
              onClick={() => setBodyMode("edit")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                bodyMode === "edit" ? "bg-bg-secondary text-text-primary" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {t(locale, "skills.editor.bodyEdit")}
            </button>
            <button
              type="button"
              onClick={() => setBodyMode("preview")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                bodyMode === "preview" ? "bg-bg-secondary text-text-primary" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {t(locale, "skills.editor.bodyPreview")}
            </button>
          </div>
        </div>
        {bodyMode === "preview" ? (
          <MarkdownPreview
            markdown={body}
            className="min-h-[22rem] w-full rounded border border-border bg-bg-primary px-3 py-2 text-sm"
          />
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="w-full block resize-y px-3 py-2 rounded bg-bg-primary border border-border text-sm font-mono focus:outline-none focus:border-accent"
            placeholder={t(locale, "skills.editor.bodyPlaceholder")}
          />
        )}
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
function validateName(name: string, locale: import("$lib/i18n").Locale): string | null {
  if (name.length === 0) return t(locale, "skills.editor.nameRequired");
  if (name.startsWith(".")) return t(locale, "skills.editor.nameNoDot");
  for (const ch of name) {
    const ok = /[A-Za-z0-9_-]/.test(ch);
    if (!ok) return t(locale, "skills.editor.nameInvalidChar", { ch });
  }
  return null;
}
