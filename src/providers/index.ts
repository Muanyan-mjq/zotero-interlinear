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
  type TranslationEngine,
} from "../settings";
import { requestClaudeTranslation, testClaudeConnection } from "./claude";
import { requestGeminiTranslation, testGeminiConnection } from "./gemini";
import { requestGoogleTranslation, testGoogleConnection } from "./google";
import { requestOllamaTranslation } from "./ollama";
import { requestOpenAITranslation, testOpenAIConnection } from "./openai";
import { requestPDFTranslate } from "./pdftranslate";
import { buildOllamaSystemPrompt } from "./prompts";
import type { TranslationProvider } from "./types";

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
