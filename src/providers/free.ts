// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — free translation service router.
//
// The free Google endpoint has several independent per-`client` quota pools.
// Once one pool throttles an IP it stays throttled for a while, so retrying the
// same URL is useless. This router keeps a chain of free services, remembers
// which ones are cooling down, and switches to the next healthy one *within
// the same batch* instead of failing the paragraph. Only when every service is
// unavailable does it surface a cooldown to the translation runner.

import {
  getFreeAutoFallback,
  getFreeBackend,
  getGoogleBaseURL,
  getGoogleClient,
  getLibreTranslateApiKey,
  getLibreTranslateURL,
  getMyMemoryEmail,
  getMyMemoryURL,
} from "../settings";
import { getString } from "../utils/locale";
import { redactSecrets } from "../utils/redact";
import { GOOGLE_CLIENTS, normalizeGoogleClient } from "./googleProtocol";
import { GoogleThrottleError, requestGoogleTranslations } from "./google";
import { NO_REDIRECT_OPTIONS } from "./secureRequest";
import type { ProviderContext } from "./types";

export interface FreeBackend {
  readonly id: string;
  readonly label: string;
  translate(texts: string[], context: ProviderContext): Promise<string[]>;
}

/** Everything the router needs, injectable so the settings pane can test unsaved values. */
export interface FreeConfig {
  backend: string;
  autoFallback: boolean;
  googleClient: string;
  googleBaseURL: string;
  myMemoryEmail: string;
  myMemoryUrl: string;
  libreURL: string;
  libreKey: string;
}

/** A throttled pool is not worth retrying for several minutes. */
const POOL_COOLDOWN_MS = 5 * 60 * 1000;
/** A connection/parse failure may be transient. */
const TRANSIENT_COOLDOWN_MS = 30_000;
const MIN_ALL_COOLDOWN_MS = 15_000;

const disabledUntil = new Map<string, number>();
let activeBackendId = "";

export function readFreeConfig(): FreeConfig {
  return {
    backend: getFreeBackend(),
    autoFallback: getFreeAutoFallback(),
    googleClient: getGoogleClient(),
    googleBaseURL: getGoogleBaseURL(),
    myMemoryEmail: getMyMemoryEmail(),
    myMemoryUrl: getMyMemoryURL(),
    libreURL: getLibreTranslateURL(),
    libreKey: getLibreTranslateApiKey(),
  };
}

export function getFreeActiveBackend(): string {
  return activeBackendId;
}

export function resetFreeBackends(): void {
  disabledUntil.clear();
  activeBackendId = "";
}

export function getFreeBackendStates(
  config: FreeConfig = readFreeConfig(),
): Array<{ id: string; available: boolean; seconds: number }> {
  const now = Date.now();
  return buildAllBackends(config).map((backend) => {
    const until = disabledUntil.get(backend.id) || 0;
    return {
      id: backend.id,
      available: until <= now,
      seconds: Math.max(0, Math.ceil((until - now) / 1000)),
    };
  });
}

/** MyMemory and LibreTranslate need explicit/ISO-639-1 language codes. */
function detectSource(texts: string[], declared: string): string {
  if (declared && declared !== "auto") return declared;
  const sample = texts.join(" ").slice(0, 600);
  if (/[\u3040-\u30ff]/u.test(sample)) return "ja";
  if (/[\uac00-\ud7af]/u.test(sample)) return "ko";
  if (/[\u4e00-\u9fff]/u.test(sample)) return "zh-CN";
  return "en";
}

function libreLang(code: string): string {
  if (code === "auto") return "auto";
  return code.split("-")[0];
}

