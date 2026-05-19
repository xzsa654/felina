import { useEffect, useMemo, useState } from "react";
import { Download, Plug, RefreshCw } from "lucide-react";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingLine,
  PageBody,
  PageHeader,
  StatCard,
} from "$lib/components/shared/PageScaffold";
import { api } from "$lib/tauri/commands";

interface PluginRecord {
  name?: string;
  description?: string;
  version?: string;
  installed?: boolean;
  [key: string]: unknown;
}

function toList(value: unknown): PluginRecord[] {
  if (Array.isArray(value)) return value as PluginRecord[];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([name, data]) => ({
      name,
      ...(typeof data === "object" && data ? (data as PluginRecord) : {}),
    }));
  }
  return [];
}

export default function PluginsPage() {
  const [installed, setInstalled] = useState<PluginRecord[]>([]);
  const [marketplace, setMarketplace] = useState<PluginRecord[]>([]);
  const [blocked, setBlocked] = useState<PluginRecord[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextInstalled, nextMarketplace, nextBlocked] = await Promise.all([
        api.plugins.getInstalled(),
        api.plugins.getMarketplace(),
        api.plugins.getBlocked(),
      ]);
      setInstalled(toList(nextInstalled));
      setMarketplace(toList(nextMarketplace));
      setBlocked(toList(nextBlocked));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const installedNames = useMemo(
    () => new Set(installed.map((plugin) => plugin.name).filter(Boolean)),
    [installed],
  );

  async function install(name: string) {
    setInstalling(name);
    setError(null);
    try {
      await api.plugins.install(name);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Plugins"
        subtitle="Browse marketplace plugins and installed extensions"
        icon={Plug}
        actions={
          <ActionButton onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </ActionButton>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        {loading ? (
          <LoadingLine />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Installed" value={installed.length} />
              <StatCard label="Marketplace" value={marketplace.length} />
              <StatCard label="Blocked" value={blocked.length} />
            </div>
            {marketplace.length === 0 ? (
              <EmptyState title="No marketplace plugins found" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {marketplace.map((plugin, index) => {
                  const name = plugin.name ?? `plugin-${index}`;
                  const isInstalled = installedNames.has(name);
                  return (
                    <div key={name} className="bg-bg-secondary border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-sm font-medium text-text-primary truncate">{name}</h2>
                          <p className="text-xs text-text-muted mt-1 line-clamp-2">
                            {plugin.description ?? "No description"}
                          </p>
                        </div>
                        <ActionButton
                          onClick={() => install(name)}
                          disabled={isInstalled || installing === name}
                          variant={isInstalled ? "secondary" : "primary"}
                        >
                          <Download size={14} />
                          {isInstalled ? "Installed" : "Install"}
                        </ActionButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </PageBody>
    </div>
  );
}
