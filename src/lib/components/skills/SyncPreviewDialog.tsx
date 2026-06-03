import { useMemo, useState } from "react";
import { AlertTriangle, Send, Trash2 } from "lucide-react";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import type {
  AgentId,
  SkillSyncDriftResolution,
  SkillSyncPreview,
  SkillSyncPreviewItem,
  SkillSyncResolution,
} from "$lib/types";
import claudeIcon from "$lib/assets/claude.svg";
import codexIcon from "$lib/assets/codex.png";
import antigravityIcon from "$lib/assets/antigravity.png";
import Modal from "$lib/components/shared/Modal";

interface Props {
  open: boolean;
  previews: SkillSyncPreview[];
  busy?: boolean;
  onconfirm: (resolutionsBySkill: Record<string, SkillSyncResolution[]>) => void;
  oncancel: () => void;
}

type ResolutionMap = Record<string, SkillSyncDriftResolution>;

const NEEDS_RESOLUTION = new Set(["blockedDrift", "overwriteUnknown"]);

const AGENT_ICON: Record<AgentId, string> = {
  anthropic: claudeIcon,
  codex: codexIcon,
  gemini: antigravityIcon,
};

// Fixed grid template: skill | operation | target | decision
const ROW_GRID = "grid grid-cols-[8rem_6rem_minmax(0,1fr)_12rem] gap-3 px-3";

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
    <Modal open={open} onClose={oncancel} size="lg">
      <div className="flex flex-col max-h-[85vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
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
            <div className="rounded-lg border border-warning/30 bg-warning-dim px-3 py-2 text-sm text-warning flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {t(locale, "skills.syncPreview.decisionRequired")}
            </div>
          )}
          <div className="space-y-1.5">
            <div className={`${ROW_GRID} py-2 text-xs uppercase text-text-secondary`}>
              <span>{t(locale, "skills.syncPreview.skill")}</span>
              <span>{t(locale, "skills.syncPreview.operation")}</span>
              <span>{t(locale, "skills.syncPreview.target")}</span>
              <span>{t(locale, "skills.syncPreview.decision")}</span>
            </div>
            {items.map((item) => {
              const key = `${item.skillName}:${item.targetKey}`;
              const needsResolution = NEEDS_RESOLUTION.has(item.operation);
              return (
                <div
                  key={key}
                  className={`${ROW_GRID} h-14 items-center text-xs border border-border rounded-xl bg-bg-tertiary/30 hover:bg-bg-hover/40 transition-colors`}
                >
                  <span className="font-mono truncate" title={item.skillName}>
                    {item.skillName}
                  </span>
                  <span className={operationClass(item.operation)}>
                    {t(locale, `skills.syncPreview.operations.${item.operation}`)}
                  </span>
                  <TargetCell item={item} locale={locale} />
                  {needsResolution ? (
                    <select
                      value={resolutions[key] ?? "cancel"}
                      onChange={(event) =>
                        setResolution(item, event.currentTarget.value as SkillSyncDriftResolution)
                      }
                      className="w-full max-w-[12rem] truncate bg-bg-primary border border-border rounded-lg px-2 py-1.5 text-xs"
                    >
                      <option value="cancel">{t(locale, "skills.syncPreview.cancelTarget")}</option>
                      <option value="override">{t(locale, "skills.syncPreview.override")}</option>
                      <option value="detach">{t(locale, "skills.syncPreview.detach")}</option>
                    </select>
                  ) : (
                    <span className="text-text-secondary truncate">{t(locale, "skills.syncPreview.none")}</span>
                  )}
                </div>
              );
            })}
          </div>

          {orphanSiblings.length > 0 && (
            <div className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 space-y-1">
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
            className="px-4 py-2 text-sm text-text-secondary bg-bg-tertiary hover:bg-bg-hover rounded-lg transition-colors"
            onClick={oncancel}
            disabled={busy}
          >
            {t(locale, "skills.syncPreview.close")}
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-50"
            onClick={confirm}
            disabled={busy}
          >
            {busy ? t(locale, "skills.syncPreview.committing") : t(locale, "skills.syncPreview.confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TargetCell({
  item,
  locale,
}: {
  item: SkillSyncPreviewItem;
  locale: "en" | "zh-TW";
}) {
  const agentName = t(locale, `skills.syncPreview.agentNames.${item.agent}`);
  const projectBasename = item.project ? basename(item.project) : null;
  const primaryLabel =
    item.scope === "project" && projectBasename
      ? t(locale, "skills.syncPreview.targetLabel.project", {
          agent: agentName,
          project: projectBasename,
        })
      : t(locale, "skills.syncPreview.targetLabel.global", { agent: agentName });
  const secondary = item.skillMdPath || item.error || item.targetKey;
  return (
    <div className="min-w-0 flex items-center gap-2">
      <img
        src={AGENT_ICON[item.agent]}
        alt={item.agent}
        className="h-4 w-4 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-text-primary truncate" title={primaryLabel}>
          {primaryLabel}
        </div>
        <div className="font-mono text-[10px] text-text-muted truncate" title={secondary}>
          {secondary}
        </div>
      </div>
    </div>
  );
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
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
