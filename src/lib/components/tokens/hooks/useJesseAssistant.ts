import { useMutation } from "@tanstack/react-query";
import { api } from "$lib/tauri/commands";
import type { Locale } from "$lib/i18n";
import type {
  JesseAssistantAction,
  JesseAssistantProvider,
  JesseChatMessage,
  JesseContextPayload,
} from "$lib/types";

export function useJesseAssistant(provider: JesseAssistantProvider, locale: Locale) {
  return useMutation({
    mutationFn: ({
      action,
      context,
    }: {
      action: JesseAssistantAction;
      context: JesseContextPayload;
    }) => api.assistant.generate(provider, action, context, locale),
  });
}

export function useJesseChat(provider: JesseAssistantProvider, locale: Locale) {
  return useMutation({
    mutationFn: ({
      context,
      messages,
    }: {
      context: JesseContextPayload;
      messages: JesseChatMessage[];
    }) => api.assistant.chat(provider, context, messages, locale),
  });
}
