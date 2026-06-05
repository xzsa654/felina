import { useState, useEffect, useCallback } from "react";
import { api } from "$lib/tauri/commands";
import {
  PageHeader,
  PageBody,
  ErrorBanner,
  LoadingLine,
  ActionButton,
  glassListRowClass,
  glassListSelectedRowClass,
  glassListSurfaceClass,
} from "$lib/components/shared/PageScaffold";
import Modal from "$lib/components/shared/Modal";
import { Store, Download, CheckCircle, AlertCircle, UploadCloud, RefreshCw } from "lucide-react";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import type { SkillListEntry } from "$lib/types";

interface MarketSkill {
  name: string;
  version: string | null;
  contentHash?: string;
}

export default function HubPage() {
  const locale = useLocaleStore((s) => s.locale);
  const [skills, setSkills] = useState<MarketSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [upToDateNames, setUpToDateNames] = useState<Set<string>>(new Set());
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishEntries, setPublishEntries] = useState<SkillListEntry[]>([]);
  const [publishName, setPublishName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);

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
            matched.add(ms.name);
          }
        }),
      );
      setUpToDateNames(matched);
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

  const loadPublishEntries = useCallback(async () => {
    setPublishLoading(true);
    setPublishError(null);
    try {
      const entries = await api.canonicalSkills.list();
      setPublishEntries(entries);
      const firstName = entries[0]
        ? entries[0].kind === "ok"
          ? entries[0].skill.name
          : entries[0].name
        : "";
      setPublishName((current) => current || firstName);
    } catch (e) {
      setPublishError(
        t(locale, "hub.publish.loadFailed", {
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setPublishLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (publishOpen) {
      void loadPublishEntries();
    }
  }, [loadPublishEntries, publishOpen]);

  async function handleInstall(skill: MarketSkill) {
    setInstalling(skill.name);
    setInstallStatus((prev) => {
      const next = { ...prev };
      delete next[skill.name];
      return next;
    });
    try {
      const name = await api.market.installSkill(skill.name);
      setUpToDateNames((prev) => new Set(prev).add(skill.name));
      setInstallStatus((prev) => ({
        ...prev,
        [skill.name]: { ok: true, msg: t(locale, "hub.installSuccess", { name }) },
      }));
    } catch (e) {
      setInstallStatus((prev) => ({
        ...prev,
        [skill.name]: {
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

  async function handlePublish() {
    if (!publishName) return;
    setPublishing(true);
    setPublishError(null);
    setPublishStatus(null);
    try {
      await api.market.publishSkill(publishName);
      setPublishStatus(t(locale, "hub.publish.success", { name: publishName }));
      setPublishOpen(false);
      await fetchSkills();
    } catch (e) {
      setPublishError(
        t(locale, "hub.publish.failure", {
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setPublishing(false);
    }
  }

  const publishDialog = (
    <Modal
      open={publishOpen}
      onClose={() => setPublishOpen(false)}
      title={t(locale, "hub.publish.title")}
      size="md"
    >
      <div className="px-5 py-4 max-h-[55vh] overflow-y-auto">
        {publishError && (
          <div className="mb-4 px-3 py-2 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs">
            {publishError}
          </div>
        )}
        {publishLoading ? (
          <LoadingLine label={t(locale, "hub.publish.loading")} />
        ) : publishEntries.length === 0 ? (
          <p className="text-sm text-text-muted">
            {t(locale, "hub.publish.empty")}
          </p>
        ) : (
          <div className={`rounded-xl p-1 ${glassListSurfaceClass}`}>
            {publishEntries.map((entry) => {
              const name = entry.kind === "ok" ? entry.skill.name : entry.name;
              const selected = publishName === name;
              return (
                <button
                  key={entry.canonicalId}
                  type="button"
                  onClick={() => setPublishName(name)}
                  className={`w-full min-h-11 rounded-lg px-3 py-2 text-left transition-colors ${
                    selected ? glassListSelectedRowClass : glassListRowClass
                  }`}
                >
                  <span className="block truncate text-sm font-medium text-text-primary">
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-border bg-bg-secondary text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          onClick={() => setPublishOpen(false)}
        >
          {t(locale, "common.cancel")}
        </button>
        <button
          type="button"
          disabled={publishing || publishLoading || !publishName || publishEntries.length === 0}
          onClick={handlePublish}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UploadCloud size={15} />
          {publishing ? t(locale, "hub.publish.publishing") : t(locale, "hub.publish.confirm")}
        </button>
      </div>
    </Modal>
  );

  return (
    <>
      <PageHeader
        title={t(locale, "hub.title")}
        subtitle={t(locale, "hub.subtitle")}
        icon={Store}
        actions={
          <>
            <ActionButton
              variant="secondary"
              onClick={() => void fetchSkills()}
              disabled={loading}
            >
              <RefreshCw size={15} />
              {t(locale, "hub.refresh")}
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={() => {
                setPublishStatus(null);
                setPublishError(null);
                setPublishOpen(true);
              }}
            >
              <UploadCloud size={15} />
              {t(locale, "hub.publish.button")}
            </ActionButton>
          </>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        {publishStatus && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-success/30 bg-success/10 text-success text-sm">
            {publishStatus}
          </div>
        )}

        {loading && !error && <LoadingLine label={t(locale, "hub.loading")} />}

        {!loading && !error && skills.length === 0 && (
          <p className="text-sm text-text-muted">{t(locale, "hub.empty")}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => {
            const status = installStatus[skill.name];
            const isUpToDate = upToDateNames.has(skill.name);
            return (
              <div
                key={skill.name}
                className="bg-bg-secondary/40 backdrop-blur-md border border-white/5 shadow-sm rounded-xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {skill.name}
                    </h3>
                    {skill.version && (
                      <p className="text-xs text-text-muted mt-0.5">
                        v{skill.version}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {isUpToDate ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-success">
                      <CheckCircle size={13} />
                      {t(locale, "hub.upToDate")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={installing === skill.name}
                      onClick={() => handleInstall(skill)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download size={13} />
                      {installing === skill.name
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
      {publishDialog}
    </>
  );
}
