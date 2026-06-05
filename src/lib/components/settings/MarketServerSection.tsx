import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Save, Store } from "lucide-react";
import { api } from "$lib/tauri/commands";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";

const DEFAULT_URL = "http://localhost:3100";

export default function MarketServerSection() {
  const locale = useLocaleStore((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const v = await api.market.getServerUrl();
        setUrl(v);
        setOriginal(v);
      } catch (e) {
        setError(t(locale, "felinaSettings.marketServer.loadError", { error: String(e) }));
        setUrl(DEFAULT_URL);
        setOriginal(DEFAULT_URL);
      }
    })();
  }, [locale]);

  if (url === null) {
    return (
      <section className="rounded-lg border border-border bg-bg-secondary p-4">
        <div className="text-sm text-text-secondary">…</div>
      </section>
    );
  }

  const dirty = original !== null && url !== original;

  async function handleSave() {
    if (url === null) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.market.setServerUrl(url);
      const stored = await api.market.getServerUrl();
      setUrl(stored);
      setOriginal(stored);
      setInfo(t(locale, "felinaSettings.marketServer.saveSuccess"));
    } catch (e) {
      setError(t(locale, "felinaSettings.marketServer.saveError", { error: String(e) }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-bg-secondary">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Store size={16} className="text-accent" />
        <span className="text-sm font-semibold">
          {t(locale, "felinaSettings.marketServer.title")}
        </span>
        <span className="text-xs text-text-secondary">
          {t(locale, "felinaSettings.marketServer.description")}
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-4 flex flex-col gap-3">
          {info && (
            <div className="text-xs text-success bg-success-dim border border-success/30 rounded px-3 py-2">
              {info}
            </div>
          )}
          {error && (
            <div className="text-xs text-danger bg-danger-dim border border-danger/30 rounded px-3 py-2 whitespace-pre-wrap break-words font-mono">
              {error}
            </div>
          )}

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-secondary">
              {t(locale, "felinaSettings.marketServer.urlLabel")}
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t(locale, "felinaSettings.marketServer.placeholder")}
              spellCheck={false}
              className="px-2 py-1.5 rounded bg-bg-primary border border-border text-xs font-mono focus:outline-none focus:border-accent"
            />
          </label>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => {
                if (original !== null) setUrl(original);
                setError(null);
                setInfo(null);
              }}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              <RotateCcw size={12} /> {t(locale, "felinaSettings.marketServer.revert")}
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              <Save size={12} />{" "}
              {saving
                ? t(locale, "felinaSettings.marketServer.saving")
                : t(locale, "felinaSettings.marketServer.save")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
