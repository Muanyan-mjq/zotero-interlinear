// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — provider contracts shared by translators and settings.

export type ProviderId = "google" | "openai" | "ollama" | "pdftranslate";

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
