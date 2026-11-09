// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Translate for Zotero provider.

import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { isFailureText } from "../translationFailure";
import type { ProviderContext, ProviderTranslation } from "./types";

export async function requestPDFTranslate(
  text: string,
  context: ProviderContext,
): Promise<ProviderTranslation> {
  const pdfTranslate = (Zotero as any).PDFTranslate;
  if (!pdfTranslate?.api?.translate) {
    throw new Error(getString("provider-error-pdftranslate-missing"));
  }

  const task = await pdfTranslate.api.translate(text, {
    pluginID: config.addonID,
    itemID: context.itemID,
    // Translate for Zotero resolves the source language itself; only the
    // target is part of its public options surface.
    langto: context.targetLanguage,
  });
  const result = String(task?.result || "").trim();

  if (task?.status && task.status !== "success") {
    throw new Error(result || getString("provider-error-pdftranslate-task"));
  }
  if (!result || isFailureText(result)) {
    throw new Error(result || getString("provider-error-pdftranslate-empty"));
  }

  const actualService = String(task?.service || "").trim();
  return actualService ? { text: result, actualService } : { text: result };
}
