import { useState } from "react";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import Modal from "$lib/components/shared/Modal";

interface Props {
  open: boolean;
  existingKeys: string[];
  onAdd: (key: string, global: string, projectRelative: string, label?: string, icon?: string) => void;
  onClose: () => void;
}

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default function AddAgentPathDialog({ open, existingKeys, onAdd, onClose }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [key, setKey] = useState("");
  const [global, setGlobal] = useState("");
  const [projectRelative, setProjectRelative] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("");

  function reset() {
    setKey(""); setGlobal(""); setProjectRelative(""); setLabel(""); setIcon("");
  }

  const keyError = key.length > 0 && !KEBAB_RE.test(key)
    ? t(locale, "felinaSettings.agentPaths.invalidKey")
    : existingKeys.includes(key)
      ? t(locale, "felinaSettings.agentPaths.duplicateKey")
      : null;

  const canSubmit = key.length > 0 && !keyError && global.trim().length > 0 && projectRelative.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onAdd(key, global.trim(), projectRelative.trim(), label.trim() || undefined, icon.trim() || undefined);
    reset();
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} size="md">
      <div className="p-6 flex flex-col gap-4">
        <h3 className="text-base font-semibold">{t(locale, "felinaSettings.agentPaths.addTitle")}</h3>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-secondary">{t(locale, "felinaSettings.agentPaths.agentKey")}</span>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase())}
            placeholder={t(locale, "felinaSettings.agentPaths.agentKeyPlaceholder")}
            spellCheck={false}
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-xs font-mono focus:outline-none focus:border-accent"
          />
          {keyError && <span className="text-danger text-[10px]">{keyError}</span>}
          <span className="text-text-tertiary text-[10px]">{t(locale, "felinaSettings.agentPaths.agentKeyHint")}</span>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-secondary">{t(locale, "felinaSettings.agentPaths.globalPath")}</span>
          <input
            type="text"
            value={global}
            onChange={(e) => setGlobal(e.target.value)}
            placeholder="~/.my-agent/skills"
            spellCheck={false}
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-xs font-mono focus:outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-secondary">{t(locale, "felinaSettings.agentPaths.projectRelativePath")}</span>
          <input
            type="text"
            value={projectRelative}
            onChange={(e) => setProjectRelative(e.target.value)}
            placeholder=".my-agent/skills"
            spellCheck={false}
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-xs font-mono focus:outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-secondary">{t(locale, "felinaSettings.agentPaths.label")}</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="My Agent"
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-xs focus:outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-secondary">{t(locale, "felinaSettings.agentPaths.icon")}</span>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="~/.felina/icons/my-agent.png"
            spellCheck={false}
            className="px-2 py-1.5 rounded bg-bg-primary border border-border text-xs font-mono focus:outline-none focus:border-accent"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:text-text-primary"
          >
            {t(locale, "felinaSettings.agentPaths.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-3 py-1.5 text-xs rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {t(locale, "felinaSettings.agentPaths.add")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
