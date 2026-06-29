import { useState, type DragEvent, type FormEvent } from "react";
import { ChevronDown, Send, Trash2 } from "lucide-react";
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

function JesseAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  const shell = size === "md" ? "h-9 w-10 rounded-2xl" : "h-7 w-7 rounded-xl";
  return (
    <div className={`relative shrink-0 bg-pink-400 ${shell}`}>
      <span className="absolute -top-1 left-1/2 h-2.5 w-5 -translate-x-1/2 rounded-t-full bg-pink-100" />
      <span className="absolute left-[27%] top-[35%] h-1.5 w-1.5 rounded-full bg-white" />
      <span className="absolute right-[27%] top-[35%] h-1.5 w-1.5 rounded-full bg-white" />
      <span className="absolute left-[31%] top-[39%] h-0.5 w-0.5 rounded-full bg-pink-800" />
      <span className="absolute right-[31%] top-[39%] h-0.5 w-0.5 rounded-full bg-pink-800" />
      <span className="absolute bottom-[22%] left-1/2 h-1.5 w-4 -translate-x-1/2 rounded-full bg-pink-700/75" />
    </div>
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
    ? "請先摘要這個 token context，用白話解釋它代表什麼，並加一個具體例子。"
    : "Summarize this token context first, explain what it means in plain language, and include one concrete example.";
}

export default function JesseTokenAssistant({ locale }: { locale: Locale }) {
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [context, setContext] = useState<JesseContextPayload | null>(null);
  const [messages, setMessages] = useState<JesseChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<JesseAssistantProvider>("claude");
  const [dropError, setDropError] = useState<string | null>(null);
  const chatMutation = useJesseChat(provider, locale);

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

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    const payload = parseJesseContextDragData(
      event.dataTransfer.getData(JESSE_CONTEXT_MIME) ||
        event.dataTransfer.getData("text/plain"),
    );
    if (!payload) {
      setDropError(t(locale, "tokens.jesse.invalidDrop"));
      setExpanded(true);
      return;
    }
    setContext(payload);
    setMessages([]);
    setDropError(null);
    setExpanded(true);
    chatMutation.reset();
    runChat([{ role: "user", content: initialSummaryPrompt(locale) }], payload);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
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

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`fixed bottom-5 right-5 z-30 flex h-20 w-20 items-center justify-center rounded-[28px] border text-white shadow-xl shadow-pink-950/20 transition-transform hover:scale-105 ${
          dragOver
            ? "border-pink-200 bg-pink-300 ring-4 ring-pink-300/25"
            : "border-pink-300/60 bg-pink-400"
        }`}
        aria-label={t(locale, "tokens.jesse.open")}
        title={t(locale, "tokens.jesse.open")}
      >
        <span className="absolute -top-2 left-5 h-5 w-10 rounded-t-full border border-pink-200/70 bg-pink-100/95" />
        <span className="absolute left-2 top-8 h-7 w-4 rounded-full bg-pink-300" />
        <span className="absolute right-2 top-8 h-7 w-4 rounded-full bg-pink-300" />
        <span className="absolute bottom-2 h-9 w-12 rounded-[18px] bg-pink-300/80" />
        <span className="absolute left-5 top-6 h-2.5 w-2.5 rounded-full bg-white" />
        <span className="absolute right-5 top-6 h-2.5 w-2.5 rounded-full bg-white" />
        <span className="absolute left-[23px] top-[27px] h-1 w-1 rounded-full bg-pink-800" />
        <span className="absolute right-[23px] top-[27px] h-1 w-1 rounded-full bg-pink-800" />
        <span className="absolute bottom-7 h-2.5 w-8 rounded-full bg-pink-800/70" />
        <span className="absolute bottom-4 h-1.5 w-6 rounded-full bg-pink-500/60" />
        <span className="sr-only">Jesse</span>
      </button>
    );
  }

  const error = chatMutation.error
    ? formatJesseError(chatMutation.error, provider, locale)
    : dropError;

  return (
    <div className="fixed bottom-5 right-5 z-30 flex max-h-[min(720px,calc(100vh-2.5rem))] w-[min(520px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-bg-primary shadow-2xl shadow-black/25">
      <div className="flex items-center justify-between border-b border-border bg-bg-secondary px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <JesseAvatar size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {t(locale, "tokens.jesse.name")}
            </p>
            <p className="truncate text-[10px] text-text-muted">
              {t(locale, "tokens.jesse.nickname")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
          aria-label={t(locale, "common.close")}
          title={t(locale, "common.close")}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-md border border-dashed p-3 transition-colors ${
            dragOver
              ? "border-pink-400 bg-pink-400/10"
              : "border-border bg-bg-secondary/60"
          }`}
        >
          {context ? (
            <div className="space-y-1">
              <p className="truncate text-xs font-medium text-text-primary" title={context.title}>
                {context.title}
              </p>
              <p className="truncate text-[10px] text-text-muted" title={context.source}>
                {context.source}
              </p>
              <p className="line-clamp-2 text-xs text-text-secondary">{context.summary}</p>
            </div>
          ) : (
            <p className="text-xs text-text-muted">{t(locale, "tokens.jesse.dropHint")}</p>
          )}
        </div>

        <div className="min-h-40 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-1 py-1">
          {messages.length === 0 && !chatMutation.isPending && !error && (
            <div className="py-6 text-center text-xs text-text-muted">
              {t(locale, "tokens.jesse.chatEmpty")}
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              {message.role === "assistant" && (
                <div className="mr-2 pt-0.5">
                  <JesseAvatar />
                </div>
              )}
              <div
                className={
                  message.role === "user"
                    ? "min-w-0 max-w-[82%] overflow-hidden break-words rounded-2xl bg-bg-secondary px-3 py-2 text-sm text-text-primary"
                    : "min-w-0 max-w-[88%] overflow-hidden text-sm leading-relaxed text-text-primary"
                }
              >
                {message.role === "assistant" ? (
                  <MarkdownPreview markdown={message.content} className="jesse-markdown md-compact" escapeHtml />
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <JesseAvatar />
              <span className="text-shimmer font-medium">{t(locale, "tokens.jesse.thinking")}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-bg-secondary p-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!context}
            placeholder={t(locale, "tokens.jesse.chatPlaceholder")}
            rows={2}
            className="max-h-32 min-h-16 w-full resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as JesseAssistantProvider)}
              className="h-8 rounded-lg border border-border bg-bg-primary px-2 text-xs text-text-secondary focus:border-accent focus:outline-none"
          >
            {PROVIDERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
            <div className="flex items-center gap-2">
              {context && (
                <button
                  type="button"
                  onClick={() => {
                    setContext(null);
                    setMessages([]);
                    setInput("");
                    setDropError(null);
                    chatMutation.reset();
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
                >
                  <Trash2 size={13} />
                  {t(locale, "tokens.jesse.clear")}
                </button>
              )}
              <button
                type="submit"
                disabled={!context || !input.trim() || chatMutation.isPending}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={t(locale, "tokens.jesse.send")}
                title={t(locale, "tokens.jesse.send")}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
          <div className="mt-2 text-center text-[10px] text-text-muted">
            {t(locale, "tokens.jesse.disclaimer")}
          </div>
        </form>
      </div>
    </div>
  );
}
