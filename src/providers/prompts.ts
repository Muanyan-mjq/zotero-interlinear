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
  return [
    `源语言：${languageNameZh(source)}`,
    `目标语言：${languageNameZh(target)}`,
    "保留要求：",
    "- 公式（含 $...$、$$...$$、\\(...\\)、\\[...\\] 等 LaTeX 定界符）、行内代码、网址必须原样保留，不得翻译、改写或删除定界符。",
    "- ⟦IL0⟧ 这类形如“⟦IL数字⟧”的占位符代表已保护的内容，必须逐字保留、编号不变、位置不变；不得翻译、增删或调换顺序。",
    "- [[BRSEG_0000]] 这类分段标记必须逐字保留并保持顺序，不得翻译、删除或合并段落。",
    "- 数字、单位、参考文献编号与引用标记（如 [12]、(2020)、Fig. 3、Table 2）保持原样。",
  ].join("\n");
}
