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
import { testGoogleConnection } from "./google";
import { testFreeConnection, translateFree } from "./free";
import { requestOllamaTranslation } from "./ollama";
import { requestOpenAITranslation, testOpenAIConnection } from "./openai";
import { buildOllamaSystemPrompt, languageNameZh } from "./prompts";
import type { ChatProvider, TranslationProvider } from "./types";

export {
  testClaudeConnection,
  testFreeConnection,
  testGeminiConnection,
  testGoogleConnection,
  testOpenAIConnection,
};

export function getTranslationProvider(engine: TranslationEngine): TranslationProvider {
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

  // Free services are routed through one chain: on a throttle the router
  // switches to the next healthy Google client pool (or MyMemory /
  // LibreTranslate) inside the same batch, so a single blocked pool does not
  // fail the paragraph.
  return {
    id: "google",
    translate: async (text, context) => ({
      text: (await translateFree([text], context))[0],
    }),
    // `translate_a/t` answers one result per `q`, so a whole batch of
    // paragraphs costs a single request — critical for a rate-limited API.
    translateBatch: (texts, context) => translateFree(texts, context),
  };
}

/**
 * Chat reuses the same backend configuration as translation. Google Translate
 * has no conversational API, so the sidebar reports it as unsupported instead
 * of guessing an endpoint.
 */
export function getChatProvider(engine: TranslationEngine): ChatProvider | null {
  if (engine === "google") return null;

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
