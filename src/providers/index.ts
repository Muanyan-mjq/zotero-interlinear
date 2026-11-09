// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — provider registry.

import {
  DEFAULT_CLAUDE_MAX_TOKENS,
  getClaudeApiKey,
  getClaudeEndpoint,
  getClaudeModel,
  getClaudeSystemPrompt,
  getClaudeTemperature,
  getGeminiApiKey,
  getGeminiBaseURL,
  getGeminiModel,
  getGeminiSystemPrompt,
  getGeminiTemperature,
  getGlossaryDirective,
  getGoogleBaseURL,
  getOllamaModel,
  getOllamaURL,
  getOpenAIApiKey,
  getOpenAIEndpoint,
  getOpenAIModel,
  getOpenAISystemPrompt,
  getOpenAITemperature,
  getRequestTimeoutMs,
  getTargetLanguage,
  type TranslationEngine,
} from "../settings";
import { requestClaudeTranslation, testClaudeConnection } from "./claude";
import {
  requestClaudeChat,
  requestGeminiChat,
  requestOllamaChat,
  requestOpenAIChat,
} from "./chat";
import { buildChatSystemPrompt } from "./chatPrompts";
import type { ChatTurn } from "./chatProtocol";
import { requestGeminiTranslation, testGeminiConnection } from "./gemini";
import { requestGoogleTranslation, testGoogleConnection } from "./google";
import { requestOllamaTranslation } from "./ollama";
import { requestOpenAITranslation, testOpenAIConnection } from "./openai";
import { requestPDFTranslate } from "./pdftranslate";
import { buildOllamaSystemPrompt, languageNameZh } from "./prompts";
import type { ChatProvider, TranslationProvider } from "./types";

export {
  testClaudeConnection,
  testGeminiConnection,
  testGoogleConnection,
  testOpenAIConnection,
};

export function getTranslationProvider(engine: TranslationEngine): TranslationProvider {
  if (engine === "google") {
    return {
      id: "google",
      translate: async (text, context) => ({
        text: await requestGoogleTranslation(
          {
            baseURL: getGoogleBaseURL(),
            sourceLanguage: context.sourceLanguage,
            targetLanguage: context.targetLanguage,
            timeoutMs: context.timeoutMs,
          },
          text,
        ),
      }),
    };
  }

  if (engine === "openai") {
    return {
      id: "openai",
      translate: async (text, context) => ({
        text: await requestOpenAITranslation(
          {
            endpoint: getOpenAIEndpoint(),
            apiKey: getOpenAIApiKey(),
            model: getOpenAIModel(),
            systemPrompt: getOpenAISystemPrompt(),
            temperature: getOpenAITemperature(),
            timeoutMs: context.timeoutMs,
          },
          text,
        ),
      }),
    };
  }

  if (engine === "claude") {
    return {
      id: "claude",
      translate: async (text, context) => ({
        text: await requestClaudeTranslation(
          {
            endpoint: getClaudeEndpoint(),
            apiKey: getClaudeApiKey(),
            model: getClaudeModel(),
            systemPrompt: getClaudeSystemPrompt(),
            temperature: getClaudeTemperature(),
            maxTokens: DEFAULT_CLAUDE_MAX_TOKENS,
            timeoutMs: context.timeoutMs,
          },
          text,
        ),
      }),
    };
  }

  if (engine === "gemini") {
    return {
      id: "gemini",
      translate: async (text, context) => ({
        text: await requestGeminiTranslation(
          {
            baseURL: getGeminiBaseURL(),
            apiKey: getGeminiApiKey(),
            model: getGeminiModel(),
            systemPrompt: getGeminiSystemPrompt(),
            temperature: getGeminiTemperature(),
            timeoutMs: context.timeoutMs,
          },
          text,
        ),
      }),
    };
  }

  if (engine === "ollama") {
    return {
      id: "ollama",
      translate: async (text, context) => {
        const prompt = buildOllamaSystemPrompt(
          context.sourceLanguage,
          context.targetLanguage,
        );
        const glossary = getGlossaryDirective();
        return {
          text: await requestOllamaTranslation(
            {
              baseURL: getOllamaURL(),
              model: getOllamaModel(),
              systemPrompt: glossary ? `${prompt}\n\n${glossary}` : prompt,
              timeoutMs: context.timeoutMs,
            },
            text,
          ),
        };
      },
    };
  }

  return {
    id: "pdftranslate",
    translate: (text, context) => requestPDFTranslate(text, context),
  };
}

/**
 * Chat reuses the same backend configuration as translation. Google Translate
 * and Translate for Zotero have no conversational API, so the sidebar reports
 * them as unsupported instead of guessing an endpoint.
 */
export function getChatProvider(engine: TranslationEngine): ChatProvider | null {
  if (engine === "google" || engine === "pdftranslate") return null;

  const systemPrompt = () =>
    buildChatSystemPrompt(languageNameZh(getTargetLanguage()), getGlossaryDirective());

  if (engine === "openai") {
    return {
      id: "openai",
      chat: (turns: readonly ChatTurn[]) =>
        requestOpenAIChat(
          {
            endpoint: getOpenAIEndpoint(),
            apiKey: getOpenAIApiKey(),
            model: getOpenAIModel(),
            systemPrompt: systemPrompt(),
            temperature: getOpenAITemperature(),
            timeoutMs: getRequestTimeoutMs(),
          },
          turns,
        ),
    };
  }

  if (engine === "claude") {
    return {
      id: "claude",
      chat: (turns: readonly ChatTurn[]) =>
        requestClaudeChat(
          {
            endpoint: getClaudeEndpoint(),
            apiKey: getClaudeApiKey(),
            model: getClaudeModel(),
            systemPrompt: systemPrompt(),
            temperature: getClaudeTemperature(),
            maxTokens: DEFAULT_CLAUDE_MAX_TOKENS,
            timeoutMs: getRequestTimeoutMs(),
          },
          turns,
        ),
    };
  }

  if (engine === "gemini") {
    return {
      id: "gemini",
      chat: (turns: readonly ChatTurn[]) =>
        requestGeminiChat(
          {
            baseURL: getGeminiBaseURL(),
            apiKey: getGeminiApiKey(),
            model: getGeminiModel(),
            systemPrompt: systemPrompt(),
            temperature: getGeminiTemperature(),
            timeoutMs: getRequestTimeoutMs(),
          },
          turns,
        ),
    };
  }

  return {
    id: "ollama",
    chat: (turns: readonly ChatTurn[]) =>
      requestOllamaChat(
        {
          baseURL: getOllamaURL(),
          model: getOllamaModel(),
          systemPrompt: systemPrompt(),
          temperature: 0.3,
          timeoutMs: getRequestTimeoutMs(),
        },
        turns,
      ),
  };
}
