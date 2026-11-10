// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — model-facing prompts for the reading assistant.
//
// These strings are sent to the selected provider, not rendered in the UI, so
// they intentionally follow the same Chinese instruction style as the
// translation prompts.

import type { ChatScope } from "../chatContext";

const SCOPE_LABELS: Record<ChatScope, string> = {
  selection: "选中段落",
  page: "当前页",
  document: "全文",
};

/** `targetLanguage` is a display name such as 简体中文, not a language code. */
export function buildChatSystemPrompt(
  targetLanguage: string,
  glossaryDirective: string,
): string {
  const lines = [
    "你是一名严谨的学术文献阅读助手。用户会提供文献片段（可能已截断），并针对它提问。",
    "",
    "要求：",
    `1. 默认用${targetLanguage}回答。`,
    "2. 优先依据提供的文献内容回答；引用原文时保持精确。",
    "3. 若上下文不足以回答，明确说明缺口，不要编造数据、引用或页码。",
    "4. 保留专业术语、公式、基因/蛋白/药物名称与文献引用编号。",
  ];

  if (glossaryDirective) {
    lines.push(
      "",
      "解释或翻译术语时，必须遵守下面的术语表：",
      "",
      glossaryDirective,
    );
  }

  return lines.join("\n");
}

/** Wrap the extracted document text in a message the model can ground on. */
export function buildChatContextBlock(
  scope: ChatScope,
  text: string,
  truncated: boolean,
): string {
  const parts = [
    `以下是文献内容（上下文范围：${SCOPE_LABELS[scope]}）。请基于这些内容回答用户接下来的问题。`,
    "",
    text,
  ];
  if (truncated) {
    parts.push("", "（注意：上下文超过长度限制，已截断；后面还有未提供的内容。）");
  }
  return parts.join("\n");
}
