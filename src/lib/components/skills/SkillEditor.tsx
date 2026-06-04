import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { CanonicalSkill, KnownProject, SkillTarget } from "$lib/types";
import type { LastSyncEntry } from "$lib/types/skills";
import RenameSkillDialog from "./RenameSkillDialog";
import TargetChips from "./TargetChips";
import TargetPopover from "./TargetPopover";
import AddTargetDialog from "./AddTargetDialog";
import { api } from "$lib/tauri/commands";
import { openPath } from "$lib/tauri/shell";
import { useSkillsStore } from "$lib/stores/skills-store";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import MarkdownPreview from "$lib/components/shared/MarkdownPreview";
import AgentFieldsEditor from "./AgentFieldsEditor";

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
  /** Optional rename callback for existing skills. */
  onRename?: (newName: string) => void;
  /** Target list for the skill (passed to TargetChips / TargetEditor). */
  targets?: SkillTarget[];
  /** Project path context for TargetEditor. */
  projectPath?: string | null;
  /** Known projects for TargetEditor project picker. */
  knownProjects?: KnownProject[];
  /** Called when targets change (e.g. after add/remove/repoint). */
  onTargetsChange?: () => void;
  /** Per-target last sync data for status display in Target Chips. */
  lastSync?: Record<string, LastSyncEntry>;
  /** Whether any sibling skill has unsaved changes. */
  siblingsDirty?: boolean;
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
export default function SkillEditor({ skill, brokenRaw, onSaved, onCancel, onDelete, onRename, targets: targetsProp, projectPath, knownProjects, lastSync, siblingsDirty, onTargetsChange }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const upsertEntry = useSkillsStore((s) => s.upsertEntry);
  const loadEntries = useSkillsStore((s) => s.loadEntries);
  const driftMap = useSkillsStore((s) => s.driftMap);

  const isNew = skill === null;
  const canonicalId = skill?.canonicalId ?? "";
  // The disabled name field for an existing skill shows the parsed
  // `frontmatter.name` (matching ManagedInventory's row label). Storage and all
  // app actions key on `canonicalId`; display and identity are decoupled.
  const [name, setName] = useState(isNew ? "" : (skill?.name ?? ""));
  const [description, setDescription] = useState(skill?.description ?? "");
  const [body, setBody] = useState(skill?.body ?? "");
  const [bodyMode, setBodyModeRaw] = useState<"edit" | "preview" | "split">(() => {
    const saved = localStorage.getItem("felina:bodyMode");
    return saved === "preview" || saved === "split" ? saved : "edit";
  });
  const setBodyMode = (mode: "edit" | "preview" | "split") => {
    setBodyModeRaw(mode);
    localStorage.setItem("felina:bodyMode", mode);
  };
  const contentRef = useRef<HTMLDivElement>(null);
  const splitEditorRef = useRef<HTMLTextAreaElement>(null);
  const splitPreviewRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);
  const metadataCollapsed = bodyMode !== "edit";
  const [containerWidth, setContainerWidth] = useState(0);
  const [renameOpen, setRenameOpen] = useState(false);
  const [popoverTargetIndex, setPopoverTargetIndex] = useState<number | null>(null);
  const [popoverAnchorRect, setPopoverAnchorRect] = useState<DOMRect | null>(null);
  const [addTargetOpen, setAddTargetOpen] = useState(false);
  const [extras, setExtras] = useState<ExtraRow[]>(() => initExtras(skill));
  const [agentFields, setAgentFields] = useState<Record<string, unknown>>(
    () => skill?.agentFields ?? {},
  );
  const [activeTab, setActiveTab] = useState<"content" | "settings">("content");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawContent, setRawContent] = useState(brokenRaw?.content ?? "");

  // When the parent swaps the selected skill, refresh local state.
  useEffect(() => {
    setName(isNew ? "" : (skill?.name ?? ""));
    setDescription(skill?.description ?? "");
    setBody(skill?.body ?? "");
    const saved = localStorage.getItem("felina:bodyMode");
    setBodyModeRaw(saved === "preview" || saved === "split" ? saved : "edit");
    setExtras(initExtras(skill));
    setAgentFields(skill?.agentFields ?? {});
    setActiveTab("content");
    setError(null);
  }, [skill?.canonicalId, skill?.body, isNew]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the parent swaps the broken skill being repaired, reload its raw text.
  useEffect(() => {
    setRawContent(brokenRaw?.content ?? "");
    setError(null);
  }, [brokenRaw?.name, brokenRaw?.content]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (bodyMode === "split" && containerWidth > 0 && containerWidth < 768) {
      setBodyMode("edit");
    }
  }, [containerWidth, bodyMode]);

  function handleSplitScroll(source: "editor" | "preview") {
    if (syncingScroll.current) return;
    syncingScroll.current = true;

    const editor = splitEditorRef.current;
    const preview = splitPreviewRef.current;
    if (!editor || !preview) {
      requestAnimationFrame(() => { syncingScroll.current = false; });
      return;
    }

    if (source === "editor") {
      const atBottom = editor.scrollTop + editor.clientHeight >= editor.scrollHeight - 2;
      if (atBottom) {
        preview.scrollTop = preview.scrollHeight;
      } else {
        const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 16;
        const topLine = Math.floor(editor.scrollTop / lineHeight) + 1;
        const els = preview.querySelectorAll<HTMLElement>("[data-source-line]");
        let best: HTMLElement | null = null;
        for (const el of els) {
          const ln = parseInt(el.dataset.sourceLine || "0", 10);
          if (ln <= topLine) best = el;
          else break;
        }
        if (best) best.scrollIntoView({ block: "start", behavior: "instant" });
      }
    } else {
      const atBottom = preview.scrollTop + preview.clientHeight >= preview.scrollHeight - 2;
      if (atBottom) {
        editor.scrollTop = editor.scrollHeight;
      } else {
        const els = preview.querySelectorAll<HTMLElement>("[data-source-line]");
        const previewTop = preview.scrollTop;
        let best: HTMLElement | null = null;
        for (const el of els) {
          if (el.offsetTop <= previewTop + 4) best = el;
          else break;
        }
        if (best) {
          const ln = parseInt(best.dataset.sourceLine || "1", 10);
          const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 16;
          editor.scrollTop = (ln - 1) * lineHeight;
        }
      }
    }

    requestAnimationFrame(() => { syncingScroll.current = false; });
  }

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
  const isDirty = useMemo(() => {
    if (isNew) return false;
    return (
      description !== (skill?.description ?? "") ||
      body !== (skill?.body ?? "") ||
      JSON.stringify(agentFields) !== JSON.stringify(skill?.agentFields ?? {})
    );
  }, [description, body, agentFields, skill, isNew]);
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
      const hasAgentFields = Object.keys(agentFields).length > 0;
      await api.canonicalSkills.write(
        dirName,
        frontmatter,
        body,
        hasAgentFields ? agentFields : undefined,
      );
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
        agentFields: skill?.agentFields ?? {},
        siblingsDirty: false,
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
    <div className="flex flex-col h-full">
      {/* ------- Sticky: Document Header + Tab Bar ------- */}
      <div className="sticky top-0 z-10 bg-bg-primary px-4 pt-4">
      {/* ------- Document Title + Actions (always visible) ------- */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {isNew ? (
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-2xl font-bold bg-transparent border-b border-transparent focus:border-accent focus:outline-none w-full placeholder:text-text-muted"
                placeholder={t(locale, "skills.editor.namePlaceholder")}
              />
              {nameError && <span className="text-xs text-danger">{nameError}</span>}
            </div>
          ) : (
            <h1 className="text-2xl font-bold truncate">
              {name}
              {isDirty && <span className="text-accent ml-1">*</span>}
            </h1>
          )}
        </div>
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1 shrink-0">
          {isNew && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1 text-xs rounded-md transition-colors text-text-muted hover:text-text-secondary"
            >
              {t(locale, "skills.editor.cancel")}
            </button>
          )}
          {!isNew && onRename && (
            <button
              type="button"
              onClick={() => setRenameOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors text-text-muted hover:text-text-secondary"
              title={t(locale, "skills.editor.renameTitle")}
            >
              <Pencil size={12} /> {t(locale, "skills.editor.rename")}
            </button>
          )}
          {!isNew && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors text-danger hover:bg-danger-dim"
              title={t(locale, "skills.editor.deleteTitle")}
            >
              <Trash2 size={12} /> {t(locale, "skills.editor.delete")}
            </button>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={12} />
            {saving ? t(locale, "skills.editor.saving") : t(locale, "skills.editor.save")}
          </button>
        </div>
      </div>

      {/* ------- Document Metadata (collapsible in preview/split modes) ------- */}
      <div className={`overflow-hidden transition-all duration-200 ${metadataCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"}`}>
      <textarea
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }
        }}
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          const el = e.target;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }}
        rows={1}
        className="w-full mt-1 text-sm text-text-secondary bg-transparent border-b border-transparent focus:border-accent focus:outline-none resize-none placeholder:text-text-muted"
        placeholder={t(locale, "skills.editor.descriptionPlaceholder")}
      />

      {error && (
        <div className="text-xs text-danger bg-danger-dim border border-danger/30 rounded px-3 py-2 mt-2">
          {error}
        </div>
      )}

      {/* ------- Target Chips + Popover ------- */}
      {!isNew && targetsProp && (
        <>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mt-3">
            {t(locale, "skills.targets.title")}
          </h4>
          <TargetChips
            targets={targetsProp}
            lastSync={lastSync ?? {}}
            knownProjects={knownProjects ?? []}
            siblingsDirty={siblingsDirty ?? false}
            driftMap={driftMap[canonicalId]}
            onChipClick={(index) => {
              if (popoverTargetIndex === index) {
                setPopoverTargetIndex(null);
                setPopoverAnchorRect(null);
              } else {
                setPopoverTargetIndex(index);
                const chip = document.querySelector(`[data-target-chip="${index}"]`);
                setPopoverAnchorRect(chip?.getBoundingClientRect() ?? null);
              }
            }}
            onAdd={() => {
              setPopoverTargetIndex(null);
              setAddTargetOpen(true);
            }}
          />
          {popoverTargetIndex !== null && targetsProp[popoverTargetIndex] && (
            <TargetPopover
              skillName={canonicalId}
              target={targetsProp[popoverTargetIndex]}
              targetIndex={popoverTargetIndex}
              allTargets={targetsProp}
              lastSync={lastSync ?? {}}
              knownProjects={knownProjects ?? []}
              anchorRect={popoverAnchorRect}
              onClose={() => {
                setPopoverTargetIndex(null);
                setPopoverAnchorRect(null);
              }}
              onTargetsChange={onTargetsChange}
            />
          )}
          {addTargetOpen && (
            <AddTargetDialog
              projectPath={projectPath ?? null}
              existingTargets={targetsProp}
              onAdd={async (target) => {
                await api.skillTargets.set(canonicalId, [...targetsProp, target]);
                await loadEntries();
                onTargetsChange?.();
              }}
              onClose={() => setAddTargetOpen(false)}
            />
          )}
        </>
      )}

      </div>
      {/* ------- Tab Bar ------- */}
      <div className="flex gap-4 border-b border-border mt-3">
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={`pb-2 text-xs font-medium transition-colors ${
            activeTab === "content"
              ? "border-b-2 border-accent text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {t(locale, "skills.editor.tabContent")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`pb-2 text-xs font-medium transition-colors ${
            activeTab === "settings"
              ? "border-b-2 border-accent text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {t(locale, "skills.editor.tabSettings")}
        </button>
      </div>
      </div>

      {/* ------- Scrollable Tab Content ------- */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-4 pb-4">
      {activeTab === "content" ? (
        <section className="flex flex-col gap-2 mt-3 h-full">
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
              <button
                type="button"
                disabled={containerWidth > 0 && containerWidth < 768}
                onClick={() => setBodyMode("split")}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  bodyMode === "split" ? "bg-bg-secondary text-text-primary" : "text-text-muted hover:text-text-secondary"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {t(locale, "skills.editor.bodySplit")}
              </button>
            </div>
          </div>
          {bodyMode === "split" ? (
            <div className="flex flex-1 min-h-[22rem]">
              <textarea
                ref={splitEditorRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onScroll={() => handleSplitScroll("editor")}
                className="w-1/2 block resize-none px-3 py-2 bg-bg-primary border border-border text-sm font-mono focus:outline-none focus:border-accent overflow-y-auto"
                placeholder={t(locale, "skills.editor.bodyPlaceholder")}
              />
              <div
                ref={splitPreviewRef}
                onScroll={() => handleSplitScroll("preview")}
                className="w-1/2 border border-l-0 border-border bg-bg-primary px-3 py-2 text-sm overflow-y-auto"
              >
                <MarkdownPreview markdown={body} />
              </div>
            </div>
          ) : bodyMode === "preview" ? (
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
      ) : (
        <section className="flex flex-col gap-4 mt-3">
          <AgentFieldsEditor
            agentFields={agentFields}
            targets={skill?.targets ?? []}
            onChange={setAgentFields}
          />
          <div className="bg-bg-secondary/30 border border-border rounded">
            <div className="px-3 py-2 text-xs font-medium text-text-primary">
              {t(locale, "skills.editor.advancedHint")}
            </div>
            <div className="px-3 pb-3 flex flex-col gap-2">
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
                    className="px-2 py-1 rounded bg-bg-primary border border-border text-xs w-1/3 focus:ring-1 focus:ring-accent"
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
                    className="px-2 py-1 rounded bg-bg-primary border border-border text-xs flex-1 focus:ring-1 focus:ring-accent"
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
                  setExtras((prev) => [...prev, { id: `extra-${Date.now()}`, key: "", value: "" }])
                }
                className="self-start inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent"
              >
                <Plus size={12} /> {t(locale, "skills.editor.addProperty")}
              </button>
            </div>
          </div>
        </section>
      )}
      </div>

      {onRename && (
        <RenameSkillDialog
          open={renameOpen}
          currentName={canonicalId}
          onConfirm={(newName) => {
            setRenameOpen(false);
            onRename(newName);
          }}
          onCancel={() => setRenameOpen(false)}
        />
      )}
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
