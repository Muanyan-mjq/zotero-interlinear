// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — provider registry.

import {
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
import { requestGoogleTranslation, testGoogleConnection } from "./google";
import { requestOllamaTranslation } from "./ollama";
import { requestOpenAITranslation, testOpenAIConnection } from "./openai";
import { requestPDFTranslate } from "./pdftranslate";
import { buildOllamaSystemPrompt } from "./prompts";
import type { TranslationProvider } from "./types";

export { testGoogleConnection, testOpenAIConnection };

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

  if (engine === "ollama") {
    return {
      id: "ollama",
      translate: async (text, context) => ({
        text: await requestOllamaTranslation(
          {
            baseURL: getOllamaURL(),
            model: getOllamaModel(),
            systemPrompt: buildOllamaSystemPrompt(
              context.sourceLanguage,
              context.targetLanguage,
            ),
            timeoutMs: context.timeoutMs,
          },
          text,
        ),
      }),
    };
  }

  return {
    id: "pdftranslate",
    translate: (text, context) => requestPDFTranslate(text, context),
  };
}
