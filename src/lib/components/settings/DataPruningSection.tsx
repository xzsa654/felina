import { useState } from "react";
import { api } from "$lib/tauri/commands";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";

export default function DataPruningSection() {
  const locale = useLocaleStore((s) => s.locale);
  const [pruneDialogOpen, setPruneDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handlePrune = async () => {
    setLoading(true);
    setResult(null);
    try {
      const deleted = await api.tokenAnalytics.pruneTokenEvents(retentionDays);
      setResult(
        t(locale, "felinaSettings.dataPruning.success", { count: deleted }),
      );
    } catch (e) {
      setResult(
        t(locale, "felinaSettings.dataPruning.error", { error: String(e) }),
      );
    } finally {
      setLoading(false);
      setPruneDialogOpen(false);
    }
  };

  const handleDeleteAll = async () => {
    setLoading(true);
    setResult(null);
    try {
      const deleted = await api.tokenAnalytics.deleteAllTokenEvents();
      setResult(
        t(locale, "felinaSettings.dataPruning.success", { count: deleted }),
      );
    } catch (e) {
      setResult(
        t(locale, "felinaSettings.dataPruning.error", { error: String(e) }),
      );
    } finally {
      setLoading(false);
      setDeleteAllDialogOpen(false);
    }
  };

  return (
    <div className="p-4 border border-border rounded-xl bg-bg-secondary/50">
      <h2 className="text-sm font-semibold text-text-primary">
        {t(locale, "felinaSettings.dataPruning.title")}
      </h2>
      <p className="text-xs text-text-secondary mt-1">
        {t(locale, "felinaSettings.dataPruning.description")}
      </p>

      <div className="flex items-center gap-3 mt-3">
        <select
          value={retentionDays}
          onChange={(e) => setRetentionDays(Number(e.target.value))}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-bg-tertiary text-text-primary"
        >
          <option value={30}>{t(locale, "felinaSettings.dataPruning.days30")}</option>
          <option value={60}>{t(locale, "felinaSettings.dataPruning.days60")}</option>
          <option value={90}>{t(locale, "felinaSettings.dataPruning.days90")}</option>
          <option value={180}>{t(locale, "felinaSettings.dataPruning.days180")}</option>
          <option value={365}>{t(locale, "felinaSettings.dataPruning.days365")}</option>
        </select>
        <button
          onClick={() => setPruneDialogOpen(true)}
          disabled={loading}
          className="px-4 py-1.5 text-sm text-white bg-danger hover:bg-danger/80 disabled:opacity-50 rounded-lg transition-colors"
        >
          {loading
            ? t(locale, "felinaSettings.dataPruning.cleaning")
            : t(locale, "felinaSettings.dataPruning.button")}
        </button>
        <button
          onClick={() => setDeleteAllDialogOpen(true)}
          disabled={loading}
          className="px-4 py-1.5 text-sm text-danger border border-danger hover:bg-danger/10 disabled:opacity-50 rounded-lg transition-colors"
        >
          {t(locale, "felinaSettings.dataPruning.deleteAllButton")}
        </button>
      </div>

      {result && (
        <p className="text-xs text-text-secondary mt-2">{result}</p>
      )}

      <ConfirmDialog
        open={pruneDialogOpen}
        title={t(locale, "felinaSettings.dataPruning.confirmTitle")}
        message={t(locale, "felinaSettings.dataPruning.confirmMessage", {
          days: retentionDays,
        })}
        confirmLabel={t(locale, "felinaSettings.dataPruning.confirmButton")}
        onconfirm={handlePrune}
        oncancel={() => setPruneDialogOpen(false)}
      />

      <ConfirmDialog
        open={deleteAllDialogOpen}
        title={t(locale, "felinaSettings.dataPruning.deleteAllConfirmTitle")}
        message={t(locale, "felinaSettings.dataPruning.deleteAllConfirmMessage")}
        confirmLabel={t(locale, "felinaSettings.dataPruning.deleteAllConfirmButton")}
        onconfirm={handleDeleteAll}
        oncancel={() => setDeleteAllDialogOpen(false)}
      />
    </div>
  );
}
