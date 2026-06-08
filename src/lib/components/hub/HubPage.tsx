import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Store, UploadCloud, RefreshCw, Loader2, CheckCircle, Download, ArrowLeft } from "lucide-react";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import type { SkillListEntry } from "$lib/types";
import MarketSkillList from "./MarketSkillList";
import MarketSkillPreview from "./MarketSkillPreview";
import LoginDialog from "./LoginDialog";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { LogIn, X } from "lucide-react";
import AccountDropdown from "./AccountDropdown";
import { sendNotification } from "@tauri-apps/plugin-notification";

function stripFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/^﻿/, "");
  const match = normalized.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? normalized.slice(match[0].length) : normalized;
}

interface MarketSkill {
  name: string;
  version: string | null;
  description?: string | null;
  contentHash?: string;
  author?: string | null;
  updatedAt?: string | null;
}

export default function HubPage() {
  const locale = useLocaleStore((s) => s.locale);
  const [skills, setSkills] = useState<MarketSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<
    Record<string, { ok: boolean; msg: string }>
  >({});
  const [upToDateNames, setUpToDateNames] = useState<Set<string>>(new Set());
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [markdownCache, setMarkdownCache] = useState<Record<string, string>>({});
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownError, setMarkdownError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishEntries, setPublishEntries] = useState<SkillListEntry[]>([]);
  const [publishName, setPublishName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [confirmInstallSkill, setConfirmInstallSkill] = useState<MarketSkill | null>(null);


  const recomputeUpToDate = useCallback(
    async (marketSkills: MarketSkill[]) => {
      const localEntries = await api.canonicalSkills.list();
      const localNames = new Set(
        localEntries.map((e) => (e.kind === "ok" ? e.skill.name : e.name)),
      );
      const matched = new Set<string>();
      const installed = new Set<string>();
      await Promise.all(
        marketSkills.map(async (ms) => {
          if (!localNames.has(ms.name)) return;
          installed.add(ms.name);
          if (!ms.contentHash) return;
          const localHash = await api.market.getSkillDirectoryHash(ms.name);
          if (localHash && localHash === ms.contentHash) {
            matched.add(ms.name);
          }
        }),
      );
      return { matched, installed };
    },
    [],
  );

  const fetchSkills = useCallback(
    async (mode: "initial" | "reload" = "initial") => {
      if (mode === "reload") setReloading(true);
      else setLoading(true);
      setError(null);
      try {
        const apiBase = await api.market.getServerUrl();
        const res = await fetch(`${apiBase}/api/skills`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const marketSkills: MarketSkill[] = await res.json();
        setSkills(marketSkills);
        const { matched } = await recomputeUpToDate(marketSkills);
        setUpToDateNames(matched);
      } catch (e) {
        setError(
          t(locale, "hub.connectionError", {
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        if (mode === "reload") {
          // Residual delay matches SkillsPage.handleReload — gives the spinner
          // a perceptible spin even when the fetch returns instantly.
          setTimeout(() => setReloading(false), 250);
        } else {
          setLoading(false);
        }
      }
    },
    [locale, recomputeUpToDate],
  );

  useEffect(() => {
    void fetchSkills("initial");
    void api.market.getAuthStatus().then((status) => {
      setAuthEmail(status?.email ?? null);
    });
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

  // Drop selection if the selected skill disappears from the market list
  // (e.g. server-side delete observed during refresh).
  useEffect(() => {
    if (selectedName && !skills.some((s) => s.name === selectedName)) {
      setSelectedName(null);
    }
  }, [selectedName, skills]);

  // Fetch SKILL.md markdown for the selected skill, cached by name.
  useEffect(() => {
    if (!selectedName) {
      setMarkdownError(null);
      return;
    }
    if (markdownCache[selectedName] !== undefined) {
      setMarkdownError(null);
      return;
    }
    let cancelled = false;
    setMarkdownLoading(true);
    setMarkdownError(null);
    (async () => {
      try {
        const apiBase = await api.market.getServerUrl();
        const res = await fetch(
          `${apiBase}/api/skills/${encodeURIComponent(selectedName)}/skill-md`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const body = stripFrontmatter(text);
        if (!cancelled) {
          setMarkdownCache((prev) => ({ ...prev, [selectedName]: body }));
        }
      } catch (e) {
        if (!cancelled) {
          setMarkdownError(
            t(locale, "hub.connectionError", {
              detail: e instanceof Error ? e.message : String(e),
            }),
          );
        }
      } finally {
        if (!cancelled) setMarkdownLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedName, markdownCache, locale]);

  async function handleInstallCheck(skill: MarketSkill) {
    const localHash = await api.market.getSkillDirectoryHash(skill.name);
    if (localHash && skill.contentHash && localHash !== skill.contentHash) {
      setConfirmInstallSkill(skill);
      return;
    }
    await doInstall(skill);
  }

  async function doInstall(skill: MarketSkill) {
    setInstalling(skill.name);
    setInstallStatus((prev) => {
      const next = { ...prev };
      delete next[skill.name];
      return next;
    });
    try {
      const name = await api.market.installSkill(skill.name);
      // Per design "Installed state is derived, never cached": do NOT
      // optimistically mark up-to-date. Recompute the local directory hash
      // and only flip to up-to-date if it matches the market contentHash.
      const localHash = await api.market.getSkillDirectoryHash(skill.name);
      const hashesMatch =
        !!skill.contentHash && !!localHash && localHash === skill.contentHash;
      if (hashesMatch) {
        setUpToDateNames((prev) => new Set(prev).add(skill.name));
        setInstallStatus((prev) => ({
          ...prev,
          [skill.name]: { ok: true, msg: t(locale, "hub.installSuccess", { name }) },
        }));
        sendNotification({ title: "Felina Hub", body: t(locale, "hub.installSuccess", { name }) });
      } else {
        // Install succeeded but the recomputed hash disagrees with the
        // server's contentHash. Surface this rather than silently lying.
        setUpToDateNames((prev) => {
          const next = new Set(prev);
          next.delete(skill.name);
          return next;
        });
        setInstallStatus((prev) => ({
          ...prev,
          [skill.name]: {
            ok: false,
            msg: t(locale, "hub.installFailed", {
              detail: "hash mismatch after install",
            }),
          },
        }));
      }
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

  async function handleDelete(name: string) {
    try {
      await api.market.deleteSkill(name);
      setSkills((prev) => prev.filter((s) => s.name !== name));
      if (selectedName === name) setSelectedName(null);
      setInstallStatus((prev) => ({
        ...prev,
        [name]: { ok: true, msg: t(locale, "hub.delete.success", { name }) },
      }));
      sendNotification({ title: "Felina Hub", body: t(locale, "hub.delete.success", { name }) });
    } catch (e) {
      setInstallStatus((prev) => ({
        ...prev,
        [name]: {
          ok: false,
          msg: e instanceof Error ? e.message : String(e),
        },
      }));
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
      sendNotification({ title: "Felina Hub", body: t(locale, "hub.publish.success", { name: publishName }) });
      setPublishOpen(false);
      await fetchSkills("reload");
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

  const selectedSkill = useMemo(
    () => skills.find((s) => s.name === selectedName) ?? null,
    [skills, selectedName],
  );

  const listEntries = useMemo(
    () =>
      skills.map((s) => ({
        name: s.name,
        version: s.version,
        author: s.author ?? null,
        upToDate: upToDateNames.has(s.name),
      })),
    [skills, upToDateNames],
  );

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

  const inSplitView = selectedSkill !== null;

  return (
    <>
      <PageHeader
        title={t(locale, "hub.title")}
        subtitle={t(locale, "hub.subtitle")}
        icon={Store}
        actions={
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              onClick={() => void fetchSkills("reload")}
              disabled={reloading || loading}
              title={t(locale, "hub.refresh")}
            >
              {reloading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
            </ActionButton>
            <div className="w-px h-5 bg-border/40" />
            <ActionButton
              variant="primary"
              onClick={() => {
                if (!authEmail) {
                  setLoginOpen(true);
                  return;
                }
                setPublishStatus(null);
                setPublishError(null);
                setPublishOpen(true);
              }}
            >
              <UploadCloud size={15} />
              {t(locale, "hub.publish.button")}
            </ActionButton>
            {authEmail ? (
              <AccountDropdown
                email={authEmail}
                onLogout={() => {
                  void api.market.logout().then(() => setAuthEmail(null));
                }}
                locale={locale}
              />
            ) : (
              <ActionButton
                variant="secondary"
                onClick={() => setLoginOpen(true)}
              >
                <LogIn size={15} />
                {t(locale, "hub.auth.login")}
              </ActionButton>
            )}
          </div>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        {publishStatus && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-success/30 bg-success/10 text-success text-sm flex items-center justify-between">
            <span>{publishStatus}</span>
            <button type="button" onClick={() => setPublishStatus(null)} className="text-success/60 hover:text-success ml-2">
              <X size={14} />
            </button>
          </div>
        )}

        {loading && !error && <LoadingLine label={t(locale, "hub.loading")} />}

        {!loading && !error && skills.length === 0 && (
          <p className="text-sm text-text-muted">{t(locale, "hub.empty")}</p>
        )}

        {!loading && !error && skills.length > 0 && !inSplitView && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity duration-200">
            {skills.map((skill) => {
              const isUpToDate = upToDateNames.has(skill.name);
              return (
                <button
                  key={skill.name}
                  type="button"
                  onClick={() => setSelectedName(skill.name)}
                  className="text-left bg-bg-secondary/40 backdrop-blur-md border border-white/5 shadow-sm rounded-xl p-5 flex flex-col gap-3 transition-colors hover:bg-bg-hover/40"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {skill.name}
                    </h3>
                    {(skill.version || skill.author) && (
                      <p className="text-xs text-text-muted mt-0.5">
                        {[skill.author?.split("@")[0], skill.version ? `v${skill.version}` : null].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  {skill.description && (
                    <p className="text-xs text-text-muted line-clamp-3">
                      {skill.description}
                    </p>
                  )}
                  <div className="mt-auto">
                    {isUpToDate ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                        <CheckCircle size={13} />
                        {t(locale, "hub.upToDate")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                        <Download size={13} />
                        {t(locale, "hub.install")}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!loading && !error && skills.length > 0 && inSplitView && selectedSkill && (
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,18rem)_1fr] gap-4 transition-opacity duration-200">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSelectedName(null)}
                className="inline-flex items-center gap-1.5 self-start text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded-md hover:bg-bg-hover"
              >
                <ArrowLeft size={13} />
                {t(locale, "hub.backToGrid")}
              </button>
              <MarketSkillList
                entries={listEntries}
                selectedName={selectedName}
                onSelect={(name) => setSelectedName(name)}
                locale={locale}
              />
            </div>
            <div className="bg-bg-secondary/40 backdrop-blur-md border border-white/5 shadow-sm rounded-xl overflow-hidden">
              <MarketSkillPreview
                skill={{
                  name: selectedSkill.name,
                  version: selectedSkill.version,
                  description: selectedSkill.description ?? null,
                  contentHash: selectedSkill.contentHash ?? null,
                }}
                upToDate={upToDateNames.has(selectedSkill.name)}
                installing={installing === selectedSkill.name}
                status={installStatus[selectedSkill.name] ?? null}
                onInstall={() => void handleInstallCheck(selectedSkill)}
                isAuthor={!!authEmail && selectedSkill.author === authEmail}
                onDelete={() => void handleDelete(selectedSkill.name)}
                locale={locale}
                markdown={markdownCache[selectedSkill.name] ?? null}
                markdownLoading={markdownLoading}
                markdownError={markdownError}
              />
            </div>
          </div>
        )}
      </PageBody>
      {publishDialog}
      <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={(email) => setAuthEmail(email)}
        locale={locale}
      />
      <ConfirmDialog
        open={confirmInstallSkill !== null}
        title={t(locale, "hub.confirm.title")}
        message={[
          confirmInstallSkill?.author ? `${t(locale, "hub.confirm.author")}: ${confirmInstallSkill.author}` : null,
          confirmInstallSkill?.version ? `${t(locale, "hub.confirm.version")}: v${confirmInstallSkill.version}` : null,
          confirmInstallSkill?.updatedAt ? `${t(locale, "hub.confirm.updatedAt")}: ${confirmInstallSkill.updatedAt}` : null,
          t(locale, "hub.confirm.overwriteWarning"),
        ].filter(Boolean).join("\n")}
        confirmLabel={t(locale, "hub.install")}
        onconfirm={() => {
          if (confirmInstallSkill) {
            void doInstall(confirmInstallSkill);
          }
          setConfirmInstallSkill(null);
        }}
        oncancel={() => setConfirmInstallSkill(null)}
      />
    </>
  );
}
