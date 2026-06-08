import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, User } from "lucide-react";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";

export default function AccountDropdown({
  email,
  onLogout,
  locale,
}: {
  email: string;
  onLogout: () => void;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + 6, left: rect.right });
    }

    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg-secondary hover:bg-bg-hover text-sm text-text-secondary hover:text-text-primary transition-colors max-w-48"
      >
        <User size={14} className="shrink-0" />
        <span className="truncate">{email.split("@")[0]}</span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[999] min-w-40 rounded-2xl shadow-2xl bg-bg-secondary/40 backdrop-blur-md border border-white/5 p-1"
            style={{ top: pos.top, left: pos.left, transform: "translateX(-100%)" }}
          >
            <div className="px-3 py-2 text-xs text-text-muted truncate border-b border-border/30 mb-1">
              {email}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <LogOut size={14} />
              {t(locale, "hub.auth.logout")}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
