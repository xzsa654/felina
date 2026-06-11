import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import { api } from "$lib/tauri/commands";

export default function SkillLibrarySection() {
  const locale = useLocaleStore((s) => s.locale);
  const [skillCount, setSkillCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  async function refreshCount() {
    try {
      const list = await api.canonicalSkills.list();
      setSkillCount(list.length);
    } catch {
      setSkillCount(0);
    }
  }

  useEffect(() => {
    void refreshCount();
  }, []);

  async function handleExport() {
    setBusy(true);
    setStatus(null);
    try {
      const path = await save({
        defaultPath: "felina-skills-backup.zip",
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!path) {
        setBusy(false);
        return;
      }
      await api.skillLibrary.export(path);
      setStatus(t(locale, "felinaSettings.skillLibrary.exportSuccess", { count: String(skillCount) }));
    } catch (e) {
      const msg = String(e);
      if (msg.includes("empty")) {
        setStatus(t(locale, "felinaSettings.skillLibrary.exportEmpty"));
      } else {
        setStatus(t(locale, "felinaSettings.skillLibrary.exportFailed", { error: msg }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setShowResetConfirm(false);
    setBusy(true);
    setStatus(null);
    try {
      const result = await api.skillLibrary.reset();
      setStatus(
        t(locale, "felinaSettings.skillLibrary.resetSuccess", { deleted: String(result.deleted) }),
      );
      await refreshCount();
    } catch (e) {
      setStatus(t(locale, "felinaSettings.skillLibrary.resetFailed", { error: String(e) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-bg-secondary p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">
          {t(locale, "felinaSettings.skillLibrary.title")}
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">
          {t(locale, "felinaSettings.skillLibrary.description")}
        </p>
        <p className="text-sm text-text-muted mt-1">
          {t(locale, "felinaSettings.skillLibrary.skillCount", { count: String(skillCount) })}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-bg-tertiary hover:bg-bg-hover text-text-secondary transition-colors disabled:opacity-50"
          onClick={handleExport}
          disabled={busy}
        >
          <Download size={14} />
          {t(locale, "felinaSettings.skillLibrary.export")}
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-colors disabled:opacity-50"
          onClick={() => setShowResetConfirm(true)}
          disabled={busy}
        >
          <Trash2 size={14} />
          {t(locale, "felinaSettings.skillLibrary.reset")}
        </button>
      </div>

      {status && (
        <p className="text-sm text-text-muted">{status}</p>
      )}

      <ConfirmDialog
        open={showResetConfirm}
        title={t(locale, "felinaSettings.skillLibrary.resetConfirmTitle")}
        message={t(locale, "felinaSettings.skillLibrary.resetConfirmBody")}
        confirmLabel={t(locale, "felinaSettings.skillLibrary.reset")}
        onconfirm={handleReset}
        oncancel={() => setShowResetConfirm(false)}
      />
    </section>
  );
}
