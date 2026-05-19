import { useEffect, useState } from "react";
import { Keyboard, RefreshCw, RotateCcw, Save } from "lucide-react";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingLine,
  PageBody,
  PageHeader,
} from "$lib/components/shared/PageScaffold";
import { api, type KeybindingEntry } from "$lib/tauri/commands";

export default function KeybindingsPage() {
  const [bindings, setBindings] = useState<KeybindingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setBindings(await api.keybindings.read());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.keybindings.write(bindings);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefaults() {
    setSaving(true);
    setError(null);
    try {
      setBindings(await api.keybindings.getDefaults());
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function update(index: number, patch: Partial<KeybindingEntry>) {
    setBindings((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Keybindings"
        subtitle="Edit keyboard shortcuts"
        icon={Keyboard}
        actions={
          <>
            <ActionButton onClick={restoreDefaults} disabled={saving}>
              <RotateCcw size={14} />
              Defaults
            </ActionButton>
            <ActionButton onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </ActionButton>
            <ActionButton onClick={save} disabled={saving} variant="primary">
              <Save size={14} />
              Save
            </ActionButton>
          </>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        {loading ? (
          <LoadingLine />
        ) : bindings.length === 0 ? (
          <EmptyState title="No keybindings found" />
        ) : (
          <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[180px_1fr_1fr_180px] gap-2 px-3 py-2 border-b border-border text-xs uppercase tracking-wider text-text-muted">
              <span>Key</span>
              <span>Command</span>
              <span>Description</span>
              <span>When</span>
            </div>
            {bindings.map((entry, index) => (
              <div key={`${entry.command}:${index}`} className="grid grid-cols-[180px_1fr_1fr_180px] gap-2 p-2 border-b border-border last:border-b-0">
                <input className="px-2 py-1.5 bg-bg-tertiary border border-border rounded text-sm font-mono text-text-primary" value={entry.key} onChange={(e) => update(index, { key: e.target.value })} />
                <input className="px-2 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary" value={entry.command} onChange={(e) => update(index, { command: e.target.value })} />
                <input className="px-2 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary" value={entry.description} onChange={(e) => update(index, { description: e.target.value })} />
                <input className="px-2 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary" value={entry.when ?? ""} onChange={(e) => update(index, { when: e.target.value || null })} />
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </div>
  );
}
