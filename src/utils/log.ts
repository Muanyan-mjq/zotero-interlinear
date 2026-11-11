// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — single entry point for error logging so credentials never reach
// Zotero's debug output or the error console.

import { redactError } from "./redact";

type SecretsProvider = () => Array<string | undefined>;

let secretsProvider: SecretsProvider = () => [];

/**
 * Register the keys currently held in memory. Called once from settings so the
 * logger does not import storage code (and so tests can leave it unset).
 */
export function setLogSecretsProvider(provider: SecretsProvider): void {
  secretsProvider = provider;
}

function currentSecrets(): Array<string | undefined> {
  try {
    return secretsProvider() || [];
  } catch (_) {
    return [];
  }
}

/** Redact before handing an error to Zotero. Never throws. */
export function logError(error: unknown): void {
  try {
    Zotero.logError(redactError(error, currentSecrets()));
  } catch (_) {
    // Logging must never break the caller.
  }
}

/** Redact text that is about to be shown in the UI. */
export function redactForDisplay(text: unknown): string {
  return redactError(text, currentSecrets()).message;
}