function normalizeLibreURL(raw: string): string {
  let url = String(raw || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//iu.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  return /\/translate$/iu.test(url) ? url : `${url}/translate`;
}

/** MyMemory caps a single `q` value; keep long paragraphs aligned. */
function splitForMyMemory(text: string, limit = 450): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = window.lastIndexOf("\n");
    if (cut < limit / 2) cut = window.lastIndexOf(". ");
    if (cut < limit / 2) cut = window.lastIndexOf(" ");
    if (cut < limit / 2) cut = limit;
    else cut += 1;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function googleBackend(client: string, config: FreeConfig): FreeBackend {
  return {
    id: `google:${client}`,
    label: `Google (${client})`,
    translate: (texts, context) =>
      requestGoogleTranslations(
        {
          baseURL: config.googleBaseURL,
          client,
          sourceLanguage: context.sourceLanguage,
          targetLanguage: context.targetLanguage,
          timeoutMs: context.timeoutMs,
        },
        texts,
      ),
  };
}

function myMemoryBackend(config: FreeConfig): FreeBackend {
  return {
    id: "mymemory",
    label: "MyMemory",
    translate: async (texts, context) => {
      const source = detectSource(texts, context.sourceLanguage);
      const results: string[] = [];

      for (const [index, text] of texts.entries()) {
        const pieces: string[] = [];
        for (const chunk of splitForMyMemory(text)) {
          const params = new URLSearchParams();
          params.set("q", chunk);
          params.set("langpair", `${source}|${context.targetLanguage}`);
          if (config.myMemoryEmail) params.set("de", config.myMemoryEmail);
          const base = config.myMemoryUrl || "https://api.mymemory.translated.net/get";
          const separator = base.includes("?") ? "&" : "?";
          const url = `${base}${separator}${params.toString()}`;

          let xhr: any;
          try {
            xhr = await Zotero.HTTP.request("GET", url, {
              responseType: "text",
              ...NO_REDIRECT_OPTIONS,
              timeout: context.timeoutMs,
            });
          } catch (error: any) {
            const failed = error?.xmlhttp || error?.xhr;
            if (failed?.status === 429) throw new GoogleThrottleError("", 0);
            throw new Error(
              getString("provider-error-google-network", {
                args: { detail: redactSecrets(String(error?.message || "")) },
              }),
            );
          }

          let payload: any = xhr?.response;
          if (typeof payload === "string") {
            try {
              payload = JSON.parse(payload);
            } catch (_) {
              throw new Error(getString("provider-error-google-parse"));
            }
          }
          if (payload?.quotaFinished || Number(payload?.responseStatus) === 429) {
            throw new GoogleThrottleError("", 0);
          }
          const translated = payload?.responseData?.translatedText;
          if (typeof translated !== "string" || !translated.trim()) {
            throw new Error(
              getString("provider-error-google-http", {
                args: {
                  status: String(payload?.responseStatus || "unknown"),
                  detail: redactSecrets(String(payload?.responseDetails || "")),
                },
              }),
            );
          }
          pieces.push(translated);
          await Zotero.Promise.delay(200);
        }
        results.push(pieces.join(""));
        if (index < texts.length - 1) await Zotero.Promise.delay(200);
      }
      return results;
    },
  };
}

function libreTranslateBackend(config: FreeConfig): FreeBackend {
  return {
    id: "libretranslate",
    label: "LibreTranslate",
    translate: async (texts, context) => {
      const url = normalizeLibreURL(config.libreURL);
      if (!url) throw new Error(getString("free-libre-url-missing"));

      const body = JSON.stringify({
        q: texts.length === 1 ? texts[0] : texts,
        source: context.sourceLanguage === "auto" ? "auto" : libreLang(context.sourceLanguage),
        target: libreLang(context.targetLanguage),
        api_key: config.libreKey,
      });

      let xhr: any;
      try {
        xhr = await Zotero.HTTP.request("POST", url, {
          headers: { "Content-Type": "application/json" },
          body,
          responseType: "text",
          ...NO_REDIRECT_OPTIONS,
          timeout: context.timeoutMs,
        });
      } catch (error: any) {
        const failed = error?.xmlhttp || error?.xhr;
        if (failed?.status === 429) throw new GoogleThrottleError("", 0);
        throw new Error(
          getString("provider-error-google-network", {
            args: { detail: redactSecrets(String(error?.message || "")) },
          }),
        );
      }

      let payload: any = xhr?.response;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch (_) {
          throw new Error(getString("provider-error-google-parse"));
        }
      }
      const raw = payload?.translatedText;
      const translated = Array.isArray(raw) ? raw : texts.length === 1 ? [raw] : null;
      if (
        !translated ||
        translated.length !== texts.length ||
        translated.some((entry: unknown) => typeof entry !== "string" || !String(entry).trim())
      ) {
        throw new Error(
          getString("provider-error-google-http", {
            args: {
              status: String(xhr?.status || "unknown"),
              detail: redactSecrets(String(payload?.error || "")),
            },
          }),
        );
      }
      return translated.map((entry: string) => entry.trim());
    },
  };
}

