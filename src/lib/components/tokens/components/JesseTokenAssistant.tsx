import {
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Send, Trash2, X } from "lucide-react";
import MarkdownPreview from "$lib/components/shared/MarkdownPreview";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import type {
  JesseChatMessage,
  JesseAssistantProvider,
  JesseContextPayload,
} from "$lib/types";
import { JESSE_CONTEXT_MIME, parseJesseContextDragData } from "../jesse-context";
import { useJesseChat } from "../hooks/useJesseAssistant";

const PROVIDERS: JesseAssistantProvider[] = ["claude", "codex"];

type JesseExpression = "idle" | "happy" | "chew";

/**
 * Progressively reveals `text` character-by-character (galgame typewriter).
 * When `enabled` is false the full text shows immediately. Longer messages
 * reveal in bigger steps so wall-clock stays roughly bounded.
 */
function useTypewriter(text: string, enabled: boolean) {
  const [len, setLen] = useState(text.length);
  useEffect(() => {
    if (!enabled || !text) {
      setLen(text.length);
      return;
    }
    setLen(0);
    const step = Math.max(1, Math.ceil(text.length / 90));
    const id = window.setInterval(() => {
      setLen((current) => {
        const next = current + step;
        if (next >= text.length) window.clearInterval(id);
        return Math.min(next, text.length);
      });
    }, 22);
    return () => window.clearInterval(id);
  }, [text, enabled]);
  return { revealed: text.slice(0, len), isRevealing: len < text.length };
}

