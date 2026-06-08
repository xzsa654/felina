import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR =
  'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Auto-focus only text-entry inputs. Radio / checkbox / file inputs are
// excluded because programmatic focus on them shows the browser focus ring
// (reads as visual noise on a freshly-opened dialog) and they are not the
// primary entry point anyway.
const INITIAL_FOCUS_SELECTOR =
  'input[type="text"]:not([disabled]), input[type="search"]:not([disabled]), input[type="email"]:not([disabled]), input[type="url"]:not([disabled]), input[type="password"]:not([disabled]), input[type="number"]:not([disabled]), input:not([type]):not([disabled]), textarea:not([disabled])';

const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "w-96",
  md: "w-[36rem]",
  lg: "w-[48rem]",
};

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export default function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: Props) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const initialFocus = contentRef.current?.querySelector<HTMLElement>(
      INITIAL_FOCUS_SELECTOR,
    );
    if (initialFocus) {
      initialFocus.focus();
    } else {
      contentRef.current?.focus();
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = contentRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );
      if (!list || list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={`relative ${SIZE_CLASS[size]} max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col bg-bg-secondary border border-border rounded-2xl shadow-2xl outline-none [&:focus-visible]:outline-none`}
        style={{ outline: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
            <h3 className="text-base font-semibold text-text-primary">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-secondary hover:text-text-primary"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
