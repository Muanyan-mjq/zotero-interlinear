// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — API key storage.
//
// Keys are encrypted with `Zotero.OSKeyStore`, which wraps Mozilla's
// `resource://gre/modules/OSKeyStore.sys.mjs` and derives its key from platform
// key storage (Keychain on macOS, DPAPI on Windows, libsecret on Linux). The
// ciphertext keeps the `oskv1:` prefix Zotero itself uses for the sync API key,
// so a plaintext value can always be recognised and migrated.
//
// Only the API subset that exists in Zotero 10 *and* 11 is used:
// `available`, `isEncrypted`, `encrypt`, `decrypt`. Zotero 10 additionally has
// `confirmUnencryptedFallback`, `_usable` and `_error`, and Zotero 11 removed
// them — calling those would break one version or the other.
//
// Reading stays synchronous (providers build their config synchronously), so
// decrypted values are cached in memory by `initSecrets()` and every write
// updates that cache immediately before the ciphertext is persisted.

import { logError } from "./utils/log";

export const SECRET_PREFS = {
  openai: "extensions.zotero.interlinear.openai.apiKey",
  claude: "extensions.zotero.interlinear.claude.apiKey",
  gemini: "extensions.zotero.interlinear.gemini.apiKey",
} as const;

export type SecretPrefKey = (typeof SECRET_PREFS)[keyof typeof SECRET_PREFS];

/** What is actually on disk for a key right now. */
export type SecretStatus = "missing" | "encrypted" | "plaintext" | "session" | "needs-reentry";

const ENCRYPTED_PREFIX = "oskv1:";

const cache = new Map<string, string>();
const sessionOnly = new Set<string>();
const needsReentry = new Set<string>();
const pendingWrites = new Set<Promise<unknown>>();

let readyPromise: Promise<void> | null = null;
let keystoreAvailable = false;
let migrationFailedOnce = false;
let lastWriteError: Error | null = null;

type WarningHandler = (message: string) => void;
let warningHandler: WarningHandler | null = null;

/** Where to report storage problems (settings pane). Never a system dialog. */
export function setSecretWarningHandler(handler: WarningHandler | null): void {
  warningHandler = handler;
}

function warn(message: string): void {
  try {
    warningHandler?.(message);
  } catch (error) {
    logError(error);
  }
}

function getOsKeyStore(): any | null {
  try {
    const store = (Zotero as any).OSKeyStore;
    if (!store) return null;
    if (typeof store.encrypt !== "function" || typeof store.decrypt !== "function") return null;
    return store;
  } catch (error) {
    return null;
  }
}

function readPref(key: string): string {
  try {
    const value = (Zotero.Prefs as any).get(key, true);
    return typeof value === "string" ? value : "";
  } catch (error) {
    return "";
  }
}

function writePref(key: string, value: string): void {
  try {
    (Zotero.Prefs as any).set(key, value, true);
  } catch (error) {
    logError(error);
  }
}

function clearPref(key: string): void {
  try {
    (Zotero.Prefs as any).clear(key, true);
  } catch (error) {
    // Not fatal: an empty string is as good as a missing pref for our reads.
    writePref(key, "");
  }
}

export function isEncryptedValue(value: string): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

/** True when the OS key store can actually be used on this machine. */
export function isKeystoreAvailable(): boolean {
  return keystoreAvailable && !!getOsKeyStore();
}

/**
 * Decrypt every stored key into memory. Idempotent; call once from startup and
 * await `whenSecretsReady()` before the first translation/chat/test request.
 */
export function initSecrets(options: { force?: boolean } = {}): Promise<void> {
  if (options.force) {
    readyPromise = null;
    needsReentry.clear();
    sessionOnly.clear();
    cache.clear();
  }
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    const store = getOsKeyStore();
    keystoreAvailable = !!store;

    for (const key of Object.values(SECRET_PREFS)) {
      const raw = readPref(key);
      if (!raw) continue;

      if (!isEncryptedValue(raw)) {
        // Legacy plaintext or a value the user chose to store unencrypted.
        cache.set(key, raw);
        continue;
      }

      if (!store) {
        // Encrypted value but no usable key store (e.g. Linux without
        // libsecret, or a profile copied from another machine).
        needsReentry.add(key);
        continue;
      }

      try {
        const plain = await store.decrypt(raw);
        cache.set(key, typeof plain === "string" ? plain : String(plain ?? ""));
      } catch (error) {
        // Do not clear the pref: the ciphertext is still there and may become
        // readable again (unlocked keychain, right OS user).
        needsReentry.add(key);
        logError(error);
      }
    }

    if (keystoreAvailable) {
      // Fire and forget: a failed migration must not block plugin startup.
      void migratePlaintextSecrets();
    }
  })();

  return readyPromise;
}

