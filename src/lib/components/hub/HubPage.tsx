import { useState, useEffect, useCallback } from "react";
import { api } from "$lib/tauri/commands";
import {
  PageHeader,
  PageBody,
  ErrorBanner,
  LoadingLine,
} from "$lib/components/shared/PageScaffold";
import { Store, Download, CheckCircle, AlertCircle } from "lucide-react";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";

interface MarketSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  contentHash?: string;
}

export default function HubPage() {
  const locale = useLocaleStore((s) => s.locale);
  const [skills, setSkills] = useState<MarketSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [upToDateIds, setUpToDateIds] = useState<Set<string>>(new Set());

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = await api.market.getServerUrl();
      const [res, localEntries] = await Promise.all([
        fetch(`${apiBase}/api/skills`),
        api.canonicalSkills.list(),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const marketSkills: MarketSkill[] = await res.json();
      setSkills(marketSkills);

      const localNames = new Set(
        localEntries.map((e) => (e.kind === "ok" ? e.skill.name : e.name)),
      );

      const matched = new Set<string>();
      await Promise.all(
        marketSkills.map(async (ms) => {
          if (!localNames.has(ms.name) || !ms.contentHash) return;
          const localHash = await api.market.getSkillDirectoryHash(ms.name);
          if (localHash && localHash === ms.contentHash) {
            matched.add(ms.id);
          }
        }),
      );
      setUpToDateIds(matched);
    } catch (e) {
      setError(
        t(locale, "hub.connectionError", {
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  async function handleInstall(skill: MarketSkill) {
    setInstalling(skill.id);
    setInstallStatus((prev) => {
      const next = { ...prev };
      delete next[skill.id];
      return next;
    });
    try {
      const name = await api.market.installSkill(skill.id);
      setUpToDateIds((prev) => new Set(prev).add(skill.id));
      setInstallStatus((prev) => ({
        ...prev,
        [skill.id]: { ok: true, msg: t(locale, "hub.installSuccess", { name }) },
      }));
    } catch (e) {
      setInstallStatus((prev) => ({
        ...prev,
        [skill.id]: {
          ok: false,
          msg: t(locale, "hub.installFailed", {
            detail: e instanceof Error ? e.message : String(e),
          }),
        },
      }));
    } finally {
      setInstalling(null);
    }
  }

  return (
    <>
      <PageHeader
        title={t(locale, "hub.title")}
        subtitle={t(locale, "hub.subtitle")}
        icon={Store}
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}

        {loading && !error && <LoadingLine label={t(locale, "hub.loading")} />}

        {!loading && !error && skills.length === 0 && (
          <p className="text-sm text-text-muted">{t(locale, "hub.empty")}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => {
            const status = installStatus[skill.id];
            const isUpToDate = upToDateIds.has(skill.id);
            return (
              <div
                key={skill.id}
                className="bg-bg-secondary/40 backdrop-blur-md border border-white/5 shadow-sm rounded-xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {skill.name}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {skill.author} · v{skill.version}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed flex-1">
                  {skill.description}
                </p>
                <div className="flex items-center justify-between gap-2">
                  {isUpToDate ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-success">
                      <CheckCircle size={13} />
                      {t(locale, "hub.upToDate")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={installing === skill.id}
                      onClick={() => handleInstall(skill)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download size={13} />
                      {installing === skill.id
                        ? t(locale, "hub.installing")
                        : t(locale, "hub.install")}
                    </button>
                  )}
                  {status && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${status.ok ? "text-success" : "text-danger"}`}
                    >
                      {status.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                      {status.msg}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
