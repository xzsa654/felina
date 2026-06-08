import { useState } from "react";
import { CheckCircle, Download, AlertCircle, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";
import MarkdownPreview from "$lib/components/shared/MarkdownPreview";
import { LoadingLine } from "$lib/components/shared/PageScaffold";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";

export interface MarketSkillPreviewData {
  name: string;
  version: string | null;
  description: string | null;
  contentHash: string | null;
}

export default function MarketSkillPreview({
  skill,
  upToDate,
  installing,
  status,
  onInstall,
  isAuthor,
  onDelete,
  locale,
  markdown,
  markdownLoading,
  markdownError,
}: {
  skill: MarketSkillPreviewData;
  upToDate: boolean;
  installing: boolean;
  status: { ok: boolean; msg: string } | null;
  onInstall: () => void;
  isAuthor: boolean;
  onDelete: () => void;
  locale: Locale;
  markdown: string | null;
  markdownLoading: boolean;
  markdownError: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const actionLabel = installing
    ? t(locale, "hub.installing")
    : upToDate
      ? t(locale, "hub.upToDate")
      : t(locale, "hub.install");
  const showUpdateVerb = !upToDate && !installing;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-text-primary truncate">
          {skill.name}
        </h2>
        {skill.version && (
          <p className="text-xs text-text-muted mt-0.5">
            {t(locale, "hub.preview.version")} v{skill.version}
          </p>
        )}
      </div>

      {skill.description && (
        <p className="text-sm text-text-secondary whitespace-pre-wrap">
          {skill.description}
        </p>
      )}

      <div className="flex items-center gap-3">
        {upToDate ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-success">
            <CheckCircle size={14} />
            {actionLabel}
          </span>
        ) : (
          <button
            type="button"
            disabled={installing}
            onClick={onInstall}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {installing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {showUpdateVerb ? t(locale, "hub.preview.update") : actionLabel}
          </button>
        )}
        {isAuthor && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-danger/30 text-danger text-sm hover:bg-danger/10 transition-colors"
          >
            <Trash2 size={14} />
            {t(locale, "hub.delete.button")}
          </button>
        )}
        {status && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              status.ok ? "text-success" : "text-danger"
            }`}
          >
            {status.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
            {status.msg}
          </span>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={t(locale, "hub.delete.button")}
        message={t(locale, "hub.delete.confirm", { name: skill.name })}
        confirmLabel={t(locale, "hub.delete.button")}
        onconfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        oncancel={() => setConfirmDelete(false)}
      />

      <div className="border-t border-border/40 pt-4">
        {markdownLoading ? (
          <LoadingLine label="" />
        ) : markdownError ? (
          <p className="text-xs text-danger">{markdownError}</p>
        ) : markdown ? (
          <MarkdownPreview markdown={markdown} />
        ) : (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