/** Resolves once stored keys have been decrypted (or immediately if not initialised). */
export function whenSecretsReady(): Promise<void> {
  return readyPromise ?? Promise.resolve();
}

/** Resolves when every queued write has finished. Used by tests. */
export async function whenSecretWritesSettled(): Promise<void> {
  while (pendingWrites.size) {
    await Promise.allSettled(Array.from(pendingWrites));
  }
}

/** Synchronous read used by provider config builders. */
export function getSecret(key: string): string {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  if (needsReentry.has(key)) return "";

  const raw = readPref(key);
  if (!raw) return "";
  // Ciphertext we could not decrypt must never be handed to a provider.
  if (isEncryptedValue(raw)) return "";
  return raw;
}

export function getSecretStatus(key: string): SecretStatus {
  if (needsReentry.has(key)) return "needs-reentry";
  const raw = readPref(key);
  if (!raw) return sessionOnly.has(key) ? "session" : "missing";
  if (isEncryptedValue(raw)) return "encrypted";
  return "plaintext";
}

export interface SecretWriteOptions {
  /** Keep the value in memory only; never touch the pref. */
  sessionOnly?: boolean;
  /** Explicitly allow writing the value unencrypted (user confirmed). */
  allowPlaintext?: boolean;
}

export interface SecretWriteResult {
  stored: "encrypted" | "plaintext" | "session" | "cleared";
  error?: Error;
}

/**
 * Store a key. The in-memory cache is updated synchronously; persistence is
 * asynchronous and verified by reading the pref back.
 */
export function setSecret(key: string, value: string, options: SecretWriteOptions = {}): void {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    cache.delete(key);
    sessionOnly.delete(key);
    needsReentry.delete(key);
    clearPref(key);
    return;
  }

  cache.set(key, trimmed);
  needsReentry.delete(key);

  if (options.sessionOnly) {
    sessionOnly.add(key);
    clearPref(key);
    return;
  }

  sessionOnly.delete(key);

  if (options.allowPlaintext) {
    writePref(key, trimmed);
    return;
  }

  const store = getOsKeyStore();
  if (!store) {
    // Never silently fall back to plaintext: keep this session only and let the
    // caller surface the problem.
    sessionOnly.add(key);
    clearPref(key);
    lastWriteError = new Error("OS key store unavailable");
    warn("keystore-unavailable");
    return;
  }

  const previous = readPref(key);
  const write = (async () => {
    try {
      const cipher = await store.encrypt(trimmed);
      const stored = typeof cipher === "string" ? cipher : String(cipher ?? "");
      if (!isEncryptedValue(stored)) throw new Error("OS key store returned an unprefixed value");
      writePref(key, stored);
      if (!isEncryptedValue(readPref(key))) {
        throw new Error("Encrypted key was not persisted");
      }
    } catch (error) {
      // Restore whatever was there before so a failed write cannot destroy a
      // working key.
      if (previous) writePref(key, previous);
      else clearPref(key);
      lastWriteError = error as Error;
      logError(error);
      warn("keystore-write-failed");
    }
  })();

  pendingWrites.add(write);
  void write.finally(() => pendingWrites.delete(write));
}

/** Remove a key from memory and from the profile. */
export function clearSecret(key: string): void {
  cache.delete(key);
  sessionOnly.delete(key);
  needsReentry.delete(key);
  clearPref(key);
}

/**
 * Encrypt legacy plaintext values in place. Idempotent: a second run sees the
 * `oskv1:` prefix and skips. Failures keep the plaintext value (translation
 * keeps working) and report once.
 */
export async function migratePlaintextSecrets(): Promise<void> {
  const store = getOsKeyStore();
  if (!store) return;

  for (const key of Object.values(SECRET_PREFS)) {
    const raw = readPref(key);
    if (!raw || isEncryptedValue(raw)) continue;

    try {
      const cipher = await store.encrypt(raw);
      const stored = typeof cipher === "string" ? cipher : String(cipher ?? "");
      if (!isEncryptedValue(stored)) throw new Error("OS key store returned an unprefixed value");
      writePref(key, stored);
      if (!isEncryptedValue(readPref(key))) throw new Error("Encrypted key was not persisted");
      cache.set(key, raw);
    } catch (error) {
      logError(error);
      if (!migrationFailedOnce) {
        migrationFailedOnce = true;
        warn("keystore-migrate-failed");
      }
    }
  }
}

/** One-shot read of the last write failure, for the settings pane. */
export function consumeSecretWriteError(): Error | null {
  const error = lastWriteError;
  lastWriteError = null;
  return error;
}