/** The always-present Jesse mascot. `expression` drives the face. */
function JesseCharacter({
  expression,
  onClick,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  label,
}: {
  expression: JesseExpression;
  onClick: () => void;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  label: string;
}) {
  const openMouth = expression !== "idle";
  const chew = expression === "chew";
  return (
    <button
      type="button"
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`jesse-bob pointer-events-auto relative flex h-20 w-20 items-center justify-center rounded-[28px] border text-white shadow-xl shadow-pink-950/20 transition-[filter] hover:brightness-110 ${
        openMouth ? "border-pink-200 bg-pink-300" : "border-pink-300/60 bg-pink-400"
      }`}
      aria-label={label}
      title={label}
    >
      <span className="absolute -top-2 left-5 h-5 w-10 rounded-t-full border border-pink-200/70 bg-pink-100/95" />
      <span className="absolute left-2 top-8 h-7 w-4 rounded-full bg-pink-300" />
      <span className="absolute right-2 top-8 h-7 w-4 rounded-full bg-pink-300" />
      <span className="absolute bottom-2 h-9 w-12 rounded-[18px] bg-pink-300/80" />
      {/* cheeks — puff out to the sides of the mouth when eating/happy */}
      <span
        className={`absolute bottom-3.5 left-2 h-4 w-4 rounded-full bg-pink-200/90 transition-all duration-200 ${openMouth ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
      />
      <span
        className={`absolute bottom-3.5 right-2 h-4 w-4 rounded-full bg-pink-200/90 transition-all duration-200 ${openMouth ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
      />
      {/* eyes — round + blink normally, curved happy arcs (⌒) when eating/talking */}
      <span
        className={`absolute left-5 top-6 transition-all ${openMouth ? "h-2 w-3 rounded-t-full border-t-[3px] border-pink-900/80 bg-transparent" : "jesse-eye h-2.5 w-2.5 rounded-full bg-white"}`}
      />
      <span
        className={`absolute right-5 top-6 transition-all ${openMouth ? "h-2 w-3 rounded-t-full border-t-[3px] border-pink-900/80 bg-transparent" : "jesse-eye h-2.5 w-2.5 rounded-full bg-white"}`}
      />
      <span
        className={`absolute left-[23px] top-[27px] h-1 w-1 rounded-full bg-pink-800 transition-opacity ${openMouth ? "opacity-0" : "opacity-100"}`}
      />
      <span
        className={`absolute right-[23px] top-[27px] h-1 w-1 rounded-full bg-pink-800 transition-opacity ${openMouth ? "opacity-0" : "opacity-100"}`}
      />
      {/* mouth — smile line normally; small mouth that nibbles (chews) when eating */}
      <span
        className={`absolute left-1/2 -translate-x-1/2 bg-pink-950/80 transition-all ${
          openMouth ? "bottom-4 h-2 w-3.5 rounded-[45%]" : "bottom-7 h-2.5 w-8 rounded-full"
        } ${chew ? "jesse-chew" : ""}`}
      />
      <span
        className={`absolute left-1/2 -translate-x-1/2 transition-all ${
          openMouth ? "h-0 w-0 opacity-0" : "bottom-4 h-1.5 w-6 rounded-full bg-pink-500/60"
        }`}
      />
      <span className="sr-only">Jesse</span>
    </button>
  );
}

function formatJesseError(
  raw: unknown,
  provider: JesseAssistantProvider,
  locale: Locale,
): string | null {
  if (!raw) return null;
  const message = String(raw);
  const isAuthRequired =
    message.includes("JESSE_AGENT_AUTH_REQUIRED") ||
    message.includes("not logged in") ||
    message.includes("HTTP 401") ||
    message.includes("HTTP 403");
  if (!isAuthRequired) return message;

  const providerName = provider === "codex" ? "Codex" : "Claude";
  const command = provider === "codex" ? "codex" : "claude";
  return t(locale, "tokens.jesse.authRequired", {
    provider: providerName,
    command,
  });
}

function initialSummaryPrompt(locale: Locale): string {
  return locale === "zh-TW"
    ? "請先摘要這個項目，用白話解釋它代表什麼，並加一個具體例子。"
    : "Summarize this item first, explain what it means in plain language, and include one concrete example.";
}

/**
 * Fixed follow-up chips locked to elaborating Jesse's own reply, so they are
 * always answerable (no dead-ends that ask for data the context lacks).
 */
function followupPrompts(locale: Locale): string[] {
  return locale === "zh-TW"
    ? ["用更白話的方式再講一次", "舉一個具體例子"]
    : ["Explain that in simpler terms", "Give me a concrete example"];
}

export default function JesseTokenAssistant({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [context, setContext] = useState<JesseContextPayload | null>(null);
  const [messages, setMessages] = useState<JesseChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<JesseAssistantProvider>("claude");
  const [dropError, setDropError] = useState<string | null>(null);
  const [foodInFlight, setFoodInFlight] = useState(false);
  const chatMutation = useJesseChat(provider, locale);

  useEffect(() => {
    function onDragStart(event: globalThis.DragEvent) {
      if (event.dataTransfer?.types.includes(JESSE_CONTEXT_MIME)) {
        setFoodInFlight(true);
      }
    }
    function onDragEnd() {
      setFoodInFlight(false);
    }
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDragEnd);
    return () => {
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDragEnd);
    };
  }, []);

  const latestAssistant =
    [...messages].reverse().find((message) => message.role === "assistant")?.content ?? "";
  const { revealed, isRevealing } = useTypewriter(latestAssistant, open);

  const happy = dragOver || foodInFlight;
  const chewing = chatMutation.isPending || isRevealing;
  const expression: JesseExpression = chewing ? "chew" : happy ? "happy" : "idle";

  function runChat(nextMessages: JesseChatMessage[], nextContext = context) {
    if (!nextContext) return;
    chatMutation.mutate(
      { context: nextContext, messages: nextMessages },
      {
        onSuccess: (response) => {
          setMessages((current) => [
            ...current,
            { role: "assistant", content: response.markdown },
          ]);
        },
      },
    );
  }

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !context || chatMutation.isPending) return;
    const nextMessages: JesseChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setDropError(null);
    runChat(nextMessages);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    const payload = parseJesseContextDragData(
      event.dataTransfer.getData(JESSE_CONTEXT_MIME) ||
        event.dataTransfer.getData("text/plain"),
    );
    setOpen(true);
    if (!payload) {
      setDropError(t(locale, "tokens.jesse.invalidDrop"));
      return;
    }
    setContext(payload);
    setMessages([]);
    setDropError(null);
    chatMutation.reset();
    runChat([{ role: "user", content: initialSummaryPrompt(locale) }], payload);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  function clearContext() {
    setContext(null);
    setMessages([]);
    setInput("");
    setDropError(null);
    chatMutation.reset();
  }

  const error = chatMutation.error
    ? formatJesseError(chatMutation.error, provider, locale)
    : dropError;

  let bubbleBody: ReactNode;
  if (error) {
    bubbleBody = <p className="text-xs leading-relaxed text-red-400">{error}</p>;
  } else if (chatMutation.isPending) {
    bubbleBody = (
      <p className="text-shimmer text-sm font-medium">{t(locale, "tokens.jesse.thinking")}</p>
    );
  } else if (latestAssistant) {
    bubbleBody = (
      <MarkdownPreview markdown={revealed} className="jesse-markdown md-compact" escapeHtml />
    );
  } else if (!context) {
    bubbleBody = <p className="text-xs text-text-muted">{t(locale, "tokens.jesse.dropHint")}</p>;
  } else {
    bubbleBody = <p className="text-xs text-text-muted">{t(locale, "tokens.jesse.chatEmpty")}</p>;
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
      {open && (
        <div className="pointer-events-auto relative w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border border-border bg-bg-primary p-3 shadow-2xl shadow-black/25">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-text-primary">
              {t(locale, "tokens.jesse.name")}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
              aria-label={t(locale, "common.close")}
              title={t(locale, "common.close")}
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-[min(360px,50vh)] overflow-y-auto overflow-x-hidden pr-1 text-sm leading-relaxed text-text-primary">
            {bubbleBody}
          </div>
          {latestAssistant && !chatMutation.isPending && !isRevealing && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-border/60 pt-2">
              {followupPrompts(locale).map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendMessage(question)}
                  className="rounded-lg border border-border bg-bg-secondary px-2.5 py-1.5 text-left text-xs text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
                >
                  {question}
                </button>
              ))}
            </div>
          )}
          {/* tail pointing down toward Jesse */}
          <span className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 border-b border-r border-border bg-bg-primary" />
        </div>
      )}

      <JesseCharacter
        expression={expression}
        onClick={() => setOpen((value) => !value)}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        label={t(locale, "tokens.jesse.open")}
      />

      {open && (
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border border-border bg-bg-secondary p-2 shadow-lg"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!context}
            placeholder={t(locale, "tokens.jesse.chatPlaceholder")}
            rows={1}
            className="max-h-24 min-h-8 w-full resize-none bg-transparent px-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as JesseAssistantProvider)}
              className="h-7 rounded-lg border border-border bg-bg-primary px-2 text-xs text-text-secondary focus:border-accent focus:outline-none"
            >
              {PROVIDERS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              {context && (
                <button
                  type="button"
                  onClick={clearContext}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
                >
                  <Trash2 size={13} />
                  {t(locale, "tokens.jesse.clear")}
                </button>
              )}
              <button
                type="submit"
                disabled={!context || !input.trim() || chatMutation.isPending}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={t(locale, "tokens.jesse.send")}
                title={t(locale, "tokens.jesse.send")}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
