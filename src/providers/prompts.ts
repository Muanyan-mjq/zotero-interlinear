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

/**
 * Domain-neutral replacement for the original biomedical prompt (upstream
 * PR #19). The marker rules are what keeps batched paragraphs aligned.
 */
export function buildOllamaSystemPrompt(source: string, target: string): string {
  return `你是学术论文翻译专家。把用户提供的${languageNameZh(source)}段落准确翻译为${languageNameZh(target)}。

要求：
1. 只输出译文，不要解释、总结或添加原文没有的内容。
2. 保持学术语体，术语使用领域通行译法并前后一致。
3. 原样保留数字、单位、公式、变量、基因/蛋白/药物名称、文献引用和图表编号。
4. 若原文含 [[BRSEG_0000]] 这类分段标记，必须逐字保留并保持顺序，不得翻译、删除或合并段落。
5. 被标记分隔的段落逐段翻译，输出顺序与输入一致。`;
}
