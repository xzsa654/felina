import { useCallback, useState } from "react";
import Modal from "$lib/components/shared/Modal";
import ErrorNotice from "$lib/components/shared/ErrorNotice";
import { api } from "$lib/tauri/commands";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";

type Tab = "login" | "register";

export default function LoginDialog({
  open,
  onClose,
  onSuccess,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
  locale: Locale;
}) {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEmail("");
    setPassword("");
    setError(null);
    setLoading(false);
  }

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const result =
        tab === "register"
          ? await api.market.register(email.trim(), password)
          : await api.market.login(email.trim(), password, rememberMe);
      reset();
      onSuccess(result.email);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={tab === "login" ? t(locale, "hub.auth.login") : t(locale, "hub.auth.register")}
      size="sm"
    >
      <div className="px-5 py-4">
        <div className="flex gap-1 mb-4">
          {(["login", "register"] as const).map((t_) => (
            <button
              key={t_}
              type="button"
              onClick={() => {
                setTab(t_);
                setError(null);
              }}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                tab === t_
                  ? "bg-bg-hover text-text-primary font-medium"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t_ === "login" ? t(locale, "hub.auth.login") : t(locale, "hub.auth.register")}
            </button>
          ))}
        </div>

        {error && (
          <ErrorNotice
            title={t(locale, "hub.auth.loginFailed")}
            detail={error}
            onDismiss={() => setError(null)}
            className="mb-3"
          />
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg-secondary text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder={t(locale, "hub.auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg-secondary text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            autoComplete={tab === "register" ? "new-password" : "current-password"}
            required
          />
          {tab === "login" && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-border accent-accent"
              />
              <span className="text-xs text-text-secondary">{t(locale, "hub.auth.rememberMe")}</span>
            </label>
          )}
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="w-full px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "..."
              : tab === "login"
                ? t(locale, "hub.auth.login")
                : t(locale, "hub.auth.register")}
          </button>
        </form>
      </div>
    </Modal>
  );
}
