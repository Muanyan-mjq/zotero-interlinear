// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — neutral prompts shared by LLM-backed providers.

const LANGUAGE_NAMES_ZH: Record<string, string> = {
  auto: "原文",
  en: "英文",
  "zh-CN": "简体中文",
  "zh-TW": "繁体中文",
  ja: "日文",
  ko: "韩文",
  fr: "法文",
  de: "德文",
  es: "西班牙文",
  ru: "俄文",
  pt: "葡萄牙文",
  it: "意大利文",
  ar: "阿拉伯文",
  hi: "印地文",
};

export function languageNameZh(code: string): string {
  return LANGUAGE_NAMES_ZH[code] || code;
}

export function buildLanguageDirective(source: string, target: string): string {
  return `源语言：${languageNameZh(source)}\n目标语言：${languageNameZh(target)}`;
}
