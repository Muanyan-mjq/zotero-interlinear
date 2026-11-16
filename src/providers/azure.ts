// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Azure AI Translator provider (F0 free tier).
//
// Azure accepts a whole batch in one request, so the free router sends every
// paragraph of a batch together. The subscription key travels in a header and
// the endpoint must be HTTPS unless it is loopback/LAN.

import { assessEndpoint } from "../utils/endpointSafety";
import { getString } from "../utils/locale";
import { redactSecrets } from "../utils/redact";
import {
  buildAzureBody,
  buildAzureEndpoint,
  extractAzureError,
  parseAzureTranslations,
} from "./azureProtocol";
import { GoogleThrottleError } from "./google";
import { NO_REDIRECT_OPTIONS } from "./secureRequest";

export interface AzureConfig {
  apiKey: string;
  /** Optional for global Translator resources; required for regional ones. */
  region: string;
  endpoint: string;
  sourceLanguage: string;
  targetLanguage: string;
  timeoutMs: number;
}

function shortDetail(value: unknown): string {
  return redactSecrets(String(value || "")).slice(0, 300);
}

function httpError(status: number | undefined, detail: string): Error {
  if (status === 401 || status === 403) {
    return new Error(
      getString("provider-error-azure-auth", {
        args: { status: String(status), detail: shortDetail(detail) },
      }),
    );
  }
  return new Error(
    getString("provider-error-azure-http", {
      args: {
        status: String(status || "unknown"),
        detail: shortDetail(detail),
      },
    }),
  );
}

export async function requestAzureTranslations(
  config: AzureConfig,
  texts: string[],
): Promise<string[]> {
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new Error(getString("provider-error-azure-credentials"));

  const url = buildAzureEndpoint(
    config.endpoint,
    config.sourceLanguage,
    config.targetLanguage,
  );
  const assessment = assessEndpoint(url);
  if (!assessment.valid || assessment.needsConfirmation) {
    throw new Error(getString("provider-error-azure-endpoint"));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Ocp-Apim-Subscription-Key": apiKey,
  };
  const region = String(config.region || "").trim();
  if (region) headers["Ocp-Apim-Subscription-Region"] = region;

  let xhr: any;
  try {
    xhr = await Zotero.HTTP.request("POST", url, {
      headers,
      body: buildAzureBody(texts),
      responseType: "text",
      ...NO_REDIRECT_OPTIONS,
      timeout: config.timeoutMs,
    });
  } catch (error: any) {
    const failed = error?.xmlhttp || error?.xhr;
    if (failed?.status === 429) throw new GoogleThrottleError("", 0);
    throw new Error(
      getString("provider-error-azure-network", {
        args: { detail: shortDetail(error?.message || error) },
      }),
    );
  }

  if (xhr?.status === 429) throw new GoogleThrottleError("", 0);

  let payload: any = xhr?.response;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (_) {
      throw httpError(xhr?.status, xhr?.statusText || "");
    }
  }

  if (!xhr || xhr.status < 200 || xhr.status >= 300) {
    throw httpError(xhr?.status, extractAzureError(payload));
  }

  const translated = parseAzureTranslations(payload, texts.length);
  if (!translated) throw new Error(getString("provider-error-azure-empty"));
  return translated;
}
