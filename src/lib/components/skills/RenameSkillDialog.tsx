import { useEffect, useState } from "react";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import Modal from "$lib/components/shared/Modal";

interface Props {
  open: boolean;
  currentName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

function validate(
  value: string,
  currentName: string,
  locale: import("$lib/i18n").Locale,
): string | null {
  if (value.length === 0) return t(locale, "skills.renameDialog.errorEmpty");
  if (value === currentName) return t(locale, "skills.renameDialog.errorSame");
  if (value.startsWith(".")) return t(locale, "skills.renameDialog.errorInvalid");
  for (const ch of value) {
    if (!/[A-Za-z0-9_-]/.test(ch))
      return t(locale, "skills.renameDialog.errorInvalid");
  }
  return null;
}

export default function RenameSkillDialog({ open, currentName, onConfirm, onCancel }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [value, setValue] = useState(currentName);

  useEffect(() => {
    if (open) setValue(currentName);
  }, [open, currentName]);

  const error = validate(value, currentName, locale);

  return (
    <Modal open={open} onClose={onCancel} title={t(locale, "skills.renameDialog.title")} size="sm">
      <div className="p-4 flex flex-col gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t(locale, "skills.renameDialog.placeholder")}
          className="w-full px-3 py-1.5 text-sm rounded border border-border bg-bg-primary focus:outline-none focus:border-accent"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !error) onConfirm(value);
          }}
        />

        {error && (
          <div className="text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary"
          >
            {t(locale, "skills.renameDialog.cancel")}
          </button>
          <button
            type="button"
            disabled={!!error}
            onClick={() => onConfirm(value)}
            className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t(locale, "skills.renameDialog.confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
