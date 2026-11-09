// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — provider contracts shared by translators and settings.

import type { ChatTurn } from "./chatProtocol";

export type ProviderId =
  | "google"
  | "openai"
  | "claude"
  | "gemini"
  | "ollama"
  | "pdftranslate";

export interface ProviderContext {
  itemID: number;
  sourceLanguage: string;
  targetLanguage: string;
  timeoutMs: number;
}

export interface ProviderTranslation {
  text: string;
  /** Translate for Zotero resolves its service dynamically; others omit it. */
  actualService?: string;
}

export interface TranslationProvider {
  readonly id: ProviderId;
  translate(text: string, context: ProviderContext): Promise<ProviderTranslation>;
}

export interface ChatProvider {
  readonly id: ProviderId;
  chat(turns: readonly ChatTurn[]): Promise<string>;
}