function buildAllBackends(config: FreeConfig): FreeBackend[] {
  const preferred = normalizeGoogleClient(config.googleClient);
  const clients = [preferred, ...GOOGLE_CLIENTS.filter((client) => client !== preferred)];
  const google = clients.map((client) => googleBackend(client, config));
  const rest: FreeBackend[] = [myMemoryBackend(config)];
  if (config.libreURL.trim()) rest.push(libreTranslateBackend(config));
  return [...google, ...rest];
}

/** Ordered chain for the next batch, honoring the user's selection. */
export function buildFreeChain(config: FreeConfig = readFreeConfig()): FreeBackend[] {
  const all = buildAllBackends(config);
  let chain: FreeBackend[];

  if (config.backend === "auto") {
    chain = all;
  } else {
    const pinned = all.find((backend) => backend.id === config.backend);
    if (!pinned) chain = all;
    else if (config.autoFallback) {
      chain = [pinned, ...all.filter((backend) => backend.id !== config.backend)];
    } else {
      chain = [pinned];
    }
  }

  // In auto mode, keep using the pool that just worked. Retrying a throttled
  // pool on every batch would waste a second of pacing each time.
  if (config.backend === "auto" && activeBackendId) {
    const index = chain.findIndex((backend) => backend.id === activeBackendId);
    if (index > 0) {
      chain = [chain[index], ...chain.slice(0, index), ...chain.slice(index + 1)];
    }
  }
  return chain;
}

function cooldownFor(error: unknown): number {
  if (error instanceof GoogleThrottleError) return POOL_COOLDOWN_MS;
  const message = String((error as any)?.message || error || "");
  if (/\b429\b|quota|rate.?limit|too many requests/iu.test(message)) return POOL_COOLDOWN_MS;
  return TRANSIENT_COOLDOWN_MS;
}

export async function translateFree(
  texts: string[],
  context: ProviderContext,
  config: FreeConfig = readFreeConfig(),
): Promise<string[]> {
  const chain = buildFreeChain(config);
  const now = Date.now();
  const available = chain.filter((backend) => (disabledUntil.get(backend.id) || 0) <= now);

  if (!available.length) {
    const soonest = Math.min(...chain.map((backend) => disabledUntil.get(backend.id) || 0));
    throw new GoogleThrottleError(
      getString("free-all-unavailable"),
      Math.max(MIN_ALL_COOLDOWN_MS, soonest - now),
    );
  }

  for (const backend of available) {
    try {
      const translated = await backend.translate(texts, context);
      if (translated.length !== texts.length) {
        throw new Error(getString("provider-error-google-empty"));
      }
      disabledUntil.delete(backend.id);
      activeBackendId = backend.id;
      return translated;
    } catch (error: any) {
      disabledUntil.set(backend.id, Date.now() + cooldownFor(error));
      if (activeBackendId === backend.id) activeBackendId = "";
    }
  }

  const soonest = Math.min(...available.map((backend) => disabledUntil.get(backend.id) || 0));
  throw new GoogleThrottleError(
    getString("free-all-unavailable"),
    Math.max(MIN_ALL_COOLDOWN_MS, soonest - Date.now()),
  );
}

/** Used by the settings pane's "Test connection" button. */
export async function testFreeConnection(
  targetLanguage: string,
  config: FreeConfig = readFreeConfig(),
): Promise<string> {
  resetFreeBackends();
  const context: ProviderContext = {
    itemID: -1,
    sourceLanguage: "en",
    targetLanguage,
    timeoutMs: 15000,
  };
  const result = await translateFree(["Hello"], context, config);
  const backend = getFreeActiveBackend() || getString("free-backend-auto");
  return `${backend}: ${result[0]}`;
}
