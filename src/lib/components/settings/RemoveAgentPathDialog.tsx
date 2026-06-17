import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "$lib/tauri/commands";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import Modal from "$lib/components/shared/Modal";
import type { RemovalPreview } from "$lib/types";

interface Props {
  open: boolean;
  agentKey: string;
  onRemoved: () => void;
  onClose: () => void;
}

export default function RemoveAgentPathDialog({ open, agentKey, onRemoved, onClose }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [preview, setPreview] = useState<RemovalPreview | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !agentKey) return;
    setPreview(null);
    setError(null);
    api.agentPaths.removalPreview(agentKey).then(setPreview).catch((e) => setError(String(e)));
  }, [open, agentKey]);

  async function handleRemove() {
    setRemoving(true);
    try {
      await api.agentPaths.remove(agentKey);
      onRemoved();
    } catch (e) {
      setError(String(e));
    } finally {
      setRemoving(false);
    }
  }

  const message = preview
    ? preview.targetCount > 0
      ? t(locale, "felinaSettings.agentPaths.removeConfirm", {
          agent: agentKey,
          targetCount: preview.targetCount,
          skillCount: preview.skills.length,
        })
      : t(locale, "felinaSettings.agentPaths.removeNoTargets", { agent: agentKey })
    : null;

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-danger-dim flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">{t(locale, "felinaSettings.agentPaths.removeTitle")}</h3>
            {message && <p className="text-sm text-text-secondary mt-2">{message}</p>}
            {preview && preview.skills.length > 0 && (
              <ul className="mt-2 text-xs text-text-secondary list-disc list-inside">
                {preview.skills.map((s) => <li key={s}>{s}</li>)}
              </ul>
            )}
            {error && <p className="text-xs text-danger mt-2">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:text-text-primary"
          >
            {t(locale, "felinaSettings.agentPaths.cancel")}
          </button>
          <button
            type="button"
            disabled={!preview || removing}
            onClick={handleRemove}
            className="px-3 py-1.5 text-xs rounded bg-danger text-white hover:opacity-90 disabled:opacity-50"
          >
            {removing ? "…" : t(locale, "felinaSettings.agentPaths.removeButton")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
