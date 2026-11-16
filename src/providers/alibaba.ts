// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Alibaba Cloud Machine Translation (alimt) provider.
//
// Cloud "free tier" differs from the keyless services: the user must open the
// product in the Alibaba Cloud console and create an AccessKey. The secret is
// kept in the OS key store; it is only used here to sign an RPC request and is
// never placed in a URL, an error message or a cache key.

import { getString } from "../utils/locale";
import { redactSecrets } from "../utils/redact";
import { GoogleThrottleError } from "./google";
import {
  ALIBABA_ENDPOINT,
  ALIBABA_MAX_CHARS,
  alibabaTimestamp,
  buildAlibabaBody,
  buildAlibabaParams,
  buildAlibabaStringToSign,
  isAlibabaThrottle,
  parseAlibabaTranslation,
  signAlibabaStringToSign,
} from "./alibabaProtocol";
import { NO_REDIRECT_OPTIONS } from "./secureRequest";

export interface AlibabaConfig {
  accessKeyId: string;
  accessKeySecret: string;
  sourceLanguage: string;
  targetLanguage: string;
  timeoutMs: number;
  endpoint?: string;
}

function newNonce(): string {
  const cryptoObj = (globalThis as any).crypto;
  if (typeof cryptoObj?.randomUUID === "function") return cryptoObj.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function shortDetail(value: unknown): string {
  return redactSecrets(String(value || "")).slice(0, 300);
}

/** One TranslateGeneral request; long paragraphs are split by the caller. */
export async function translateAlibaba(
  text: string,
  config: AlibabaConfig,
): Promise<string> {
  const accessKeyId = config.accessKeyId.trim();
  const accessKeySecret = config.accessKeySecret.trim();
  if (!accessKeyId || !accessKeySecret) {
    throw new Error(getString("provider-error-alibaba-credentials"));
  }
  if (text.length > ALIBABA_MAX_CHARS) {
    throw new Error(getString("provider-error-alibaba-length"));
  }

  const params = buildAlibabaParams({
    accessKeyId,
    sourceLanguage: config.sourceLanguage || "auto",
    targetLanguage: config.targetLanguage,
    text,
    nonce: newNonce(),
    timestamp: alibabaTimestamp(),
  });

  let signature: string;
  try {
    signature = await signAlibabaStringToSign(
      accessKeySecret,
      buildAlibabaStringToSign(params),
    );
  } catch (error: any) {
    throw new Error(
      getString("provider-error-alibaba-crypto", {
        args: { detail: shortDetail(error?.message || error) },
      }),
    );
  }

  const endpoint = String(config.endpoint || ALIBABA_ENDPOINT).trim() || ALIBABA_ENDPOINT;
  let xhr: any;
  try {
    xhr = await Zotero.HTTP.request("POST", endpoint, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: buildAlibabaBody(params, signature),
      responseType: "text",
      ...NO_REDIRECT_OPTIONS,
      timeout: config.timeoutMs,
    });
  } catch (error: any) {
    const failed = error?.xmlhttp || error?.xhr;
    if (failed?.status === 429) throw new GoogleThrottleError("", 0);
    throw new Error(
      getString("provider-error-alibaba-network", {
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
      if (xhr?.status && (xhr.status < 200 || xhr.status >= 300)) {
        throw new Error(
          getString("provider-error-alibaba-http", {
            args: {
              code: String(xhr.status),
              detail: shortDetail(xhr.statusText || ""),
            },
          }),
        );
      }
      throw new Error(getString("provider-error-alibaba-parse"));
    }
  }

  const result = parseAlibabaTranslation(payload);
  if (!result.ok) {
    if (isAlibabaThrottle(result.code || String(xhr?.status || ""), result.message)) {
      throw new GoogleThrottleError("", 0);
    }
    throw new Error(
      getString("provider-error-alibaba-http", {
        args: {
          code: result.code || String(xhr?.status || "unknown"),
          detail: shortDetail(result.message || ""),
        },
      }),
    );
  }
  return result.text as string;
}
