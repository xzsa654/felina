import { useMemo, useState } from "react";
import { AlertTriangle, Send, Trash2 } from "lucide-react";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import type {
  SkillSyncDriftResolution,
  SkillSyncPreview,
  SkillSyncPreviewItem,
  SkillSyncResolution,
} from "$lib/types";

interface Props {
  open: boolean;
  previews: SkillSyncPreview[];
  busy?: boolean;
  onconfirm: (resolutionsBySkill: Record<string, SkillSyncResolution[]>) => void;
  oncancel: () => void;
}

type ResolutionMap = Record<string, SkillSyncDriftResolution>;

const NEEDS_RESOLUTION = new Set(["blockedDrift", "overwriteUnknown"]);

export default function SyncPreviewDialog({
  open,
  previews,
  busy = false,
  onconfirm,
  oncancel,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const items = useMemo(() => previews.flatMap((p) => p.items), [previews]);
  const orphanSiblings = useMemo(() => {
    const all = new Set<string>();
    for (const p of previews) {
      for (const s of p.orphanSiblings) all.add(s);
    }
    return [...all].sort();
  }, [previews]);
  const [resolutions, setResolutions] = useState<ResolutionMap>({});

  if (!open) return null;

  const summary = summarize(items);
  const needsDecision = items.filter((item) => NEEDS_RESOLUTION.has(item.operation));
  const writes = summary.create + summary.overwrite;

  function setResolution(item: SkillSyncPreviewItem, resolution: SkillSyncDriftResolution) {
    setResolutions((current) => ({
      ...current,
      [`${item.skillName}:${item.targetKey}`]: resolution,
    }));
  }

  function confirm() {
    const grouped: Record<string, SkillSyncResolution[]> = {};
    for (const item of needsDecision) {
      const resolution = resolutions[`${item.skillName}:${item.targetKey}`] ?? "cancel";
      grouped[item.skillName] = grouped[item.skillName] ?? [];
      grouped[item.skillName].push({ targetKey: item.targetKey, resolution });
    }
    onconfirm(grouped);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={oncancel}
        aria-label={t(locale, "skills.syncPreview.close")}
      />
      <div className="relative bg-bg-secondary border border-border rounded shadow-2xl w-[44rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] overflow-hidden z-10">
        <div className="px-5 py-4 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center shrink-0">
            <Send size={20} className="text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-text-primary">
              {t(locale, "skills.syncPreview.title")}
            </h3>
            <p className="text-sm text-text-muted mt-1">
              {t(locale, impactSummaryKey(summary), {
                count: needsDecision.length || writes,
              })}
            </p>
            <p className="text-xs text-text-secondary mt-1">
              {t(locale, "skills.syncPreview.operationSummary", {
                create: summary.create,
                overwrite: summary.overwrite,
                noOp: summary.noOp,
                blocked: summary.blockedDrift,
                unknown: summary.overwriteUnknown,
              })}
            </p>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[24rem] space-y-3">
          {needsDecision.length > 0 && (
            <div className="rounded border border-warning/30 bg-warning-dim px-3 py-2 text-sm text-warning flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {t(locale, "skills.syncPreview.decisionRequired")}
            </div>
          )}
          <div className="border border-border rounded overflow-hidden">
            <div className="grid grid-cols-[8rem_7rem_1fr_9rem] gap-2 px-3 py-2 text-xs uppercase text-text-secondary bg-bg-tertiary">
              <span>{t(locale, "skills.syncPreview.skill")}</span>
              <span>{t(locale, "skills.syncPreview.operation")}</span>
              <span>{t(locale, "skills.syncPreview.path")}</span>
              <span>{t(locale, "skills.syncPreview.decision")}</span>
            </div>
            {items.map((item) => {
              const key = `${item.skillName}:${item.targetKey}`;
              return (
                <div
                  key={key}
                  className="grid grid-cols-[8rem_7rem_1fr_9rem] gap-2 px-3 py-2 text-xs border-t border-border items-center"
                >
                  <span className="font-mono truncate" title={item.skillName}>
                    {item.skillName}
                  </span>
                  <span className={operationClass(item.operation)}>
                    {t(locale, `skills.syncPreview.operations.${item.operation}`)}
                  </span>
                  <span className="font-mono text-text-secondary truncate" title={item.skillMdPath}>
                    {item.skillMdPath || item.error || item.targetKey}
                  </span>
                  {NEEDS_RESOLUTION.has(item.operation) ? (
                    <select
                      value={resolutions[key] ?? "cancel"}
                      onChange={(event) =>
                        setResolution(item, event.currentTarget.value as SkillSyncDriftResolution)
                      }
                      className="bg-bg-primary border border-border rounded px-2 py-1 text-xs"
                    >
                      <option value="cancel">{t(locale, "skills.syncPreview.cancelTarget")}</option>
                      <option value="override">{t(locale, "skills.syncPreview.override")}</option>
                      <option value="detach">{t(locale, "skills.syncPreview.detach")}</option>
                    </select>
                  ) : (
                    <span className="text-text-secondary">{t(locale, "skills.syncPreview.none")}</span>
                  )}
                </div>
              );
            })}
          </div>

          {orphanSiblings.length > 0 && (
            <div className="rounded border border-border bg-bg-tertiary px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Trash2 size={14} className="text-danger shrink-0" />
                {t(locale, "skills.syncPreview.orphanSiblings.title")}
              </div>
              <p className="text-xs text-text-secondary">
                {t(locale, "skills.syncPreview.orphanSiblings.description")}
              </p>
              <ul className="text-xs font-mono text-danger space-y-0.5 mt-1">
                {orphanSiblings.map((path) => (
                  <li key={path}>− {path}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 text-sm text-text-secondary bg-bg-tertiary hover:bg-bg-hover rounded transition-colors"
            onClick={oncancel}
            disabled={busy}
          >
            {t(locale, "skills.syncPreview.close")}
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent-hover rounded transition-colors disabled:opacity-50"
            onClick={confirm}
            disabled={busy}
          >
            {busy ? t(locale, "skills.syncPreview.committing") : t(locale, "skills.syncPreview.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function summarize(items: SkillSyncPreviewItem[]) {
  return items.reduce(
    (acc, item) => ({ ...acc, [item.operation]: acc[item.operation] + 1 }),
    {
      create: 0,
      overwrite: 0,
      noOp: 0,
      skipped: 0,
      blockedDrift: 0,
      overwriteUnknown: 0,
    },
  );
}

function impactSummaryKey(summary: ReturnType<typeof summarize>) {
  const attention = summary.blockedDrift + summary.overwriteUnknown;
  if (attention > 0) {
    return "skills.syncPreview.impact.needsAttention" as const;
  }
  if (summary.create + summary.overwrite > 0) {
    return "skills.syncPreview.impact.willWrite" as const;
  }
  return "skills.syncPreview.impact.noChanges" as const;
}

function operationClass(operation: SkillSyncPreviewItem["operation"]): string {
  if (operation === "blockedDrift" || operation === "overwriteUnknown") {
    return "text-warning";
  }
  if (operation === "create" || operation === "overwrite") {
    return "text-accent";
  }
  if (operation === "skipped") {
    return "text-text-secondary";
  }
  return "text-success";
}
